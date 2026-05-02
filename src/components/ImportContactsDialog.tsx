import { useState, useRef } from 'react';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileText, ClipboardPaste, AlertCircle, CheckCircle2, Copy } from 'lucide-react';

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, '');
}

interface ImportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: string;
}

interface ParsedContact {
  name: string;
  phone: string;
  location?: string;
  tags: string[];
  valid: boolean;
  duplicate?: boolean;
  error?: string;
}

function isPhoneHeader(value: string): boolean {
  return [
    'phone',
    'phone number',
    'mobile',
    'telephone',
    'contact',
    'contacts',
    'number',
    'numbers',
  ].includes(value);
}

function parseCSVLine(line: string): string[] {
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

function parseContacts(text: string): ParsedContact[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const firstLine = lines[0].toLowerCase();
  const firstColumns = parseCSVLine(firstLine).map((header) => header.replace(/['"]/g, '').trim().toLowerCase());
  const knownHeaders = ['name', 'full name', 'phone', 'phone number', 'mobile', 'telephone', 'contact', 'contacts', 'number', 'numbers', 'location', 'city', 'address', 'tags', 'labels', 'categories'];
  const hasHeader = firstColumns.some((header) => knownHeaders.includes(header));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  let nameIdx = -1;
  let phoneIdx = -1;
  let locationIdx = -1;
  let tagsIdx = -1;
  let phoneOnlyMode = !hasHeader && parseCSVLine(lines[0]).length === 1;

  if (hasHeader) {
    firstColumns.forEach((normalized, index) => {
      if (normalized === 'name' || normalized === 'full name') nameIdx = index;
      else if (isPhoneHeader(normalized)) phoneIdx = index;
      else if (normalized === 'location' || normalized === 'city' || normalized === 'address') locationIdx = index;
      else if (normalized === 'tags' || normalized === 'labels' || normalized === 'categories') tagsIdx = index;
    });

    const phoneHeaders = firstColumns.filter((header) => isPhoneHeader(header));
    phoneOnlyMode = phoneHeaders.length > 0 && !firstColumns.includes('name') && firstColumns.length === 1;
  } else if (!phoneOnlyMode) {
    nameIdx = 0;
    phoneIdx = 1;
  }

  return dataLines.map((line): ParsedContact => {
    const columns = parseCSVLine(line);
    const phoneValue = phoneOnlyMode
      ? (columns[0] || '')
      : phoneIdx >= 0
        ? (columns[phoneIdx] || '')
        : '';
    const phone = phoneValue.replace(/^["']|["']$/g, '').trim();
    const nameValue = phoneOnlyMode
      ? phone
      : (((nameIdx >= 0 ? columns[nameIdx] : '') || '').replace(/^["']|["']$/g, '').trim() || phone);
    const name = nameValue.trim();
    const location = locationIdx >= 0 ? (columns[locationIdx] || '').replace(/^["']|["']$/g, '').trim() : '';
    const tagsRaw = tagsIdx >= 0 ? (columns[tagsIdx] || '').replace(/^["']|["']$/g, '').trim() : '';
    const tags = tagsRaw ? tagsRaw.split(';').map((tag) => tag.trim()).filter(Boolean) : [];

    if (!phone) {
      return { name, phone, location, tags, valid: false, error: 'Missing phone' };
    }

    return { name, phone, location, tags, valid: true };
  });
}

const SAMPLE_CSV = `name,phone,location,tags
John Doe,+1 555-1234,New York,client;vip
Jane Smith,+1 555-5678,Chicago,lead
Bob Wilson,+1 555-9012,Miami,`;

const SAMPLE_PHONE_ONLY_CSV = `phone
+1 555-1234
+1 555-5678
+1 555-9012`;

export default function ImportContactsDialog({ open, onOpenChange }: ImportContactsDialogProps) {
  const [tab, setTab] = useState<string>('paste');
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState<ParsedContact[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setPasteText('');
    setParsed([]);
    setImporting(false);
    setDone(false);
    setImportedCount(0);
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  async function handleParse() {
    const results = parseContacts(pasteText);
    const existing = await db.contacts.toArray();
    const existingPhones = new Set(existing.map((contact) => normalizePhone(contact.phone)));
    const seenPhones = new Set<string>();

    for (const contact of results) {
      if (!contact.valid) continue;

      const normalizedPhone = normalizePhone(contact.phone);
      if (existingPhones.has(normalizedPhone)) {
        contact.duplicate = true;
        contact.error = 'Already exists';
      } else if (seenPhones.has(normalizedPhone)) {
        contact.duplicate = true;
        contact.error = 'Duplicate in file';
      } else {
        seenPhones.add(normalizedPhone);
      }
    }

    setParsed(results);
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const text = String(loadEvent.target?.result || '');
      setPasteText(text);
      setParsed(parseContacts(text));
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  async function handleImport() {
    const validContacts = parsed.filter((contact) => contact.valid && !contact.duplicate);
    if (validContacts.length === 0) return;

    setImporting(true);
    const now = new Date();

    await db.contacts.bulkAdd(
      validContacts.map((contact) => ({
        name: contact.name,
        phone: contact.phone,
        location: contact.location || '',
        tags: contact.tags,
        groupIds: [] as number[],
        optedOut: false,
        createdAt: now,
        updatedAt: now,
      }))
    );

    setImportedCount(validContacts.length);
    setDone(true);
    setImporting(false);
  }

  const importableCount = parsed.filter((contact) => contact.valid && !contact.duplicate).length;
  const duplicateCount = parsed.filter((contact) => contact.duplicate).length;
  const invalidCount = parsed.filter((contact) => !contact.valid && !contact.duplicate).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display">Import Contacts</DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 mx-auto text-success" />
            <p className="text-sm font-medium">{importedCount} contacts imported successfully!</p>
            <Button variant="outline" onClick={() => handleClose(false)}>Done</Button>
          </div>
        ) : parsed.length > 0 ? (
          <div className="flex-1 min-h-0 space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="w-3 h-3 text-success" />
                {importableCount} new
              </Badge>
              {duplicateCount > 0 && (
                <Badge variant="secondary" className="gap-1 bg-warning/10 text-warning">
                  <Copy className="w-3 h-3" />
                  {duplicateCount} duplicates
                </Badge>
              )}
              {invalidCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {invalidCount} invalid
                </Badge>
              )}
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-2 space-y-1">
                {parsed.map((contact, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-2 rounded text-xs ${
                      contact.duplicate ? 'bg-warning/10' : contact.valid ? 'bg-secondary/50' : 'bg-destructive/10'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{contact.name || '-'}</span>
                      <span className="text-muted-foreground ml-2">{contact.phone || '-'}</span>
                      {contact.location && (
                        <span className="text-muted-foreground ml-2">Location: {contact.location}</span>
                      )}
                    </div>
                    {contact.error && (
                      <span
                        className={`text-[10px] ml-2 shrink-0 ${
                          contact.duplicate ? 'text-warning' : 'text-destructive'
                        }`}
                      >
                        {contact.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setParsed([])}>Back</Button>
              <Button onClick={handleImport} disabled={importableCount === 0 || importing}>
                {importing ? 'Importing...' : `Import ${importableCount} contacts`}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full">
                <TabsTrigger value="paste" className="flex-1 gap-1.5">
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  Paste
                </TabsTrigger>
                <TabsTrigger value="file" className="flex-1 gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  CSV File
                </TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Paste any CSV subset using known headers. Phone is the only required field.
                </p>
                <Textarea
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                  placeholder={`${SAMPLE_CSV}\n\n${SAMPLE_PHONE_ONLY_CSV}`}
                  rows={8}
                  className="font-mono text-xs"
                />
              </TabsContent>

              <TabsContent value="file" className="space-y-3">
                <Card
                  className="border-dashed cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <CardContent className="py-8 text-center">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to select a CSV file</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Supports .csv and .txt files</p>
                  </CardContent>
                </Card>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                {pasteText && (
                  <p className="text-xs text-muted-foreground">
                    File loaded. {pasteText.split('\n').filter(Boolean).length} lines detected.
                  </p>
                )}
              </TabsContent>
            </Tabs>

            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-[10px] font-medium text-muted-foreground mb-1">Expected format:</p>
              <pre className="text-[10px] text-muted-foreground font-mono whitespace-pre-wrap">{`${SAMPLE_CSV}\n\nOr phone only:\n${SAMPLE_PHONE_ONLY_CSV}\n\nAlso valid:\nphone,tags\n+254700000001,lead;vip\n+254700000002,staff`}</pre>
            </div>

            <DialogFooter>
              <Button onClick={handleParse} disabled={!pasteText.trim()}>
                Parse Contacts
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
