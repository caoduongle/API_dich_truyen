# Research & Technical Decisions: Real-Time CRDT Collaboration (Yjs + WebSocket Relay)

**Feature Directory**: `specs/055-crdt-realtime-collab`
**Date**: 2026-08-22

---

## 1. CRDT Architecture & Yjs Integration

### Data Granularity & Invariants:
- Each chapter has an independent `Y.Doc` matching `chapter_{chapterId}.json` in `AI_Dich_Truyen_Data/{projectId}/`.
- **`Y.Text` Binding**: Applied to `rawTranslation` and `polishedTranslation`. Keystroke changes mutate the Y.Text structure, guaranteeing conflict-free character-level merging.
- **`Y.Map` Binding**: Applied to `sourceText`, `paragraphs`, `translatedLines`, `status` using Last-Write-Wins (LWW).
- **Session Cache**: `y-indexeddb` caches active session `Y.Doc` updates locally for instant offline reloading.
- **Single Source of Truth**: `src/services/db.ts` remains the application DB. A debounce/observer syncs `Y.Doc` state back to `db.ts` chapters object.

---

## 2. Server Relay Architecture & Multi-Instance Redis Pub/Sub

### WebSocket Upgrade & Zero Server Storage:
- The WebSocket server is attached to `http.Server` in `server.ts` via `server.on('upgrade')` on pathname `/ws/sync`.
- **Zero Storage Invariant**: The relay server keeps Yjs documents strictly in RAM. Binary updates are broadcast to connected sockets in the room and published to Redis, without writing any text or documents to server disk or database.

### Multi-Instance Routing via Redis Pub/Sub:
```text
[Client 1 (Inst A)] ──ws──► [Server Instance A] ──publish──► [Redis Channel crdt:room:{chapterId}]
                                                                   │
[Client 2 (Inst B)] ◄──ws── [Server Instance B] ◄──subscribe───────┘
```
- Each server instance subscribes to `crdt:room:{chapterId}` for active rooms.
- Incoming Yjs binary packets from client 1 are forwarded to local clients in the room AND published to Redis.
- Other instances receive the message from Redis and broadcast to their local clients.
- If `REDIS_URL` is omitted (single-instance development), the relay operates in in-memory mode.

---

## 3. Connection Rate Limiting & Google Token Authentication

### Handshake Authentication:
```text
GET /ws/sync?projectId=P1&chapterId=C1&token=OAUTH_ACCESS_TOKEN
```
1. **IP Rate Limit**: Check if connection count from `req.ip` exceeds limit (max 20 sockets/IP). If exceeded, close socket immediately with HTTP 429.
2. **Google Token Verification**: Verify the access token via Google userinfo endpoint (`https://www.googleapis.com/oauth2/v3/userinfo`). Cache token-to-user verification in RAM for 5 minutes.
3. **Collaborator Authorization**: Validate that the verified email matches the project owner or is in `project.collaborators`.

---

## 4. Awareness & Live Presence

- Use `y-protocols/awareness` to broadcast collaborator presence:
  ```typescript
  awareness.setLocalStateField('user', {
    name: user.name,
    email: user.email,
    picture: user.picture,
    color: generateUserColor(user.email),
    activeField: 'raw' | 'polished' | 'idle'
  });
  ```
- Renders collaborator pills with active avatars and pulse status in `BilingualEditor`.

---

## 5. Dual-Mode Fallback & Google Drive Sync

- **Online**: Live real-time Yjs CRDT via WebSocket relay.
- **Offline / Relay Down**: Edits persist to local IndexedDB. Drive Push uploads `Y.encodeStateAsUpdate(doc)` alongside JSON metadata.
- **Fallback**: `ChapterConflictModal.tsx` is retained for cases where two users work offline independently for extended periods and produce divergent timestamp histories.
