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
    <nav className="fixed bottom-6 left-0 right-0 z-50 safe-bottom px-4 pointer-events-none">
      <div className="mx-auto max-w-[400px] rounded-[2rem] border border-white/20 bg-background/70 backdrop-blur-2xl shadow-2xl shadow-black/20 dark:shadow-primary/10 pointer-events-auto">
        <div className="flex h-[72px] w-full items-center justify-between px-2">
          {tabs.map(({ id, icon: Icon, labelKey }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={`relative flex items-center justify-center transition-all duration-300 ${
                  isActive ? 'px-4 py-2.5 gap-2' : 'p-3 hover:scale-110'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 rounded-full bg-primary shadow-lg shadow-primary/30"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon
                  strokeWidth={isActive ? 2.5 : 2.5}
                  className={`relative z-10 w-5 h-5 transition-colors ${
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                />
                {isActive && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="relative z-10 text-xs font-bold tracking-wide text-primary-foreground ml-1"
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
