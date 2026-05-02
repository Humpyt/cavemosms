import Dexie, { type EntityTable } from 'dexie';
import type { Contact, Group, MessageTemplate, MessageBatch, MessageLog, AppSettings } from './types';

const db = new Dexie('BulkSMSApp') as Dexie & {
  contacts: EntityTable<Contact, 'id'>;
  groups: EntityTable<Group, 'id'>;
  templates: EntityTable<MessageTemplate, 'id'>;
  batches: EntityTable<MessageBatch, 'id'>;
  messageLogs: EntityTable<MessageLog, 'id'>;
  settings: EntityTable<AppSettings, 'id'>;
};

db.version(1).stores({
  contacts: '++id, name, phone, *tags, *groupIds, optedOut',
  groups: '++id, name',
  templates: '++id, name',
  batches: '++id, status, scheduledAt, createdAt',
  messageLogs: '++id, batchId, contactId, status, gatewayMessageId',
  settings: '++id',
});

db.version(2)
  .stores({
    contacts: '++id, name, phone, *tags, *groupIds, optedOut',
    groups: '++id, name',
    templates: '++id, name',
    batches: '++id, status, scheduledAt, createdAt',
    messageLogs: '++id, batchId, contactId, status, nativeRequestId',
    settings: '++id',
  })
  .upgrade(async (tx) => {
    await tx.table('messageLogs').toCollection().modify((log: Record<string, unknown>) => {
      if (log.nativeRequestId === undefined && typeof log.gatewayMessageId === 'string') {
        log.nativeRequestId = log.gatewayMessageId;
      }
      delete log.gatewayMessageId;
    });

    await tx.table('settings').toCollection().modify((settings: Record<string, unknown>) => {
      if (settings.preferredSubscriptionId === undefined) {
        settings.preferredSubscriptionId = null;
      }
      delete settings.gatewayHost;
      delete settings.gatewayPort;
      delete settings.gatewayUsername;
      delete settings.gatewayPassword;
      delete settings.gatewayDeviceId;
    });
  });

db.version(3)
  .stores({
    contacts: '++id, name, phone, *tags, *groupIds, optedOut',
    groups: '++id, name',
    templates: '++id, name',
    batches: '++id, status, scheduledAt, createdAt',
    messageLogs: '++id, batchId, contactId, status, nativeRequestId, retryCount, nextRetryAt, lastAttemptAt',
    settings: '++id',
  })
  .upgrade(async (tx) => {
    await tx.table('messageLogs').toCollection().modify((log: Record<string, unknown>) => {
      if (log.retryCount === undefined) {
        log.retryCount = 0;
      }
      if (log.nextRetryAt === undefined) {
        log.nextRetryAt = null;
      }
      if (log.lastAttemptAt === undefined) {
        log.lastAttemptAt = null;
      }
    });
  });

function getDefaultSettings(): AppSettings {
  return {
    language: 'en',
    theme: 'system',
    sendDelay: 2000,
    maxRetries: 2,
    preferredSubscriptionId: null,
  };
}

export async function getSettings(): Promise<AppSettings> {
  const settings = await db.settings.toCollection().first();
  const defaults = getDefaultSettings();

  if (settings) {
    const merged = { ...defaults, ...settings };
    const keys = Object.keys(defaults) as Array<keyof AppSettings>;
    const hasMissingField = keys.some((key) => settings[key] === undefined);

    if (hasMissingField) {
      await db.settings.update(settings.id!, merged);
    }

    return merged;
  }

  await db.settings.add(defaults);
  return defaults;
}

export async function updateSettings(updates: Partial<AppSettings>) {
  const settings = await getSettings();
  await db.settings.update(settings.id!, updates);
}

export { db };
