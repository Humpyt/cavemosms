export interface GroupCsvContact {
  name: string;
  phone: string;
  location?: string;
  tags: string[];
  valid: boolean;
  duplicate?: boolean;
  error?: string;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, '');
}

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }

  result.push(current.trim());
  return result;
}

export function parseContactsFromCsv(text: string): GroupCsvContact[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const firstColumns = parseCSVLine(lines[0].toLowerCase()).map((header) => header.replace(/['"]/g, '').trim());
  const knownHeaders = ['name', 'full name', 'phone', 'phone number', 'mobile', 'location', 'city', 'address', 'tags', 'labels'];
  const hasHeader = firstColumns.some((header) => knownHeaders.includes(header));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  let nameIdx = 0;
  let phoneIdx = 1;
  let locationIdx = -1;
  let tagsIdx = -1;
  let phoneOnlyMode = !hasHeader && parseCSVLine(lines[0]).length === 1;

  if (hasHeader) {
    nameIdx = firstColumns.findIndex((header) => header === 'name' || header === 'full name');
    phoneIdx = firstColumns.findIndex((header) =>
      ['phone', 'phone number', 'mobile', 'telephone', 'contact', 'number'].includes(header)
    );
    locationIdx = firstColumns.findIndex((header) => ['location', 'city', 'address'].includes(header));
    tagsIdx = firstColumns.findIndex((header) => ['tags', 'labels', 'categories'].includes(header));
    phoneOnlyMode = phoneIdx >= 0 && nameIdx < 0 && firstColumns.length === 1;
  }

  return dataLines.map((line) => {
    const columns = parseCSVLine(line);
    const phone = phoneOnlyMode
      ? (columns[0] || '').replace(/^["']|["']$/g, '').trim()
      : (columns[phoneIdx] || '').replace(/^["']|["']$/g, '').trim();
    const name = phoneOnlyMode
      ? phone
      : ((nameIdx >= 0 ? columns[nameIdx] : '') || '').replace(/^["']|["']$/g, '').trim() || phone;
    const location = locationIdx >= 0 ? (columns[locationIdx] || '').replace(/^["']|["']$/g, '').trim() : '';
    const tagsRaw = tagsIdx >= 0 ? (columns[tagsIdx] || '').replace(/^["']|["']$/g, '').trim() : '';
    const tags = tagsRaw ? tagsRaw.split(';').map((tag) => tag.trim()).filter(Boolean) : [];

    if (!phone) {
      return { name, phone, location, tags, valid: false, error: 'Missing phone' };
    }

    return { name, phone, location, tags, valid: true };
  });
}
