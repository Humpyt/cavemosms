import { db } from '@/lib/db';
import type { MessageBatch, MessageLog } from '@/lib/types';
import { NativeSms, type NativeSmsStatusEvent } from '@/plugins/nativeSms';

const TERMINAL_STATUSES: Array<MessageLog['status']> = ['sent', 'failed'];
const RETRY_BASE_DELAY_MS = 15_000;
const STALE_SENDING_TIMEOUT_MS = 120_000;

function isFutureDate(value: Date | undefined): boolean {
  return !!value && new Date(value).getTime() > Date.now();
}

function normalizeBatchStatus(batch: MessageBatch, logs: MessageLog[]): MessageBatch['status'] {
  if (batch.status === 'cancelled') {
    return 'cancelled';
  }

  if (batch.status === 'paused') {
    if (logs.length > 0 && logs.every((log) => TERMINAL_STATUSES.includes(log.status))) {
      return 'completed';
    }
    return 'paused';
  }

  if (logs.length === 0) {
    return isFutureDate(batch.scheduledAt) ? 'scheduled' : 'pending';
  }

  if (logs.every((log) => TERMINAL_STATUSES.includes(log.status))) {
    return 'completed';
  }

  if (isFutureDate(batch.scheduledAt) && logs.every((log) => log.status === 'pending')) {
    return 'scheduled';
  }

  if (logs.some((log) => log.status === 'sending')) {
    return 'sending';
  }

  return 'pending';
}

export async function getQueuedCount(): Promise<number> {
  const [batches, logs] = await Promise.all([
    db.batches.toArray(),
    db.messageLogs.where('status').equals('pending').toArray(),
  ]);
  const batchMap = new Map(batches.map((batch) => [batch.id!, batch]));

  return logs.filter((log) => {
    const batch = batchMap.get(log.batchId);
    return batch && batch.status !== 'completed';
  }).length;
}

export async function refreshBatchStatuses(batchIds?: number[]): Promise<void> {
  const [batches, logs] = await Promise.all([
    batchIds?.length ? db.batches.bulkGet(batchIds) : db.batches.toArray(),
    batchIds?.length ? db.messageLogs.where('batchId').anyOf(batchIds).toArray() : db.messageLogs.toArray(),
  ]);

  const logsByBatch = new Map<number, MessageLog[]>();
  for (const log of logs) {
    const existing = logsByBatch.get(log.batchId) || [];
    existing.push(log);
    logsByBatch.set(log.batchId, existing);
  }

  await Promise.all(
    batches
      .filter((batch): batch is MessageBatch => !!batch?.id)
      .map(async (batch) => {
        const batchLogs = logsByBatch.get(batch.id!) || [];
        const sentCount = batchLogs.filter((log) => log.status === 'sent').length;
        const failedCount = batchLogs.filter((log) => log.status === 'failed').length;
        const status = normalizeBatchStatus(batch, batchLogs);

        await db.batches.update(batch.id!, {
          status,
          sentCount,
          failedCount,
          completedAt: status === 'completed' ? batch.completedAt || new Date() : undefined,
        });
      })
  );
}

async function loadProcessContext() {
  const [batches, pendingLogs] = await Promise.all([
    db.batches.toArray(),
    db.messageLogs.where('status').equals('pending').toArray(),
  ]);

  return {
    batchMap: new Map(batches.map((batch) => [batch.id!, batch])),
    pendingLogs,
  };
}

function isDue(batch: MessageBatch | undefined): boolean {
  if (!batch) {
    return false;
  }

  return !isFutureDate(batch.scheduledAt);
}

function getRetryCount(log: MessageLog): number {
  return Math.max(0, log.retryCount ?? 0);
}

function computeRetryDelayMs(retryCount: number): number {
  return RETRY_BASE_DELAY_MS * Math.max(1, Math.min(8, 2 ** Math.max(0, retryCount - 1)));
}

function isRetryDue(log: MessageLog): boolean {
  if (!log.nextRetryAt) {
    return true;
  }
  return new Date(log.nextRetryAt).getTime() <= Date.now();
}

async function scheduleRetryOrFail(log: MessageLog, maxRetries: number, reason: string) {
  const retryCount = getRetryCount(log) + 1;
  const canRetry = retryCount <= Math.max(0, maxRetries);

  if (canRetry) {
    await db.messageLogs.update(log.id!, {
      status: 'pending',
      retryCount,
      nextRetryAt: new Date(Date.now() + computeRetryDelayMs(retryCount)),
      error: reason,
    });
    return;
  }

  await db.messageLogs.update(log.id!, {
    status: 'failed',
    retryCount,
    nextRetryAt: undefined,
    error: reason,
  });
}

async function recoverStaleSendingLogs(maxRetries: number): Promise<Set<number>> {
  const sendingLogs = await db.messageLogs.where('status').equals('sending').toArray();
  const affectedBatchIds = new Set<number>();

  for (const log of sendingLogs) {
    const attemptedAt = log.lastAttemptAt ? new Date(log.lastAttemptAt).getTime() : 0;
    if (!attemptedAt || Date.now() - attemptedAt < STALE_SENDING_TIMEOUT_MS) {
      continue;
    }

    affectedBatchIds.add(log.batchId);
    await scheduleRetryOrFail(log, maxRetries, 'Send confirmation timed out. Retrying.');
  }

  return affectedBatchIds;
}

export async function processNativeSmsQueue(
  sendDelayMs: number,
  subscriptionId: number | null,
  maxRetries: number
): Promise<{ affectedBatchIds: Set<number> }> {
  const staleAffectedBatchIds = await recoverStaleSendingLogs(maxRetries);
  const { batchMap, pendingLogs } = await loadProcessContext();
  const affectedBatchIds = new Set<number>(staleAffectedBatchIds);

  const dueLogs = pendingLogs
    .filter((log) => {
      const batch = batchMap.get(log.batchId);
      return (
        batch &&
        batch.status !== 'completed' &&
        batch.status !== 'cancelled' &&
        batch.status !== 'paused' &&
        isDue(batch) &&
        isRetryDue(log)
      );
    })
    .sort((left, right) => {
      if (left.batchId !== right.batchId) {
        return left.batchId - right.batchId;
      }

      return (left.id || 0) - (right.id || 0);
    });

  const minGapMs = Math.max(1000, sendDelayMs);
  let nextDueAt = Date.now();

  for (const log of dueLogs) {
    affectedBatchIds.add(log.batchId);

    try {
      const requestId = `log-${log.id}-${Date.now()}`;
      const retryCount = getRetryCount(log);
      const dueAt = Math.max(Date.now(), nextDueAt);
      nextDueAt = dueAt + minGapMs;

      await NativeSms.enqueueNativeQueue({
        requestId,
        logId: log.id,
        batchId: log.batchId,
        phoneNumber: log.contactPhone,
        message: log.body,
        subscriptionId: subscriptionId ?? undefined,
        dueAt,
        minGapMs,
        retryCount,
        maxRetries,
      });

      await db.messageLogs.update(log.id!, {
        status: 'sending',
        nativeRequestId: requestId,
        lastAttemptAt: new Date(),
        nextRetryAt: undefined,
        error: undefined,
      });
    } catch (error) {
      await scheduleRetryOrFail(
        log,
        maxRetries,
        error instanceof Error ? error.message : 'Native SMS send failed.'
      );
    }
  }

  if (dueLogs.length > 0) {
    try {
      await NativeSms.processNativeQueueNow({
        subscriptionId: subscriptionId ?? undefined,
        maxToProcess: 1,
      });
    } catch {
      // Native queue is persisted; it can be processed in a later cycle.
    }
  } else {
    try {
      const queueStats = await NativeSms.getNativeQueueStats();
      if (queueStats.due > 0) {
        await NativeSms.processNativeQueueNow({
          subscriptionId: subscriptionId ?? undefined,
          maxToProcess: 1,
        });
      }
    } catch {
      // Best effort processing only.
    }
  }

  if (affectedBatchIds.size > 0) {
    await refreshBatchStatuses(Array.from(affectedBatchIds));
  }

  return { affectedBatchIds };
}

export async function pauseBatch(batchId: number): Promise<void> {
  await NativeSms.removeBatchFromNativeQueue({ batchId });

  const logs = await db.messageLogs.where('batchId').equals(batchId).toArray();
  await Promise.all(
    logs
      .filter((log) => log.status === 'pending' || log.status === 'sending')
      .map((log) =>
        db.messageLogs.update(log.id!, {
          status: 'pending',
          nativeRequestId: undefined,
          nextRetryAt: undefined,
          error: 'Paused by user.',
        })
      )
  );

  await db.batches.update(batchId, {
    status: 'paused',
    completedAt: undefined,
  });
}

export async function resumeBatch(batchId: number): Promise<void> {
  const batch = await db.batches.get(batchId);
  const status: MessageBatch['status'] =
    batch?.scheduledAt && new Date(batch.scheduledAt).getTime() > Date.now() ? 'scheduled' : 'pending';

  await db.batches.update(batchId, {
    status,
    completedAt: undefined,
  });
}

export async function stopBatch(batchId: number): Promise<void> {
  await NativeSms.removeBatchFromNativeQueue({ batchId });

  const logs = await db.messageLogs.where('batchId').equals(batchId).toArray();
  await Promise.all(
    logs
      .filter((log) => log.status === 'pending' || log.status === 'sending')
      .map((log) =>
        db.messageLogs.update(log.id!, {
          status: 'failed',
          nativeRequestId: undefined,
          nextRetryAt: undefined,
          error: 'Cancelled by user.',
        })
      )
  );

  await db.batches.update(batchId, {
    status: 'cancelled',
    completedAt: new Date(),
  });
}

export async function handleNativeSmsStatusEvent(
  event: NativeSmsStatusEvent,
  maxRetries: number
): Promise<void> {
  let logId = event.logId;

  if (!logId && event.requestId) {
    const matchedLog = await db.messageLogs.where('nativeRequestId').equals(event.requestId).first();
    logId = matchedLog?.id;
  }

  if (!logId) {
    return;
  }

  const existingLog = await db.messageLogs.get(logId);
  if (!existingLog) {
    return;
  }

  if (event.status === 'failed') {
    await scheduleRetryOrFail(existingLog, maxRetries, event.error || 'SMS send failed.');
  } else {
    await db.messageLogs.update(logId, {
      status: event.status,
      error: undefined,
      sentAt: event.status === 'sent' ? new Date() : undefined,
      nextRetryAt: undefined,
    });
  }

  await refreshBatchStatuses([existingLog.batchId]);
}
