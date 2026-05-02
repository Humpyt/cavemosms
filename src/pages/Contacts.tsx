import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Download,
  Edit2,
  MapPin,
  Phone,
  Plus,
  Search,
  Tag,
  Trash2,
  Undo2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';

import ImportContactsDialog from '@/components/ImportContactsDialog';
import PullToRefresh from '@/components/PullToRefresh';
import SwipeToDelete from '@/components/SwipeToDelete';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/db';
import { normalizePhone, parseContactsFromCsv, type GroupCsvContact } from '@/lib/contactCsv';
import { t } from '@/lib/i18n';
import { GROUP_COLORS } from '@/lib/types';
import type { Contact, Group } from '@/lib/types';
import { addContactsToGroup, removeContactFromGroup as removeContactFromGroupService } from '@/services/groupMembership';

interface ContactsPageProps {
  lang: string;
}

export default function ContactsPage({ lang }: ContactsPageProps) {
  const [search, setSearch] = useState('');
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [activeTab, setActiveTab] = useState('contacts');
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formGroupIds, setFormGroupIds] = useState<number[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupColor, setGroupColor] = useState(GROUP_COLORS[0]);
  const [groupContactsDialogOpen, setGroupContactsDialogOpen] = useState(false);
  const [groupCsvDialogOpen, setGroupCsvDialogOpen] = useState(false);
  const [groupMembersDialogOpen, setGroupMembersDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupContactSearch, setGroupContactSearch] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [groupCsvText, setGroupCsvText] = useState('');
  const [groupCsvParsed, setGroupCsvParsed] = useState<GroupCsvContact[]>([]);

  const contactsQuery = useLiveQuery(() => db.contacts.toArray());
  const groupsQuery = useLiveQuery(() => db.groups.toArray());
  const contacts = useMemo(() => contactsQuery ?? [], [contactsQuery]);
  const groups = useMemo(() => groupsQuery ?? [], [groupsQuery]);

  const filtered = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(search.toLowerCase()) ||
      contact.phone.includes(search) ||
      contact.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
  );

  const totalActive = contacts.filter((contact) => !contact.optedOut).length;
  const optedOutCount = contacts.filter((contact) => contact.optedOut).length;

  function openNewContact() {
    setEditingContact(null);
    setFormName('');
    setFormPhone('');
    setFormLocation('');
    setFormTags('');
    setFormGroupIds([]);
    setContactDialogOpen(true);
  }

  function openEditContact(contact: Contact) {
    setEditingContact(contact);
    setFormName(contact.name);
    setFormPhone(contact.phone);
    setFormLocation(contact.location || '');
    setFormTags(contact.tags.join(', '));
    setFormGroupIds(contact.groupIds);
    setContactDialogOpen(true);
  }

  async function saveContact() {
    const tags = formTags
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const now = new Date();

    if (editingContact) {
      await db.contacts.update(editingContact.id!, {
        name: formName,
        phone: formPhone,
        location: formLocation,
        tags,
        groupIds: formGroupIds,
        updatedAt: now,
      });
    } else {
      await db.contacts.add({
        name: formName,
        phone: formPhone,
        location: formLocation,
        tags,
        groupIds: formGroupIds,
        optedOut: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    setContactDialogOpen(false);
  }

  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function deleteContact(id: number) {
    const contact = await db.contacts.get(id);
    if (!contact) return;

    await db.contacts.delete(id);

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

    const { dismiss } = toast({
      title: `${contact.name} deleted`,
      description: 'Tap undo to restore this contact.',
      action: (
        <button
          onClick={async () => {
            if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
            await db.contacts.add(contact);
            dismiss();
          }}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Undo2 className="h-3 w-3" />
          Undo
        </button>
      ),
    });

    undoTimerRef.current = setTimeout(() => {
      dismiss();
      undoTimerRef.current = null;
    }, 5000);
  }

  async function toggleOptOut(contact: Contact) {
    await db.contacts.update(contact.id!, { optedOut: !contact.optedOut, updatedAt: new Date() });
  }

  function openNewGroup() {
    setEditingGroup(null);
    setGroupName('');
    setGroupColor(GROUP_COLORS[0]);
    setGroupDialogOpen(true);
  }

  function openAddExistingToGroup(group: Group) {
    setSelectedGroup(group);
    setGroupContactSearch('');
    setSelectedContactIds([]);
    setGroupContactsDialogOpen(true);
  }

  function openCsvImportToGroup(group: Group) {
    setSelectedGroup(group);
    setGroupCsvText('');
    setGroupCsvParsed([]);
    setGroupCsvDialogOpen(true);
  }

  function openGroupMembers(group: Group) {
    setSelectedGroup(group);
    setGroupMembersDialogOpen(true);
  }

  async function addSelectedContactsToGroup() {
    if (!selectedGroup?.id || selectedContactIds.length === 0) return;

    const addedCount = await addContactsToGroup(selectedContactIds, selectedGroup.id);

    toast({
      title: 'Contacts added',
      description: `${addedCount} contact(s) added to ${selectedGroup.name}.`,
    });
    setGroupContactsDialogOpen(false);
  }

  async function parseGroupCsv() {
    const parsed = parseContactsFromCsv(groupCsvText);
    const existingPhones = new Set(contacts.map((contact) => normalizePhone(contact.phone)));
    const seenPhones = new Set<string>();

    for (const item of parsed) {
      if (!item.valid) continue;
      const normalized = normalizePhone(item.phone);
      if (existingPhones.has(normalized)) {
        item.duplicate = true;
        item.error = 'Already exists';
      } else if (seenPhones.has(normalized)) {
        item.duplicate = true;
        item.error = 'Duplicate in file';
      } else {
        seenPhones.add(normalized);
      }
    }

    setGroupCsvParsed(parsed);
  }

  async function importGroupCsvContacts() {
    if (!selectedGroup?.id) return;
    const importable = groupCsvParsed.filter((item) => item.valid && !item.duplicate);
    if (importable.length === 0) return;

    const now = new Date();
    await db.contacts.bulkAdd(
      importable.map((item) => ({
        name: item.name,
        phone: item.phone,
        location: item.location || '',
        tags: item.tags,
        groupIds: [selectedGroup.id!],
        optedOut: false,
        createdAt: now,
        updatedAt: now,
      }))
    );

    toast({
      title: 'CSV imported',
      description: `${importable.length} contact(s) imported to ${selectedGroup.name}.`,
    });
    setGroupCsvDialogOpen(false);
  }

  async function removeContactFromGroup(contactId: number, groupId: number) {
    await removeContactFromGroupService(contactId, groupId);
  }

  const selectableContacts = useMemo(() => {
    if (!selectedGroup?.id) return [];
    return contacts.filter(
      (contact) =>
        !contact.groupIds.includes(selectedGroup.id!) &&
        (contact.name.toLowerCase().includes(groupContactSearch.toLowerCase()) ||
          contact.phone.includes(groupContactSearch))
    );
  }, [contacts, groupContactSearch, selectedGroup]);

  const selectedGroupMembers = useMemo(() => {
    if (!selectedGroup?.id) return [];
    return contacts.filter((contact) => contact.groupIds.includes(selectedGroup.id!));
  }, [contacts, selectedGroup]);

  async function saveGroup() {
    if (editingGroup) {
      await db.groups.update(editingGroup.id!, { name: groupName, color: groupColor });
    } else {
      await db.groups.add({ name: groupName, color: groupColor, createdAt: new Date() });
    }

    setGroupDialogOpen(false);
  }

  async function deleteGroup(id: number) {
    await db.groups.delete(id);
    const contactsInGroup = await db.contacts.where('groupIds').equals(id).toArray();

    for (const contact of contactsInGroup) {
      await db.contacts.update(contact.id!, { groupIds: contact.groupIds.filter((groupId) => groupId !== id) });
    }
  }

  function exportCSV() {
    if (contacts.length === 0) return;

    const header = 'name,phone,location,tags';
    const rows = contacts.map((contact) => {
      const name = `"${contact.name.replace(/"/g, '""')}"`;
      const phone = `"${contact.phone.replace(/"/g, '""')}"`;
      const location = `"${(contact.location || '').replace(/"/g, '""')}"`;
      const tags = `"${contact.tags.join(';').replace(/"/g, '""')}"`;
      return `${name},${phone},${location},${tags}`;
    });

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PullToRefresh onRefresh={async () => await new Promise((resolve) => setTimeout(resolve, 600))}>
      <div className="px-4 pb-20 pt-2">
        <section className="mb-4 overflow-hidden rounded-[28px] border border-border bg-card px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Audience Desk
              </p>
              <h1 className="mt-1 text-2xl font-display font-bold">{t('contacts', lang)}</h1>
              <p className="mt-1 max-w-[18rem] text-sm text-muted-foreground">
                Import, segment, and maintain the audience behind every campaign.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className=""
                onClick={exportCSV}
                disabled={contacts.length === 0}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setImportDialogOpen(true)}
              >
                <Upload className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatPill label="Total" value={contacts.length} />
            <StatPill label="Active" value={totalActive} />
            <StatPill label="Opt-out" value={optedOutCount} tone="warning" />
          </div>
        </section>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('search', lang)}
            className="pl-9"
          />
        </div>

        <div className="mb-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={openNewGroup}
          >
            <Users className="h-4 w-4" />
            {t('createGroup', lang)}
          </Button>
          <Button size="sm" className="flex-1 gap-1.5" onClick={openNewContact}>
            <UserPlus className="h-4 w-4" />
            {t('addContact', lang)}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 grid w-full grid-cols-2 rounded-2xl bg-muted/50">
            <TabsTrigger value="contacts" className="rounded-xl">
              {t('allContacts', lang)}
            </TabsTrigger>
            <TabsTrigger value="groups" className="rounded-xl">
              {t('groups', lang)}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contacts">
            <div className="space-y-2">
              <AnimatePresence>
                {filtered.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <Users className="mx-auto mb-3 h-12 w-12 opacity-40" />
                      <p className="text-sm">{t('noContacts', lang)}</p>
                    </CardContent>
                  </Card>
                ) : (
                  filtered.map((contact) => (
                    <motion.div
                      key={contact.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    >
                      <SwipeToDelete onDelete={() => deleteContact(contact.id!)}>
                        <Card className={`overflow-hidden ${contact.optedOut ? 'opacity-60' : ''}`}>
                          <CardContent className="p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div
                                className="min-w-0 flex flex-1 items-center gap-2.5"
                                onClick={() => openEditContact(contact)}
                              >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[11px] font-semibold text-primary">
                                  {contact.name
                                    .split(' ')
                                    .slice(0, 2)
                                    .map((part) => part[0]?.toUpperCase() ?? '')
                                    .join('')}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <p className="truncate text-sm font-medium">{contact.name}</p>
                                    {contact.optedOut && (
                                      <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                                        {t('optedOut', lang)}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Phone className="h-3 w-3" />
                                    {contact.phone}
                                  </p>
                                  <div className="mt-1 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap pr-1">
                                    {contact.location && (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-secondary/45 px-2 py-0.5 text-[10px] text-muted-foreground">
                                        <MapPin className="h-2.5 w-2.5" />
                                        {contact.location}
                                      </span>
                                    )}
                                    {contact.tags.slice(0, 2).map((tag) => (
                                      <Badge
                                        key={tag}
                                        variant="secondary"
                                        className="inline-flex items-center gap-1 px-1.5 py-0 text-[10px]"
                                      >
                                        <Tag className="h-2.5 w-2.5" />
                                        {tag}
                                      </Badge>
                                    ))}
                                    {contact.tags.length > 2 && (
                                      <Badge
                                        variant="secondary"
                                        className="px-1.5 py-0 text-[10px]"
                                      >
                                        +{contact.tags.length - 2}
                                      </Badge>
                                    )}
                                    {!contact.location && contact.tags.length === 0 && (
                                      <span className="text-[10px] text-muted-foreground/80">No labels</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="ml-1 flex items-center gap-2">
                                <Switch checked={!contact.optedOut} onCheckedChange={() => toggleOptOut(contact)} />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </SwipeToDelete>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </TabsContent>

          <TabsContent value="groups">
            <div className="space-y-2">
              {groups.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Users className="mx-auto mb-3 h-12 w-12 opacity-40" />
                    <p className="text-sm">No groups yet</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={openNewGroup}
                    >
                      {t('createGroup', lang)}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                groups.map((group) => {
                  const memberCount = contacts.filter((contact) => contact.groupIds.includes(group.id!)).length;
                  return (
                    <Card key={group.id}>
                      <CardContent className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-4 w-4 rounded-full" style={{ backgroundColor: group.color }} />
                          <div>
                            <p className="text-sm font-medium">{group.name}</p>
                            <p className="text-xs text-muted-foreground">{memberCount} contacts</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openAddExistingToGroup(group)}
                            title="Add contacts"
                            aria-label="Add contacts"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openCsvImportToGroup(group)}
                            title="Import CSV"
                            aria-label="Import CSV"
                          >
                            <Upload className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingGroup(group);
                              setGroupName(group.name);
                              setGroupColor(group.color);
                              setGroupDialogOpen(true);
                            }}
                            title="Edit group"
                            aria-label="Edit group"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => deleteGroup(group.id!)}
                            title="Delete group"
                            aria-label="Delete group"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editingContact ? t('edit', lang) : t('addContact', lang)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder={t('name', lang)} value={formName} onChange={(event) => setFormName(event.target.value)} />
              <Input
                placeholder={t('phone', lang)}
                value={formPhone}
                onChange={(event) => setFormPhone(event.target.value)}
                type="tel"
              />
              <Input
                placeholder={t('location', lang)}
                value={formLocation}
                onChange={(event) => setFormLocation(event.target.value)}
              />
              <Input
                placeholder="Tags (comma separated)"
                value={formTags}
                onChange={(event) => setFormTags(event.target.value)}
              />

              {groups.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">{t('groups', lang)}</p>
                  <div className="flex flex-wrap gap-2">
                    {groups.map((group) => (
                      <button
                        key={group.id}
                        onClick={() => {
                          setFormGroupIds((previous) =>
                            previous.includes(group.id!)
                              ? previous.filter((id) => id !== group.id!)
                              : [...previous, group.id!]
                          );
                        }}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          formGroupIds.includes(group.id!)
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-secondary text-secondary-foreground'
                        }`}
                      >
                        {group.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              {editingContact && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    deleteContact(editingContact.id!);
                    setContactDialogOpen(false);
                  }}
                >
                  {t('delete', lang)}
                </Button>
              )}
              <Button onClick={saveContact} disabled={!formName.trim() || !formPhone.trim()}>
                {t('save', lang)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editingGroup ? t('edit', lang) : t('createGroup', lang)}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder={t('groupName', lang)}
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
              />
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Color</p>
                <div className="flex gap-2">
                  {GROUP_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setGroupColor(color)}
                      className={`h-8 w-8 rounded-full border-2 transition-all ${
                        groupColor === color ? 'scale-110 border-foreground' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={saveGroup} disabled={!groupName.trim()}>
                {t('save', lang)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={groupContactsDialogOpen} onOpenChange={setGroupContactsDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">
                Add contacts to {selectedGroup?.name || 'group'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Search contacts by name or phone"
                value={groupContactSearch}
                onChange={(event) => setGroupContactSearch(event.target.value)}
              />
              <ScrollArea className="h-[280px] rounded-lg border">
                <div className="p-2 space-y-1.5">
                  {selectableContacts.length === 0 ? (
                    <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                      No available contacts to add.
                    </p>
                  ) : (
                    selectableContacts.map((contact) => (
                      <label
                        key={contact.id}
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-border/70 bg-background/70 px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{contact.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{contact.phone}</p>
                        </div>
                        <Checkbox
                          checked={selectedContactIds.includes(contact.id!)}
                          onCheckedChange={(checked) => {
                            setSelectedContactIds((previous) =>
                              checked
                                ? [...previous, contact.id!]
                                : previous.filter((id) => id !== contact.id!)
                            );
                          }}
                        />
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
            <DialogFooter>
              <Button
                onClick={addSelectedContactsToGroup}
                disabled={selectedContactIds.length === 0}
              >
                Add {selectedContactIds.length} contact(s)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={groupCsvDialogOpen} onOpenChange={setGroupCsvDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">
                Import CSV to {selectedGroup?.name || 'group'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {groupCsvParsed.length === 0 ? (
                <>
                  <Input
                    type="file"
                    accept=".csv,.txt"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const text = await file.text();
                      setGroupCsvText(text);
                      event.target.value = '';
                    }}
                  />
                  <textarea
                    value={groupCsvText}
                    onChange={(event) => setGroupCsvText(event.target.value)}
                    placeholder="name,phone,location,tags&#10;John,+254700000001,Nairobi,lead;vip"
                    className="min-h-[180px] w-full rounded-xl border border-input bg-background px-3 py-2 text-xs"
                  />
                  <Button onClick={parseGroupCsv} disabled={!groupCsvText.trim()}>
                    Parse CSV
                  </Button>
                </>
              ) : (
                <>
                  <ScrollArea className="h-[260px] rounded-lg border">
                    <div className="space-y-1 p-2">
                      {groupCsvParsed.map((item, index) => (
                        <div
                          key={`${item.phone}-${index}`}
                          className={`rounded-md px-2 py-1.5 text-xs ${
                            item.duplicate ? 'bg-warning/10' : item.valid ? 'bg-secondary/50' : 'bg-destructive/10'
                          }`}
                        >
                          <span className="font-medium">{item.name || '-'}</span>
                          <span className="ml-2 text-muted-foreground">{item.phone || '-'}</span>
                          {item.error && <span className="ml-2 text-warning">{item.error}</span>}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setGroupCsvParsed([])}>
                      Back
                    </Button>
                    <Button
                      onClick={importGroupCsvContacts}
                      disabled={groupCsvParsed.filter((item) => item.valid && !item.duplicate).length === 0}
                    >
                      Import {groupCsvParsed.filter((item) => item.valid && !item.duplicate).length} contact(s)
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={groupMembersDialogOpen} onOpenChange={setGroupMembersDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">
                Manage {selectedGroup?.name || 'group'} members
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[320px] rounded-lg border">
              <div className="space-y-1.5 p-2">
                {selectedGroupMembers.length === 0 ? (
                  <p className="px-2 py-8 text-center text-xs text-muted-foreground">No members in this group yet.</p>
                ) : (
                  selectedGroupMembers.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between rounded-lg border border-border/70 bg-background/70 px-2.5 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{contact.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{contact.phone}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                        onClick={() => selectedGroup?.id && void removeContactFromGroup(contact.id!, selectedGroup.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <ImportContactsDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} lang={lang} />
      </div>
    </PullToRefresh>
  );
}

function StatPill({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'warning';
}) {
  const toneClass =
    tone === 'warning'
      ? 'border-warning/20 bg-warning/10 text-warning'
      : 'border-border bg-muted text-foreground';

  return (
    <div className={`rounded-2xl border px-3 py-2 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-current/80">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold">{value}</p>
    </div>
  );
}
