import { MessageSquare, Users, FileText, BarChart3, Settings, type LucideIcon } from 'lucide-react';
import type { TabId } from '@/lib/types';
import { t } from '@/lib/i18n';
import { motion } from 'framer-motion';

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  lang: string;
}

const tabs: { id: TabId; icon: LucideIcon; labelKey: string }[] = [
  { id: 'messages', icon: MessageSquare, labelKey: 'messages' },
  { id: 'contacts', icon: Users, labelKey: 'contacts' },
  { id: 'templates', icon: FileText, labelKey: 'templates' },
  { id: 'analytics', icon: BarChart3, labelKey: 'analytics' },
  { id: 'settings', icon: Settings, labelKey: 'settings' },
];

export default function BottomNav({ activeTab, onTabChange, lang }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 safe-bottom">
      <div className="surface-floating mx-auto max-w-lg rounded-[24px] border backdrop-blur-xl">
        <div className="flex h-[72px] w-full items-center justify-around px-2">
          {tabs.map(({ id, icon: Icon, labelKey }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className="relative flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl transition-colors"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-x-2 inset-y-2 rounded-2xl bg-primary/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] dark:bg-primary/18"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon
                  className={`relative z-10 w-5 h-5 transition-colors ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                <span
                  className={`relative z-10 text-[10px] font-medium transition-colors ${
                    isActive ? 'text-primary' : 'text-muted-foreground dark:text-slate-400'
                  }`}
                >
                  {t(labelKey, lang)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
