import { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAppSettings } from '@/hooks/useAppSettings';
import { useLicenseAuth } from '@/hooks/useLicenseAuth';
import { NativeSmsProvider } from '@/hooks/useNativeSms';
import type { TabId } from '@/lib/types';
import BottomNav from '@/components/BottomNav';
import MessagesPage from '@/pages/Messages';
import ContactsPage from '@/pages/Contacts';
import TemplatesPage from '@/pages/Templates';
import AnalyticsPage from '@/pages/Analytics';
import SettingsPage from '@/pages/Settings';
import OnboardingWalkthrough from '@/components/OnboardingWalkthrough';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { motion, AnimatePresence } from 'framer-motion';
import SmsStatusBadge from '@/components/SmsStatusBadge';
import LicenseGate from '@/components/LicenseGate';

const queryClient = new QueryClient();
const ONBOARDING_KEY = 'bulksms_onboarding_done';
let appReadyDispatched = false;

function notifyAppReady() {
  if (appReadyDispatched) return;
  appReadyDispatched = true;
  window.dispatchEvent(new Event('app-ready'));
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>('messages');
  const { settings, update, loading } = useAppSettings();
  const license = useLicenseAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!loading && !localStorage.getItem(ONBOARDING_KEY)) {
      setShowOnboarding(true);
    }
  }, [loading]);

  useEffect(() => {
    if (!loading && license.state !== 'checking') {
      notifyAppReady();
    }
  }, [loading, license.state]);

  function completeOnboarding() {
    setShowOnboarding(false);
    localStorage.setItem(ONBOARDING_KEY, 'true');
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent shadow-[0_0_32px_hsl(var(--primary)/0.35)]" />
      </div>
    );
  }

  if (license.state === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent shadow-[0_0_32px_hsl(var(--primary)/0.35)]" />
      </div>
    );
  }

  if (license.state === 'unauthorized') {
    return (
      <LicenseGate
        email={license.userEmail}
        password={license.userPassword}
        onEmailChange={license.setUserEmail}
        onPasswordChange={license.setUserPassword}
        onActivate={() => void license.activate()}
        activating={license.activating}
        error={license.error}
      />
    );
  }

  const lang = settings.language;

  return (
    <NativeSmsProvider settings={settings} onUpdate={update}>
      <div className="min-h-screen bg-app safe-top">
        <div className="surface-app mx-auto flex min-h-screen max-w-lg flex-col backdrop-blur supports-[backdrop-filter]:bg-background/88 md:border-x">
          <header className="sticky top-0 z-40 border-b border-border/70 bg-background/82 backdrop-blur-xl dark:bg-slate-950/55">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Camo SMS
                  </p>
                  <h1 className="text-base font-display font-semibold text-foreground dark:text-slate-50">
                    Native Campaign Console
                  </h1>
                  {license.identity?.email && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{license.identity.email}</p>
                  )}
                </div>
                <SmsStatusBadge />
              </div>
            </div>
          </header>

          <main className="flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
              >
                {activeTab === 'messages' && <MessagesPage lang={lang} />}
                {activeTab === 'contacts' && <ContactsPage lang={lang} />}
                {activeTab === 'templates' && <TemplatesPage lang={lang} />}
                {activeTab === 'analytics' && (
                  <AnalyticsPage lang={lang} settings={settings} onUpdate={update} />
                )}
                {activeTab === 'settings' && (
                  <SettingsPage lang={lang} settings={settings} onUpdate={update} onLogout={license.logout} />
                )}
              </motion.div>
            </AnimatePresence>
          </main>

          <BottomNav activeTab={activeTab} onTabChange={setActiveTab} lang={lang} />
        </div>
        <PWAInstallPrompt />
        <OnboardingWalkthrough open={showOnboarding} onComplete={completeOnboarding} />
      </div>
    </NativeSmsProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
