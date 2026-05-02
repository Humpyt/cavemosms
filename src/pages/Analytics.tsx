import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { endOfDay, format, startOfDay, subDays } from 'date-fns';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle,
  ChevronRight,
  Download,
  RefreshCw,
  Search,
  Send,
  User,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import ThemeToggle from '@/components/ThemeToggle';
import { BatchListSkeleton, StatCardsSkeleton } from '@/components/SkeletonLoaders';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNativeSms } from '@/hooks/useNativeSms';
import { toast } from '@/hooks/use-toast';
import { db } from '@/lib/db';
import { exportAnalyticsReport, exportBatchDetails } from '@/lib/csvExport';
import { t } from '@/lib/i18n';
import type { AppSettings, MessageBatch, MessageLog } from '@/lib/types';

interface AnalyticsPageProps {
  lang: string;
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => Promise<void> | void;
}

const SENDING_STALE_TIMEOUT_MS = 120_000;

function getRetryCount(log: MessageLog): number {
  return Math.max(0, log.retryCount ?? 0);
}

function isStaleSending(log: MessageLog): boolean {
  if (log.status !== 'sending' || !log.lastAttemptAt) return false;
  return Date.now() - new Date(log.lastAttemptAt).getTime() > SENDING_STALE_TIMEOUT_MS;
}

export default function AnalyticsPage({ lang, settings, onUpdate }: AnalyticsPageProps) {
  const batchesQuery = useLiveQuery(() => db.batches.orderBy('createdAt').reverse().toArray());
  const logsQuery = useLiveQuery(() => db.messageLogs.toArray());
  const batches = useMemo(() => batchesQuery ?? [], [batchesQuery]);
  const logs = useMemo(() => logsQuery ?? [], [logsQuery]);
  const isLoading = batchesQuery === undefined || logsQuery === undefined;

  const [selectedBatch, setSelectedBatch] = useState<MessageBatch | null>(null);
  const [batchLogs, setBatchLogs] = useState<MessageLog[]>([]);
  const [retrying, setRetrying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { processQueueNow, canSend } = useNativeSms();

  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      const matchesSearch = !searchQuery || batch.body.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || batch.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [batches, searchQuery, statusFilter]);

  const totalSent = logs.filter((log) => log.status === 'sent').length;
  const totalFailed = logs.filter((log) => log.status === 'failed').length;
  const total = totalSent + totalFailed;
  const successRate = total > 0 ? Math.round((totalSent / total) * 100) : 0;

  const chartData = Array.from({ length: 7 }, (_, index) => {
    const date = subDays(new Date(), 6 - index);
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    const dayLogs = logs.filter(
      (log) => log.sentAt && new Date(log.sentAt) >= dayStart && new Date(log.sentAt) <= dayEnd
    );

    return {
      day: format(date, 'EEE'),
      sent: dayLogs.filter((log) => log.status === 'sent').length,
      failed: dayLogs.filter((log) => log.status === 'failed').length,
    };
  });

  async function openBatchDetail(batch: MessageBatch) {
    setSelectedBatch(batch);
    const logsForBatch = await db.messageLogs.where({ batchId: batch.id! }).toArray();
    setBatchLogs(logsForBatch);
  }

  async function refreshSelectedBatch(batchId: number) {
    const batch = await db.batches.get(batchId);
    const logsForBatch = await db.messageLogs.where({ batchId }).toArray();

    setBatchLogs(logsForBatch);
    if (batch) setSelectedBatch(batch);
  }

  async function queueLogsForRetry(logsToRetry: MessageLog[]) {
    if (!selectedBatch || logsToRetry.length === 0) return;

    await Promise.all(
      logsToRetry.map((log) =>
        db.messageLogs.update(log.id!, {
          status: 'pending',
          sentAt: undefined,
          error: undefined,
          nativeRequestId: undefined,
          nextRetryAt: undefined,
          retryCount: getRetryCount(log),
        })
      )
    );

    await db.batches.update(selectedBatch.id!, {
      status: 'pending',
      completedAt: undefined,
    });

    await processQueueNow();
    await refreshSelectedBatch(selectedBatch.id!);
  }

  async function retryNow(log: MessageLog) {
    if (!selectedBatch) return;
    setRetrying(true);
    await db.messageLogs.update(log.id!, {
      status: 'pending',
      nextRetryAt: undefined,
      error: undefined,
    });
    await db.batches.update(selectedBatch.id!, { status: 'pending', completedAt: undefined });
    await processQueueNow();
    await refreshSelectedBatch(selectedBatch.id!);
    setRetrying(false);
  }

  async function recoverStale(log: MessageLog) {
    if (!selectedBatch) return;
    setRetrying(true);
    await db.messageLogs.update(log.id!, {
      status: 'pending',
      nextRetryAt: undefined,
      error: 'Recovered from stale sending state.',
    });
    await db.batches.update(selectedBatch.id!, { status: 'pending', completedAt: undefined });
    await processQueueNow();
    await refreshSelectedBatch(selectedBatch.id!);
    setRetrying(false);
  }

  async function retryFailed() {
    if (!selectedBatch) return;
    setRetrying(true);
    await queueLogsForRetry(batchLogs.filter((log) => log.status === 'failed'));
    setRetrying(false);
  }

  async function retrySingle(log: MessageLog) {
    setRetrying(true);
    await queueLogsForRetry([log]);
    setRetrying(false);
  }

  const failedInBatch = batchLogs.filter((log) => log.status === 'failed').length;

  const statCards = [
    { label: t('totalSent', lang), value: totalSent, icon: Send, color: 'text-success', bg: 'bg-success/10 dark:bg-emerald-400/10' },
    { label: t('totalFailed', lang), value: totalFailed, icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10 dark:bg-destructive/12' },
    { label: t('successRate', lang), value: `${successRate}%`, icon: CheckCircle, color: 'text-primary dark:text-sky-300', bg: 'bg-primary/10 dark:bg-sky-400/10' },
  ];

  if (isLoading) {
    return (
      <div className="px-5 pb-32 pt-8 min-h-screen bg-background">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('analytics', lang)}</h1>
          <ThemeToggle settings={settings} onUpdate={onUpdate} />
        </div>
        <StatCardsSkeleton />
        <BatchListSkeleton count={5} />
      </div>
    );
  }

  return (
    <div className="px-5 pb-32 pt-8 min-h-screen bg-background">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('analytics', lang)}</h1>
          <p className="text-sm text-muted-foreground mt-1">Campaign insights & history.</p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle settings={settings} onUpdate={onUpdate} />
        </div>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-3">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card rounded-[24px] border border-border/50 p-4 text-center hover:border-border transition-colors">
            <div className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-[14px] ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-[32px] border border-border/50 p-5 mb-8">
        <h2 className="text-[14px] font-bold text-foreground mb-4">Last 7 Days</h2>
        <div className="h-[200px] w-full">
          {total > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} className="text-muted-foreground" />
                <Tooltip cursor={{ fill: 'hsl(var(--secondary))' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="sent" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} barSize={12} />
                <Bar dataKey="failed" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <BarChart3 className="mb-2 h-8 w-8 opacity-20" />
              <span className="text-xs font-medium">No activity yet</span>
            </div>
          )}
        </div>
      </div>

      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[18px] font-bold text-foreground">{t('recentBatches', lang)}</h2>
        {batches.length > 0 && (
          <button
            className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-full bg-secondary text-secondary-foreground text-[11px] font-bold hover:bg-secondary/80 transition-colors"
            onClick={async () => {
              try {
                await exportAnalyticsReport(batches);
                toast({ title: 'Export started', description: 'Analytics CSV is being prepared.' });
              } catch {
                toast({ title: 'Export failed', description: 'Could not export analytics CSV.' });
              }
            }}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        )}
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-12 pl-10 rounded-[20px] bg-secondary border-0 text-[14px] shadow-none"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-12 w-[130px] rounded-[20px] bg-secondary border-0 text-[14px] font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-2xl">
            <SelectItem value="all" className="rounded-xl">All</SelectItem>
            <SelectItem value="completed" className="rounded-xl">Completed</SelectItem>
            <SelectItem value="sending" className="rounded-xl">Sending</SelectItem>
            <SelectItem value="scheduled" className="rounded-xl">Scheduled</SelectItem>
            <SelectItem value="pending" className="rounded-xl">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filteredBatches.length === 0 ? (
          <div className="bg-card rounded-[24px] border border-dashed border-border/80 p-8 text-center text-sm font-medium text-muted-foreground">
            {t('noMessages', lang)}
          </div>
        ) : (
          filteredBatches.slice(0, 10).map((batch) => (
            <div
              key={batch.id}
              className="bg-card rounded-[24px] border border-border/50 p-4 cursor-pointer transition-colors hover:border-border"
              onClick={() => openBatchDetail(batch)}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1 pr-4">
                  <p className="truncate text-[15px] font-bold text-foreground">{batch.body}</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">
                    {format(batch.createdAt, 'PPp')} <span className="mx-1">•</span> {batch.recipientCount} {t('recipients', lang)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-success/10 text-[10px] font-bold text-success">{batch.sentCount} sent</span>
                    {batch.failedCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-destructive/10 text-[10px] font-bold text-destructive">{batch.failedCount} fail</span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={!!selectedBatch} onOpenChange={(open) => !open && setSelectedBatch(null)}>
        <DialogContent className="flex max-h-[85vh] max-w-[95vw] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-sm">Batch Details</DialogTitle>
          </DialogHeader>

          {selectedBatch && (
            <div className="min-h-0 flex-1 space-y-3">
              <div className="rounded-xl bg-muted/50 p-3 dark:bg-white/[0.04]">
                <p className="text-xs font-medium dark:text-slate-100">{selectedBatch.body}</p>
                <p className="text-[10px] text-muted-foreground dark:text-slate-400">
                  {format(selectedBatch.createdAt, 'PPp')} · {selectedBatch.recipientCount} {t('recipients', lang)}
                </p>
                <div className="mt-2 flex gap-3">
                  <Badge variant="secondary" className="bg-success/10 text-[10px] text-success dark:bg-emerald-400/10 dark:text-emerald-200">
                    {selectedBatch.sentCount} {t('sent', lang)}
                  </Badge>
                  <Badge variant="secondary" className="bg-destructive/10 text-[10px] text-destructive dark:bg-destructive/12">
                    {selectedBatch.failedCount} {t('failed', lang)}
                  </Badge>
                </div>
              </div>

              {failedInBatch > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 dark:border-destructive/20 dark:bg-destructive/5"
                  onClick={retryFailed}
                  disabled={retrying || !canSend}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} />
                  {retrying ? 'Retrying...' : `Retry all ${failedInBatch} failed`}
                </Button>
              )}

              <ScrollArea className="h-[300px] rounded-lg border dark:border-white/10">
                <div className="space-y-1 p-2">
                  {batchLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`flex items-center justify-between rounded p-2 text-xs ${
                        log.status === 'failed' ? 'bg-destructive/10 dark:bg-destructive/12' : 'bg-secondary/50 dark:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate font-medium dark:text-slate-100">{log.contactName}</p>
                          <p className="text-[10px] text-muted-foreground dark:text-slate-400">{log.contactPhone}</p>
                        </div>
                      </div>
                      <div className="ml-2 flex shrink-0 items-center gap-2">
                        {log.status === 'sent' ? (
                          <Badge variant="secondary" className="bg-success/10 px-1.5 text-[10px] text-success dark:bg-emerald-400/10 dark:text-emerald-200">
                            {t('sent', lang)}
                          </Badge>
                        ) : log.status === 'failed' ? (
                          <>
                            <Badge variant="destructive" className="px-1.5 text-[10px]">
                              {t('failed', lang)}
                            </Badge>
                            {getRetryCount(log) > 0 && (
                              <Badge variant="secondary" className="px-1.5 text-[10px]">
                                tries {getRetryCount(log)}
                              </Badge>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 dark:hover:bg-white/[0.06]"
                              onClick={(event) => {
                                event.stopPropagation();
                                void retrySingle(log);
                              }}
                              disabled={retrying || !canSend}
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          </>
                        ) : log.status === 'pending' ? (
                          <>
                            <Badge variant="secondary" className="px-1.5 text-[10px]">
                              {t(log.status, lang)}
                            </Badge>
                            {getRetryCount(log) > 0 && (
                              <Badge variant="secondary" className="px-1.5 text-[10px]">
                                tries {getRetryCount(log)}
                              </Badge>
                            )}
                            {log.nextRetryAt && new Date(log.nextRetryAt).getTime() > Date.now() && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[10px] dark:hover:bg-white/[0.06]"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void retryNow(log);
                                }}
                                disabled={retrying || !canSend}
                              >
                                Retry now
                              </Button>
                            )}
                          </>
                        ) : log.status === 'sending' && isStaleSending(log) ? (
                          <>
                            <Badge variant="secondary" className="px-1.5 text-[10px]">
                              stale sending
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[10px] text-warning dark:hover:bg-white/[0.06]"
                              onClick={(event) => {
                                event.stopPropagation();
                                void recoverStale(log);
                              }}
                              disabled={retrying || !canSend}
                            >
                              Recover
                            </Button>
                          </>
                        ) : (
                          <Badge variant="secondary" className="px-1.5 text-[10px]">
                            {t(log.status, lang)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <DialogFooter className="flex-row gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
              onClick={async () => {
                if (!selectedBatch) return;
                try {
                  await exportBatchDetails(selectedBatch, batchLogs);
                  toast({ title: 'Export started', description: 'Batch CSV is being prepared.' });
                } catch {
                  toast({ title: 'Export failed', description: 'Could not export batch CSV.' });
                }
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button variant="outline" onClick={() => setSelectedBatch(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
