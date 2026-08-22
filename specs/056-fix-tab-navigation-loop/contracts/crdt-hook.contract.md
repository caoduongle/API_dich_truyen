# Contract: useChapterCRDT Hook Interface

## 1. Module Definition
- **File**: `src/hooks/useChapterCRDT.ts`
- **Consumer**: `src/components/TranslatorWorkspace.tsx`

---

## 2. Options Signature

```typescript
export interface UseChapterCRDTOptions {
  /** Unique ID of current project */
  projectId: string;
  /** Unique ID of currently opened chapter (null if no chapter opened) */
  chapterId: string | null;
  /** Seed data for initial Y.Doc instantiation if doc does not exist yet */
  initialChapter?: Chapter | null;
  /** Flag whether the project is shared across multiple users */
  isShared?: boolean;
  /** Authenticated Google user email */
  userEmail?: string;
  /** Authenticated Google user name */
  userName?: string;
  /** Authenticated Google user avatar URL */
  userPicture?: string;
  /** Event handler called whenever remote peer modifies Y.Doc */
  onRemoteChange?: (updated: Partial<Chapter>) => void;
}
```

---

## 3. Behavioral Guarantees

1. **Callback Stability**:
   - `onRemoteChange` MAY be passed as an anonymous inline function without causing the hook's internal `useEffect` to re-execute.
   - When a remote binary update is applied to `Y.Doc`, the hook MUST invoke the most recently passed `onRemoteChange` callback.
2. **Connection Lifecycle**:
   - The hook MUST NOT tear down and recreate WebSocket or IndexedDB persistence on parent component re-renders when `chapterId`, `projectId`, and `isShared` have not changed.
3. **State Updates**:
   - Initializing or changing status (`setStatus`) MUST NOT cause cascading re-renders that exceed React's update depth limit.
