import { describe, expect, it } from 'vitest';

import { normalizePhone, parseCSVLine, parseContactsFromCsv } from '@/lib/contactCsv';

describe('contactCsv', () => {
  it('normalizes phone formatting characters', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('5551234567');
  });

  it('parses csv lines with quoted commas', () => {
    expect(parseCSVLine('"Doe, Jane",+15551234567,Nairobi')).toEqual([
      'Doe, Jane',
      '+15551234567',
      'Nairobi',
    ]);
  });

  it('parses header-based contacts with location and tags', () => {
    const input = [
      'name,phone,location,tags',
      'Alice,+254700111222,Nairobi,VIP;East',
      'Bob,+254700333444,Mombasa,West',
    ].join('\n');

    expect(parseContactsFromCsv(input)).toEqual([
      {
        name: 'Alice',
        phone: '+254700111222',
        location: 'Nairobi',
        tags: ['VIP', 'East'],
        valid: true,
      },
      {
        name: 'Bob',
        phone: '+254700333444',
        location: 'Mombasa',
        tags: ['West'],
        valid: true,
      },
    ]);
  });

  it('supports phone-only csv and flags missing phones', () => {
    const input = ['+254700111222', '', '   ', '+254700333444'].join('\n');

    expect(parseContactsFromCsv(input)).toEqual([
      {
        name: '+254700111222',
        phone: '+254700111222',
        location: '',
        tags: [],
        valid: true,
      },
      {
        name: '+254700333444',
        phone: '+254700333444',
        location: '',
        tags: [],
        valid: true,
      },
    ]);
  });
});
