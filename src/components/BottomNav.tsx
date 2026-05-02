import { Send, UsersRound, Layers, Activity, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import type { TabId } from '@/lib/types';
import { t } from '@/lib/i18n';
import { motion } from 'framer-motion';

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  lang: string;
}

const tabs: { id: TabId; icon: LucideIcon; labelKey: string }[] = [
  { id: 'messages', icon: Send, labelKey: 'messages' },
  { id: 'contacts', icon: UsersRound, labelKey: 'contacts' },
  { id: 'templates', icon: Layers, labelKey: 'templates' },
  { id: 'analytics', icon: Activity, labelKey: 'analytics' },
  { id: 'settings', icon: SlidersHorizontal, labelKey: 'settings' },
];

export default function BottomNav({ activeTab, onTabChange, lang }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="mx-auto max-w-lg border-t border-border bg-background/95 backdrop-blur-xl">
        <div className="flex h-[72px] w-full items-center justify-between px-6">
          {tabs.map(({ id, icon: Icon, labelKey }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={`relative flex items-center justify-center transition-all duration-300 ${
                  isActive ? 'px-4 py-3 gap-2' : 'p-3'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 rounded-full bg-primary shadow-sm"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon
                  strokeWidth={isActive ? 2.5 : 2}
                  className={`relative z-10 w-[22px] h-[22px] transition-colors ${
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground hover:text-accent-foreground'
                  }`}
                />
                {isActive && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="relative z-10 text-[13px] font-semibold tracking-wide text-primary-foreground"
                  >
                    {t(labelKey, lang)}
                  </motion.span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
