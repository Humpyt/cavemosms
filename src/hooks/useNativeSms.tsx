import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Capacitor } from '@capacitor/core';
import type {
  AppSettings,
  NativeSmsCapability,
  NativeSmsServiceStatus,
  NativePermissionState,
} from '@/lib/types';
import { NativeSms, type NativeQueueStats, type NativeSmsCapabilityResponse } from '@/plugins/nativeSms';
import {
  getQueuedCount,
  handleNativeSmsStatusEvent,
  processNativeSmsQueue,
} from '@/services/nativeSmsQueue';

interface NativeSmsContextValue {
  serviceStatus: NativeSmsServiceStatus;
  capability: NativeSmsCapability;
  canSend: boolean;
  queuedCount: number;
  nativeQueueStats?: NativeQueueStats;
  lastNativeSyncAt?: Date;
  error?: string;
  refreshStatus: () => Promise<void>;
  requestSmsPermission: () => Promise<void>;
  requestPhonePermission: () => Promise<void>;
  processQueueNow: () => Promise<void>;
  savePreferredSubscriptionId: (subscriptionId: number | null) => Promise<void>;
}

interface NativeSmsProviderProps {
  children: ReactNode;
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => Promise<void> | void;
}

const QUEUE_POLL_INTERVAL_MS = 5000;
const NATIVE_EVENT_DEDUP_KEY = 'bulksms_native_event_dedup';
const NATIVE_EVENT_DEDUP_MAX = 1000;

const NativeSmsContext = createContext<NativeSmsContextValue | null>(null);

const EMPTY_CAPABILITY: NativeSmsCapability = {
  supported: false,
  canSend: false,
  smsPermission: 'prompt',
  phonePermission: 'prompt',
  defaultSubscriptionId: -1,
  subscriptions: [],
};

function normalizeCapability(
  input: NativeSmsCapabilityResponse | undefined,
  preferredSubscriptionId: number | null
): NativeSmsCapability {
  if (!input) {
    return EMPTY_CAPABILITY;
  }

  const subscriptions = input.subscriptions ?? [];
  const resolvedDefaultSubscriptionId =
    preferredSubscriptionId ??
    subscriptions.find((subscription) => subscription.defaultSms)?.id ??
    input.defaultSubscriptionId ??
    -1;

  return {
    supported: Boolean(input.supported),
    canSend: Boolean(input.canSend),
    smsPermission: normalizePermission(input.smsPermission),
    phonePermission: normalizePermission(input.phonePermission),
    defaultSubscriptionId: resolvedDefaultSubscriptionId,
    subscriptions,
    manufacturer: input.manufacturer,
    model: input.model,
  };
}

function normalizePermission(value: string | undefined): NativePermissionState {
  switch ((value || '').toLowerCase()) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'prompt-with-rationale':
      return 'prompt-with-rationale';
    default:
      return 'prompt';
  }
}

function deriveServiceStatus(capability: NativeSmsCapability): NativeSmsServiceStatus {
  if (!capability.supported) {
    return 'unsupported';
  }

  if (!capability.canSend) {
    return 'blocked';
  }

  return 'ready';
}

function useNativeSmsState(
  settings: AppSettings,
  onUpdate: (updates: Partial<AppSettings>) => Promise<void> | void
): NativeSmsContextValue {
  const [serviceStatus, setServiceStatus] = useState<NativeSmsServiceStatus>('checking');
  const [capability, setCapability] = useState<NativeSmsCapability>(EMPTY_CAPABILITY);
  const [queuedCount, setQueuedCount] = useState(0);
  const [nativeQueueStats, setNativeQueueStats] = useState<NativeQueueStats>();
  const [lastNativeSyncAt, setLastNativeSyncAt] = useState<Date>();
  const [error, setError] = useState<string>();
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const loadEventDedup = useCallback((): Record<string, number> => {
    try {
      const raw = localStorage.getItem(NATIVE_EVENT_DEDUP_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, number>;
    } catch {
      return {};
    }
  }, []);

  const saveEventDedup = useCallback((map: Record<string, number>) => {
    const entries = Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, NATIVE_EVENT_DEDUP_MAX);
    const trimmed = Object.fromEntries(entries);
    localStorage.setItem(NATIVE_EVENT_DEDUP_KEY, JSON.stringify(trimmed));
  }, []);

  const updateNativeQueueStats = useCallback(async () => {
    if (Capacitor.getPlatform() !== 'android') {
      setNativeQueueStats(undefined);
      return;
    }
    try {
      const stats = await NativeSms.getNativeQueueStats();
      setNativeQueueStats(stats);
    } catch {
      // Best effort stats.
    }
  }, []);

  const updateQueuedCount = useCallback(async () => {
    setQueuedCount(await getQueuedCount());
  }, []);

  const syncNativeEvents = useCallback(async () => {
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }

    try {
      const drained = await NativeSms.drainNativeEvents();
      const dedupMap = loadEventDedup();
      let changed = false;

      for (const event of drained.events || []) {
        const fingerprint = `${event.requestId}:${event.status}:${event.resultCode ?? 0}:${event.error ?? ''}`;
        if (dedupMap[fingerprint]) {
          continue;
        }
        dedupMap[fingerprint] = Date.now();
        changed = true;
        await handleNativeSmsStatusEvent(event, settingsRef.current.maxRetries);
      }

      if (changed) {
        saveEventDedup(dedupMap);
      }
      setLastNativeSyncAt(new Date());
    } catch {
      // Best effort sync only.
    }
  }, [loadEventDedup, saveEventDedup]);

  const refreshStatus = useCallback(async () => {
    if (Capacitor.getPlatform() !== 'android') {
      setCapability(EMPTY_CAPABILITY);
      setServiceStatus('unsupported');
      setError('Native SMS sending is only available in the Android app build.');
      await updateQueuedCount();
      await updateNativeQueueStats();
      return;
    }

    try {
      const response = await NativeSms.getStatus();
      const nextCapability = normalizeCapability(response, settingsRef.current.preferredSubscriptionId);
      setCapability(nextCapability);
      setServiceStatus(deriveServiceStatus(nextCapability));
      setError(undefined);
    } catch (refreshError) {
      setCapability(EMPTY_CAPABILITY);
      setServiceStatus('error');
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to read SMS status.');
    }

    await updateQueuedCount();
    await updateNativeQueueStats();
  }, [updateNativeQueueStats, updateQueuedCount]);

  const requestSmsPermission = useCallback(async () => {
    try {
      const response = await NativeSms.requestSmsPermission();
      const nextCapability = normalizeCapability(response, settingsRef.current.preferredSubscriptionId);
      setCapability(nextCapability);
      setServiceStatus(deriveServiceStatus(nextCapability));
      setError(undefined);
    } catch (permissionError) {
      setServiceStatus('error');
      setError(permissionError instanceof Error ? permissionError.message : 'Unable to request SMS permission.');
    }

    await updateQueuedCount();
  }, [updateQueuedCount]);

  const requestPhonePermission = useCallback(async () => {
    try {
      const response = await NativeSms.requestPhonePermission();
      const nextCapability = normalizeCapability(response, settingsRef.current.preferredSubscriptionId);
      setCapability(nextCapability);
      setServiceStatus(deriveServiceStatus(nextCapability));
      setError(undefined);
    } catch (permissionError) {
      setServiceStatus('error');
      setError(permissionError instanceof Error ? permissionError.message : 'Unable to request SIM access.');
    }
  }, []);

  const processQueueNow = useCallback(async () => {
    if (Capacitor.getPlatform() !== 'android') {
      await updateQueuedCount();
      return;
    }

    if (!capability.canSend) {
      await updateQueuedCount();
      return;
    }

    await processNativeSmsQueue(
      settingsRef.current.sendDelay,
      settingsRef.current.preferredSubscriptionId,
      settingsRef.current.maxRetries
    );
    await syncNativeEvents();
    await updateQueuedCount();
    await updateNativeQueueStats();
  }, [capability.canSend, syncNativeEvents, updateNativeQueueStats, updateQueuedCount]);

  const savePreferredSubscriptionId = useCallback(async (subscriptionId: number | null) => {
    await onUpdate({ preferredSubscriptionId: subscriptionId });
    setCapability((prev) => ({
      ...prev,
      defaultSubscriptionId: subscriptionId ?? prev.defaultSubscriptionId,
    }));
  }, [onUpdate]);

  useEffect(() => {
    void refreshStatus();
    void syncNativeEvents();
  }, [refreshStatus, syncNativeEvents]);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }

    let active = true;

    void NativeSms.addListener('smsStatusChanged', (event) => {
      void (async () => {
        await handleNativeSmsStatusEvent(event, settingsRef.current.maxRetries);
        if (!active) {
          return;
        }
        await updateQueuedCount();
        await updateNativeQueueStats();
      })();
    });

    return () => {
      active = false;
      void NativeSms.removeAllListeners();
    };
  }, [updateNativeQueueStats, updateQueuedCount]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void processQueueNow();
    }, QUEUE_POLL_INTERVAL_MS);

    const onResume = () => {
      void refreshStatus();
      void syncNativeEvents();
      void processQueueNow();
    };

    window.addEventListener('focus', onResume);
    document.addEventListener('visibilitychange', onResume);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onResume);
      document.removeEventListener('visibilitychange', onResume);
    };
  }, [processQueueNow, refreshStatus, syncNativeEvents]);

  return useMemo(() => ({
    serviceStatus,
    capability,
    canSend: capability.canSend,
    queuedCount,
    nativeQueueStats,
    lastNativeSyncAt,
    error,
    refreshStatus,
    requestSmsPermission,
    requestPhonePermission,
    processQueueNow,
    savePreferredSubscriptionId,
  }), [
    capability,
    error,
    lastNativeSyncAt,
    nativeQueueStats,
    processQueueNow,
    queuedCount,
    refreshStatus,
    requestPhonePermission,
    requestSmsPermission,
    savePreferredSubscriptionId,
    serviceStatus,
  ]);
}

export function NativeSmsProvider({ children, settings, onUpdate }: NativeSmsProviderProps) {
  const value = useNativeSmsState(settings, onUpdate);
  return createElement(NativeSmsContext.Provider, { value }, children);
}

export function useNativeSms(): NativeSmsContextValue {
  const context = useContext(NativeSmsContext);
  if (!context) {
    throw new Error('useNativeSms must be used within NativeSmsProvider');
  }

  return context;
}
