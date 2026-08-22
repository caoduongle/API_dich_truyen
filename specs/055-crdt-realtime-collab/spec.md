# Feature Specification: Real-Time CRDT Collaboration via Yjs & WebSocket Relay

**Feature Branch**: `055-crdt-realtime-collab`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "Triển khai đồng bộ real-time bằng CRDT (Yjs) cho tính năng cộng tác đã có ở specs/052-drive-collaboration, thay ChapterConflictModal thành phương án dự phòng thay vì cơ chế chính. Bắt buộc hỗ trợ CẢ HAI chế độ: online (real-time qua WebSocket relay) và offline (vẫn Pull/Push qua Google Drive như 051/052 khi không có mạng hoặc relay không khả dụng) — không được đánh đổi mất chế độ nào. KHÔNG dùng P2P/WebRTC (không đáng phức tạp thêm cho dữ liệu text nhẹ); chỉ 1 đường truyền real-time duy nhất: WebSocket relay tự host. Mục tiêu tải: relay phải chịu được khoảng 1.000 kết nối WebSocket đồng thời TRÊN TOÀN SERVER, phân bổ trên nhiều 'phòng' độc lập (mỗi phòng = 1 chapter, mỗi phòng chỉ vài người cộng tác như đã scope ở 052) — đây KHÔNG phải yêu cầu 1.000 người cùng sửa 1 chapter, ghi rõ điều này trong spec để tránh hiểu lệch thành bài toán fan-out khổng lồ trong 1 phòng. Kiến trúc CRDT: mỗi Chapter có 1 Y.Doc riêng, khớp ranh giới chapter_{chapterId}.json đã có từ driveStorageFormat: 'granular' của 052. Áp dụng Y.Text cho đúng 2 field người dịch gõ tay — rawTranslation và polishedTranslation; các field còn lại (sourceText, paragraphs, translatedLines, status) giữ nguyên dạng thường, dùng Y.Map/last-write-wins. Dùng y-indexeddb làm persistence cho phiên đang mở, KHÔNG thay thế src/services/db.ts hiện có; Y.Doc chỉ là tầng sống động, đồng bộ ngược lại vào Chapter object qua observer để phần còn lại của app không đổi cách đọc dữ liệu. Relay: package ws, gắn vào http.Server đã có trong server.ts qua server.on('upgrade') có kiểm tra pathname (bind riêng ví dụ /ws/sync, KHÔNG đụng Vite HMR websocket đang chạy cùng server ở dev — xem comment CSP trong server.ts). Relay CHỈ giữ state trong RAM để chuyển tiếp Yjs update giữa các client trong cùng 1 phòng, KHÔNG ghi nội dung truyện xuống DB nào, giữ đúng cam kết Zero Server Storage trong docs/privacy-policy.md. Sẵn sàng multi-instance: dùng LẠI ioredis đã có trong server/services/redisService.ts (không thêm client Redis mới) làm pub/sub channel theo từng phòng, để nếu server chạy nhiều instance (ví dụ do Cloud Run tự scale — cần xác nhận lại nền tảng hosting thật trước khi implement phần này, đừng giả định suông), 2 người cùng phòng nhưng rơi vào instance khác nhau vẫn thấy update của nhau. Vì việc này cần REDIS_URL trỏ tới Redis thật ở production (khác với hiện tại đang optional cho rate limiter), nêu rõ đây là yêu cầu hạ tầng bắt buộc mới trong Implementation Plan, không phải optional. Vận hành cần nêu rõ trong plan.md: (1) nâng OS file-descriptor ulimit trên môi trường host lên đủ cho ~1.000 kết nối đồng thời cộng thêm các fd khác của process; (2) thêm giới hạn số kết nối WebSocket theo IP ở bước upgrade, tái dùng pattern của server/middleware/rateLimiter.ts đã có thay vì viết mới từ đầu; (3) relay xác thực người kết nối bằng access token Google hiện có (tái dùng googleAuthService.ts) và kiểm tra email nằm trong collaborators của project (đã có ở types.ts từ 052) trước khi cho join phòng. Dùng y-protocols/awareness để hiển thị 'đang có ai mở chương này' trong khu vực soạn thảo — vẫn phải nêu rõ trong spec giới hạn thật của CRDT văn bản: 2 người viết lại toàn bộ 1 đoạn hoàn toàn khác nhau trong lúc offline dài ngày rồi mới đồng bộ lại có thể ra kết quả merge ở cấp ký tự xen kẽ khó đọc — không quảng cáo CRDT như giải pháp hoàn hảo mọi trường hợp. Giữ nguyên ChapterConflictModal.tsx, chỉ đổi vai trò thành fallback CHO ĐÚNG lúc cả 2 người hoàn toàn không kết nối được relay (offline hoàn toàn). googleDriveSyncService.ts (051/052) đổi vai trò từ nguồn sự thật duy nhất thành bản backup định kỳ: mỗi lần Push lên Drive lưu Y.encodeStateAsUpdate(doc) thay vì string thường. Không đụng directGeminiClient.ts/directTranslationEngine.ts. Implementation Plan PHẢI chia phase rõ: Phase A (Y.Doc + Y.Text wiring 2 field, chưa nối mạng, test đơn lẻ) → Phase B (WebSocket relay 1 instance + xác thực collaborator) → Phase C (Redis pub/sub cross-instance + test tải ~1.000 kết nối) → Phase D (awareness/presence UI) → Phase E (đổi googleDriveSyncService sang backup theo Y update snapshot)."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Real-Time Collaborative Editing via Yjs CRDT (Online Mode) (Priority: P1) 🎯 MVP

As a translator or editor collaborating on a shared project chapter in `BilingualEditor`, I want all my keystrokes in `rawTranslation` and `polishedTranslation` to sync seamlessly in real time (< 100ms) with other collaborators working in the same chapter room via WebSocket relay, so that we can translate and polish adjacent sentences simultaneously without file locks, save conflicts, or manual merges.

**Why this priority**: Core value proposition that transforms collaboration from asynchronous, file-level conflict resolution into fluid, simultaneous teamwork.

**Independent Test**: Open the same chapter in two different browser tabs/windows (User A and User B), type in `rawTranslation` on User A and in `polishedTranslation` on User B, observe instant bidirectional updates appearing character-by-character, and verify that IndexedDB receives continuous updates via Yjs observers.

**Acceptance Scenarios**:

1. **Given** User A and User B are both connected to the WebSocket room for `chapterId_123`, **When** User A types text in `rawTranslation`, **Then** User B's `rawTranslation` textarea updates within 100ms without cursor jumping or text duplication.
2. **Given** User A and User B edit different sentences in `polishedTranslation` concurrently, **When** both changes propagate, **Then** Yjs CRDT mathematically merges both changes deterministically on all connected clients.
3. **Given** any incoming CRDT update, **When** processed by the client's `Y.Doc`, **Then** an observer automatically synchronizes the in-memory `Chapter` state and persists to local IndexedDB via standard storage services.

---

### User Story 2 - Dual-Mode Resilience & Offline Drive Sync Fallback (Priority: P1)

As a translator working on a spotty network connection or without server relay connectivity, I want the application to automatically function offline (saving to local IndexedDB and syncing periodically to Google Drive as established in 051/052), and only surface the `ChapterConflictModal` as an emergency fallback when two translators perform long disconnected offline edits that cannot be automatically resolved.

**Why this priority**: Preserves the privacy-first, client-side resilience of the application so users are never blocked from translating when offline.

**Independent Test**: Disconnect network or stop relay server, perform local edits in `BilingualEditor`, verify that local editing and auto-save work with 0 errors, re-connect network or trigger Google Drive Sync, and verify that the Yjs document state merges or triggers fallback resolution.

**Acceptance Scenarios**:

1. **Given** the WebSocket relay is unavailable or network is disconnected, **When** the user types in `BilingualEditor`, **Then** the editor continues normal operation, persisting changes to local `y-indexeddb` and `db.ts`.
2. **Given** an offline session is completed, **When** the user performs a manual Google Drive Push, **Then** the system exports `Y.encodeStateAsUpdate(doc)` alongside JSON metadata to the project subfolder `AI_Dich_Truyen_Data/{projectId}/chapter_{chapterId}.json`.
3. **Given** two users worked offline independently for days with diverging edits and no relay sync, **When** they sync via Drive and timestamps conflict, **Then** `ChapterConflictModal` opens as a fallback allowing users to review and pick local, remote, or forked copies.

---

### User Story 3 - Secure Zero-Storage WebSocket Relay & Collaborator Verification (Priority: P1)

As a project owner, I want the backend WebSocket relay to verify the Google OAuth access token of connecting users and ensure their email is listed in the project's authorized `collaborators` before granting access to a chapter room, while strictly processing all message updates in RAM without ever storing manuscript contents on server disk or database.

**Why this priority**: Enforces enterprise-grade access control for collaborative rooms while maintaining the absolute Zero Server Storage privacy invariant defined in `docs/privacy-policy.md`.

**Independent Test**: Attempt connecting to `/ws/sync?projectId=P1&chapterId=C1` without a valid token (verifies connection is rejected with 4001 Unauthorized), connect as a collaborator whose email is in `project.collaborators` (verifies connection accepted), and inspect server memory/disk to verify 0 manuscript storage.

**Acceptance Scenarios**:

1. **Given** a WebSocket connection request to `/ws/sync`, **When** the HTTP upgrade occurs, **Then** the relay parses query parameters (`token`, `projectId`, `chapterId`), verifies the Google access token via Google userinfo endpoint (with cached validation), and checks that the user's email belongs to `project.collaborators` or is the project owner.
2. **Given** an unauthorized user or missing token, **When** connecting, **Then** the WebSocket connection is rejected immediately with code `4401 (Unauthorized)` or `4403 (Forbidden)`.
3. **Given** binary Yjs sync messages passing through the relay, **When** inspected on the server, **Then** the relay only maintains ephemeral in-memory client sets per room to broadcast packets, never writing message payloads to disk or DB.

---

### User Story 4 - Multi-Instance Redis Pub/Sub & Server Load Scalability (~1,000 Connections) (Priority: P2)

As a system administrator running the app across scaled instances (e.g. Google Cloud Run horizontal containers), I want the WebSocket relay to use Redis Pub/Sub (`ioredis`) to route room updates between different server instances, while supporting ~1,000 concurrent WebSocket connections globally across independent chapter rooms.

**Why this priority**: Guarantees horizontal scalability in cloud environments without requiring sticky sessions or complex socket clustering libraries.

**Independent Test**: Start two server instances connected to the same Redis URL, connect User A to Instance 1 (port 3000) and User B to Instance 2 (port 3001) in the same chapter room, type on User A, verify that User B receives the CRDT update via Redis pub/sub within 50ms.

**Acceptance Scenarios**:

1. **Given** multiple server instances connected to `REDIS_URL`, **When** a Yjs update is received from a client on Instance 1, **Then** Instance 1 publishes the update to Redis channel `crdt:room:{chapterId}`, and Instance 2 receives and broadcasts it to its local connected clients in that room.
2. **Given** 1,000 concurrent WebSocket connections distributed across 200–500 distinct chapter rooms (2–5 users per room), **When** under load, **Then** the server handles all connections within OS file descriptor limits and CPU/memory quotas without dropping frames or leaking memory.
3. **Given** a single IP attempting to open excess WebSocket connections, **When** exceeding rate limits (e.g. > 20 connections/IP), **Then** subsequent upgrade requests from that IP are rejected with HTTP 429.

---

### User Story 5 - Live Presence & Active Collaborator Awareness (Priority: P2)

As an editor working in `BilingualEditor`, I want to see visual awareness badges indicating who is currently viewing or actively editing the same chapter in real time, so that we do not collide on the exact same paragraph or duplicate translation work.

**Why this priority**: Prevents redundant work and fosters collaborative team communication.

**Independent Test**: Connect two users to the same chapter room, verify that User A sees User B's avatar/name badge in the editor header with an "Đang xem / Đang sửa" indicator, and verify that closing User B's tab removes their badge within 5 seconds.

**Acceptance Scenarios**:

1. **Given** User A and User B join the same chapter room, **When** connected, **Then** `y-protocols/awareness` broadcasts user state (name, email, color, active field), and an awareness pill in `BilingualEditor` displays active collaborator avatars.
2. **Given** User B disconnects or closes the tab, **When** the awareness timeout elapses, **Then** User B's avatar is smoothly removed from User A's view.

---

### Edge Cases & Known CRDT Limitations

- **Long Disconnected Offline Divergence**: If two translators independently rewrite the *same* paragraph in completely different styles over multiple days of offline work, character-level CRDT text merging may produce interleaved sentences. The spec explicitly defines that `ChapterConflictModal` acts as the safety net for major offline timestamp conflicts.
- **Relay Reconnection Backoff**: If WebSocket connection drops due to intermittent Wi-Fi, the client automatically attempts reconnection with exponential backoff (1s, 2s, 4s, up to 30s) while continuing to accept local edits in memory and IndexedDB.
- **Non-Text Field Conflicts**: For metadata fields (`status`, `translatedLines`), Last-Write-Wins (LWW) via `Y.Map` is applied.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST implement a dedicated `Y.Doc` instance per chapter, matching the `chapter_{chapterId}.json` boundary of the granular storage format.
- **FR-002**: The system MUST bind `Y.Text` exclusively to `rawTranslation` and `polishedTranslation` for character-level collaborative editing.
- **FR-003**: The system MUST bind non-text fields (`sourceText`, `paragraphs`, `translatedLines`, `status`) to a `Y.Map` using Last-Write-Wins (LWW) conflict resolution.
- **FR-004**: The system MUST use `y-indexeddb` as an ephemeral client session cache, while maintaining `src/services/db.ts` as the primary application storage through bidirectional observer sync.
- **FR-005**: The backend relay MUST be implemented using the `ws` package attached to `http.Server` in `server.ts` via `server.on('upgrade')` under a dedicated path (`/ws/sync`), without interfering with Vite HMR or API routes.
- **FR-006**: The relay MUST process all synchronization in RAM and MUST NOT persist manuscript content or client messages to any server database (Zero Server Storage).
- **FR-007**: The relay MUST authenticate connecting clients during the HTTP upgrade handshake by validating their Google access token and verifying that the user's email is an authorized collaborator or owner of the specified `projectId`.
- **FR-008**: The relay MUST enforce a per-IP WebSocket connection limit (max 20 concurrent connections per IP) to prevent denial-of-service connection exhaustion.
- **FR-009**: The system MUST support multi-instance horizontal scaling by utilizing Redis Pub/Sub (`ioredis` via `redisService.ts`) on channels scoped by `crdt:room:{chapterId}` whenever `REDIS_URL` is configured.
- **FR-010**: The server architecture MUST be capable of sustaining ~1,000 concurrent WebSocket connections across the entire server, distributed across independent chapter rooms (2–5 collaborators per room).
- **FR-011**: The system MUST provide live collaborator presence and cursor/field awareness using `y-protocols/awareness`, rendering active user pills in `BilingualEditor`.
- **FR-012**: The system MUST support full offline editing resilience; when offline or disconnected from the relay, edits continue uninterrupted in local IndexedDB.
- **FR-013**: The Google Drive sync engine (`googleDriveSyncService.ts`) MUST export and import `Y.encodeStateAsUpdate(doc)` binary snapshots alongside JSON chapter data.
- **FR-014**: The `ChapterConflictModal.tsx` component MUST be retained and utilized as an explicit fallback mechanism when two disconnected offline edits conflict during manual Drive synchronization.
- **FR-015**: The system MUST NOT modify direct translation engines (`directGeminiClient.ts` / `directTranslationEngine.ts`) or core IndexedDB database schemas.
- **FR-016**: All quality gates (`npm run lint`, `npm test`, `npm run build`) MUST pass cleanly.

---

### Key Entities & Data Model

```typescript
// Room Channel Identifier
export type RoomId = string; // format: `project_${projectId}_chapter_${chapterId}`

// Client CRDT Sync State
export interface ChapterCRDTSyncState {
  chapterId: string;
  projectId: string;
  doc: Y.Doc;
  rawText: Y.Text;
  polishedText: Y.Text;
  metadataMap: Y.Map<any>;
  provider: WebSocketProvider | null;
  status: 'connecting' | 'connected' | 'disconnected' | 'offline';
  collaborators: CollaboratorPresence[];
}

// User Awareness Presence
export interface CollaboratorPresence {
  clientId: number;
  email: string;
  name: string;
  picture?: string;
  color: string;
  activeField?: 'raw' | 'polished' | 'idle';
  lastSeen: number;
}
```

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Character-level edits in `rawTranslation` and `polishedTranslation` synchronize across online collaborators in the same chapter room in under 100ms.
- **SC-002**: 100% offline capability is preserved; users can edit without network connection and sync later without data loss.
- **SC-003**: The WebSocket relay handles ~1,000 global concurrent connections distributed across multiple chapter rooms without process memory leakage.
- **SC-004**: Multi-instance Redis Pub/Sub propagates updates between separate server instances within 50ms latency.
- **SC-005**: 0 bytes of novel manuscript text are persisted on server storage, strictly honoring `docs/privacy-policy.md`.
- **SC-006**: Unauthorized connection attempts to private chapter rooms are rejected 100% of the time.
- **SC-007**: All quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly.

---

## Assumptions & Dependencies

- **Dependencies**: `yjs`, `y-websocket`, `y-indexeddb`, `y-protocols`, `ws` (server-side), `ioredis` (already installed in repo).
- **Infrastructure**: Production multi-instance deployment requires a live Redis instance provided via `REDIS_URL`. Single-instance development runs with in-memory room routing without Redis.
- **OS Limits**: Server hosting environment (Linux / Cloud Run / VPS) must have `ulimit -n` configured to at least 4,096 to comfortably support 1,000 open socket file descriptors.
