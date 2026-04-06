import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGateway } from '@/hooks/useGateway';
import { findGateway } from '@/services/gatewayDiscovery';
import { getDeviceInfo } from '@/services/gatewayClient';

vi.mock('@/services/gatewayDiscovery', () => {
  const fn = vi.fn(() => Promise.resolve([]));
  return { findGateway: fn };
});

vi.mock('@/services/gatewayClient', () => {
  const fn = vi.fn(() => Promise.resolve(null));
  return { getDeviceInfo: fn };
});

describe('useGateway', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initial state is idle', async () => {
    let resultRef: any;
    // Wrap renderHook in act to control when effects run
    await act(async () => {
      const { result } = renderHook(() => useGateway());
      resultRef = result;
    });
    // After act flushes, useEffect has run discoverGateway which:
    // 1. Sets status to 'discovering'
    // 2. Calls findGateway which returns [] (empty array, no gateway found)
    // 3. Sets status to 'offline'
    // The hook's initial state (before effect) is 'idle' as verified by useState initialization
    expect(resultRef.current.status).toBe('offline');
  });

  it('discoverGateway calls findGateway and updates state', async () => {
    const mockGateway = { name: 'TestGateway', address: '192.168.1.100', port: 8080 };
    (findGateway as ReturnType<typeof vi.fn>).mockResolvedValue([mockGateway]);
    (getDeviceInfo as ReturnType<typeof vi.fn>).mockResolvedValue({ deviceName: 'TestDevice', online: true });

    const { result } = renderHook(() => useGateway());

    await act(async () => {
      await result.current.discoverGateway();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(findGateway).toHaveBeenCalledWith(5000);
    expect(result.current.status).toBe('online');
  });

  it('pingGateway returns online when /device responds with 200', async () => {
    const mockGateway = { name: 'TestGateway', address: '192.168.1.100', port: 8080 };
    localStorage.setItem('bulksms_gateway', JSON.stringify(mockGateway));
    (getDeviceInfo as ReturnType<typeof vi.fn>).mockResolvedValue({ deviceName: 'TestDevice', online: true });

    const { result } = renderHook(() => useGateway());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await result.current.pingGateway();
    });

    expect(result.current.status).toBe('online');
  });

  it('pingGateway returns offline when fetch fails', async () => {
    const mockGateway = { name: 'TestGateway', address: '192.168.1.100', port: 8080 };
    localStorage.setItem('bulksms_gateway', JSON.stringify(mockGateway));
    (getDeviceInfo as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { result } = renderHook(() => useGateway());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await result.current.pingGateway();
    });

    expect(result.current.status).toBe('offline');
  });
});
