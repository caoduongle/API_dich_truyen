# Tasks: Fix CSP Blocking Google OAuth PKCE and Accessibility Defects

**Feature**: [`064-fix-csp-oauth-a11y`](./spec.md)  
**Spec**: [`specs/064-fix-csp-oauth-a11y/spec.md`](./spec.md) | **Plan**: [`specs/064-fix-csp-oauth-a11y/plan.md`](./plan.md)  
**Status**: Completed  

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize static asset directory structure

- [X] T001 Ensure `public/` directory exists at repository root for static asset distribution

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Verify baseline quality gates and test suite health before modifying code

- [X] T002 Verify baseline test suite execution via `npm test`

**Checkpoint**: Baseline verified - user story implementation can begin

---

## Phase 3: User Story 1 - Unblock Production Google OAuth PKCE Flow (Priority: P1) 🎯 MVP

**Goal**: Allow browser client to exchange PKCE authorization code for access token and fetch user profile without `connect-src` CSP blocking in production.

**Independent Test**: Run `npx vitest run server/__tests__/securityHeaders.test.ts` to confirm production headers include Google OAuth and userinfo endpoints in `connect-src`.

### Tests for User Story 1

- [X] T003 [P] [US1] Update security header tests in `server/__tests__/securityHeaders.test.ts` to assert `connect-src` includes `https://oauth2.googleapis.com` and `https://www.googleapis.com`

### Implementation for User Story 1

- [X] T004 [US1] Add `https://oauth2.googleapis.com` and `https://www.googleapis.com` to `connectSrc` in `server.ts`
- [X] T005 [US1] Verify `server/__tests__/securityHeaders.test.ts` passes with updated CSP configuration

**Checkpoint**: User Story 1 complete. Google OAuth PKCE endpoints are explicitly permitted in production CSP.

---

## Phase 4: User Story 2 - Eliminate CSP Inline Script Violation via Extracted Theme Initializer (Priority: P2)

**Goal**: Eliminate inline script CSP error (`script-src-elem`) on application boot while preserving instantaneous theme application before DOM paint.

**Independent Test**: Load application in browser under production build and confirm `/theme-init.js` loads with 200, applies theme attributes to `<html>`, and triggers zero CSP script violations.

### Implementation for User Story 2

- [X] T006 [P] [US2] Create standalone `public/theme-init.js` containing IIFE theme and custom color initialization extracted from `index.html`
- [X] T007 [US2] Update `index.html` to replace inline `<script>` block with `<script src="/theme-init.js"></script>`

**Checkpoint**: User Story 2 complete. Theme initializes cleanly from an external static file compliant with `script-src 'self'`.

---

## Phase 5: User Story 3 - Accessible Credential Form Controls in Google Sync Modal (Priority: P3)

**Goal**: Bind form labels programmatically to Client ID and Picker Key inputs in Google Sync Modal for full WCAG compliance and improved UX.

**Independent Test**: In Google Sync Modal credentials drawer, verify clicking "OAuth Client ID" and "Picker API Key" labels focuses their respective input controls.

### Implementation for User Story 3

- [X] T008 [US3] Add `htmlFor="google-oauth-client-id"` and `id="google-oauth-client-id"` in `src/components/google-sync/GoogleSyncModal.tsx`
- [X] T009 [US3] Add `htmlFor="google-picker-api-key"` and `id="google-picker-api-key"` in `src/components/google-sync/GoogleSyncModal.tsx`

**Checkpoint**: User Story 3 complete. Form labels and inputs are programmatically bound.

---

## Phase 6: Polish & Quality Gates Verification

**Purpose**: Execute all non-negotiable quality checks per AGENTS.md and verify stylesheet DevTools notice

- [X] T010 Run type check via `npm run lint` (`tsc --noEmit`) to ensure 0 type errors
- [X] T011 Run full test suite via `npm test` (`vitest run`) to ensure 100% test pass rate
- [X] T012 Run full production build via `npm run build` (`vite build && esbuild server.ts`)
- [X] T013 Inspect DevTools Network tab for Google Fonts stylesheet URL status

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1.
- **User Story 1 (Phase 3 - P1)**: Depends on Phase 2.
- **User Story 2 (Phase 4 - P2)**: Independent of US1; can proceed concurrently or sequentially.
- **User Story 3 (Phase 5 - P3)**: Independent of US1 and US2; can proceed concurrently or sequentially.
- **Polish (Phase 6)**: Depends on completion of all user story implementations.

### Parallel Opportunities
- T003 ([US1] test) and T006 ([US2] theme script) target completely different files and can be prepared in parallel.
- US1 (`server.ts`), US2 (`public/theme-init.js` + `index.html`), and US3 (`GoogleSyncModal.tsx`) touch disjoint files.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Setup (T001) + Foundational (T002).
2. Complete User Story 1 (T003 - T005).
3. Validate CSP production headers.

### Incremental Delivery
1. US1: Fix CSP connectSrc allowlist for Google OAuth.
2. US2: Extract inline theme script to `public/theme-init.js`.
3. US3: Add accessible label-input associations to GoogleSyncModal.
4. Polish: Run full Quality Gates (`npm run lint`, `npm test`, `npm run build`).
