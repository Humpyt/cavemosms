import { useState } from 'react';
import { t } from '@/lib/i18n';
import { LANGUAGES } from '@/lib/types';
import type { AppSettings } from '@/lib/types';
import { db } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useGateway } from '@/hooks/useGateway';
import GatewayStatusBadge from '@/components/GatewayStatusBadge';
import { Globe, Palette, Shield, Clock, Info, Trash2, RefreshCw, Wifi, WifiOff, AlertCircle } from 'lucide-react';

interface SettingsPageProps {
  lang: string;
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => void;
}

export default function SettingsPage({ lang, settings, onUpdate }: SettingsPageProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { status, address, error, discoverGateway, pingGateway } = useGateway();
  const [testingConnection, setTestingConnection] = useState(false);

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
    <div className="pb-20 px-4 pt-2">
      <h1 className="text-2xl font-display font-bold mb-4">{t('settings', lang)}</h1>

      <div className="space-y-4">
        {/* Language */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Globe className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm font-medium">{t('language', lang)}</p>
            </div>
            <Select value={settings.language} onValueChange={(v) => onUpdate({ language: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Theme */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Palette className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm font-medium">{t('theme', lang)}</p>
            </div>
            <div className="flex gap-2">
              {(['light', 'dark', 'system'] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => onUpdate({ theme })}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                    settings.theme === theme
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-secondary-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {t(theme, lang)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Send Delay */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm font-medium">{t('sendDelay', lang)}</p>
            </div>
            <Select
              value={String(settings.sendDelay)}
              onValueChange={(v) => onUpdate({ sendDelay: Number(v) })}
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
            <p className="text-[10px] text-muted-foreground mt-2">
              Delay between sending each SMS to avoid carrier throttling
            </p>
          </CardContent>
        </Card>

        {/* SMS Gateway */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                {status === 'online' ? <Wifi className="w-4 h-4 text-success" /> : <WifiOff className="w-4 h-4 text-muted-foreground" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">SMS Gateway</p>
                <GatewayStatusBadge />
              </div>
              <Button variant="ghost" size="sm" onClick={() => discoverGateway()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            {status === 'online' && address && (
              <p className="text-xs text-muted-foreground mb-3">{address}</p>
            )}

            {status === 'offline' && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground mb-3">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <p>Gateway not found. Make sure the android-sms-gateway app is running on your phone and connected to the same network.</p>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setTestingConnection(true);
                await pingGateway();
                setTestingConnection(false);
              }}
              disabled={testingConnection}
            >
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </Button>
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                <Shield className="w-4 h-4 text-success" />
              </div>
              <p className="text-sm font-medium">{t('privacy', lang)}</p>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>✓ All data stored locally on your device</p>
              <p>✓ No external network requests</p>
              <p>✓ No analytics or tracking</p>
              <p>✓ Messages sent via native SMS only</p>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Info className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm font-medium">{t('about', lang)}</p>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Bulk SMS App v1.0.0</p>
              <p>Privacy-first bulk messaging</p>
              <p>Built with ❤️ using Capacitor</p>
            </div>
          </CardContent>
        </Card>
        {/* Reset Data */}
        <Card className="border-destructive/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-destructive" />
              </div>
              <p className="text-sm font-medium">Reset App Data</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
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
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={clearAllData}>Delete Everything</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
