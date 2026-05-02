import { useState } from 'react';
import {
  Clock,
  Globe,
  Info,
  Palette,
  RefreshCw,
  Shield,
  Smartphone,
  SmartphoneNfc,
  Trash2,
  TriangleAlert,
} from 'lucide-react';

import SmsStatusBadge from '@/components/SmsStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNativeSms } from '@/hooks/useNativeSms';
import { db } from '@/lib/db';
import { t } from '@/lib/i18n';
import { LANGUAGES } from '@/lib/types';
import type { AppSettings } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface SettingsPageProps {
  lang: string;
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => Promise<void> | void;
  onLogout?: () => void;
}

export default function SettingsPage({ lang, settings, onUpdate, onLogout }: SettingsPageProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const {
    serviceStatus,
    capability,
    canSend,
    queuedCount,
    nativeQueueStats,
    lastNativeSyncAt,
    error,
    refreshStatus,
    requestSmsPermission,
    requestPhonePermission,
    savePreferredSubscriptionId,
  } = useNativeSms();

  async function clearAllData() {
    await Promise.all([
      db.contacts.clear(),
      db.groups.clear(),
      db.templates.clear(),
      db.batches.clear(),
      db.messageLogs.clear(),
    ]);
    setConfirmOpen(false);
    window.location.reload();
  }

  return (
    <div className="px-4 pb-20 pt-2">
      <section className="mb-4 overflow-hidden rounded-[1.75rem] border border-border/70 bg-card px-4 py-4 shadow-sm dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(8,15,28,0.92))] dark:shadow-[0_24px_60px_rgba(2,6,23,0.32)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground dark:text-sky-200/70">
              Control Room
            </p>
            <h1 className="mt-1 text-2xl font-display font-bold dark:text-slate-50">{t('settings', lang)}</h1>
            <p className="mt-1 max-w-[16rem] text-sm text-muted-foreground dark:text-slate-300">
              Tune delivery behavior, device access, and the look and feel of this app.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right dark:text-slate-200">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground dark:text-slate-400">Queue</p>
            <p className="font-display text-xl font-semibold">{queuedCount}</p>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        <Card className="dark:border-white/10">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 dark:bg-sky-400/10">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-medium">{t('language', lang)}</p>
            </div>
            <Select value={settings.language} onValueChange={(value) => void onUpdate({ language: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((language) => (
                  <SelectItem key={language.code} value={language.code}>
                    {language.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="dark:border-white/10">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 dark:bg-sky-400/10">
                <Palette className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-medium">{t('theme', lang)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/40 p-1 dark:bg-white/[0.04]">
              {(['light', 'dark', 'system'] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => void onUpdate({ theme })}
                  className={`rounded-xl border py-2.5 text-xs font-medium transition-all ${
                    settings.theme === theme
                      ? 'border-primary bg-primary text-primary-foreground shadow-[0_10px_26px_hsl(var(--primary)/0.22)]'
                      : 'border-transparent bg-transparent text-secondary-foreground hover:border-primary/20 hover:bg-background/70 dark:text-slate-300 dark:hover:bg-white/[0.05]'
                  }`}
                >
                  {t(theme, lang)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="dark:border-white/10">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 dark:bg-sky-400/10">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-medium">{t('sendDelay', lang)}</p>
            </div>
            <Select
              value={String(settings.sendDelay)}
              onValueChange={(value) => void onUpdate({ sendDelay: Number(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1000">1 second</SelectItem>
                <SelectItem value="2000">2 seconds</SelectItem>
                <SelectItem value="3000">3 seconds</SelectItem>
                <SelectItem value="5000">5 seconds</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Delay between native SMS sends to reduce carrier throttling on bulk runs.
            </p>
          </CardContent>
        </Card>

        <Card className="dark:border-white/10">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 dark:bg-sky-400/10">
                <Smartphone className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Native SMS</p>
                <SmsStatusBadge />
              </div>
              <Button variant="ghost" size="sm" className="dark:hover:bg-white/[0.06]" onClick={() => void refreshStatus()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Device</p>
                <div className="rounded-xl border border-border/70 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                  {capability.manufacturer || 'Android'} {capability.model || ''}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">SMS permission</p>
                  <div className="rounded-xl border border-border/70 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                    {capability.smsPermission}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">SIM access</p>
                  <div className="rounded-xl border border-border/70 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                    {capability.phonePermission}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant={canSend ? 'outline' : 'default'}
                size="sm"
                className="gap-1.5 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                onClick={() => void requestSmsPermission()}
              >
                <Smartphone className="h-4 w-4" />
                {canSend ? 'Recheck SMS Permission' : 'Grant SMS Permission'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                onClick={() => void requestPhonePermission()}
              >
                <SmartphoneNfc className="h-4 w-4" />
                Allow SIM Selection
              </Button>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Preferred SIM</p>
              <Select
                value={settings.preferredSubscriptionId === null ? 'system' : String(settings.preferredSubscriptionId)}
                onValueChange={(value) =>
                  void savePreferredSubscriptionId(value === 'system' ? null : Number(value))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System default</SelectItem>
                  {capability.subscriptions.map((subscription) => (
                    <SelectItem key={subscription.id} value={String(subscription.id)}>
                      {subscription.displayName || subscription.carrierName || `SIM ${subscription.slotIndex + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Leave this on system default unless your phone has multiple active SIMs.
              </p>
            </div>

            {queuedCount > 0 && (
              <p className="rounded-xl border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning dark:border-amber-300/15 dark:bg-amber-400/10 dark:text-amber-200">
                {queuedCount} queued message{queuedCount === 1 ? '' : 's'} waiting to send.
              </p>
            )}

            {(serviceStatus === 'unsupported' || error) && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive dark:bg-destructive/12">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>{error || 'This build can only send SMS from a real Android phone with telephony support.'}</p>
              </div>
            )}

            {nativeQueueStats && (
              <div className="rounded-xl border border-border/70 bg-secondary/30 px-3 py-3 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                <p className="mb-2 text-[11px] font-medium text-foreground dark:text-slate-100">Native Queue Health</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <span>Queued total</span>
                  <span className="text-right font-medium">{nativeQueueStats.total}</span>
                  <span>Due now</span>
                  <span className="text-right font-medium">{nativeQueueStats.due}</span>
                  <span>Last sync</span>
                  <span className="text-right font-medium">
                    {lastNativeSyncAt ? `${formatDistanceToNow(lastNativeSyncAt)} ago` : 'not synced'}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="dark:border-white/10">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-success/10 dark:bg-emerald-400/10">
                <Shield className="h-4 w-4 text-success" />
              </div>
              <p className="text-sm font-medium">{t('privacy', lang)}</p>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>Contacts, templates, and analytics stay on this device.</p>
              <p>Messages are sent directly through Android&apos;s native SMS stack on this phone.</p>
              <p>No third-party SMS API, LAN gateway, or cloud relay is used.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="dark:border-white/10">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 dark:bg-sky-400/10">
                <Info className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-medium">{t('about', lang)}</p>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Bulk SMS App v1.0.0</p>
              <p>Transport: native Android SMS via SmsManager</p>
              <p>Built with Capacitor and React</p>
            </div>
            {onLogout && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                onClick={onLogout}
              >
                Log Out / Re-Activate
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/30 dark:border-destructive/25">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-destructive/10">
                <Trash2 className="h-4 w-4 text-destructive" />
              </div>
              <p className="text-sm font-medium">Reset App Data</p>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Delete all contacts, groups, templates, and message history. This cannot be undone.
            </p>
            <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
              Clear All Data
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete all your contacts, groups, templates, and message history.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void clearAllData()}>
              Delete Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
