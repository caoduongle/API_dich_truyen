# Data Model: Real-Time CRDT Collaboration

**Feature Directory**: `specs/055-crdt-realtime-collab`
**Date**: 2026-08-22

---

## 1. CRDT Document Structure (`Y.Doc`)

```text
Y.Doc ("chapter_{chapterId}")
├── rawTranslation: Y.Text
├── polishedTranslation: Y.Text
└── metadata: Y.Map
    ├── title: string
    ├── status: 'not_started' | 'in_progress' | 'completed'
    ├── translatedLines: number
    ├── updatedAt: number
    └── updatedBy: string
```

---

## 2. Types & Interfaces (`src/types/crdt.ts`)

```typescript
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export type CRDTSyncStatus = 'connecting' | 'connected' | 'disconnected' | 'offline';

export interface UserPresence {
  name: string;
  email: string;
  picture?: string;
  color: string;
  activeField?: 'raw' | 'polished' | 'idle';
  lastActive: number;
}

export interface ChapterCRDTSession {
  chapterId: string;
  projectId: string;
  doc: Y.Doc;
  rawText: Y.Text;
  polishedText: Y.Text;
  metadataMap: Y.Map<any>;
  provider: WebsocketProvider | null;
  status: CRDTSyncStatus;
  collaborators: UserPresence[];
}
```

---

## 3. Server Relay In-Memory Room (`server/services/websocketRelayService.ts`)

```typescript
export interface RelayRoom {
  roomId: string;
  projectId: string;
  chapterId: string;
  clients: Set<WebSocket>;
  doc: Y.Doc;
  lastActive: number;
}
```
