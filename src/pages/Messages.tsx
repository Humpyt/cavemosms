import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarIcon,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Send,
  TimerReset,
  Users,
  SlidersHorizontal,
  Layers,
} from 'lucide-react';

import PullToRefresh from '@/components/PullToRefresh';
import { BatchListSkeleton } from '@/components/SkeletonLoaders';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [recipientDialogOpen, setRecipientDialogOpen] = useState(false);

  const {
    serviceStatus,
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
    setShowAdvanced(false);
  }

  return (
    <PullToRefresh onRefresh={processQueueNow}>
      <div className="px-5 pb-32 pt-8 min-h-screen bg-background">
        
        {/* Header Section */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('messages', lang)}</h1>
            <p className="text-sm text-muted-foreground mt-1">Ready to reach your audience.</p>
          </div>
          <button 
            onClick={() => void processQueueNow()} 
            className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center text-foreground hover:bg-secondary/80 transition-colors"
          >
            <TimerReset className="w-5 h-5" />
          </button>
        </div>

        {/* Status Pills */}
        <div className="flex gap-3 mb-8 overflow-x-auto no-scrollbar pb-2">
          {serviceStatus === 'unsupported' ? (
             <div className="px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap bg-destructive/10 text-destructive flex items-center gap-2">
               <AlertTriangle className="w-4 h-4" /> Unsupported Device
             </div>
          ) : !canSend ? (
            <button onClick={() => void requestSmsPermission()} className="px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap bg-warning/20 text-warning-foreground flex items-center gap-2">
              ⚠️ Grant SMS Permission
            </button>
          ) : (
            <div className="px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap bg-accent text-accent-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]"></span>
              Gateway Online
            </div>
          )}
          
          <div className="px-4 py-2.5 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold whitespace-nowrap flex gap-2 items-center">
            <Clock className="w-4 h-4" />
            {queuedCount} Queued
          </div>
        </div>

        {/* Compose Section (E-Commerce Product Card Style) */}
        <div className="bg-card rounded-[32px] p-5 mb-8 shadow-sm border border-border/50">
          <h2 className="text-lg font-bold mb-4 px-1">New Campaign</h2>
          
          {/* Step 1: Recipients */}
          <button 
            onClick={() => setRecipientDialogOpen(true)} 
            className="w-full flex items-center justify-between bg-background rounded-[24px] p-4 mb-3 border border-border/50 hover:border-border transition-colors"
          >
             <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary-foreground">
                 <Users className="w-6 h-6" />
               </div>
               <div className="text-left">
                 <p className="font-semibold text-[15px]">{selectedContacts.length > 0 ? `${selectedContacts.length} Recipients` : 'Select Recipients'}</p>
                 <p className="text-xs text-muted-foreground mt-0.5">
                   {optedOutCount > 0 && selectedContacts.length > 0 ? `${optedOutCount} opted out` : 'Tap to add contacts or groups'}
                 </p>
               </div>
             </div>
             <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>

          {/* Step 2: Message Body */}
          <div className="bg-background rounded-[24px] p-4 mb-4 border border-border/50 focus-within:border-primary/50 transition-colors">
            <Textarea 
               className="border-0 bg-transparent p-1 text-[15px] focus-visible:ring-0 resize-none min-h-[120px] placeholder:text-muted-foreground/60" 
               placeholder="Type your message here..."
               value={messageBody}
               onChange={e => setMessageBody(e.target.value)}
            />
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/50">
               <span className="text-xs font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-md">
                 {charCount} chars • {segmentCount} sms
               </span>
               <button 
                 onClick={() => setShowAdvanced(!showAdvanced)} 
                 className={`p-2 rounded-full transition-colors ${showAdvanced ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground'}`}
               >
                 <SlidersHorizontal className="w-4 h-4" />
               </button>
            </div>
          </div>

          {/* Advanced Options Slide-down */}
          <AnimatePresence initial={false}>
            {showAdvanced && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }} 
                className="overflow-hidden mb-4"
              >
                <div className="bg-background rounded-[24px] p-5 border border-border/50 space-y-5">
                  
                  {/* Templates */}
                  {safeTemplates.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" /> Quick Templates
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {safeTemplates.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => setMessageBody(template.body)}
                            className="shrink-0 rounded-full bg-secondary px-4 py-2 text-xs font-semibold transition-colors hover:bg-accent hover:text-accent-foreground"
                          >
                            {template.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Variables */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Variables</p>
                    <div className="flex flex-wrap gap-2">
                      {['name', 'phone', 'location'].map((placeholder) => (
                        <button
                          key={placeholder}
                          type="button"
                          onClick={() => insertPlaceholder(placeholder)}
                          className="rounded-full border border-border bg-transparent px-3 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                        >
                          +{placeholder}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scheduling */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Scheduling
                      </p>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start gap-3 rounded-xl h-12 bg-transparent border-border hover:bg-secondary">
                          <CalendarIcon className="h-4 w-4" />
                          <span className="text-sm">{scheduleDate ? format(scheduleDate, 'PPp') : 'Send Immediately'}</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-[24px] overflow-hidden" align="center">
                        <div className="flex flex-col bg-background">
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
                          <div className="flex items-center gap-3 px-4 pb-4 pt-2">
                            <label className="text-xs font-semibold text-muted-foreground">Time</label>
                            <Input
                              type="time"
                              className="h-9 w-full rounded-lg text-sm bg-secondary border-0"
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
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Send Button */}
          <div className="flex gap-2">
            {(messageBody || selectedContacts.length > 0 || scheduleDate) && (
              <button 
                onClick={clearComposer} 
                className="px-5 py-4 rounded-[20px] font-bold text-[15px] bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all"
              >
                Clear
              </button>
            )}
            <button 
              onClick={() => void handleSend()} 
              disabled={sendDisabled}
              className={`flex-1 py-4 rounded-[20px] font-bold text-[15px] flex justify-center items-center gap-2 transition-all shadow-sm ${
                sendDisabled ? 'bg-secondary text-muted-foreground opacity-70' : 'bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]'
              }`}
            >
              {scheduleInFuture ? <Clock className="w-5 h-5" /> : <Send className="w-5 h-5" />}
              {scheduleInFuture ? 'Schedule' : 'Send Campaign'}
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-lg font-bold">Recent Activity</h2>
            <span className="text-xs font-semibold text-primary cursor-pointer hover:underline">See All</span>
          </div>

          {isLoading ? (
            <BatchListSkeleton count={3} />
          ) : (
            <div className="space-y-3">
              {safeBatches.length === 0 ? (
                <div className="bg-card rounded-[24px] border border-dashed border-border/80 flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3">
                    <Send className="h-5 w-5 opacity-50" />
                  </div>
                  <p className="text-sm font-medium">No recent campaigns</p>
                </div>
              ) : (
                safeBatches.map((batch) => <BatchRow key={batch.id} batch={batch} lang={lang} />)
              )}
            </div>
          )}
        </section>

        {/* Recipients Dialog */}
        <Dialog open={recipientDialogOpen} onOpenChange={setRecipientDialogOpen}>
          <DialogContent className="max-h-[85vh] max-w-[95vw] sm:max-w-md rounded-[32px] p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-xl font-bold">{t('selectRecipients', lang)}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[50vh] pr-4">
              {safeGroups.length > 0 && (
                <div className="mb-6">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('groups', lang)}</p>
                  <div className="space-y-2">
                    {safeGroups.map((group) => (
                      <label key={group.id} className="flex cursor-pointer items-center gap-4 rounded-2xl p-3 bg-secondary/50 hover:bg-secondary transition-colors">
                        <Checkbox
                          className="w-5 h-5 rounded-md border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          checked={selectedGroupIds.includes(group.id!)}
                          onCheckedChange={(checked) => {
                            setSelectedGroupIds((previous) =>
                              checked ? [...previous, group.id!] : previous.filter((id) => id !== group.id!)
                            );
                          }}
                        />
                        <div className="h-4 w-4 rounded-full shadow-sm" style={{ backgroundColor: group.color }} />
                        <span className="text-[15px] font-semibold">{group.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('allContacts', lang)}</p>
              <div className="space-y-2">
                {activeContacts.map((contact) => (
                  <label key={contact.id} className="flex cursor-pointer items-center gap-4 rounded-2xl p-3 bg-secondary/50 hover:bg-secondary transition-colors">
                    <Checkbox
                      className="w-5 h-5 rounded-md border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      checked={selectedContactIds.includes(contact.id!)}
                      onCheckedChange={(checked) => {
                        setSelectedContactIds((previous) =>
                          checked ? [...previous, contact.id!] : previous.filter((id) => id !== contact.id!)
                        );
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">{contact.name}</p>
                      <p className="text-xs text-muted-foreground font-medium">{contact.phone}</p>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter className="gap-2 mt-6">
              <Button
                variant="outline"
                className="rounded-full h-12 font-semibold"
                onClick={() => {
                  setSelectedContactIds(activeContacts.map((contact) => contact.id!).filter(Boolean));
                  setSelectedGroupIds([]);
                }}
              >
                {t('selectAll', lang)}
              </Button>
              <Button className="rounded-full h-12 font-semibold px-8" onClick={() => setRecipientDialogOpen(false)}>{t('confirm', lang)}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PullToRefresh>
  );
}

function BatchRow({ batch, lang }: { batch: MessageBatch; lang: string }) {
  const statusColors: Record<string, string> = {
    completed: 'bg-success/20 text-success-foreground',
    sending: 'bg-primary/20 text-primary-foreground',
    pending: 'bg-secondary text-secondary-foreground',
    scheduled: 'bg-warning/20 text-warning-foreground',
  };

  return (
    <div className="bg-card rounded-[24px] p-4 border border-border/50 hover:border-border transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-foreground mb-1">{batch.body}</p>
          <p className="text-[11px] font-medium text-muted-foreground">{format(batch.createdAt, 'MMM d, h:mm a')}</p>
          <div className="mt-2 flex gap-3">
            <span className="text-[11px] font-bold text-success flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success"></span> {batch.sentCount} {t('sent', lang)}
            </span>
            {batch.failedCount > 0 && (
              <span className="text-[11px] font-bold text-destructive flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive"></span> {batch.failedCount} {t('failed', lang)}
              </span>
            )}
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${statusColors[batch.status]}`}>
          {t(batch.status, lang)}
        </div>
      </div>

      {batch.scheduledAt && (
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-1.5 text-[11px] font-bold text-warning">
          <Clock className="h-3.5 w-3.5" />
          {t('scheduledFor', lang)}: {format(batch.scheduledAt, 'MMM d, h:mm a')}
        </div>
      )}
    </div>
  );
}
