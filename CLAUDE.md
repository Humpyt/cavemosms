# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Camo SMS is a React-based PWA + Android app for sending bulk SMS messages via the device's native SMS capabilities. Built with Vite, TypeScript, shadcn-ui, Tailwind CSS, and Capacitor (Android). Uses license-gated activation against a remote licensing server.

## Commands

```sh
npm run dev                    # Vite dev server (port 8080)
npm run build                  # Production build to dist/
npm run build:dev              # Development-mode build
npm run lint                   # ESLint
npm test                       # Vitest (run)
npm run test:watch             # Vitest (watch)
npx cap sync android           # Sync web assets + plugins into Android project
cd android && .\gradlew.bat :app:compileDebugJavaWithJavac   # Validate Java compile
```

## Monorepo Structure

Three distinct projects live side-by-side:

| Directory | Purpose |
|-----------|---------|
| `src/` (root) | Main PWA/Android app — React + Capacitor |
| `licensing-platform/` | Node.js Express backend for license activation (API at `uglive.io`) |
| `website/` | Standalone Vite project for the product landing page |
| `android/` | Capacitor Android host + native `NativeSmsPlugin` Java code |

## Architecture

### Launch Flow
1. `App.tsx` renders `QueryClientProvider` + `TooltipProvider` wrapper
2. `AppContent` waits for settings (Dexie) and license check (fetch to licensing server)
3. If `unauthorized` → renders `LicenseGate` (email/password → `POST /api/activate`)
4. If `authorized` → renders `NativeSmsProvider` wrapping tab navigation

### Routing & Navigation
- Single-page app with tab-based navigation via `BottomNav` component
- Active tab (`TabId`) stored in local state, renders the matching page component
- Pages: `src/pages/Messages.tsx`, `Contacts.tsx`, `Templates.tsx`, `Analytics.tsx`, `Settings.tsx`
- Page transitions via `framer-motion` `AnimatePresence`

### Database (Dexie/IndexedDB)
- `src/lib/db.ts` exports `db` connected to `"BulkSMSApp"` (v3 schema)
- Tables: `contacts`, `groups`, `templates`, `batches`, `messageLogs`, `settings`
- `getSettings()` merges persisted settings with defaults; `updateSettings()` for partial updates
- Types in `src/lib/types.ts`: `Contact`, `Group`, `MessageTemplate`, `MessageBatch`, `MessageLog`, `AppSettings`, `NativeSmsCapability`, etc.

### Native SMS (Capacitor Plugin)
SMS sending is done via a custom Capacitor plugin (`NativeSms`) backed by Android's `SmsManager`.

**Frontend (TypeScript):**
- `src/plugins/nativeSms.ts` — Capacitor plugin bridge definition (`registerPlugin<NativeSmsPlugin>('NativeSms')`)
- `src/hooks/useNativeSms.tsx` — React context provider wrapping all native SMS state:
  - Fetches device capability (dual-SIM, permissions, manufacturer)
  - Polls native queue stats every 5s
  - Syncs events from Android → updates IndexedDB `MessageLog` rows
  - Calls `processNativeSmsQueue()` on interval and on window focus/resume
  - Exposes `canSend`, `queuedCount`, `serviceStatus`, permission request helpers
- `src/services/nativeSmsQueue.ts` — queue processing logic:
  - Loads pending logs from Dexie, respects send delay between messages
  - Pushes to native queue via `NativeSms.enqueueNativeQueue()`, then `processNativeQueueNow()`
  - Handles retries with exponential backoff (15s × 2^attempt)
  - Recovers stale `sending`-status logs after 2min timeout
  - `handleNativeSmsStatusEvent()` maps native events back to Dexie rows
- `src/components/SmsStatusBadge.tsx` — header badge showing SMS readiness

**Android (Java):**
- `NativeSmsPlugin.java` — Capacitor plugin class: `getStatus`, `requestSmsPermission`, `send`, `enqueueNativeQueue`, `processNativeQueueNow`, `drainNativeEvents`
  - Sends SMS via `SmsManager` with multipart support and dual-SIM subscription selection
  - Registers `BroadcastReceiver` for `SMS_SENT` intent — emits `smsStatusChanged` events to JS
  - Persists events buffer in `SharedPreferences` for cross-process delivery
- `NativeSmsQueueScheduler.java` — Android WorkManager integration: persistent JSON queue in `SharedPreferences`
  - Periodic worker every 15min + immediate one-shot dispatch
  - `processDueQueue()` sends eligible items, handles retries, persists events
- `NativeSmsQueueWorker.java` — WorkManager `Worker` that calls `processDueQueue()`
- `NativeSmsBootReceiver.java` — reschedules the periodic worker on device boot

### Licensing
- `src/hooks/useLicenseAuth.ts` — manages auth state machine (`checking → unauthorized → authorized`)
  - Talks to `VITE_LICENSE_API_URL` (defaults to `https://uglive.io`)
  - Stores token + user + license data in `localStorage`
  - 5-minute heartbeat interval while authorized
- `src/components/LicenseGate.tsx` — login form UI (email + password + activate button)
- `licensing-platform/server.js` — Express backend:
  - `POST /api/activate` — validates credentials, creates/updates device-bound license, returns JWT
  - `GET /api/license/status` — verifies token validity
  - `POST /api/license/heartbeat` — refreshes last-seen timestamp
  - Uses `data.json` flat-file DB, bcrypt for passwords
- `Settings` page has a logout button that calls `license.logout()`

### State Management
- `useAppSettings` hook (`src/hooks/useAppSettings.ts`) — app settings via Dexie (language, theme, sendDelay, maxRetries, preferredSubscriptionId)
- `useNativeSms` hook (`src/hooks/useNativeSms.tsx`) — all SMS capability + queue state
- `useLicenseAuth` hook — licensing auth state
- React Query (`@tanstack/react-query`) available but largely unused (local-first architecture)

### i18n
- `src/lib/i18n.ts` — translation map; `lang` prop passed to each page
- Supported: English, Spanish, French, German, Portuguese, Arabic, Chinese, Hindi

## Coding Style

- TypeScript + React function components, 2-space indentation
- Components: `PascalCase`, hooks: `useXxx.ts`, services: `camelCase.ts`
- Use `@/` path alias (maps to `src/`)
- shadcn-ui components in `src/components/ui/`, custom components in `src/components/`
- Tailwind CSS with `tailwind.config.ts` — use existing utility patterns
- Run `npm run lint` before committing; Conventional Commits (`feat: ...`, `fix: ...`)

## Testing

- Vitest with jsdom; test files in `src/test/` as `*.test.ts` / `*.test.tsx`
- Focus tests on queue logic, CSV parsing, hooks, and other behavior boundaries
