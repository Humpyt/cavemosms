import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const dismissed = sessionStorage.getItem('pwa-install-dismissed');
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Show iOS instructions after a delay
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handler);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    setShowBanner(false);
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  }

  if (!showBanner || isInstalled) return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <div className="fixed bottom-20 left-2 right-2 z-50 max-w-lg mx-auto animate-in slide-in-from-bottom-4">
      <div className="bg-card border border-border rounded-xl p-4 shadow-lg flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Install Cavo SMS</p>
          {isIOS ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              Tap the share button, then "Add to Home Screen" to install.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              Install for quick access, offline support, and a native app experience.
            </p>
          )}
          {!isIOS && deferredPrompt && (
            <Button size="sm" className="mt-2 h-7 text-xs" onClick={handleInstall}>
              Install Now
            </Button>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
