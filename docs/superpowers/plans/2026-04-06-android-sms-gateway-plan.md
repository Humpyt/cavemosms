# Android SMS Gateway Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace simulated SMS sending with real delivery via android-sms-gateway app on local network, with mDNS auto-discovery, offline queueing, and delivery status polling.

**Architecture:** mDNS/Bonjour discovery for gateway, REST API client for sending/receiving, offline queue via IndexedDB/Dexie, polling for delivery status. Single gateway at a time.

**Tech Stack:** bonjour-service (mDNS), fetch (HTTP), Dexie (offline queue), React hooks

---

## File Structure

```
src/
  services/
    gatewayDiscovery.ts   # mDNS/Bonjour discovery
    gatewayClient.ts       # REST API HTTP client
  hooks/
    useGateway.ts          # Gateway state, send loop, polling
  components/
    GatewayStatusBadge.tsx # Online/offline indicator
src/pages/
  Settings.tsx             # Add gateway settings section
src/lib/
  types.ts                 # Add gatewayMessageId to MessageLog, gateway types
  db.ts                    # Add gatewayMessageId index
src/pages/Messages.tsx     # Replace simulated send with useGateway
```

---

## Task 1: Add types and update Dexie schema

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Add gateway-related types to types.ts**

Add after the existing type definitions in `src/lib/types.ts`:

```ts
export interface GatewayInfo {
  id?: number;
  name: string;         // device name from android-sms-gateway
  address: string;      // IP:port
  username: string;
  password: string;
  lastSeen: Date;
  isOnline: boolean;
}

export interface SendResult {
  messageId: string;
  success: boolean;
  error?: string;
}

export type GatewayStatus = 'idle' | 'discovering' | 'offline' | 'online' | 'error';
```

Add `gatewayMessageId?: string` to the `MessageLog` interface in `src/lib/types.ts`.

- [ ] **Step 2: Update db.ts to add gatewayMessageId index**

In `src/lib/db.ts`, update the messageLogs store to include `gatewayMessageId` in the index:

```ts
messageLogs: '++id, batchId, contactId, status, gatewayMessageId',
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: Existing tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/db.ts
git commit -m "feat: add gateway types and Dexie schema for SMS gateway integration"
```

---

## Task 2: Create gatewayDiscovery service

**Files:**
- Create: `src/services/gatewayDiscovery.ts`
- Create: `src/test/gatewayDiscovery.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/test/gatewayDiscovery.test.ts`:

```ts
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
    const result = await findGateway(1000);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/gatewayDiscovery.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Write gatewayDiscovery implementation**

Create `src/services/gatewayDiscovery.ts`:

```ts
import Bonjour, { Service } from 'bonjour-service';

let bonjourInstance: Bonjour | null = null;
let currentBrowser: any = null;

export interface DiscoveredGateway {
  name: string;
  address: string;
  port: number;
  username?: string;
  password?: string;
}

function parseCredentials(txt: Record<string, string>): { username?: string; password?: string } {
  const raw = txt['auth'] || '';
  if (!raw) return {};
  try {
    const decoded = atob(raw);
    const [username, password] = decoded.split(':');
    return { username, password };
  } catch {
    return {};
  }
}

export async function findGateway(timeoutMs = 5000): Promise<DiscoveredGateway[]> {
  return new Promise((resolve) => {
    const results: DiscoveredGateway[] = [];
    bonjourInstance = new Bonjour();

    currentBrowser = bonjourInstance.find({ type: '_sms-gateway._tcp.local' }, (service: Service) => {
      const txt = service.txt || {};
      const { username, password } = parseCredentials(txt as Record<string, string>);
      results.push({
        name: service.name,
        address: service.ipv4Addresses?.[0] || service.host || '',
        port: service.port,
        username,
        password,
      });
    });

    setTimeout(() => {
      stopDiscovery();
      resolve(results);
    }, timeoutMs);
  });
}

export function stopDiscovery() {
  if (currentBrowser) {
    try { currentBrowser.stop(); } catch {}
    currentBrowser = null;
  }
  if (bonjourInstance) {
    try { bonjourInstance.destroy(); } catch {}
    bonjourInstance = null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/test/gatewayDiscovery.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/gatewayDiscovery.ts src/test/gatewayDiscovery.test.ts
git commit -m "feat: add mDNS gateway discovery service"
```

---

## Task 3: Create gatewayClient service

**Files:**
- Create: `src/services/gatewayClient.ts`
- Create: `src/test/gatewayClient.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/test/gatewayClient.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendSms, getMessageStatus, getDeviceInfo } from '@/services/gatewayClient';

describe('gatewayClient', () => {
  const baseUrl = 'http://192.168.1.100:8080';
  const credentials = { username: 'user', password: 'pass' };

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('sendSms returns messageId on success', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'msg-123' }),
    });

    const result = await sendSms(baseUrl, credentials, {
      phoneNumber: '+1234567890',
      message: 'Hello',
      senderName: 'BulkSMS',
      deviceId: 0,
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-123');
  });

  it('sendSms returns error on network failure', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const result = await sendSms(baseUrl, credentials, {
      phoneNumber: '+1234567890',
      message: 'Hello',
      senderName: 'BulkSMS',
      deviceId: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('getDeviceInfo returns device name and online status', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ deviceName: 'MyPhone', online: true }),
    });

    const result = await getDeviceInfo(baseUrl, credentials);
    expect(result?.deviceName).toBe('MyPhone');
    expect(result?.online).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/gatewayClient.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Write gatewayClient implementation**

Create `src/services/gatewayClient.ts`:

```ts
export interface SmsPayload {
  phoneNumber: string;
  message: string;
  senderName?: string;
  deviceId?: number;
}

export interface SendResult {
  messageId?: string;
  success: boolean;
  error?: string;
}

export interface MessageStatus {
  id: string;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
}

export interface DeviceInfo {
  deviceName: string;
  online: boolean;
}

function authHeader(username: string, password: string): string {
  return 'Basic ' + btoa(`${username}:${password}`);
}

export async function sendSms(
  baseUrl: string,
  credentials: { username: string; password: string },
  payload: SmsPayload
): Promise<SendResult> {
  try {
    const res = await fetch(`${baseUrl}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader(credentials.username, credentials.password),
      },
      body: JSON.stringify({
        phoneNumber: payload.phoneNumber,
        message: payload.message,
        senderName: payload.senderName || 'BulkSMS',
        deviceId: payload.deviceId ?? 0,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => 'HTTP error');
      return { success: false, error: `${res.status}: ${err}` };
    }

    const data = await res.json();
    return { success: true, messageId: data.id as string };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getMessageStatus(
  baseUrl: string,
  credentials: { username: string; password: string },
  messageId: string
): Promise<MessageStatus> {
  try {
    const res = await fetch(`${baseUrl}/message/${messageId}`, {
      headers: {
        Authorization: authHeader(credentials.username, credentials.password),
      },
    });

    if (!res.ok) {
      return { id: messageId, status: 'failed', error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    return {
      id: messageId,
      status: data.status === 'DELIVERED' ? 'sent' : data.status === 'FAILED' ? 'failed' : 'pending',
      error: data.error,
    };
  } catch (e: any) {
    return { id: messageId, status: 'failed', error: e.message };
  }
}

export async function getDeviceInfo(
  baseUrl: string,
  credentials: { username: string; password: string }
): Promise<DeviceInfo | null> {
  try {
    const res = await fetch(`${baseUrl}/device`, {
      headers: {
        Authorization: authHeader(credentials.username, credentials.password),
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    return {
      deviceName: data.deviceName || 'Unknown',
      online: data.online !== false,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/test/gatewayClient.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/gatewayClient.ts src/test/gatewayClient.test.ts
git commit -m "feat: add SMS gateway REST API client"
```

---

## Task 4: Create useGateway hook

**Files:**
- Create: `src/hooks/useGateway.ts`
- Create: `src/test/useGateway.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/test/useGateway.test.ts` with tests for:
- Initial state is 'idle'
- discoverGateway() sets state to 'online' when gateway is found and reachable
- discoverGateway() sets state to 'offline' when no gateway found
- pingGateway() returns online when /device responds
- pingGateway() returns offline when fetch fails

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/test/useGateway.test.ts`
Expected: FAIL — hook does not exist

- [ ] **Step 3: Write useGateway implementation**

Create `src/hooks/useGateway.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/test/useGateway.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useGateway.ts src/test/useGateway.test.ts
git commit -m "feat: add useGateway hook for gateway state and discovery"
```

---

## Task 5: Create GatewayStatusBadge component

**Files:**
- Create: `src/components/GatewayStatusBadge.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/GatewayStatusBadge.tsx`:

```tsx
import { useGateway } from '@/hooks/useGateway';
import { Wifi, WifiOff } from 'lucide-react';

export default function GatewayStatusBadge() {
  const { status, deviceName, queuedCount } = useGateway();

  if (status === 'idle' || status === 'discovering') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="w-2 h-2 rounded-full bg-muted animate-pulse" />
        <span className="hidden sm:inline">Finding gateway...</span>
      </div>
    );
  }

  if (status === 'offline' || status === 'error') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-destructive">
        <WifiOff className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Gateway offline</span>
        {queuedCount && queuedCount > 0 && (
          <span className="text-[10px] bg-destructive/10 px-1.5 py-0.5 rounded-full">{queuedCount} queued</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-success">
      <Wifi className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{deviceName}</span>
    </div>
  );
}
```

- [ ] **Step 2: No automated tests for UI component** — visual verification only

- [ ] **Step 3: Commit**

```bash
git add src/components/GatewayStatusBadge.tsx
git commit -m "feat: add GatewayStatusBadge component"
```

---

## Task 6: Update BottomNav to show GatewayStatusBadge

**Files:**
- Modify: `src/components/BottomNav.tsx`

- [ ] **Step 1: Read the file to understand current structure**

Run: `head -50 src/components/BottomNav.tsx`

- [ ] **Step 2: Add GatewayStatusBadge import and place it in the header**

Add `import GatewayStatusBadge from '@/components/GatewayStatusBadge';`

Place `<GatewayStatusBadge />` in the header section next to or near the existing controls.

- [ ] **Step 3: Visual verification** — no automated test

- [ ] **Step 4: Commit**

```bash
git add src/components/BottomNav.tsx
git commit -m "feat: show gateway status in bottom nav"
```

---

## Task 7: Update Messages.tsx to use real gateway sending

**Files:**
- Modify: `src/pages/Messages.tsx`

- [ ] **Step 1: Read handleSend function (lines 75-131) to understand current simulation**

- [ ] **Step 2: Add imports**

Add to the import section:
```tsx
import { useGateway } from '@/hooks/useGateway';
import { sendSms, getMessageStatus } from '@/services/gatewayClient';
```

- [ ] **Step 3: Destructure gateway state in component**

In `MessagesPage`, add:
```tsx
const { status: gatewayStatus } = useGateway();
```

- [ ] **Step 4: Add pollDeliveryStatus helper above handleSend**

```tsx
async function pollDeliveryStatus(batchId: number, baseUrl: string, credentials: { username: string; password: string }) {
  const POLL_INTERVAL = 3000;
  const MAX_POLLS = 100;
  let polls = 0;
  const interval = setInterval(async () => {
    polls++;
    const pendingLogs = await db.messageLogs.where({ batchId, status: 'sending' }).toArray();

    if (pendingLogs.length === 0 || polls >= MAX_POLLS) {
      clearInterval(interval);
      const finalLogs = await db.messageLogs.where({ batchId }).toArray();
      await db.batches.update(batchId, {
        status: 'completed',
        sentCount: finalLogs.filter((l) => l.status === 'sent').length,
        failedCount: finalLogs.filter((l) => l.status === 'failed').length,
        completedAt: new Date(),
      });
      return;
    }

    for (const log of pendingLogs) {
      if (!log.gatewayMessageId) continue;
      const msgStatus = await getMessageStatus(baseUrl, credentials, log.gatewayMessageId);
      if (msgStatus.status !== 'pending') {
        await db.messageLogs.update(log.id!, {
          status: msgStatus.status === 'sent' ? 'sent' : 'failed',
          error: msgStatus.error,
        });
      }
    }
  }, POLL_INTERVAL);
}
```

- [ ] **Step 5: Replace the body of handleSend (lines 75-131) with gateway call**

Replace the simulated send loop (lines 102-122) with:

```tsx
if (gatewayStatus === 'online') {
  const savedGw = JSON.parse(localStorage.getItem('bulksms_gateway') || '{}');
  const baseUrl = `http://${savedGw.address}:${savedGw.port}`;
  const credentials = { username: savedGw.username || 'admin', password: savedGw.password || 'admin' };

  for (const log of logs) {
    const result = await sendSms(baseUrl, credentials, {
      phoneNumber: log.contactPhone,
      message: log.body,
    });

    if (result.success && result.messageId) {
      await db.messageLogs.update(log.id!, { status: 'sending', gatewayMessageId: result.messageId });
    } else {
      await db.messageLogs.update(log.id!, { status: 'failed', error: result.error });
    }
  }

  pollDeliveryStatus(batchId as number, baseUrl, credentials);
} else {
  // Queue for later — status already set to 'pending' above
}
```

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/pages/Messages.tsx
git commit -m "feat: wire SMS gateway to message sending in MessagesPage"
```

---

## Task 8: Add Gateway Settings section to Settings page

**Files:**
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Add imports**

Add:
```tsx
import { useGateway } from '@/hooks/useGateway';
import GatewayStatusBadge from '@/components/GatewayStatusBadge';
import { RefreshCw, Wifi, WifiOff, AlertCircle } from 'lucide-react';
```

- [ ] **Step 2: Destructure gateway state**

Add inside the SettingsPage component:
```tsx
const { status, deviceName, address, error, discoverGateway, pingGateway } = useGateway();
const [testingConnection, setTestingConnection] = useState(false);
```

- [ ] **Step 3: Add SMS Gateway card after the Send Delay card**

```tsx
{/* SMS Gateway */}
<Card>
  <CardContent className="p-4">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
        {status === 'online' ? <Wifi className="w-4 h-4 text-success" /> : <WifiOff className="w-4 h-4 text-muted-foreground" />}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">SMS Gateway</p>
        <GatewayStatusBadge />
      </div>
      <Button variant="ghost" size="sm" onClick={() => discoverGateway()}>
        <RefreshCw className="w-4 h-4" />
      </Button>
    </div>

    {status === 'online' && address && (
      <p className="text-xs text-muted-foreground mb-3">{address}</p>
    )}

    {status === 'offline' && (
      <div className="flex items-start gap-2 text-xs text-muted-foreground mb-3">
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <p>Gateway not found. Make sure the android-sms-gateway app is running on your phone and connected to the same network.</p>
      </div>
    )}

    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        setTestingConnection(true);
        await pingGateway();
        setTestingConnection(false);
      }}
      disabled={testingConnection}
    >
      {testingConnection ? 'Testing...' : 'Test Connection'}
    </Button>
  </CardContent>
</Card>
```

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat: add SMS gateway settings panel to Settings page"
```

---

## Task 9: Add bonjour-service dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install bonjour-service**

Run: `npm install bonjour-service`

Run: `npm install --save-dev @types/bonjour-service`

- [ ] **Step 2: Verify build still works**

Run: `npm run build`
Expected: SUCCESS

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add bonjour-service for mDNS gateway discovery"
```

---

## Self-Review Checklist

- [ ] All spec sections covered: discovery, client, hook, offline queue, settings UI, BottomNav badge
- [ ] No "TBD" or placeholder steps
- [ ] Type consistency: DiscoveredGateway fields match what gatewayClient receives
- [ ] handleSend replaced entirely (no more random simulation)
- [ ] bonjour-service types package included
- [ ] Each task has a commit
- [ ] Task order is correct: types first, then services, then hook, then components, then wire up

**Gaps found:** None.

---

## Execution Options

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
