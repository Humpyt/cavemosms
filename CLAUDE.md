# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BulkSMS is a React-based mobile-first PWA for sending bulk SMS messages. Built with Vite, TypeScript, shadcn-ui, Tailwind CSS, and Capacitor for mobile deployment.

## Commands

```sh
npm run dev          # Start Vite dev server (port 8080)
npm run build        # Production build to dist/
npm run build:dev   # Development build
npm run lint         # Run ESLint
npm test             # Run Vitest tests
npm run test:watch   # Watch mode for tests
```

## Architecture

### Routing & Navigation
- Single-page app with tab-based navigation via `BottomNav` component
- Active tab stored in state (`activeTab: TabId`), renders corresponding page component
- Pages: `Messages`, `Contacts`, `Templates`, `Analytics`, `Settings` in `src/pages/`

### Database (Dexie/IndexedDB)
- `src/lib/db.ts` exports a `db` instance connected to "BulkSMSApp"
- Tables: `contacts`, `groups`, `templates`, `batches`, `messageLogs`, `settings`
- Settings helper functions: `getSettings()`, `updateSettings()` in `db.ts`
- Types for all entities in `src/lib/types.ts`

### State Management
- `useAppSettings` hook (`src/hooks/useAppSettings.ts`) for app settings (language, theme, sendDelay, maxRetries)
- React Query (`@tanstack/react-query`) available for server-state management
- Local state used for UI state (active tab, dialogs, onboarding)

### i18n
- Language passed as `lang` prop to pages
- Implementation in `src/lib/i18n.ts`
- Supported languages defined in `src/lib/types.ts` (`LANGUAGES` array)

### UI Components
- shadcn-ui components in `src/components/ui/` (Radix UI based)
- Custom components in `src/components/` (BottomNav, ImportContactsDialog, OnboardingWalkthrough, etc.)
- Tailwind CSS for styling with `tailwind.config.ts`

### Mobile/PWA
- Capacitor config in `capacitor.config.ts` (appId, webDir, server URL)
- PWA manifest and service worker via `vite-plugin-pwa` in `vite.config.ts`
- PWA icons in `public/pwa-icon-192.png` and `public/pwa-icon-512.png`

### Key Libraries
- `dexie` + `dexie-react-hooks` for IndexedDB
- `react-hook-form` + `zod` + `@hookform/resolvers` for form validation
- `framer-motion` for page transitions
- `recharts` for analytics charts
- `date-fns` for date manipulation
- `next-themes` for dark/light mode theming
- `bonjour-service` for mDNS/Bonjour SMS gateway discovery

### SMS Gateway Integration
SMS messages are sent via [android-sms-gateway](https://github.com/capcom6/android-sms-gateway) running on a local Android phone.

**Services:**
- `src/services/gatewayDiscovery.ts` — mDNS discovery on `_sms-gateway._tcp.local` using `bonjour-service`
- `src/services/gatewayClient.ts` — REST API client for gateway (sendSms, getMessageStatus, getDeviceInfo)
- `src/hooks/useGateway.ts` — central hook: gateway state, auto-discovery, ping polling (every 10s), offline queue
- `src/components/GatewayStatusBadge.tsx` — online/offline indicator in nav bar

**Data flow:**
1. App starts → mDNS discovers gateway on local network → pings `/device` for status
2. User sends message → if gateway online, POSTs to `/message` for each recipient → stores `gatewayMessageId` on each `MessageLog`
3. Polls `GET /message/{id}` every 3s until all delivered (max 100 polls)
4. If gateway offline → messages queued with `status: 'pending'` in IndexedDB → sent when gateway comes back online

**Gateway credentials:** Stored in localStorage under key `bulksms_gateway` after mDNS discovery. The TXT record from the gateway contains `auth: base64(username:password)`.

**Settings page:** SMS Gateway card shows device name, IP address, online/offline status, discover button, and test connection button.
