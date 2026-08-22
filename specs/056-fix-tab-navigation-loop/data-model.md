# Data Model & State Lifecycle: Fix Tab Navigation Loop

## 1. Entities & State Architecture

### A. Navigation Tab State (`src/App.tsx`)
```typescript
type TabId = 'translate' | 'auto-translate' | 'glossary' | 'history' | 'projects';

interface AppTabState {
  activeTab: TabId;                      // Currently displayed workspace tab
  visitedTabs: Set<TabId>;               // Lazy-mount cache: keep tabs alive once loaded
  isTransitionPending: boolean;          // Transition state managed by useTransition
}
```

#### State Transition Graph:
```text
[Tab A] ──(User click / Alt+1..5)──> switchTab(Tab B)
                                          │
                                          ├──> setVisitedTabs(prev + Tab B)
                                          └──> startTransition(() => setActiveTab(Tab B))
                                                   │
                                                   └──> [Tab B Active & Rendered]
```

---

### B. CRDT Chapter Hook State & Option Model (`src/types/crdt.ts`, `src/hooks/useChapterCRDT.ts`)

```typescript
export type CRDTSyncStatus = 'connecting' | 'connected' | 'disconnected' | 'offline';

export interface UserPresence {
  name: string;
  email: string;
  picture?: string;
  color: string;
  activeField: 'raw' | 'polished' | 'idle';
  lastActive: number;
}

export interface UseChapterCRDTOptions {
  projectId: string;
  chapterId: string | null;
  initialChapter?: Chapter | null;
  isShared?: boolean;
  userEmail?: string;
  userName?: string;
  userPicture?: string;
  onRemoteChange?: (updated: Partial<Chapter>) => void;
}

export interface UseChapterCRDTReturn {
  doc: Y.Doc | null;
  status: CRDTSyncStatus;
  collaborators: UserPresence[];
  updateRawTranslation: (newText: string) => void;
  updatePolishedTranslation: (newText: string) => void;
  updateMetadata: (fields: Partial<Chapter>) => void;
  setActiveField: (field: 'raw' | 'polished' | 'idle') => void;
}
```

---

## 2. Hook Internal Lifecycle & Ref Management

```text
┌────────────────────────────────────────────────────────────────────────┐
│ useChapterCRDT Hook Instance                                           │
│                                                                        │
│  Props/Options:                                                        │
│   - projectId, chapterId, isShared (Connection triggers)               │
│   - userEmail, userName, userPicture (Awareness identifiers)           │
│   - onRemoteChange (Mutable callback stored in Ref)                   │
│                                                                        │
│  Internal Refs:                                                        │
│   - onRemoteChangeRef = useRef(onRemoteChange) ◄── Updated every render│
│   - docRef = useRef<Y.Doc>(null)                                       │
│   - providerRef = useRef<WebsocketProvider>(null)                      │
│   - persistenceRef = useRef<IndexeddbPersistence>(null)                │
│                                                                        │
│  Lifecycle useEffect Dependencies:                                     │
│   [projectId, chapterId, isShared, userEmail, userName, userPicture]  │
│                                                                        │
│  Triggers:                                                             │
│   - Runs ONLY when chapterId, projectId, or isShared truly changes     │
│   - Does NOT re-run on parent re-renders or unmemoized callback changes│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Invariants & Rules

1. **Tab Navigation Invariant**: Clicking any of the 5 navigation tabs or pressing `Alt+1`..`Alt+5` MUST always update `activeTab` to the target tab within a single React render cycle.
2. **CRDT Effect Isolation Invariant**: The `useEffect` managing `Y.Doc` and `WebsocketProvider` lifecycle MUST NOT execute more than once per `(projectId, chapterId, isShared)` tuple change.
3. **Remote Update Propagation Invariant**: Incoming Y.Doc updates from remote peers MUST reliably invoke the latest `onRemoteChange` callback without missing updates.
