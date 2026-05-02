import { useState, useEffect, useCallback } from 'react';
import { getSettings, updateSettings } from '@/lib/db';
import type { AppSettings } from '@/lib/types';

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>({
    language: 'en',
    theme: 'system',
    sendDelay: 2000,
    maxRetries: 2,
    preferredSubscriptionId: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else if (settings.theme === 'light') {
      root.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }
  }, [settings.theme]);

  const update = useCallback(async (updates: Partial<AppSettings>) => {
    await updateSettings(updates);
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  return { settings, update, loading };
}
