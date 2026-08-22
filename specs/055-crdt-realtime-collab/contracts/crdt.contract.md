# Interface Contracts: Real-Time CRDT Collaboration

**Feature Directory**: `specs/055-crdt-realtime-collab`
**Date**: 2026-08-22

---

## 1. WebSocket Protocol Contract (`/ws/sync`)

### Connection Handshake:
- **URL**: `ws(s)://<host>/ws/sync?projectId=<projectId>&chapterId=<chapterId>&token=<googleAccessToken>`
- **Protocol**: Binary subprotocol `yjs-sync-v1` (implemented by `y-websocket` provider)
- **Error Codes**:
  - `4401`: Unauthorized (Invalid or expired Google access token)
  - `4403`: Forbidden (User email is not in project collaborators)
  - `4429`: Too Many Requests (Exceeded per-IP WebSocket connection limit)

---

## 2. Client CRDT Hook Contract (`src/hooks/useChapterCRDT.ts`)

```typescript
export interface UseChapterCRDTOptions {
  projectId: string;
  chapterId: string | null;
  initialChapter: Chapter | null;
  isShared: boolean;
  userEmail?: string;
  userName?: string;
  userPicture?: string;
  onRemoteChange?: (updatedFields: Partial<Chapter>) => void;
}

export interface UseChapterCRDTReturn {
  doc: Y.Doc | null;
  rawText: Y.Text | null;
  polishedText: Y.Text | null;
  status: CRDTSyncStatus;
  collaborators: UserPresence[];
  updateRawTranslation: (newText: string) => void;
  updatePolishedTranslation: (newText: string) => void;
  updateMetadata: (fields: Partial<Chapter>) => void;
  setActiveField: (field: 'raw' | 'polished' | 'idle') => void;
}
```
