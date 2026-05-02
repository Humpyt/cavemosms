# Android SMS Gateway Integration Design

## Context

The BulkSMS app currently simulates SMS sending with random delays and random success/failure (Messages.tsx lines 102-122). It has no real SMS delivery capability. The goal is to integrate with the open-source [android-sms-gateway](https://github.com/capcom6/android-sms-gateway) project, which turns an Android phone into a programmable SMS gateway accessible via REST API on the local network.

**Key user decisions:**
- Discovery: mDNS/Bonjour auto-discovery on local network
- Gateway count: Single gateway at a time
- Identity: Device name + online/offline status indicator
- Offline behavior: Queue messages for later delivery
- Status updates: Polling (no webhooks)

---

## Architecture

### High-Level Data Flow

```
User sends message
  → App validates recipients + message
  → Check gateway connectivity
    → Gateway ONLINE:
      → POST /message for each recipient
      → Store MessageLog entries with status "sending"
      → Poll GET /message/{id} every 3 seconds until all complete
      → Update MessageLog status → "sent" or "failed"
    → Gateway OFFLINE:
      → Store MessageLog entries with status "pending"
      → When gateway comes online: detect via mDNS + polling, then send queued messages

mDNS Discovery
  → App starts → scan for _sms-gateway._tcp.local
  → Found → store IP, port, credentials
  → Not found → show "gateway not found" state
```

### New Architecture Components

```
src/
  services/
    gatewayDiscovery.ts   # mDNS/Bonjour scanning for _sms-gateway._tcp.local
    gatewayClient.ts       # HTTP client for SMS Gateway REST API
    messageQueue.ts        # Offline queue management
  hooks/
    useGateway.ts          # Gateway connection state, auto-discovery, polling
  components/
    GatewayStatusBadge.tsx # Online/offline indicator with device name
```

### Gateway REST API (android-sms-gateway)

Base URL: `http://{gateway_ip}:{port}`

| Method | Path | Purpose |
|--------|------|---------|
| POST | /message | Send SMS |
| GET | /message/{id} | Get message status |
| GET | /device | Device info (name, SIM status) |

Authentication: Basic Auth (`Authorization: Basic base64(username:password)`)

**Send SMS payload:**
```json
POST /message
{
  "phoneNumber": "+1234567890",
  "message": "Hello {name}",
  "senderName": "BulkSMS",
  "deviceId": 0  // SIM slot 0 or 1
}
```

---

## Design

### 1. Gateway Discovery Service

Uses the `bonjour-service` npm package to resolve mDNS/Bonjour records.

> **Note:** `bonjour-service` uses the browser's mDNS/NSD APIs where available. In Capacitor's webview, this may work on Android 10+ with multicast support. If mDNS discovery is unreliable in the webview, the app falls back to the manual URL entry in settings. The discovery service should also attempt a direct HTTP probe to common gateway ports (8080, 8088) on the local subnet as a fallback.

**Service type:** `_sms-gateway._tcp.local`

**Published TXT record** from android-sms-gateway contains:
- `path` — HTTP server path (usually `/`)
- `auth` — Basic Auth credentials needed

**Flow:**
1. On app startup, publish a resolve query for `_sms-gateway._tcp.local`
2. On each resolved result, extract `host`, `port`, `txt` record
3. Store resolved gateway info in Dexie `settings` table
4. If multiple found, let user pick (or auto-select first)
5. Re-run discovery every 60 seconds to detect gateway changes

### 2. Gateway Client Service

Typed HTTP client wrapping fetch with Basic Auth.

**Endpoints used:**
- `POST /message` — send single SMS
- `GET /message/{id}` — check delivery status
- `GET /device` — get device name and SIM info (for status indicator)

**Error handling:**
- Network error → treat as offline, queue message
- HTTP 401 → credentials invalid
- HTTP 400 → malformed request (bad phone number)
- HTTP 500 → gateway error

### 3. Gateway Hook (`useGateway`)

Central hook managing:
- Gateway discovery state (idle/discovering/found/not-found)
- Current gateway address + credentials
- Online/offline polling (ping `/device` every 10 seconds)
- Queued messages count
- Send function wrapping the full send flow

**States:**
```ts
type GatewayState =
  | { status: 'idle' }
  | { status: 'discovering' }
  | { status: 'offline', lastSeen?: Date }
  | { status: 'online', deviceName: string, address: string }
  | { status: 'error', message: string }
```

### 4. Message Send Flow (updated `handleSend`)

**Current (simulated):** lines 102-122 of Messages.tsx

**New flow:**
1. Call `useGateway().sendMessages(batchId, recipients, body)`
2. `sendMessages` loops over recipients:
   a. If gateway online → POST /message immediately
   b. If gateway offline → store with status "pending", return
3. If online, after each POST, store returned `messageId` in `MessageLog.gatewayMessageId`
4. Start polling `getMessageStatus(batchId)` every 3 seconds while any log in batch is "sending"
5. Stop polling when all logs are "sent" or "failed" or after 5 minutes timeout

### 5. Offline Queue

- `MessageLog.status === 'pending'` when queued for later
- `MessageLog.gatewayMessageId` stores the message ID for polling
- `MessageLog.scheduledAt` — when to send (for scheduled messages)
- On gateway reconnect → scan for pending logs → resume sending
- Background polling for queued messages: check every 30 seconds

### 6. Settings Page Changes

Add a new **SMS Gateway** section in `SettingsPage.tsx`:

- **Gateway status card** — shows device name, IP address, online/offline badge
- **Discovery button** — manually trigger mDNS discovery
- **Manual fallback** — if mDNS fails, allow manual IP:port + credentials entry
- **Test connection button** — sends a ping to /device to verify connectivity
- Remove or update the privacy section (now makes network requests to gateway)

### 7. UI Changes

**BottomNav or Header:** Add `GatewayStatusBadge` component showing:
- Green dot + device name when online
- Red dot + "Gateway offline" when offline
- Gray dot + "No gateway" when not discovered

**Send button in composer:** Show spinner + "Sending via {deviceName}" during send, disable if no gateway.

**BatchCard:** Already displays status colors — status "sending" maps to "sending" state from the gateway.

---

## Error Handling

| Error | User-facing behavior |
|-------|---------------------|
| Gateway not found on network | Banner: "No gateway found — messages will be queued" |
| Send fails (network) | Retry up to `settings.maxRetries`, then mark "failed" with error |
| Invalid credentials | Show error in settings: "Check gateway username/password" |
| Gateway offline mid-send | Pause remaining sends, queue them, show "Gateway went offline" toast |
| Message rejected by gateway (invalid number) | Mark that specific log as "failed", continue others |

---

## Testing Strategy

1. **Unit tests** for `gatewayClient.ts` and `gatewayDiscovery.ts` (mock fetch, mock bonjour)
2. **Integration tests** for message send flow with a mock gateway server
3. **Manual testing** on device with android-sms-gateway app installed on same network

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/services/gatewayDiscovery.ts` | mDNS/Bonjour service |
| `src/services/gatewayClient.ts` | REST API HTTP client |
| `src/services/messageQueue.ts` | Offline queue management |
| `src/hooks/useGateway.ts` | Main gateway state hook |
| `src/components/GatewayStatusBadge.tsx` | Status indicator UI |
| `src/components/GatewaySettings.tsx` | Gateway config UI (in Settings page) |

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Messages.tsx` | Replace simulated send with `useGateway().sendMessages()` |
| `src/pages/Settings.tsx` | Add SMS Gateway settings section |
| `src/lib/types.ts` | Add `gatewayMessageId` to `MessageLog`, add gateway types |
| `src/lib/db.ts` | Add index on `gatewayMessageId` |
| `src/components/BottomNav.tsx` | Add `GatewayStatusBadge` |
| `package.json` | Add `bonjour-service` dependency |
| `CLAUDE.md` | Document new gateway integration |
