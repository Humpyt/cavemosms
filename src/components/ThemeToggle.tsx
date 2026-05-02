import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppSettings } from '@/hooks/useAppSettings';

export default function ThemeToggle() {
  const { settings, update } = useAppSettings();

  const isDark =
    settings.theme === 'dark' ||
    (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => update({ theme: isDark ? 'light' : 'dark' })}
      className="h-8 w-8 rounded-full border border-border/60 bg-background/70 backdrop-blur transition-colors hover:bg-accent/60 dark:border-white/10 dark:bg-slate-900/70 dark:hover:bg-slate-800/80"
    >
      {isDark ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
    </Button>
  );
}
