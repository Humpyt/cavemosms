import { useCallback, useEffect, useMemo, useState } from 'react';

type AuthState = 'checking' | 'unauthorized' | 'authorized';

interface ActivationResponse {
  token: string;
  user: { id: number; email: string; name: string };
  license: { key: string; status: string; expiresAt?: string; deviceId: string };
}

const AUTH_TOKEN_KEY = 'bulksms_license_token';
const AUTH_USER_KEY = 'bulksms_license_user';
const AUTH_LICENSE_KEY = 'bulksms_license_data';
const DEVICE_ID_KEY = 'bulksms_device_id';
const API_BASE_URL = (import.meta.env.VITE_LICENSE_API_URL as string | undefined) || 'https://uglive.io';
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

function buildDeviceId(): string {
  const random = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`.slice(0, 24);
  return `dev-${random}`;
}

function getDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const next = buildDeviceId();
  localStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

function getDeviceName(): string {
  return navigator.userAgent.slice(0, 120);
}

export function useLicenseAuth() {
  const [state, setState] = useState<AuthState>('checking');
  const [error, setError] = useState<string>();
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [activating, setActivating] = useState(false);

  const clearAuth = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_LICENSE_KEY);
    setState('unauthorized');
  }, []);

  const verifyStatus = useCallback(async () => {
    const currentToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!currentToken) {
      setState('unauthorized');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/license/status`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      if (!response.ok) {
        clearAuth();
        setError('License is not active on this device.');
        return;
      }

      setError(undefined);
      setState('authorized');
    } catch {
      setError('Could not reach licensing server.');
      setState('unauthorized');
    }
  }, [clearAuth]);

  const activate = useCallback(async () => {
    if (!userEmail.trim() || !userPassword.trim()) {
      setError('Email and password are required.');
      return;
    }

    setActivating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail.trim().toLowerCase(),
          password: userPassword,
          deviceId: getDeviceId(),
          deviceName: getDeviceName(),
        }),
      });

      const data = (await response.json()) as ActivationResponse | { error?: string };
      if (!response.ok || !('token' in data)) {
        setError(data && 'error' in data ? data.error || 'Activation failed.' : 'Activation failed.');
        setActivating(false);
        return;
      }

      localStorage.setItem(AUTH_TOKEN_KEY, data.token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(AUTH_LICENSE_KEY, JSON.stringify(data.license));
      setError(undefined);
      setState('authorized');
    } catch {
      setError('Could not reach licensing server.');
    } finally {
      setActivating(false);
    }
  }, [userEmail, userPassword]);

  const logout = useCallback(() => {
    clearAuth();
    setError(undefined);
  }, [clearAuth]);

  useEffect(() => {
    void verifyStatus();
  }, [verifyStatus]);

  useEffect(() => {
    if (state !== 'authorized') return;
    const interval = window.setInterval(async () => {
      const currentToken = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!currentToken) return;
      try {
        await fetch(`${API_BASE_URL}/api/license/heartbeat`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentToken}` },
        });
      } catch {
        // Keep local session; full status is rechecked elsewhere.
      }
    }, HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [state]);

  const identity = useMemo(() => {
    try {
      const raw = localStorage.getItem(AUTH_USER_KEY);
      return raw ? (JSON.parse(raw) as { email: string; name: string }) : null;
    } catch {
      return null;
    }
  }, []);

  return {
    state,
    error,
    userEmail,
    setUserEmail,
    userPassword,
    setUserPassword,
    activating,
    activate,
    logout,
    verifyStatus,
    identity,
  };
}
