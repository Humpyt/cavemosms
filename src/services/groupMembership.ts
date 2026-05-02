import { db } from '@/lib/db';

export async function addContactsToGroup(contactIds: number[], groupId: number): Promise<number> {
  if (contactIds.length === 0) return 0;

  const now = new Date();
  let addedCount = 0;

  for (const contactId of contactIds) {
    const contact = await db.contacts.get(contactId);
    if (!contact) continue;
    if (contact.groupIds.includes(groupId)) continue;

    await db.contacts.update(contactId, {
      groupIds: [...contact.groupIds, groupId],
      updatedAt: now,
    });
    addedCount += 1;
  }

  return addedCount;
}

export async function removeContactFromGroup(contactId: number, groupId: number): Promise<boolean> {
  const contact = await db.contacts.get(contactId);
  if (!contact) return false;

  await db.contacts.update(contactId, {
    groupIds: contact.groupIds.filter((id) => id !== groupId),
    updatedAt: new Date(),
  });
  return true;
}
