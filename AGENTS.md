# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains all app code.
  - `pages/` tab screens (`Messages`, `Contacts`, `Templates`, `Analytics`, `Settings`).
  - `components/` reusable UI and feature components; `components/ui/` is the shared shadcn/Radix layer.
  - `hooks/` app hooks (`useAppSettings`, `useNativeSms`, etc.).
  - `services/` operational logic (queueing, gateway/native SMS behavior).
  - `lib/` shared utilities, types, DB (`Dexie`) and i18n.
  - `plugins/` Capacitor plugin TypeScript bridge definitions.
- `android/` native Android project (Capacitor host + `NativeSmsPlugin` Java code).
- `public/` static assets and PWA icons.
- `src/test/` Vitest setup/tests.

## Build, Test, and Development Commands
- `npm run dev` — start local Vite dev server.
- `npm run build` — production web build to `dist/`.
- `npm run build:dev` — development-mode build.
- `npm run lint` — run ESLint on the codebase.
- `npm test` — run Vitest once.
- `npx cap sync android` — sync web assets/plugins into Android project.
- `cd android && .\gradlew.bat :app:compileDebugJavaWithJavac` — validate native Java compile.

## Coding Style & Naming Conventions
- Language: TypeScript + React function components.
- Indentation: 2 spaces; prefer concise, readable JSX.
- Naming:
  - Components: `PascalCase` (`ImportContactsDialog.tsx`).
  - Hooks: `useXxx` (`useNativeSms.tsx`).
  - Utility/service files: `camelCase` (`nativeSmsQueue.ts`).
- Use existing Tailwind + shadcn patterns; avoid one-off style systems.
- Run `npm run lint` before pushing.

## Testing Guidelines
- Framework: Vitest (`src/test/`).
- Test files: `*.test.ts` / `*.test.tsx`.
- Keep tests near behavior boundaries (queue logic, parsing, hooks).
- Minimum expectation for changes: add/update tests for non-trivial logic paths.

## Commit & Pull Request Guidelines
- Follow Conventional Commit style seen in history: `feat: ...`, `fix: ...` (optional scope).
- Keep commits focused (one logical change per commit).
- PRs should include:
  - clear summary + rationale,
  - testing notes (web build, lint, native compile if touched),
  - screenshots/video for UI changes,
  - linked issue/task when available.

## Security & Configuration Tips
- Never commit secrets or device-specific credentials.
- Validate Android permissions/manifest changes carefully (`SEND_SMS`, `READ_PHONE_STATE`, boot/work manager behavior).
- For queue/retry logic, prefer idempotent updates and explicit failure states.
