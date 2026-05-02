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
    <div className="px-5 pb-32 pt-8 min-h-screen bg-background">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('settings', lang)}</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure your app.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Queue</p>
            <p className="text-lg font-bold text-foreground leading-none">{queuedCount}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-card rounded-[32px] p-5 border border-border/50">
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-2">
              <QuickStat label="Theme" value={settings.theme} icon={Palette} />
              <QuickStat label="Delay" value={`${settings.sendDelay / 1000}s`} icon={Clock} />
              <QuickStat label="Language" value={settings.language.toUpperCase()} icon={Globe} />
            </div>

            <div>
              <p className="mb-2 text-xs font-bold text-muted-foreground">{t('language', lang)}</p>
              <Select value={settings.language} onValueChange={(value) => void onUpdate({ language: value })}>
                <SelectTrigger className="h-14 rounded-[20px] bg-secondary border-0 px-4 text-[15px] font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {LANGUAGES.map((language) => (
                    <SelectItem key={language.code} value={language.code} className="rounded-xl">
                      {language.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold text-muted-foreground">{t('theme', lang)}</p>
              <div className="grid grid-cols-3 gap-2 rounded-[24px] bg-secondary p-1.5">
                {(['light', 'dark', 'system'] as const).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => void onUpdate({ theme })}
                    className={`rounded-[20px] py-3 text-xs font-bold transition-all ${
                      settings.theme === theme
                        ? 'bg-background text-foreground shadow-sm'
                        : 'bg-transparent text-muted-foreground hover:bg-background/50 hover:text-foreground'
                    }`}
                  >
                    {t(theme, lang)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold text-muted-foreground">{t('sendDelay', lang)}</p>
              <Select
                value={String(settings.sendDelay)}
                onValueChange={(value) => void onUpdate({ sendDelay: Number(value) })}
              >
                <SelectTrigger className="h-14 rounded-[20px] bg-secondary border-0 px-4 text-[15px] font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="1000" className="rounded-xl">1 second</SelectItem>
                  <SelectItem value="2000" className="rounded-xl">2 seconds</SelectItem>
                  <SelectItem value="3000" className="rounded-xl">3 seconds</SelectItem>
                  <SelectItem value="5000" className="rounded-xl">5 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-[32px] p-5 border border-border/50">
          <div className="space-y-5">
            <div className="flex items-center gap-4 bg-secondary rounded-[24px] p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-primary/20">
                <Smartphone className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-foreground">Native SMS</p>
                <SmsStatusBadge />
              </div>
              <button className="w-10 h-10 rounded-full flex items-center justify-center bg-background text-muted-foreground hover:text-foreground transition-colors" onClick={() => void refreshStatus()}>
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <NativeChip label="Device" value={`${capability.manufacturer || 'Android'} ${capability.model || ''}`} />
              <NativeChip label="SMS" value={capability.smsPermission} />
              <NativeChip label="SIM" value={capability.phonePermission} />
              <NativeChip label="Queue" value={String(queuedCount)} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                className={`w-full py-4 rounded-[20px] font-bold text-[13px] flex items-center justify-center gap-2 transition-colors ${canSend ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                onClick={() => void requestSmsPermission()}
              >
                <Smartphone className="h-4 w-4" />
                {canSend ? 'Recheck SMS Permission' : 'Grant SMS Permission'}
              </button>
              <button
                className="w-full py-4 rounded-[20px] bg-secondary text-secondary-foreground font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-secondary/80 transition-colors"
                onClick={() => void requestPhonePermission()}
              >
                <SmartphoneNfc className="h-4 w-4" />
                Allow SIM Selection
              </button>
            </div>

            <div>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-[24px] bg-secondary p-4 text-left transition-colors hover:bg-secondary/80"
                onClick={() => setShowNativeAdvanced((v) => !v)}
              >
                <div>
                  <p className="text-sm font-bold text-foreground">Advanced Controls</p>
                  <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                    Preferred SIM & Queue Diagnostics
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center">
                  {showNativeAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </button>
            </div>

            {showNativeAdvanced && (
              <div className="space-y-4 rounded-[24px] border border-border/50 bg-card p-4 shadow-sm mt-3">
                <div>
                  <p className="mb-2 text-xs font-bold text-muted-foreground">Preferred SIM</p>
                  <Select
                    value={settings.preferredSubscriptionId === null ? 'system' : String(settings.preferredSubscriptionId)}
                    onValueChange={(value) =>
                      void savePreferredSubscriptionId(value === 'system' ? null : Number(value))
                    }
                  >
                    <SelectTrigger className="h-12 rounded-[16px] bg-secondary border-0 px-4 text-[14px] font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="system" className="rounded-xl">System default</SelectItem>
                      {capability.subscriptions.map((subscription) => (
                        <SelectItem key={subscription.id} value={String(subscription.id)} className="rounded-xl">
                          {subscription.displayName || subscription.carrierName || `SIM ${subscription.slotIndex + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {queuedCount > 0 && (
                  <p className="rounded-[16px] border border-warning/20 bg-warning/10 px-4 py-3 text-xs font-medium text-warning">
                    {queuedCount} queued message{queuedCount === 1 ? '' : 's'} waiting to send.
                  </p>
                )}

                {(serviceStatus === 'unsupported' || error) && (
                  <div className="flex items-start gap-3 rounded-[16px] border border-destructive/20 bg-destructive/10 px-4 py-3 text-xs font-medium text-destructive">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{error || 'This build can only send SMS from a real Android phone with telephony support.'}</p>
                  </div>
                )}

                {nativeQueueStats && (
                  <div className="rounded-[16px] border border-border/50 bg-secondary/50 p-4">
                    <p className="mb-3 text-[12px] font-bold text-foreground border-b border-border/50 pb-2">Native Queue Health</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-medium text-muted-foreground">
                      <span>Queued total</span>
                      <span className="text-right text-foreground font-bold">{nativeQueueStats.total}</span>
                      <span>Due now</span>
                      <span className="text-right text-foreground font-bold">{nativeQueueStats.due}</span>
                      <span>Last sync</span>
                      <span className="text-right text-foreground font-bold">
                        {lastNativeSyncAt ? `${formatDistanceToNow(lastNativeSyncAt)} ago` : 'not synced'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-[32px] p-5 border border-border/50">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[20px] bg-secondary p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-success" />
                  <p className="text-sm font-bold text-foreground">{t('privacy', lang)}</p>
                </div>
                <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">
                  Data and message history remain on this device.
                </p>
              </div>
              <div className="rounded-[20px] bg-secondary p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  <p className="text-sm font-bold text-foreground">{t('about', lang)}</p>
                </div>
                <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">
                  Native Android SMS via SmsManager.
                </p>
                <p className="mt-2 inline-block px-2 py-0.5 bg-background rounded-md text-[10px] font-bold text-muted-foreground">
                  {BUILD_LABEL}
                </p>
              </div>
            </div>

            {onLogout && (
              <button
                className="w-full py-4 rounded-[20px] bg-secondary text-secondary-foreground font-bold text-[14px] hover:bg-secondary/80 transition-colors"
                onClick={onLogout}
              >
                Log Out / Re-Activate
              </button>
            )}
          </div>
        </div>

        <div className="bg-destructive/5 rounded-[32px] p-5 border border-destructive/20">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-destructive/10">
              <Trash2 className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-[16px] font-bold text-foreground">Reset App Data</p>
              <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
                Delete all data. This cannot be undone.
              </p>
            </div>
          </div>
          <button 
            className="w-full py-4 rounded-[20px] bg-destructive text-destructive-foreground font-bold text-[14px] hover:bg-destructive/90 transition-colors"
            onClick={() => setConfirmOpen(true)}
          >
            Clear All Data
          </button>
        </div>
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
    <div className="rounded-[20px] bg-secondary p-3">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <p className="text-[10px] uppercase font-bold tracking-wider">{label}</p>
      </div>
      <p className="truncate text-[15px] font-bold text-foreground capitalize">{value}</p>
    </div>
  );
}

function NativeChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-secondary p-3">
      <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xs font-bold text-foreground">{value || 'n/a'}</p>
    </div>
  );
}
