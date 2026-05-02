import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Globe,
  Info,
  Palette,
  RefreshCw,
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
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('settings', lang)}</h1>
      </div>

      <div className="space-y-8">
        {/* App Preferences */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">Preferences</h2>
          <div className="bg-card rounded-[24px] border border-border/50 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                  <Globe className="h-4 w-4 text-foreground" />
                </div>
                <span className="text-[15px] font-bold text-foreground">{t('language', lang)}</span>
              </div>
              <Select value={settings.language} onValueChange={(value) => void onUpdate({ language: value })}>
                <SelectTrigger className="w-[120px] h-9 rounded-full bg-secondary border-0 text-[13px] font-medium focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-[16px]">
                  {LANGUAGES.map((language) => (
                    <SelectItem key={language.code} value={language.code} className="rounded-lg text-[13px]">
                      {language.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-border/50 gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                  <Palette className="h-4 w-4 text-foreground" />
                </div>
                <span className="text-[15px] font-bold text-foreground">{t('theme', lang)}</span>
              </div>
              <div className="flex p-1 bg-secondary rounded-full">
                {(['light', 'dark', 'system'] as const).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => void onUpdate({ theme })}
                    className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-all ${
                      settings.theme === theme
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t(theme, lang)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                  <Clock className="h-4 w-4 text-foreground" />
                </div>
                <span className="text-[15px] font-bold text-foreground">{t('sendDelay', lang)}</span>
              </div>
              <Select
                value={String(settings.sendDelay)}
                onValueChange={(value) => void onUpdate({ sendDelay: Number(value) })}
              >
                <SelectTrigger className="w-[120px] h-9 rounded-full bg-secondary border-0 text-[13px] font-medium focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-[16px]">
                  <SelectItem value="1000" className="rounded-lg text-[13px]">1 second</SelectItem>
                  <SelectItem value="2000" className="rounded-lg text-[13px]">2 seconds</SelectItem>
                  <SelectItem value="3000" className="rounded-lg text-[13px]">3 seconds</SelectItem>
                  <SelectItem value="5000" className="rounded-lg text-[13px]">5 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* System & SMS */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">System & SMS</h2>
          <div className="bg-card rounded-[24px] border border-border/50 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <Smartphone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <span className="text-[15px] font-bold text-foreground block">Native Integration</span>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {capability.manufacturer || 'Android'} {capability.model || ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <SmsStatusBadge />
                <button className="h-8 w-8 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors" onClick={() => void refreshStatus()}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row p-4 gap-3 border-b border-border/50">
              <button
                className={`flex-1 py-3 px-4 rounded-full font-bold text-[13px] flex items-center justify-center gap-2 transition-colors ${canSend ? 'bg-secondary text-foreground hover:bg-secondary/80' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                onClick={() => void requestSmsPermission()}
              >
                <Smartphone className="h-4 w-4" />
                {canSend ? 'Recheck SMS' : 'Grant SMS Access'}
              </button>
              <button
                className="flex-1 py-3 px-4 rounded-full bg-secondary text-foreground font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-secondary/80 transition-colors"
                onClick={() => void requestPhonePermission()}
              >
                <SmartphoneNfc className="h-4 w-4" />
                Allow SIM Selection
              </button>
            </div>

            <div className="p-2">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-[16px] px-3 py-3 hover:bg-secondary/50 transition-colors"
                onClick={() => setShowNativeAdvanced((v) => !v)}
              >
                <span className="text-[14px] font-bold text-foreground">Advanced Settings</span>
                {showNativeAdvanced ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              {showNativeAdvanced && (
                <div className="px-3 pb-3 pt-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-muted-foreground">Preferred SIM</span>
                    <Select
                      value={settings.preferredSubscriptionId === null ? 'system' : String(settings.preferredSubscriptionId)}
                      onValueChange={(value) =>
                        void savePreferredSubscriptionId(value === 'system' ? null : Number(value))
                      }
                    >
                      <SelectTrigger className="w-[140px] h-8 rounded-full bg-secondary border-0 text-[12px] font-medium focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-[16px]">
                        <SelectItem value="system" className="rounded-lg text-[12px]">System default</SelectItem>
                        {capability.subscriptions.map((subscription) => (
                          <SelectItem key={subscription.id} value={String(subscription.id)} className="rounded-lg text-[12px]">
                            {subscription.displayName || subscription.carrierName || `SIM ${subscription.slotIndex + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {nativeQueueStats && (
                    <div className="bg-secondary/50 rounded-[16px] p-3 text-[12px] font-medium flex justify-between items-center text-muted-foreground">
                      <span>Queue Health</span>
                      <span className="text-foreground font-bold">{nativeQueueStats.total} total / {nativeQueueStats.due} due</span>
                    </div>
                  )}

                  {(serviceStatus === 'unsupported' || error) && (
                    <div className="flex items-center gap-3 rounded-[16px] bg-destructive/10 px-3 py-3 text-[12px] font-bold text-destructive">
                      <TriangleAlert className="h-4 w-4 shrink-0" />
                      <p>{error || 'Only available on Android devices.'}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Account & Data */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">Account & Data</h2>
          <div className="bg-card rounded-[24px] border border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <div className="flex items-center gap-3 mb-1">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13px] font-bold text-foreground">Build {BUILD_LABEL}</span>
              </div>
              <p className="text-[12px] text-muted-foreground ml-7 font-medium">Native Android SMS via SmsManager. Data remains on your device.</p>
            </div>

            {onLogout && (
              <button
                className="w-full flex items-center justify-between p-4 border-b border-border/50 hover:bg-secondary/50 transition-colors text-left"
                onClick={onLogout}
              >
                <span className="text-[15px] font-bold text-foreground">Log Out Account</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}

            <button
              className="w-full flex items-center justify-between p-4 hover:bg-destructive/5 transition-colors text-left group"
              onClick={() => setConfirmOpen(true)}
            >
              <span className="text-[15px] font-bold text-destructive group-hover:text-destructive/80 transition-colors">Clear All App Data</span>
              <Trash2 className="h-4 w-4 text-destructive/50 group-hover:text-destructive transition-colors" />
            </button>
          </div>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-sm rounded-[32px] border-border/50 p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Clear All Data</DialogTitle>
          </DialogHeader>
          <p className="text-[14px] font-medium text-muted-foreground leading-relaxed my-2">
            This will permanently delete all your contacts, groups, templates, and message history. This cannot be undone.
          </p>
          <DialogFooter className="gap-2 mt-4 flex-col sm:flex-row">
            <button 
              className="w-full py-3 rounded-full bg-secondary text-foreground font-bold text-[14px] hover:bg-secondary/80 transition-colors"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </button>
            <button 
              className="w-full py-3 rounded-full bg-destructive text-destructive-foreground font-bold text-[14px] hover:bg-destructive/90 transition-colors"
              onClick={() => void clearAllData()}
            >
              Delete Everything
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
