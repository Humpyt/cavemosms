import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
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
import { BUILD_LABEL } from '@/lib/buildInfo';
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
  const [showNativeAdvanced, setShowNativeAdvanced] = useState(false);
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
      <section className="mb-4 overflow-hidden rounded-[28px] border border-border bg-card px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Control Room
            </p>
            <h1 className="mt-1 text-2xl font-display font-bold">{t('settings', lang)}</h1>
            <p className="mt-1 max-w-[18rem] text-sm text-muted-foreground">
              Tune delivery behavior, device access, and the look and feel of this app.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-muted px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Queue</p>
            <p className="font-display text-xl font-semibold">{queuedCount}</p>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="grid grid-cols-3 gap-2">
              <QuickStat label="Theme" value={settings.theme} icon={Palette} />
              <QuickStat label="Delay" value={`${settings.sendDelay / 1000}s`} icon={Clock} />
              <QuickStat label="Language" value={settings.language.toUpperCase()} icon={Globe} />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t('language', lang)}</p>
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
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t('theme', lang)}</p>
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/40 p-1">
                {(['light', 'dark', 'system'] as const).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => void onUpdate({ theme })}
                    className={`rounded-xl border py-2.5 text-xs font-medium transition-all ${
                      settings.theme === theme
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-transparent bg-transparent text-secondary-foreground hover:border-primary/20 hover:bg-background/70'
                    }`}
                  >
                    {t(theme, lang)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t('sendDelay', lang)}</p>
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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10">
                <Smartphone className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Native SMS</p>
                <SmsStatusBadge />
              </div>
              <Button variant="ghost" size="sm" onClick={() => void refreshStatus()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <NativeChip label="Device" value={`${capability.manufacturer || 'Android'} ${capability.model || ''}`} />
              <NativeChip label="SMS" value={capability.smsPermission} />
              <NativeChip label="SIM" value={capability.phonePermission} />
              <NativeChip label="Queue" value={String(queuedCount)} />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                variant={canSend ? 'outline' : 'default'}
                size="sm"
                className="w-full min-w-0 gap-1.5 px-3 text-xs"
                onClick={() => void requestSmsPermission()}
              >
                <Smartphone className="h-4 w-4" />
                {canSend ? 'Recheck SMS Permission' : 'Grant SMS Permission'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full min-w-0 gap-1.5 px-3 text-xs"
                onClick={() => void requestPhonePermission()}
              >
                <SmartphoneNfc className="h-4 w-4" />
                Allow SIM Selection
              </Button>
            </div>

            <div>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-left"
                onClick={() => setShowNativeAdvanced((v) => !v)}
              >
                <div>
                  <p className="text-xs font-medium">Advanced SIM & Queue Controls</p>
                  <p className="text-[10px] text-muted-foreground">
                    Preferred SIM, queue health, and error diagnostics
                  </p>
                </div>
                {showNativeAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>

            {showNativeAdvanced && (
              <div className="space-y-3 rounded-2xl border border-border/70 bg-secondary/25 p-3">
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
                </div>

                {queuedCount > 0 && (
                  <p className="rounded-xl border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning">
                    {queuedCount} queued message{queuedCount === 1 ? '' : 's'} waiting to send.
                  </p>
                )}

                {(serviceStatus === 'unsupported' || error) && (
                  <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <p>{error || 'This build can only send SMS from a real Android phone with telephony support.'}</p>
                  </div>
                )}

                {nativeQueueStats && (
                  <div className="rounded-xl border border-border/70 bg-secondary/30 px-3 py-3 text-xs text-muted-foreground">
                    <p className="mb-2 text-[11px] font-medium text-foreground">Native Queue Health</p>
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
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-border/70 bg-secondary/25 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-success" />
                  <p className="text-xs font-medium">{t('privacy', lang)}</p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Data and message history remain on this device.
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-secondary/25 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  <p className="text-xs font-medium">{t('about', lang)}</p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Native Android SMS via SmsManager.
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Build: {BUILD_LABEL}
                </p>
              </div>
            </div>

            {onLogout && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={onLogout}
              >
                Log Out / Re-Activate
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
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

function QuickStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Globe;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-secondary/25 p-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[10px] uppercase tracking-[0.12em]">{label}</p>
      </div>
      <p className="truncate text-sm font-medium capitalize">{value}</p>
    </div>
  );
}

function NativeChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-secondary/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-xs text-foreground">{value || 'n/a'}</p>
    </div>
  );
}
