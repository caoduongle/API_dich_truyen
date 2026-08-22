# Tasks: Pre-Deployment Security Hardening for Render Hosting

## Feature Overview
- **Branch**: `058-security-hardening`
- **Spec**: [`specs/058-security-hardening/spec.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/058-security-hardening/spec.md)
- **Plan**: [`specs/058-security-hardening/plan.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/058-security-hardening/plan.md)

---

## Phase 1: Setup & Baseline Verification

**Purpose**: Verify baseline quality gates and test suite before making edits.

- [x] T001 Verify baseline unit test suite passes via `npm test`

---

## Phase 2: Foundational

**Purpose**: Inspect existing test harnesses and baseline behavior for WebSocket relay.

- [x] T002 Inspect existing test suite in `server/services/__tests__/websocketRelayService.test.ts`

---

## Phase 3: User Story 1 - Enforce Authentication on WebSocket Relay (Priority: P1) 🎯 MVP

**Goal**: Block unauthorized join/read/write on `/ws/sync` by enforcing Google OAuth token verification in the HTTP upgrade handshake.

**Independent Test**: Send HTTP upgrade requests to `/ws/sync` without token or with invalid token; verify connection is immediately rejected with `HTTP 401 Unauthorized`.

### Implementation & Testing
- [x] T003 [US1] Enforce Google OAuth token verification during HTTP upgrade in `server/services/websocketRelayService.ts`
- [x] T004 [US1] Reject unauthenticated or invalid token requests with HTTP 401 Unauthorized in `server/services/websocketRelayService.ts`
- [x] T005 [P] [US1] Add unit tests for unauthenticated handshake rejection and token validation in `server/services/__tests__/websocketRelayService.test.ts`

**Checkpoint**: At this point, `/ws/sync` strictly requires valid Google OAuth credentials.

---

## Phase 4: User Story 2 - Production Alert for Unprotected Server Access (Priority: P1)

**Goal**: Ensure deployers cannot inadvertently run a public server with open API routes without an unmissable alert banner in logs.

**Independent Test**: Start server with `NODE_ENV=production` and empty `ACCESS_PASSWORD`; verify multi-line boxed security warning banner is printed to stdout.

### Implementation
- [x] T006 [US2] Add prominent boxed security warning banner upon server startup in `NODE_ENV=production` when `ACCESS_PASSWORD` is empty in `server.ts`

**Checkpoint**: Production startup emits an unmistakable warning when server access password is not configured.

---

## Phase 5: User Story 3 - Codebase Security Verification & Quality Gates (Priority: P2)

**Purpose**: Strict Constitution quality assurance and security verification.

- [x] T007 [P] Verify XSS safety and HTML entity escaping in `src/components/auto-translator/DiffModal.tsx`
- [x] T008 [P] Verify dependency vulnerability count with `npm audit --audit-level=low`
- [x] T009 [P] Run TypeScript typecheck verification via `npm run lint` (`tsc --noEmit`)
- [x] T010 [P] Run entire unit test suite via `npm test` (`vitest run`)
- [x] T011 Run production bundle build via `npm run build` (`vite build && esbuild server.ts`)
- [x] T012 Execute verification scenarios from `specs/058-security-hardening/quickstart.md`

---

## Dependencies & Execution Order

```text
Phase 1: Setup (T001)
   │
   ▼
Phase 2: Foundational (T002)
   │
   ▼
Phase 3: User Story 1 (T003, T004, T005 [P]) ◄── MVP Checkpoint
   │
   ▼
Phase 4: User Story 2 (T006)
   │
   ▼
Phase 5: User Story 3 & Quality Gates (T007 [P], T008 [P], T009 [P], T010 [P], T011, T012)
```

---

## Implementation Strategy

### MVP Scope (Phase 1 through Phase 3)
1. Complete baseline test check (`T001`).
2. Implement WebSocket token enforcement (`T003`, `T004`) and unit tests (`T005`).
3. Verify unauthenticated `/ws/sync` connections are blocked with HTTP 401.

### Full Delivery
4. Complete Phase 4 (`T006` production warning banner in `server.ts`).
5. Complete Phase 5 (all quality gates and security audit verifications).
