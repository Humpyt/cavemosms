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

export async function getSettings(): Promise<AppSettings> {
  const settings = await db.settings.toCollection().first();
  if (settings) return settings;
  const defaults: AppSettings = {
    language: 'en',
    theme: 'system',
    sendDelay: 2000,
    maxRetries: 2,
  };
  await db.settings.add(defaults);
  return defaults;
}

export async function updateSettings(updates: Partial<AppSettings>) {
  const settings = await getSettings();
  await db.settings.update(settings.id!, updates);
}

export { db };
