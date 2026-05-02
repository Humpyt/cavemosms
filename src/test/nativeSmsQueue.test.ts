import { beforeEach, describe, expect, it, vi } from 'vitest';

type BatchStatus = 'pending' | 'sending' | 'completed' | 'scheduled';
type LogStatus = 'pending' | 'sending' | 'sent' | 'failed';

interface MockBatch {
  id: number;
  status: BatchStatus;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
  completedAt?: Date;
  scheduledAt?: Date;
}

interface MockLog {
  id: number;
  batchId: number;
  contactId: number;
  contactName: string;
  contactPhone: string;
  body: string;
  status: LogStatus;
  retryCount?: number;
  nextRetryAt?: Date;
  lastAttemptAt?: Date;
  sentAt?: Date;
  error?: string;
  nativeRequestId?: string;
}

interface DbState {
  batches: MockBatch[];
  messageLogs: MockLog[];
}

const state: DbState = { batches: [], messageLogs: [] };

function cloneState(input: DbState): DbState {
  return {
    batches: input.batches.map((batch) => ({ ...batch })),
    messageLogs: input.messageLogs.map((log) => ({ ...log })),
  };
}

function setDbState(next: DbState) {
  const cloned = cloneState(next);
  state.batches = cloned.batches;
  state.messageLogs = cloned.messageLogs;
}

function updateById<T extends { id: number }>(items: T[], id: number, updates: Partial<T>) {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return;
  items[index] = { ...items[index], ...updates };
}

vi.mock('@/lib/db', () => {
  const db = {
    batches: {
      toArray: async () => state.batches,
      bulkGet: async (ids: number[]) => ids.map((id) => state.batches.find((batch) => batch.id === id)),
      update: async (id: number, updates: Partial<MockBatch>) => updateById(state.batches, id, updates),
    },
    messageLogs: {
      toArray: async () => state.messageLogs,
      get: async (id: number) => state.messageLogs.find((log) => log.id === id),
      update: async (id: number, updates: Partial<MockLog>) => updateById(state.messageLogs, id, updates),
      where: (field: string) => ({
        equals: (value: unknown) => ({
          toArray: async () => state.messageLogs.filter((log) => (log as Record<string, unknown>)[field] === value),
          first: async () => state.messageLogs.find((log) => (log as Record<string, unknown>)[field] === value),
        }),
        anyOf: (values: unknown[]) => ({
          toArray: async () =>
            state.messageLogs.filter((log) => values.includes((log as Record<string, unknown>)[field])),
        }),
      }),
    },
  };

  return { db, __setDbState: setDbState };
});

const nativeSmsMocks = vi.hoisted(() => ({
  enqueueNativeQueue: vi.fn(),
  processNativeQueueNow: vi.fn(),
}));

vi.mock('@/plugins/nativeSms', () => ({
  NativeSms: {
    enqueueNativeQueue: nativeSmsMocks.enqueueNativeQueue,
    processNativeQueueNow: nativeSmsMocks.processNativeQueueNow,
  },
}));

import { __setDbState } from '@/lib/db';
import { getQueuedCount, handleNativeSmsStatusEvent, processNativeSmsQueue } from '@/services/nativeSmsQueue';

describe('nativeSmsQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __setDbState({ batches: [], messageLogs: [] });
  });

  it('enqueues due pending logs and marks them as sending', async () => {
    __setDbState({
      batches: [
        {
          id: 1,
          status: 'pending',
          sentCount: 0,
          failedCount: 0,
          createdAt: new Date(),
        },
      ],
      messageLogs: [
        {
          id: 10,
          batchId: 1,
          contactId: 5,
          contactName: 'Alice',
          contactPhone: '+254700111222',
          body: 'Hello',
          status: 'pending',
          retryCount: 0,
        },
      ],
    });

    await processNativeSmsQueue(0, null, 2);

    expect(nativeSmsMocks.enqueueNativeQueue).toHaveBeenCalledTimes(1);
    expect(nativeSmsMocks.processNativeQueueNow).toHaveBeenCalledTimes(1);

    const queuedCount = await getQueuedCount();
    expect(queuedCount).toBe(0);
  });

  it('marks a log failed when enqueue throws and max retries is exceeded', async () => {
    nativeSmsMocks.enqueueNativeQueue.mockRejectedValueOnce(new Error('enqueue failed'));
    __setDbState({
      batches: [
        {
          id: 2,
          status: 'pending',
          sentCount: 0,
          failedCount: 0,
          createdAt: new Date(),
        },
      ],
      messageLogs: [
        {
          id: 20,
          batchId: 2,
          contactId: 7,
          contactName: 'Bob',
          contactPhone: '+254700333444',
          body: 'Hi',
          status: 'pending',
          retryCount: 0,
        },
      ],
    });

    await processNativeSmsQueue(0, null, 0);

    await expect(getQueuedCount()).resolves.toBe(0);
    expect(state.messageLogs[0].status).toBe('failed');
    expect(state.messageLogs[0].error).toBe('enqueue failed');
    expect(state.batches[0].status).toBe('completed');
    expect(state.batches[0].failedCount).toBe(1);
  });

  it('handles sent status events and completes batch when all logs are terminal', async () => {
    __setDbState({
      batches: [
        {
          id: 3,
          status: 'pending',
          sentCount: 0,
          failedCount: 0,
          createdAt: new Date(),
        },
      ],
      messageLogs: [
        {
          id: 31,
          batchId: 3,
          contactId: 1,
          contactName: 'Carol',
          contactPhone: '+254700000001',
          body: 'A',
          status: 'sending',
          nativeRequestId: 'req-1',
        },
        {
          id: 32,
          batchId: 3,
          contactId: 2,
          contactName: 'Dan',
          contactPhone: '+254700000002',
          body: 'B',
          status: 'failed',
        },
      ],
    });

    await handleNativeSmsStatusEvent({ requestId: 'req-1', status: 'sent' }, 2);

    expect(state.messageLogs.find((log) => log.id === 31)?.status).toBe('sent');
    expect(state.batches[0].status).toBe('completed');
    expect(state.batches[0].sentCount).toBe(1);
    expect(state.batches[0].failedCount).toBe(1);
  });

  it('keeps log pending and schedules retry when failed event has retries remaining', async () => {
    __setDbState({
      batches: [
        {
          id: 4,
          status: 'pending',
          sentCount: 0,
          failedCount: 0,
          createdAt: new Date(),
        },
      ],
      messageLogs: [
        {
          id: 41,
          batchId: 4,
          contactId: 4,
          contactName: 'Eve',
          contactPhone: '+254700000004',
          body: 'retry me',
          status: 'sending',
          retryCount: 0,
          nativeRequestId: 'req-retry',
        },
      ],
    });

    await handleNativeSmsStatusEvent({ requestId: 'req-retry', status: 'failed', error: 'modem busy' }, 2);

    const log = state.messageLogs.find((item) => item.id === 41);
    expect(log?.status).toBe('pending');
    expect(log?.retryCount).toBe(1);
    expect(log?.nextRetryAt).toBeInstanceOf(Date);
    expect(log?.error).toBe('modem busy');
    expect(state.batches[0].status).toBe('pending');
  });

  it('marks log failed when failed event exceeds retry budget', async () => {
    __setDbState({
      batches: [
        {
          id: 5,
          status: 'pending',
          sentCount: 0,
          failedCount: 0,
          createdAt: new Date(),
        },
      ],
      messageLogs: [
        {
          id: 51,
          batchId: 5,
          contactId: 5,
          contactName: 'Frank',
          contactPhone: '+254700000005',
          body: 'fail me',
          status: 'sending',
          retryCount: 2,
          nativeRequestId: 'req-fail',
        },
      ],
    });

    await handleNativeSmsStatusEvent({ requestId: 'req-fail', status: 'failed', error: 'permanent' }, 2);

    const log = state.messageLogs.find((item) => item.id === 51);
    expect(log?.status).toBe('failed');
    expect(log?.retryCount).toBe(3);
    expect(log?.nextRetryAt).toBeUndefined();
    expect(log?.error).toBe('permanent');
    expect(state.batches[0].status).toBe('completed');
    expect(state.batches[0].failedCount).toBe(1);
  });
});
