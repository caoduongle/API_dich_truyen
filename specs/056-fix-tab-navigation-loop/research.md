# Research & Architecture Decisions: Fix Tab Navigation Loop

## 1. Problem Investigation & Root Cause Analysis

### Symptoms
When clicking between main navigation tabs (Dịch, Tự động dịch, Thuật ngữ, Lịch sử, Dự án), users can only switch to tabs situated to the right of the active tab. Attempting to navigate leftward fails silently: the tab receives focus, but the active panel does not switch and `activeTab` state remains unchanged.

### Browser DevTools & React Fiber Diagnostic
1. Live testing with Chrome DevTools confirmed:
   - Clicking Right (Tab 1 → Tab 2): state transitions successfully to `auto-translate`.
   - Clicking Right (Tab 2 → Tab 3): state transitions successfully to `glossary`.
   - Clicking Left (Tab 3 → Tab 2 or Tab 1): state remains stuck on `glossary`.
   - Keyboard shortcuts (`Alt+1` through `Alt+5`) exhibit identical unidirectional behavior.
2. Console Inspection revealed **321 occurrences** of:
   ```text
   Maximum update depth exceeded. This can happen when a component calls setState inside useEffect,
   but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
     at useChapterCRDT.ts:98
   ```
3. Root Cause Trace:
   - In `src/components/TranslatorWorkspace.tsx` (lines 109–119), `useChapterCRDT` is invoked with an inline arrow function:
     ```tsx
     onRemoteChange: (updated) => {
       if (updated.rawTranslation !== undefined) setRawTranslation(updated.rawTranslation);
       if (updated.polishedTranslation !== undefined) setPolishedTranslation(updated.polishedTranslation);
       if (updated.title !== undefined) setChapterTitle(updated.title);
     }
     ```
   - In `src/hooks/useChapterCRDT.ts` (lines 96–208), the main initialization `useEffect` lists `onRemoteChange` and `debouncedSaveToDb` in its dependency array:
     ```tsx
     useEffect(() => {
       if (!chapterId || !projectId) {
         setStatus('offline'); // Line 98: Triggers re-render on each effect run
         setCollaborators([]);
         return;
       }
       // ... doc initialization, persistence, websocket ...
     }, [projectId, chapterId, isShared, userEmail, userName, userPicture, onRemoteChange, debouncedSaveToDb]);
     ```
   - Every render of `TranslatorWorkspace` creates a new function reference for `onRemoteChange`.
   - The effect triggers → executes `setStatus('offline')` or `setStatus('connecting')` → updates state → triggers re-render → generates new `onRemoteChange` → infinite loop.
   - React's concurrent scheduler encounters `Maximum update depth exceeded`, entering a degraded error recovery state where low-priority transitions created by `startTransition(() => setActiveTab(tab))` are discarded or stalled.

---

## 2. Architectural Decisions & Patterns

### Decision 1: Ref-Based Callback Stabilization inside `useChapterCRDT` (Primary Fix)
- **Decision**: Store `onRemoteChange` in a mutable React ref (`onRemoteChangeRef.current = onRemoteChange`) inside `useChapterCRDT.ts`, removing `onRemoteChange` from the `useEffect` dependency array.
- **Rationale**: 
  - `onRemoteChange` is an event listener callback invoked when remote Y.Doc binary updates arrive.
  - In a real-time collaboration hook, re-running the effect tears down and re-initializes the `Y.Doc`, IndexedDB persistence (`IndexeddbPersistence`), and WebSocket connection (`WebsocketProvider`).
  - By accessing the latest callback via `onRemoteChangeRef.current(updated)`, the callback always has access to fresh component scope without causing effect re-execution.
- **Alternatives Considered**:
  - *Only wrapping `onRemoteChange` with `useCallback` in `TranslatorWorkspace.tsx`*: While helpful, it makes `useChapterCRDT` vulnerable to future consumers who might pass unmemoized callbacks. Combining both approaches provides defense-in-depth.

### Decision 2: Call-Site Memoization in `TranslatorWorkspace.tsx` (Defense-in-Depth)
- **Decision**: Wrap the `onRemoteChange` callback in `TranslatorWorkspace.tsx` using `useCallback` with stable setter dependencies (`setRawTranslation`, `setPolishedTranslation`, `setChapterTitle`).
- **Rationale**: Adheres to React best practices for stable prop passing and prevents unnecessary hook re-evaluations.

### Decision 3: Debounced Save Callback Ref Stabilization in `useChapterCRDT.ts`
- **Decision**: Stabilize `debouncedSaveToDb` or remove it from the effect dependency array by using a ref or stable callback pattern so that only fundamental connection keys (`projectId`, `chapterId`, `isShared`, `userEmail`, `userName`, `userPicture`) control the CRDT connection lifecycle.
- **Rationale**: Minimizes effect dependency surface to strictly primitives that represent true connection parameters.

---

## 3. Compatibility & Non-Regression Analysis

| Component / Subsystem | Potential Impact | Mitigation / Verification |
|---|---|---|
| **Tab Navigation (`App.tsx`)** | Restored bidirectional tab switching | Verify in real browser: 1→2→3→4→5 and 5→4→3→2→1 |
| **CRDT Y.Doc Sync (`useChapterCRDT`)** | Must maintain real-time sync when remote updates arrive | Ensure `onRemoteChangeRef.current` is invoked inside `handleDocUpdate` |
| **IndexedDB Offline Persistence** | Must continue saving document snapshots to `crdt_${projectId}_${chapterId}` | Verify persistence is created once per chapter and cleanly destroyed on chapter unmount |
| **WebSocket Relay** | Must connect/disconnect cleanly without reconnect storms | Verify `WebsocketProvider` connection state transitions cleanly |
| **Existing Unit Tests** | All 87 test files (589 tests) must remain 100% green | Run `vitest run` before and after fix |
