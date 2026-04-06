import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { Contact, Group, MessageBatch, MessageLog } from '@/lib/types';
import { useGateway } from '@/hooks/useGateway';
import { sendSms, getMessageStatus } from '@/services/gatewayClient';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Clock, Plus, Eye, Users, CalendarIcon, ChevronRight, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from '@/components/ThemeToggle';
import { BatchListSkeleton } from '@/components/SkeletonLoaders';
import PullToRefresh from '@/components/PullToRefresh';

interface MessagesPageProps {
  lang: string;
}

export default function MessagesPage({ lang }: MessagesPageProps) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [messageBody, setMessageBody] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [recurringType, setRecurringType] = useState<string>('none');
  const [showSchedule, setShowSchedule] = useState(false);
  const [recipientDialogOpen, setRecipientDialogOpen] = useState(false);

  const { status: gatewayStatus } = useGateway();

  const contacts = useLiveQuery(() => db.contacts.toArray());
  const groups = useLiveQuery(() => db.groups.toArray());
  const batches = useLiveQuery(() => db.batches.orderBy('createdAt').reverse().limit(20).toArray());
  const templates = useLiveQuery(() => db.templates.toArray());

  const isLoading = contacts === undefined || batches === undefined;

  const safeContacts = contacts || [];
  const safeGroups = groups || [];
  const safeBatches = batches || [];
  const safeTemplates = templates || [];

  const activeContacts = safeContacts.filter((c) => !c.optedOut);
  const optedOutCount = safeContacts.filter((c) => c.optedOut).length;

  const selectedContacts = activeContacts.filter((c) => {
    if (selectedContactIds.includes(c.id!)) return true;
    if (selectedGroupIds.some((gId) => c.groupIds.includes(gId))) return true;
    return false;
  });

  const charCount = messageBody.length;
  const segmentCount = Math.ceil(charCount / 160) || 0;

  function insertPlaceholder(placeholder: string) {
    setMessageBody((prev) => prev + `{${placeholder}}`);
  }

  function resolveMessage(body: string, contact: Contact): string {
    return body
      .replace(/\{name\}/gi, contact.name)
      .replace(/\{phone\}/gi, contact.phone)
      .replace(/\{location\}/gi, contact.location || '');
  }

  async function pollDeliveryStatus(batchId: number, baseUrl: string, credentials: { username: string; password: string }) {
    const POLL_INTERVAL = 3000;
    const MAX_POLLS = 100;
    let polls = 0;
    const interval = setInterval(async () => {
      polls++;
      const pendingLogs = await db.messageLogs.where({ batchId, status: 'sending' }).toArray();

      if (pendingLogs.length === 0 || polls >= MAX_POLLS) {
        clearInterval(interval);
        const finalLogs = await db.messageLogs.where({ batchId }).toArray();
        await db.batches.update(batchId, {
          status: 'completed',
          sentCount: finalLogs.filter((l) => l.status === 'sent').length,
          failedCount: finalLogs.filter((l) => l.status === 'failed').length,
          completedAt: new Date(),
        });
        return;
      }

      for (const log of pendingLogs) {
        if (!log.gatewayMessageId) continue;
        const msgStatus = await getMessageStatus(baseUrl, credentials, log.gatewayMessageId);
        if (msgStatus.status !== 'pending') {
          await db.messageLogs.update(log.id!, {
            status: msgStatus.status === 'sent' ? 'sent' : 'failed',
            error: msgStatus.error,
          });
        }
      }
    }, POLL_INTERVAL);
  }

  async function handleSend() {
    if (!messageBody.trim() || selectedContacts.length === 0) return;

    const batch: MessageBatch = {
      body: messageBody,
      recipientCount: selectedContacts.length,
      sentCount: 0,
      failedCount: 0,
      status: scheduleDate ? 'scheduled' : 'sending',
      scheduledAt: scheduleDate,
      recurringType: recurringType as any,
      createdAt: new Date(),
    };

    const batchId = await db.batches.add(batch);

    const logs: MessageLog[] = selectedContacts.map((contact) => ({
      batchId: batchId as number,
      contactId: contact.id!,
      contactName: contact.name,
      contactPhone: contact.phone,
      body: resolveMessage(messageBody, contact),
      status: scheduleDate ? 'pending' : 'sending',
    }));

    await db.messageLogs.bulkAdd(logs);

    // In a real Capacitor app, this would trigger native SMS sending
    // For now, simulate sending
    if (!scheduleDate) {
      if (gatewayStatus === 'online') {
        const savedGw = JSON.parse(localStorage.getItem('bulksms_gateway') || '{}');
        const baseUrl = `http://${savedGw.address}:${savedGw.port}`;
        const credentials = { username: savedGw.username || 'admin', password: savedGw.password || 'admin' };

        for (const log of logs) {
          const result = await sendSms(baseUrl, credentials, {
            phoneNumber: log.contactPhone,
            message: log.body,
          });

          if (result.success && result.messageId) {
            await db.messageLogs.update(log.id!, { status: 'sending', gatewayMessageId: result.messageId });
          } else {
            await db.messageLogs.update(log.id!, { status: 'failed', error: result.error });
          }
        }

        pollDeliveryStatus(batchId as number, baseUrl, credentials);
      } else {
        // Queue for later — status already set to 'pending' above
      }
    }

    setComposerOpen(false);
    setMessageBody('');
    setSelectedContactIds([]);
    setSelectedGroupIds([]);
    setScheduleDate(undefined);
    setRecurringType('none');
    setShowSchedule(false);
  }

  return (
    <PullToRefresh onRefresh={async () => { await new Promise(r => setTimeout(r, 600)); }}>
    <div className="pb-20 px-4 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-display font-bold">{t('messages', lang)}</h1>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button onClick={() => setComposerOpen(true)} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            {t('compose', lang)}
          </Button>
        </div>
      </div>

      {/* Recent Batches */}
      {isLoading ? (
        <BatchListSkeleton count={4} />
      ) : (
        <div className="space-y-3">
          {safeBatches.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquareIcon className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm">{t('noMessages', lang)}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setComposerOpen(true)}>
                  {t('compose', lang)}
                </Button>
              </CardContent>
            </Card>
          ) : (
            safeBatches.map((batch) => <BatchCard key={batch.id} batch={batch} lang={lang} />)
          )}
        </div>
      )}

      {/* Composer Dialog */}
      <Dialog open={composerOpen} onOpenChange={setComposerOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{t('compose', lang)}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Recipients */}
            <div>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => setRecipientDialogOpen(true)}
              >
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {selectedContacts.length > 0
                    ? `${selectedContacts.length} ${t('recipients', lang)}`
                    : t('selectRecipients', lang)}
                </span>
                <ChevronRight className="w-4 h-4" />
              </Button>
              {optedOutCount > 0 && selectedContacts.length > 0 && (
                <p className="text-xs text-warning mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {optedOutCount} {t('optOutNotice', lang)}
                </p>
              )}
            </div>

            {/* Message Body */}
            <div>
              <Textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder={t('messageBody', lang)}
                className="min-h-[120px] resize-none"
              />
              <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                <span>
                  {charCount} {t('characters', lang)} · {segmentCount} {t('segments', lang)}
                </span>
                <div className="flex gap-1">
                  {['name', 'phone', 'location'].map((p) => (
                    <button
                      key={p}
                      onClick={() => insertPlaceholder(p)}
                      className="px-2 py-0.5 rounded-sm bg-secondary text-secondary-foreground text-[10px] font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      {`{${p}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Templates Quick Pick */}
            {safeTemplates.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {safeTemplates.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => setMessageBody(tmpl.body)}
                    className="shrink-0 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    {tmpl.name}
                  </button>
                ))}
              </div>
            )}

            {/* Schedule Toggle */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => setShowSchedule(!showSchedule)}
              >
                <Clock className="w-4 h-4" />
                {t('schedule', lang)}
              </Button>

              <AnimatePresence>
                {showSchedule && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                     <div className="pt-2 space-y-3">
                       <Popover>
                         <PopoverTrigger asChild>
                           <Button variant="outline" size="sm" className="gap-2 w-full justify-start">
                             <CalendarIcon className="w-4 h-4" />
                             {scheduleDate ? format(scheduleDate, 'PPp') : 'Pick date & time'}
                           </Button>
                         </PopoverTrigger>
                         <PopoverContent className="w-auto p-0" align="start">
                           <div className="flex flex-col">
                             <Calendar
                               mode="single"
                               selected={scheduleDate}
                               onSelect={(day) => {
                                 if (day) {
                                   const prev = scheduleDate || new Date();
                                   day.setHours(prev.getHours(), prev.getMinutes());
                                   setScheduleDate(new Date(day));
                                 }
                               }}
                               disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                               initialFocus
                             />
                             <div className="px-3 pb-3 flex items-center gap-2">
                               <label className="text-xs text-muted-foreground">Time:</label>
                               <Input
                                 type="time"
                                 className="h-8 w-auto text-sm"
                                 value={scheduleDate ? format(scheduleDate, 'HH:mm') : ''}
                                 onChange={(e) => {
                                   const [h, m] = e.target.value.split(':').map(Number);
                                   const d = scheduleDate ? new Date(scheduleDate) : new Date();
                                   d.setHours(h, m, 0, 0);
                                   setScheduleDate(d);
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
                          {['none', 'daily', 'weekly', 'monthly'].map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {t(opt, lang)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Preview */}
            {selectedContacts.length > 0 && messageBody.trim() && (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setPreviewOpen(true)}>
                <Eye className="w-4 h-4" />
                {t('preview', lang)}
              </Button>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setComposerOpen(false)}>
              {t('cancel', lang)}
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!messageBody.trim() || selectedContacts.length === 0}
              className="gap-1.5"
            >
              {scheduleDate ? (
                <>
                  <Clock className="w-4 h-4" />
                  {t('schedule', lang)}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {t('send', lang)}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recipients Picker Dialog */}
      <Dialog open={recipientDialogOpen} onOpenChange={setRecipientDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="font-display">{t('selectRecipients', lang)}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            {safeGroups.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('groups', lang)}</p>
                <div className="space-y-2">
                  {safeGroups.map((group) => (
                    <label key={group.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary cursor-pointer">
                      <Checkbox
                        checked={selectedGroupIds.includes(group.id!)}
                        onCheckedChange={(checked) => {
                          setSelectedGroupIds((prev) =>
                            checked ? [...prev, group.id!] : prev.filter((id) => id !== group.id!)
                          );
                        }}
                      />
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
                      <span className="text-sm font-medium">{group.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs font-medium text-muted-foreground mb-2">{t('allContacts', lang)}</p>
            <div className="space-y-1">
              {activeContacts.map((contact) => (
                <label
                  key={contact.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary cursor-pointer"
                >
                  <Checkbox
                    checked={selectedContactIds.includes(contact.id!)}
                    onCheckedChange={(checked) => {
                      setSelectedContactIds((prev) =>
                        checked ? [...prev, contact.id!] : prev.filter((id) => id !== contact.id!)
                      );
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">{contact.phone}</p>
                  </div>
                </label>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setRecipientDialogOpen(false)}>{t('confirm', lang)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">{t('preview', lang)}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-3">
              {selectedContacts.slice(0, 5).map((contact) => (
                <div key={contact.id} className="p-3 rounded-lg bg-secondary">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{contact.name}</p>
                  <p className="text-sm">{resolveMessage(messageBody, contact)}</p>
                </div>
              ))}
              {selectedContacts.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{selectedContacts.length - 5} more
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Send Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              {t('confirm', lang)} {scheduleDate ? t('schedule', lang) : t('send', lang)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              {scheduleDate
                ? `This will schedule ${selectedContacts.length} message(s) for ${format(scheduleDate, 'PPp')}.`
                : `This will send ${selectedContacts.length} message(s) immediately.`}
            </p>
            <p className="text-xs">This action cannot be undone.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t('cancel', lang)}
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                handleSend();
              }}
              className="gap-1.5"
            >
              <Send className="w-4 h-4" />
              {scheduleDate ? t('schedule', lang) : t('send', lang)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PullToRefresh>
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
    completed: 'bg-success/10 text-success',
    sending: 'bg-primary/10 text-primary',
    pending: 'bg-muted text-muted-foreground',
    scheduled: 'bg-warning/10 text-warning',
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{batch.body}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(batch.createdAt, 'PPp')}
            </p>
          </div>
          <Badge variant="secondary" className={`shrink-0 ml-2 text-[10px] ${statusColors[batch.status]}`}>
            {t(batch.status, lang)}
          </Badge>
        </div>

        {batch.status === 'completed' && (
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-xs text-muted-foreground">{batch.sentCount} {t('sent', lang)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              <span className="text-xs text-muted-foreground">{batch.failedCount} {t('failed', lang)}</span>
            </div>
          </div>
        )}

        {batch.scheduledAt && (
          <p className="text-xs text-warning mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {t('scheduledFor', lang)}: {format(batch.scheduledAt, 'PPp')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
