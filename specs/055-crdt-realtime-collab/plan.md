# Implementation Plan: Real-Time CRDT Collaboration via Yjs & WebSocket Relay

**Feature Directory**: `specs/055-crdt-realtime-collab`
**Date**: 2026-08-22

---

## 1. Technical Architecture & Decisions

- **CRDT Structure**:
  - 1 `Y.Doc` per chapter, mapping to `chapter_{chapterId}.json` granular storage.
  - `Y.Text` exclusively for `rawTranslation` and `polishedTranslation`.
  - `Y.Map` for metadata fields with Last-Write-Wins.
  - `y-indexeddb` as ephemeral session persistence layer without replacing `src/services/db.ts`.
- **WebSocket Relay**:
  - `ws` package attached to `http.Server` in `server.ts` via `server.on('upgrade')` on `/ws/sync`.
  - **Zero Server Storage**: Updates processed purely in RAM, 0 bytes of manuscript text written to server DB.
- **Multi-Instance Scalability via Redis**:
  - `ioredis` from `redisService.ts` used as pub/sub channels (`crdt:room:{chapterId}`).
  - `REDIS_URL` is a **mandatory production infrastructure requirement** when scaling to multiple instances (e.g. Cloud Run horizontal scaling).
- **Operational Requirements**:
  1. **OS File Descriptor Ulimit**: Configure `ulimit -n 65535` on the host OS / Docker container to comfortably handle ~1,000 concurrent sockets plus system descriptors.
  2. **Per-IP Rate Limiting**: Limit max 20 WebSocket connections per client IP during upgrade handshake.
  3. **Google Token Verification**: Validate OAuth token at handshake and verify collaborator email belongs to `project.collaborators` or project owner.
- **Presence UI**:
  - `y-protocols/awareness` displays active collaborator pills in `BilingualEditor`.

---

## 2. Proposed Changes & Itemized File List

### Phase A: CRDT Core & Local Document Wiring
1. **[NEW]** [`src/types/crdt.ts`](../../src/types/crdt.ts):
   - CRDT document structures, presence types, and sync statuses.
2. **[NEW]** [`src/services/crdtDocManager.ts`](../../src/services/crdtDocManager.ts):
   - Local `Y.Doc` creation, `Y.Text` mutation helpers, and `y-indexeddb` binding.
3. **[NEW]** [`src/services/__tests__/crdtDocManager.test.ts`](../../src/services/__tests__/crdtDocManager.test.ts):
   - Unit tests for local CRDT document creation, character insertions, and deterministic merges.

### Phase B: WebSocket Relay & Collaborator Authentication
4. **[NEW]** [`server/services/websocketRelayService.ts`](../../server/services/websocketRelayService.ts):
   - WebSocket relay server with RAM-only room management, Google OAuth token verification, and per-IP rate limiting.
5. **[NEW]** [`server/services/__tests__/websocketRelayService.test.ts`](../../server/services/__tests__/websocketRelayService.test.ts):
   - Unit tests for handshake auth validation, room joining, and broadcast routing.
6. **[MODIFY]** [`server.ts`](../../server.ts):
   - Attach `setupWebSocketRelay` to `server.on('upgrade')` on pathname `/ws/sync`.

### Phase C: Multi-Instance Redis Pub/Sub & Load Scalability
7. **[NEW]** [`server/services/crdtRedisPubSub.ts`](../../server/services/crdtRedisPubSub.ts):
   - Redis Pub/Sub room router connecting server instances across `crdt:room:{chapterId}`.
8. **[NEW]** [`server/services/__tests__/crdtRedisPubSub.test.ts`](../../server/services/__tests__/crdtRedisPubSub.test.ts):
   - Unit tests for cross-instance message publishing and subscription handling.

### Phase D: Client Hook & Presence UI in BilingualEditor
9. **[NEW]** [`src/hooks/useChapterCRDT.ts`](../../src/hooks/useChapterCRDT.ts):
   - React hook managing `Y.Doc`, `y-websocket` provider, awareness presence, and observer sync to `db.ts`.
10. **[NEW]** [`src/components/translator-workspace/CollaboratorPresenceBar.tsx`](../../src/components/translator-workspace/CollaboratorPresenceBar.tsx):
    - UI component showing active collaborator avatars, colors, and live typing indicators.
11. **[MODIFY]** [`src/components/translator-workspace/BilingualEditor.tsx`](../../src/components/translator-workspace/BilingualEditor.tsx):
    - Embed `CollaboratorPresenceBar` and bind `useChapterCRDT` for real-time keystroke propagation.
12. **[MODIFY]** [`src/components/TranslatorWorkspace.tsx`](../../src/components/TranslatorWorkspace.tsx):
    - Wire `useChapterCRDT` when active project has `isShared: true`.

### Phase E: Drive Sync Snapshot Backup & Fallback Role
13. **[MODIFY]** [`src/services/googleDriveSyncService.ts`](../../src/services/googleDriveSyncService.ts):
    - Export `Y.encodeStateAsUpdate(doc)` binary snapshot inside `chapter_{chapterId}.json` for offline backup.
14. **[MODIFY]** [`README.md`](../../README.md):
    - Document Real-Time CRDT Collaboration and mandatory `REDIS_URL` requirement for multi-instance production.

---

## 3. Verification Plan

### Automated Tests
- `npx vitest run src/services/__tests__/crdtDocManager.test.ts`
- `npx vitest run server/services/__tests__/websocketRelayService.test.ts`
- `npx vitest run server/services/__tests__/crdtRedisPubSub.test.ts`
- `npm run lint` (`tsc --noEmit`)
- `npm test` (`vitest run`)
- `npm run build` (`vite build` + esbuild server)

### Manual & Real-Time Verification
- Multi-window simultaneous typing in `rawTranslation` and `polishedTranslation`.
- Offline editing test -> network reconnect -> automatic convergence.
- Fallback Drive sync and `ChapterConflictModal` verification.
