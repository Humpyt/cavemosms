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
import { addContactsToGroup } from '@/services/groupMembership';

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
  const [groupDeleteDialogOpen, setGroupDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
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

  const selectableContacts = useMemo(() => {
    if (!selectedGroup?.id) return [];
    return contacts.filter(
      (contact) =>
        !contact.groupIds.includes(selectedGroup.id!) &&
        (contact.name.toLowerCase().includes(groupContactSearch.toLowerCase()) ||
          contact.phone.includes(groupContactSearch))
    );
  }, [contacts, groupContactSearch, selectedGroup]);

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

  function openDeleteGroupDialog(group: Group) {
    setGroupToDelete(group);
    setGroupDeleteDialogOpen(true);
  }

  async function confirmDeleteGroup() {
    if (!groupToDelete?.id || deletingGroup) return;
    setDeletingGroup(true);
    try {
      await deleteGroup(groupToDelete.id);
      toast({
        title: 'Group deleted',
        description: `${groupToDelete.name} was deleted.`,
      });
      setGroupDeleteDialogOpen(false);
      setGroupToDelete(null);
    } finally {
      setDeletingGroup(false);
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
      <div className="px-5 pb-32 pt-8 min-h-screen bg-background">
        
        {/* Header Section */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('contacts', lang)}</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your audience.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={exportCSV} 
              disabled={contacts.length === 0}
              className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
            >
              <Download className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setImportDialogOpen(true)}
              className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Upload className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3 mb-6 overflow-x-auto no-scrollbar pb-2">
           <div className="px-4 py-2.5 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold whitespace-nowrap">
             <span className="text-primary mr-1">•</span> {contacts.length} Total
           </div>
           <div className="px-4 py-2.5 rounded-full bg-success/20 text-success-foreground text-xs font-semibold whitespace-nowrap">
             {totalActive} Active
           </div>
           {optedOutCount > 0 && (
             <div className="px-4 py-2.5 rounded-full bg-destructive/10 text-destructive text-xs font-semibold whitespace-nowrap">
               {optedOutCount} Opted Out
             </div>
           )}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('search', lang)}
            className="pl-11 h-14 rounded-full bg-secondary border-0 text-[15px] focus-visible:ring-1 focus-visible:ring-primary shadow-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={openNewGroup}
            className="flex-1 py-4 rounded-[20px] bg-secondary text-secondary-foreground font-bold text-[14px] flex items-center justify-center gap-2 hover:bg-secondary/80 transition-colors"
          >
            <Users className="w-4 h-4" />
            {t('createGroup', lang)}
          </button>
          <button
            onClick={openNewContact}
            className="flex-1 py-4 rounded-[20px] bg-accent text-accent-foreground font-bold text-[14px] flex items-center justify-center gap-2 hover:bg-accent/90 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            {t('addContact', lang)}
          </button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 grid w-full grid-cols-2 rounded-full bg-secondary p-1.5 h-14">
            <TabsTrigger value="contacts" className="rounded-full text-sm font-semibold h-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              {t('allContacts', lang)}
            </TabsTrigger>
            <TabsTrigger value="groups" className="rounded-full text-sm font-semibold h-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
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
                        <div className={`overflow-hidden bg-card rounded-[24px] border border-border/50 mb-3 hover:border-border transition-colors ${contact.optedOut ? 'opacity-60' : ''}`}>
                          <div className="p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div
                                className="min-w-0 flex flex-1 items-center gap-3"
                                onClick={() => openEditContact(contact)}
                              >
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-primary/20 text-[14px] font-bold text-primary">
                                  {contact.name
                                    .split(' ')
                                    .slice(0, 2)
                                    .map((part) => part[0]?.toUpperCase() ?? '')
                                    .join('')}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate text-[15px] font-bold text-foreground">{contact.name}</p>
                                    {contact.optedOut && (
                                      <Badge variant="destructive" className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wide">
                                        {t('optedOut', lang)}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                                    <Phone className="h-3.5 w-3.5" />
                                    {contact.phone}
                                  </p>
                                  <div className="mt-2 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap pr-1 no-scrollbar">
                                    {contact.location && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold text-secondary-foreground">
                                        <MapPin className="h-3 w-3" />
                                        {contact.location}
                                      </span>
                                    )}
                                    {contact.tags.slice(0, 2).map((tag) => (
                                      <Badge
                                        key={tag}
                                        variant="secondary"
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] bg-secondary text-secondary-foreground"
                                      >
                                        <Tag className="h-3 w-3" />
                                        {tag}
                                      </Badge>
                                    ))}
                                    {contact.tags.length > 2 && (
                                      <Badge
                                        variant="secondary"
                                        className="px-2.5 py-1 text-[10px] bg-secondary"
                                      >
                                        +{contact.tags.length - 2}
                                      </Badge>
                                    )}
                                    {!contact.location && contact.tags.length === 0 && (
                                      <span className="text-[10px] font-medium text-muted-foreground/80">No labels</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="ml-1 flex items-center shrink-0">
                                <Switch checked={!contact.optedOut} onCheckedChange={() => toggleOptOut(contact)} />
                              </div>
                            </div>
                          </div>
                        </div>
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
                    <div key={group.id} className="bg-card rounded-[24px] border border-border/50 hover:border-border transition-colors mb-3">
                      <div className="flex flex-col p-4">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="h-12 w-12 rounded-[18px] flex items-center justify-center" style={{ backgroundColor: `${group.color}20`, color: group.color }}>
                             <Users className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[16px] font-bold text-foreground truncate">{group.name}</p>
                            <p className="text-xs font-semibold text-muted-foreground mt-0.5">{memberCount} contacts</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="flex-1 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-secondary/80 transition-colors"
                            onClick={() => openAddExistingToGroup(group)}
                          >
                            <Plus className="h-3.5 w-3.5" /> Add
                          </button>
                          <button
                            className="flex-1 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-secondary/80 transition-colors"
                            onClick={() => openCsvImportToGroup(group)}
                          >
                            <Upload className="h-3.5 w-3.5" /> CSV
                          </button>
                          <button
                            className="w-10 h-10 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-secondary/80 transition-colors"
                            onClick={() => {
                              setEditingGroup(group);
                              setGroupName(group.name);
                              setGroupColor(group.color);
                              setGroupDialogOpen(true);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors"
                            onClick={() => openDeleteGroupDialog(group)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
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
                  {groupCsvText && (
                    <p className="text-xs text-muted-foreground">
                      File loaded. {groupCsvText.split('\n').filter(Boolean).length} lines detected.
                    </p>
                  )}
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

        <Dialog
          open={groupDeleteDialogOpen}
          onOpenChange={(open) => {
            if (!deletingGroup) {
              setGroupDeleteDialogOpen(open);
              if (!open) setGroupToDelete(null);
            }
          }}
        >
          <DialogContent className="max-w-[95vw] sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display">Delete group?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {groupToDelete
                ? `Delete "${groupToDelete.name}"? Contacts will remain, but they will be removed from this group.`
                : 'Delete this group?'}
            </p>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setGroupDeleteDialogOpen(false);
                  setGroupToDelete(null);
                }}
                disabled={deletingGroup}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDeleteGroup} disabled={deletingGroup}>
                {deletingGroup ? 'Deleting...' : 'Delete Group'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ImportContactsDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} lang={lang} />
      </div>
    </PullToRefresh>
  );
}
