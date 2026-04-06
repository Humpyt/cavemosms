import { useState, useEffect, useCallback, useRef } from 'react';
import { findGateway, type DiscoveredGateway } from '@/services/gatewayDiscovery';
import { getDeviceInfo } from '@/services/gatewayClient';
import type { GatewayStatus } from '@/lib/types';

interface GatewayState {
  status: GatewayStatus;
  deviceName?: string;
  address?: string;
  lastSeen?: Date;
  error?: string;
  queuedCount?: number;
}

const GATEWAY_KEY = 'bulksms_gateway';
const PING_INTERVAL_MS = 10000;
const QUEUE_POLL_INTERVAL_MS = 30000;

export function useGateway() {
  const [state, setState] = useState<GatewayState>({ status: 'idle' });
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentGatewayRef = useRef<DiscoveredGateway | null>(null);

  const saveGateway = useCallback((gw: DiscoveredGateway) => {
    localStorage.setItem(GATEWAY_KEY, JSON.stringify(gw));
    currentGatewayRef.current = gw;
  }, []);

  const loadGateway = useCallback((): DiscoveredGateway | null => {
    const stored = localStorage.getItem(GATEWAY_KEY);
    return stored ? JSON.parse(stored) : null;
  }, []);

  const pingGateway = useCallback(async () => {
    const gw = currentGatewayRef.current;
    if (!gw) return;

    const info = await getDeviceInfo(`http://${gw.address}:${gw.port}`, {
      username: gw.username || 'admin',
      password: gw.password || 'admin',
    });

    if (info) {
      setState({ status: 'online', deviceName: info.deviceName, address: gw.address, lastSeen: new Date() });
    } else {
      setState((prev) => ({ ...prev, status: 'offline', lastSeen: new Date() }));
    }
  }, []);

  const discoverGateway = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'discovering' }));

    const saved = loadGateway();
    if (saved) {
      currentGatewayRef.current = saved;
      await pingGateway();
    }

    const gateways = await findGateway(5000);
    if (gateways.length > 0) {
      saveGateway(gateways[0]);
      await pingGateway();
    } else {
      setState((prev) => ({ ...prev, status: 'offline', error: 'Gateway not found on network' }));
    }
  }, [loadGateway, saveGateway, pingGateway]);

  const startPolling = useCallback(() => {
    if (pingTimerRef.current) clearInterval(pingTimerRef.current);
    pingTimerRef.current = setInterval(pingGateway, PING_INTERVAL_MS);
  }, [pingGateway]);

  useEffect(() => {
    discoverGateway();
    startPolling();

    return () => {
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      if (queueTimerRef.current) clearInterval(queueTimerRef.current);
    };
  }, []);

  return { ...state, discoverGateway, pingGateway };
}
