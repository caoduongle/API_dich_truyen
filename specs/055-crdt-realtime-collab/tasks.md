# Tasks: Real-Time CRDT Collaboration (Yjs + WebSocket Relay)

**Feature Directory**: `specs/055-crdt-realtime-collab`
**Branch**: `055-crdt-realtime-collab`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: CRDT Core & Local Document Wiring (Phase A)

**Purpose**: Setup CRDT packages, document bindings for 2 translation fields, and local Yjs document tests.

- [x] T001 [P] Install CRDT dependencies (`yjs`, `y-websocket`, `y-indexeddb`, `y-protocols`, `ws`, `@types/ws`)
- [x] T002 [P] Create TypeScript interfaces in `src/types/crdt.ts` for CRDT session, document bindings, and presence
- [x] T003 [P] Write unit tests for local CRDT document creation, `Y.Text` mutations, and deterministic convergence in `src/services/__tests__/crdtDocManager.test.ts`
- [x] T004 Implement local document creation, `Y.Text` mutations, and `y-indexeddb` session binding in `src/services/crdtDocManager.ts`

**Checkpoint**: Local Yjs documents can mutate `rawTranslation` / `polishedTranslation` and merge deterministically.

---

## Phase 2: WebSocket Relay & Collaborator Authentication (Phase B)

**Purpose**: Implement single-instance RAM-only WebSocket relay on `/ws/sync` with Google OAuth token verification and connection rate limiting.

- [x] T005 [P] Write unit tests for WebSocket relay authentication and in-memory room routing in `server/services/__tests__/websocketRelayService.test.ts`
- [x] T006 Implement RAM-only WebSocket relay with Google OAuth token verification and per-IP rate limiting in `server/services/websocketRelayService.ts`
- [x] T007 Attach `setupWebSocketRelay` to `server.on('upgrade')` on `/ws/sync` in `server.ts` and update CSP `connectSrc` to allow `ws:` / `wss:`

**Checkpoint**: WebSocket clients can connect to `/ws/sync`, authenticate, and exchange Yjs updates in isolated rooms.

---

## Phase 3: Multi-Instance Redis Pub/Sub & Scalability (Phase C)

**Purpose**: Implement cross-instance room routing via Redis Pub/Sub using existing `ioredis` service.

- [x] T008 [P] Write unit tests for Redis Pub/Sub multi-instance room synchronization in `server/services/__tests__/crdtRedisPubSub.test.ts`
- [x] T009 Implement Redis Pub/Sub cross-instance room message bridge in `server/services/crdtRedisPubSub.ts`

**Checkpoint**: Multiple server instances can broadcast Yjs updates to each other via Redis channels.

---

## Phase 4: Client Hook & Presence UI in BilingualEditor (Phase D) 🎯 MVP

**Goal**: Enable real-time collaborative editing and live presence awareness in `BilingualEditor`.

- [x] T010 Implement `src/hooks/useChapterCRDT.ts` managing `Y.Doc`, `y-websocket` provider, awareness presence, and observer sync to `db.ts`
- [x] T011 [P] Create `src/components/translator-workspace/CollaboratorPresenceBar.tsx` rendering active collaborator avatars, colors, and live typing status
- [x] T012 Embed `CollaboratorPresenceBar` and bind `useChapterCRDT` in `src/components/translator-workspace/BilingualEditor.tsx` and `src/components/TranslatorWorkspace.tsx`

**Checkpoint**: Translators can collaborate simultaneously with real-time text syncing and live avatar presence.

---

## Phase 5: Drive Sync Snapshot Backup & Fallback Role (Phase E)

**Purpose**: Transition Google Drive sync to periodic Yjs binary snapshot backup and preserve `ChapterConflictModal` as an offline emergency fallback.

- [x] T013 Update `src/services/googleDriveSyncService.ts` to export and import `Y.encodeStateAsUpdate(doc)` binary snapshots in `chapter_{chapterId}.json` for offline backup
- [x] T014 Update `README.md` and documentation for real-time CRDT collaboration, `REDIS_URL` requirement for multi-instance production, and host OS ulimit configuration

---

## Phase 6: Polish & Verification Gates

**Purpose**: Quality assurance and verification gates.

- [x] T015 Run full typecheck with `npm run lint` (`tsc --noEmit`)
- [x] T016 Run full test suite with `npm test` (`vitest run`)
- [x] T017 Verify production build with `npm run build` (`vite build` + esbuild server)

---

## Dependencies & Execution Order

```text
Phase 1 (CRDT Core) ──► Phase 2 (WebSocket Relay) ──► Phase 3 (Redis Pub/Sub) ──► Phase 4 (Editor UI MVP) ──► Phase 5 (Drive Snapshot Backup) ──► Phase 6 (Quality Gates)
```
