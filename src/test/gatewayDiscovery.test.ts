import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { findGateway, stopDiscovery } from '@/services/gatewayDiscovery';

describe('gatewayDiscovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopDiscovery();
    vi.useRealTimers();
  });

  it('returns empty array when no gateways found', async () => {
    const findPromise = findGateway(1000);
    await vi.advanceTimersByTimeAsync(2000);
    const result = await findPromise;
    expect(result).toEqual([]);
  });
});
