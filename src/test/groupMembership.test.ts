import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockContact {
  id: number;
  groupIds: number[];
  updatedAt: Date;
}

const state: { contacts: MockContact[] } = { contacts: [] };

function setContacts(contacts: MockContact[]) {
  state.contacts = contacts.map((contact) => ({ ...contact, groupIds: [...contact.groupIds] }));
}

function findContact(id: number): MockContact | undefined {
  return state.contacts.find((contact) => contact.id === id);
}

vi.mock('@/lib/db', () => ({
  db: {
    contacts: {
      get: async (id: number) => findContact(id),
      update: async (id: number, updates: Partial<MockContact>) => {
        const existing = findContact(id);
        if (!existing) return;
        Object.assign(existing, updates);
      },
    },
  },
}));

import { addContactsToGroup, removeContactFromGroup } from '@/services/groupMembership';

describe('groupMembership service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setContacts([]);
  });

  it('adds group membership only for eligible contacts', async () => {
    setContacts([
      { id: 1, groupIds: [], updatedAt: new Date('2026-01-01T00:00:00.000Z') },
      { id: 2, groupIds: [99], updatedAt: new Date('2026-01-01T00:00:00.000Z') },
    ]);

    const addedCount = await addContactsToGroup([1, 2, 3], 99);

    expect(addedCount).toBe(1);
    expect(findContact(1)?.groupIds).toEqual([99]);
    expect(findContact(2)?.groupIds).toEqual([99]);
  });

  it('removes membership from existing contact and skips missing contact', async () => {
    setContacts([
      { id: 1, groupIds: [7, 9], updatedAt: new Date('2026-01-01T00:00:00.000Z') },
    ]);

    const removed = await removeContactFromGroup(1, 9);
    const missing = await removeContactFromGroup(2, 9);

    expect(removed).toBe(true);
    expect(missing).toBe(false);
    expect(findContact(1)?.groupIds).toEqual([7]);
  });
});
