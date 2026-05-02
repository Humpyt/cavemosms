import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLicenseAuth } from '@/hooks/useLicenseAuth';

const AUTH_TOKEN_KEY = 'bulksms_license_token';
const AUTH_USER_KEY = 'bulksms_license_user';
const AUTH_LICENSE_KEY = 'bulksms_license_data';

describe('useLicenseAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts unauthorized when no token is present', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useLicenseAuth());

    await waitFor(() => expect(result.current.state).toBe('unauthorized'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('becomes authorized when status endpoint returns ok', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'token-1');
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ email: 'x@example.com', name: 'X' }));

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useLicenseAuth());

    await waitFor(() => expect(result.current.state).toBe('authorized'));
    expect(result.current.identity).toEqual({ email: 'x@example.com', name: 'X' });
  });

  it('activates and persists credentials on successful activate call', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'new-token',
        user: { id: 1, email: 'test@example.com', name: 'Test User' },
        license: { key: 'ABC', status: 'active', deviceId: 'dev-1' },
      }),
    } as Response);

    const { result } = renderHook(() => useLicenseAuth());

    await waitFor(() => expect(result.current.state).toBe('unauthorized'));

    act(() => {
      result.current.setUserEmail('test@example.com');
      result.current.setUserPassword('secret');
    });

    await waitFor(() => expect(result.current.userEmail).toBe('test@example.com'));
    await waitFor(() => expect(result.current.userPassword).toBe('secret'));

    await act(async () => {
      await result.current.activate();
    });

    await waitFor(() => expect(result.current.state).toBe('authorized'));
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe('new-token');
    expect(localStorage.getItem(AUTH_LICENSE_KEY)).toContain('"status":"active"');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces activate error when backend rejects credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    } as Response);

    const { result } = renderHook(() => useLicenseAuth());
    await waitFor(() => expect(result.current.state).toBe('unauthorized'));

    act(() => {
      result.current.setUserEmail('bad@example.com');
      result.current.setUserPassword('wrong');
    });

    await waitFor(() => expect(result.current.userEmail).toBe('bad@example.com'));
    await waitFor(() => expect(result.current.userPassword).toBe('wrong'));

    await act(async () => {
      await result.current.activate();
    });

    expect(result.current.state).toBe('unauthorized');
    await waitFor(() => expect(result.current.error).toBe('Invalid credentials'));
  });

  it('clears local auth on logout', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'token-2');
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ email: 'y@example.com', name: 'Y' }));
    localStorage.setItem(AUTH_LICENSE_KEY, JSON.stringify({ key: 'L', status: 'active' }));

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useLicenseAuth());
    await waitFor(() => expect(result.current.state).toBe('authorized'));

    act(() => {
      result.current.logout();
    });

    expect(result.current.state).toBe('unauthorized');
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_USER_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_LICENSE_KEY)).toBeNull();
  });
});
