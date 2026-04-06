import { MessageSquare, Users, FileText, BarChart3, Settings, type LucideIcon } from 'lucide-react';
import type { TabId } from '@/lib/types';
import { t } from '@/lib/i18n';
import { motion } from 'framer-motion';
import GatewayStatusBadge from '@/components/GatewayStatusBadge';

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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom">
      <div className="flex flex-col items-center max-w-lg mx-auto">
        <div className="flex items-center justify-end w-full py-1.5 pr-2">
          <GatewayStatusBadge />
        </div>
        <div className="flex items-center justify-around h-16 w-full">
          {tabs.map(({ id, icon: Icon, labelKey }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className="relative flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -top-0.5 w-8 h-0.5 rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                />
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
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
