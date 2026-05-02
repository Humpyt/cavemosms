import { db } from './db';
import type { Contact, Group, MessageBatch, MessageLog } from './types';
import { GROUP_COLORS } from './types';

export async function seedDemoData() {
  const contactCount = await db.contacts.count();
  if (contactCount > 0) return; // Already seeded

  // Groups
  const groups: Omit<Group, 'id'>[] = [
    { name: 'Family', color: GROUP_COLORS[0], createdAt: new Date('2026-02-01') },
    { name: 'Clients', color: GROUP_COLORS[1], createdAt: new Date('2026-02-05') },
    { name: 'Team', color: GROUP_COLORS[2], createdAt: new Date('2026-02-10') },
    { name: 'VIP', color: GROUP_COLORS[4], createdAt: new Date('2026-02-15') },
    { name: 'Leads', color: GROUP_COLORS[3], createdAt: new Date('2026-02-20') },
  ];
  const groupIds = await db.groups.bulkAdd(groups, { allKeys: true });

  // Contacts
  const names = [
    ['Sofia Martinez', '+1 555-0101', 'New York', ['friend'], [groupIds[0]]],
    ['James Chen', '+1 555-0102', 'San Francisco', ['developer', 'priority'], [groupIds[2]]],
    ['Aisha Patel', '+1 555-0103', 'Chicago', ['client', 'enterprise'], [groupIds[1], groupIds[3]]],
    ['Marcus Johnson', '+1 555-0104', 'Austin', ['lead'], [groupIds[4]]],
    ['Elena Rodriguez', '+1 555-0105', 'Miami', ['family'], [groupIds[0]]],
    ['David Kim', '+1 555-0106', 'Seattle', ['developer'], [groupIds[2]]],
    ['Fatima Al-Hassan', '+1 555-0107', 'Denver', ['client'], [groupIds[1]]],
    ['Lucas Silva', '+1 555-0108', 'Portland', ['lead', 'warm'], [groupIds[4]]],
    ['Priya Sharma', '+1 555-0109', 'Boston', ['vip', 'client'], [groupIds[1], groupIds[3]]],
    ['Oliver Brown', '+1 555-0110', 'Phoenix', ['team'], [groupIds[2]]],
    ['Mei Lin', '+1 555-0111', 'Los Angeles', ['family'], [groupIds[0]]],
    ['Ahmed Hassan', '+1 555-0112', 'Houston', ['lead'], [groupIds[4]]],
    ['Sarah O\'Brien', '+1 555-0113', 'Philadelphia', ['client', 'enterprise'], [groupIds[1]]],
    ['Raj Kapoor', '+1 555-0114', 'Atlanta', ['developer', 'team'], [groupIds[2]]],
    ['Isabella Rossi', '+1 555-0115', 'Dallas', ['vip'], [groupIds[3]]],
    ['Chen Wei', '+1 555-0116', 'San Diego', ['lead', 'cold'], [groupIds[4]]],
    ['Emma Wilson', '+1 555-0117', 'Nashville', ['friend', 'family'], [groupIds[0]]],
    ['Yuki Tanaka', '+1 555-0118', 'Minneapolis', ['client'], [groupIds[1]]],
    ['Carlos Mendez', '+1 555-0119', 'Detroit', ['team'], [groupIds[2]]],
    ['Anna Kowalski', '+1 555-0120', 'Charlotte', ['lead', 'warm'], [groupIds[4]]],
    ['Mohammed Ali', '+1 555-0121', 'Las Vegas', ['client', 'vip'], [groupIds[1], groupIds[3]]],
    ['Grace Park', '+1 555-0122', 'Orlando', ['family'], [groupIds[0]]],
    ['Tom Anderson', '+1 555-0123', 'Columbus', ['team', 'developer'], [groupIds[2]]],
    ['Lina Johansson', '+1 555-0124', 'Indianapolis', ['lead'], [groupIds[4]]],
    ['Daniel Okafor', '+1 555-0125', 'San Jose', ['client'], [groupIds[1]]],
  ] as const;

  const now = new Date();
  const contacts: Omit<Contact, 'id'>[] = names.map(([name, phone, location, tags, gIds], i) => ({
    name: name as string,
    phone: phone as string,
    location: location as string,
    tags: [...tags] as string[],
    groupIds: [...gIds] as number[],
    optedOut: i === 7 || i === 16, // A couple opted out
    createdAt: new Date(now.getTime() - (25 - i) * 86400000),
    updatedAt: new Date(now.getTime() - (25 - i) * 86400000),
  }));
  const contactIds = await db.contacts.bulkAdd(contacts, { allKeys: true });

  // Templates
  await db.templates.bulkAdd([
    { name: 'Welcome', body: 'Hi {name}, welcome aboard! We\'re glad to have you from {location}.', placeholders: ['name', 'location'], createdAt: new Date('2026-02-10'), updatedAt: new Date('2026-02-10') },
    { name: 'Appointment Reminder', body: 'Hi {name}, just a reminder about your upcoming appointment. See you soon!', placeholders: ['name'], createdAt: new Date('2026-02-12'), updatedAt: new Date('2026-02-12') },
    { name: 'Promo Offer', body: 'Hey {name}! Exclusive 20% off just for you. Use code VIP20 at checkout.', placeholders: ['name'], createdAt: new Date('2026-02-15'), updatedAt: new Date('2026-02-15') },
    { name: 'Follow Up', body: 'Hi {name}, just checking in. Let me know if you have any questions!', placeholders: ['name'], createdAt: new Date('2026-02-18'), updatedAt: new Date('2026-02-18') },
    { name: 'Event Invite', body: '{name}, you\'re invited to our exclusive event in {location}. RSVP today!', placeholders: ['name', 'location'], createdAt: new Date('2026-02-20'), updatedAt: new Date('2026-02-20') },
  ]);

  // Message batches & logs (simulate history over the past 7 days)
  const batchDefs = [
    { body: 'Hi {name}, welcome aboard!', days: 6, recipientIds: contactIds.slice(0, 8), failIndexes: [3] },
    { body: 'Reminder: Meeting tomorrow at 10am', days: 5, recipientIds: contactIds.slice(8, 14), failIndexes: [] },
    { body: 'Hey {name}! 20% off just for you. Code: VIP20', days: 4, recipientIds: contactIds.slice(0, 5), failIndexes: [1] },
    { body: 'Team standup moved to 2pm today', days: 3, recipientIds: contactIds.slice(14, 20), failIndexes: [2, 4] },
    { body: 'Hi {name}, your invoice is ready. Check your email!', days: 2, recipientIds: contactIds.slice(5, 15), failIndexes: [0] },
    { body: 'Event this Saturday! Don\'t miss it, {name}.', days: 1, recipientIds: contactIds.slice(0, 12), failIndexes: [] },
    { body: 'Quick update: new features launching next week!', days: 0, recipientIds: contactIds.slice(10, 25), failIndexes: [3, 7] },
  ];

  for (const def of batchDefs) {
    const batchDate = new Date(now.getTime() - def.days * 86400000 + 36000000);
    const sentCount = def.recipientIds.length - def.failIndexes.length;
    const failedCount = def.failIndexes.length;

    const batchId = await db.batches.add({
      body: def.body,
      recipientCount: def.recipientIds.length,
      sentCount,
      failedCount,
      status: 'completed',
      createdAt: batchDate,
      completedAt: new Date(batchDate.getTime() + def.recipientIds.length * 2000),
    });

    const logs: Omit<MessageLog, 'id'>[] = def.recipientIds.map((cId, i) => {
      const c = contacts[contactIds.indexOf(cId)];
      const failed = def.failIndexes.includes(i);
      return {
        batchId: batchId as number,
        contactId: cId,
        contactName: c?.name || 'Unknown',
        contactPhone: c?.phone || '',
        body: def.body.replace('{name}', c?.name || ''),
        status: failed ? 'failed' : 'sent',
        sentAt: failed ? undefined : new Date(batchDate.getTime() + i * 2000),
        error: failed ? 'Delivery failed' : undefined,
      };
    });
    await db.messageLogs.bulkAdd(logs);
  }
}
