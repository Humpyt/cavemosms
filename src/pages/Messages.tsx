import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarIcon,
  CheckCircle2,
  ChevronRight,
  Clock,
  Layers3,
  Send,
  TimerReset,
  Users,
} from 'lucide-react';

import PullToRefresh from '@/components/PullToRefresh';
import { BatchListSkeleton } from '@/components/SkeletonLoaders';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useNativeSms } from '@/hooks/useNativeSms';
import { db } from '@/lib/db';
import { t } from '@/lib/i18n';
import type { Contact, MessageBatch } from '@/lib/types';

interface MessagesPageProps {
  lang: string;
}

export default function MessagesPage({ lang }: MessagesPageProps) {
  const [messageBody, setMessageBody] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [recurringType, setRecurringType] = useState<string>('none');
  const [showSchedule, setShowSchedule] = useState(false);
  const [recipientDialogOpen, setRecipientDialogOpen] = useState(false);

  const {
    serviceStatus,
    capability,
    canSend,
    queuedCount,
    error,
    requestSmsPermission,
    processQueueNow,
  } = useNativeSms();

  const contactsQuery = useLiveQuery(() => db.contacts.toArray());
  const groupsQuery = useLiveQuery(() => db.groups.toArray());
  const batchesQuery = useLiveQuery(() => db.batches.orderBy('createdAt').reverse().limit(20).toArray());
  const templatesQuery = useLiveQuery(() => db.templates.toArray());

  const safeContacts = useMemo(() => contactsQuery ?? [], [contactsQuery]);
  const safeGroups = useMemo(() => groupsQuery ?? [], [groupsQuery]);
  const safeBatches = useMemo(() => batchesQuery ?? [], [batchesQuery]);
  const safeTemplates = useMemo(() => templatesQuery ?? [], [templatesQuery]);
  const isLoading = contactsQuery === undefined || batchesQuery === undefined;

  const activeContacts = safeContacts.filter((contact) => !contact.optedOut);
  const selectedContacts = activeContacts.filter((contact) => {
    if (selectedContactIds.includes(contact.id!)) return true;
    if (selectedGroupIds.some((groupId) => contact.groupIds.includes(groupId))) return true;
    return false;
  });

  const optedOutCount = safeContacts.filter((contact) => contact.optedOut).length;
  const charCount = messageBody.length;
  const segmentCount = Math.max(1, Math.ceil(charCount / 160));
  const scheduleInFuture = !!scheduleDate && scheduleDate.getTime() > Date.now();
  const sendDisabled = !messageBody.trim() || selectedContacts.length === 0 || !canSend;

  function insertPlaceholder(placeholder: string) {
    setMessageBody((previous) => previous + `{${placeholder}}`);
  }

  function resolveMessage(body: string, contact: Contact): string {
    return body
      .replace(/\{name\}/gi, contact.name)
      .replace(/\{phone\}/gi, contact.phone)
      .replace(/\{location\}/gi, contact.location || '');
  }

  async function handleSend() {
    if (sendDisabled) return;

    const now = new Date();
    const batchId = await db.batches.add({
      body: messageBody,
      recipientCount: selectedContacts.length,
      sentCount: 0,
      failedCount: 0,
      status: scheduleInFuture ? 'scheduled' : 'pending',
      scheduledAt: scheduleDate,
      recurringType: recurringType as MessageBatch['recurringType'],
      createdAt: now,
    });

    await db.messageLogs.bulkAdd(
      selectedContacts.map((contact) => ({
        batchId: batchId as number,
        contactId: contact.id!,
        contactName: contact.name,
        contactPhone: contact.phone,
        body: resolveMessage(messageBody, contact),
        status: 'pending' as const,
        retryCount: 0,
        nextRetryAt: undefined,
        lastAttemptAt: undefined,
      }))
    );

    await processQueueNow();
    clearComposer();
  }

  function clearComposer() {
    setMessageBody('');
    setSelectedContactIds([]);
    setSelectedGroupIds([]);
    setScheduleDate(undefined);
    setRecurringType('none');
    setShowSchedule(false);
  }

  return (
    <PullToRefresh onRefresh={processQueueNow}>
      <div className="px-4 pb-28 pt-4">
        <section className="mb-4 overflow-hidden rounded-[28px] border border-border bg-card px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Dispatch Center
              </p>
              <h2 className="mt-1 text-2xl font-display font-bold">{t('messages', lang)}</h2>
              <p className="mt-1 max-w-[18rem] text-sm text-muted-foreground">
                Compose campaigns and send directly from this Android phone.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void processQueueNow()}
            >
              <TimerReset className="h-4 w-4" />
              Sync
            </Button>
          </div>

          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
            <Badge className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] text-primary">
              Android native SMS
            </Badge>
            <Badge className="rounded-full border border-border bg-muted px-3 py-1 text-[10px] text-muted-foreground">
              {canSend ? 'Ready to send' : 'Permission needed'}
            </Badge>
            <Badge className="rounded-full border border-border bg-muted px-3 py-1 text-[10px] text-muted-foreground">
              {queuedCount} queued
            </Badge>
          </div>
        </section>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <InfoCard label="Recipients" value={selectedContacts.length} helper="selected" icon={Users} />
          <InfoCard label="Segments" value={segmentCount} helper={`${charCount} chars`} icon={Layers3} />
          <InfoCard
            label="Queue"
            value={queuedCount}
            helper={canSend ? 'ready' : 'blocked'}
            icon={canSend ? CheckCircle2 : AlertTriangle}
          />
        </div>

        <Card className="mb-5 overflow-hidden border-border">
          <CardHeader className="space-y-1 border-b border-border bg-muted/30 pb-4">
            <CardTitle className="text-base font-display">Compose Campaign</CardTitle>
            <p className="text-xs text-muted-foreground">
              Pick recipients, write your message, then send now or schedule it.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            {serviceStatus === 'unsupported' && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-3 text-xs text-destructive">
                This device does not expose Android SMS sending to the app.
              </div>
            )}

            {serviceStatus !== 'unsupported' && !canSend && (
              <div className="rounded-2xl border border-warning/30 bg-warning/10 px-3 py-3 text-xs text-warning">
                <p>Grant SMS permission before sending.</p>
                {error && <p className="mt-1 text-[11px]">{error}</p>}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2 h-8 text-[11px]"
                  onClick={() => void requestSmsPermission()}
                >
                  Allow SMS
                </Button>
              </div>
            )}

            {canSend && (
              <div className="rounded-2xl border border-success/30 bg-success/10 px-3 py-3 text-xs text-success">
                Native SMS ready{capability.model ? ` on ${capability.model}` : ''}.
              </div>
            )}

            <div className="space-y-2">
              <Button
                variant="outline"
                className="h-12 w-full justify-between rounded-2xl border-border bg-background/70"
                onClick={() => setRecipientDialogOpen(true)}
              >
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {selectedContacts.length > 0
                    ? `${selectedContacts.length} ${t('recipients', lang)}`
                    : t('selectRecipients', lang)}
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>

              {selectedContacts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedContacts.slice(0, 8).map((contact) => (
                    <Badge key={contact.id} variant="secondary" className="rounded-full px-2.5 py-1 text-[10px]">
                      {contact.name}
                    </Badge>
                  ))}
                  {selectedContacts.length > 8 && (
                    <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[10px]">
                      +{selectedContacts.length - 8} more
                    </Badge>
                  )}
                </div>
              )}

              {optedOutCount > 0 && selectedContacts.length > 0 && (
                <p className="flex items-center gap-1 text-xs text-warning">
                  <AlertTriangle className="h-3 w-3" />
                  {optedOutCount} {t('optOutNotice', lang)}
                </p>
              )}
            </div>

            <div>
              <Textarea
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                placeholder={t('messageBody', lang)}
                className="min-h-[180px] resize-none rounded-[1.35rem] border-border bg-background/75 px-4 py-3"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {charCount} {t('characters', lang)} · {segmentCount} {t('segments', lang)}
                </span>
                <div className="flex gap-1">
                  {['name', 'phone', 'location'].map((placeholder) => (
                    <button
                      key={placeholder}
                      type="button"
                      onClick={() => insertPlaceholder(placeholder)}
                      className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      {`{${placeholder}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {safeTemplates.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Saved Templates</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {safeTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setMessageBody(template.body)}
                      className="shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary hover:text-primary"
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-[1.4rem] border border-border/70 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Schedule</p>
                  <p className="text-xs text-muted-foreground">
                    {scheduleInFuture && scheduleDate
                      ? `Queued for ${format(scheduleDate, 'PPp')}`
                      : 'Send immediately or choose a time.'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setShowSchedule((value) => !value)}
                >
                  <Clock className="h-4 w-4" />
                  {showSchedule ? 'Hide' : t('schedule', lang)}
                </Button>
              </div>

              <AnimatePresence initial={false}>
                {showSchedule && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 pt-3">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start gap-2 rounded-xl"
                          >
                            <CalendarIcon className="h-4 w-4" />
                            {scheduleDate ? format(scheduleDate, 'PPp') : 'Pick date and time'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <div className="flex flex-col">
                            <Calendar
                              mode="single"
                              selected={scheduleDate}
                              onSelect={(day) => {
                                if (!day) return;
                                const previous = scheduleDate || new Date();
                                day.setHours(previous.getHours(), previous.getMinutes(), 0, 0);
                                setScheduleDate(new Date(day));
                              }}
                              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                              initialFocus
                            />
                            <div className="flex items-center gap-2 px-3 pb-3">
                              <label className="text-xs text-muted-foreground">Time</label>
                              <Input
                                type="time"
                                className="h-8 w-auto text-sm"
                                value={scheduleDate ? format(scheduleDate, 'HH:mm') : ''}
                                onChange={(event) => {
                                  const [hours, minutes] = event.target.value.split(':').map(Number);
                                  const nextDate = scheduleDate ? new Date(scheduleDate) : new Date();
                                  nextDate.setHours(hours, minutes, 0, 0);
                                  setScheduleDate(nextDate);
                                }}
                              />
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Select value={recurringType} onValueChange={setRecurringType}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={t('recurringType', lang)} />
                        </SelectTrigger>
                        <SelectContent>
                          {['none', 'daily', 'weekly', 'monthly'].map((option) => (
                            <SelectItem key={option} value={option}>
                              {t(option, lang)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={clearComposer}
              >
                Clear
              </Button>
              <Button
                onClick={() => void handleSend()}
                disabled={sendDisabled}
                className="flex-1 gap-1.5"
              >
                {scheduleInFuture ? <Clock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                {scheduleInFuture ? t('schedule', lang) : t('send', lang)}
              </Button>
            </div>
          </CardContent>
        </Card>

        <section>
          <div className="mb-3">
            <h3 className="text-sm font-display font-semibold">{t('recentBatches', lang)}</h3>
            <p className="text-xs text-muted-foreground">Latest campaign activity on this device.</p>
          </div>

          {isLoading ? (
            <BatchListSkeleton count={4} />
          ) : (
            <div className="space-y-3">
              {safeBatches.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <MessageSquareIcon className="mb-3 h-12 w-12 opacity-40" />
                    <p className="text-sm">{t('noMessages', lang)}</p>
                  </CardContent>
                </Card>
              ) : (
                safeBatches.map((batch) => <BatchCard key={batch.id} batch={batch} lang={lang} />)
              )}
            </div>
          )}
        </section>

        <Dialog open={recipientDialogOpen} onOpenChange={setRecipientDialogOpen}>
          <DialogContent className="max-h-[80vh] max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">{t('selectRecipients', lang)}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[50vh]">
              {safeGroups.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">{t('groups', lang)}</p>
                  <div className="space-y-2">
                    {safeGroups.map((group) => (
                      <label
                        key={group.id}
                        className="flex cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-secondary"
                      >
                        <Checkbox
                          checked={selectedGroupIds.includes(group.id!)}
                          onCheckedChange={(checked) => {
                            setSelectedGroupIds((previous) =>
                              checked ? [...previous, group.id!] : previous.filter((id) => id !== group.id!)
                            );
                          }}
                        />
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
                        <span className="text-sm font-medium">{group.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <p className="mb-2 text-xs font-medium text-muted-foreground">{t('allContacts', lang)}</p>
              <div className="space-y-1">
                {activeContacts.map((contact) => (
                  <label
                    key={contact.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-secondary"
                  >
                    <Checkbox
                      checked={selectedContactIds.includes(contact.id!)}
                      onCheckedChange={(checked) => {
                        setSelectedContactIds((previous) =>
                          checked ? [...previous, contact.id!] : previous.filter((id) => id !== contact.id!)
                        );
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{contact.name}</p>
                      <p className="text-xs text-muted-foreground">{contact.phone}</p>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedContactIds(activeContacts.map((contact) => contact.id!).filter(Boolean));
                  setSelectedGroupIds([]);
                }}
              >
                {t('selectAll', lang)}
              </Button>
              <Button onClick={() => setRecipientDialogOpen(false)}>{t('confirm', lang)}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PullToRefresh>
  );
}

function InfoCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  helper: string;
  icon: typeof Users;
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
          <div className="rounded-full bg-primary/10 p-1.5">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
        </div>
        <p className="text-lg font-display font-bold">{value}</p>
        <p className="text-[10px] text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

function MessageSquareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function BatchCard({ batch, lang }: { batch: MessageBatch; lang: string }) {
  const statusColors: Record<string, string> = {
    completed: 'bg-success/10 text-success border-success/20',
    sending: 'bg-primary/10 text-primary border-primary/20',
    pending: 'bg-muted text-muted-foreground border-border',
    scheduled: 'bg-warning/10 text-warning border-warning/20',
  };

  return (
    <Card className="overflow-hidden border-border/70">
      <CardContent className="p-4">
        <div className="mb-2 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{batch.body}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{format(batch.createdAt, 'PPp')}</p>
          </div>
          <Badge variant="secondary" className={`ml-2 shrink-0 border text-[10px] ${statusColors[batch.status]}`}>
            {t(batch.status, lang)}
          </Badge>
        </div>

        {batch.status === 'completed' && (
          <div className="mt-2 flex gap-4">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-success" />
              <span className="text-xs text-muted-foreground">
                {batch.sentCount} {t('sent', lang)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-destructive" />
              <span className="text-xs text-muted-foreground">
                {batch.failedCount} {t('failed', lang)}
              </span>
            </div>
          </div>
        )}

        {batch.scheduledAt && (
          <p className="mt-2 flex items-center gap-1 text-xs text-warning">
            <Clock className="h-3 w-3" />
            {t('scheduledFor', lang)}: {format(batch.scheduledAt, 'PPp')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
