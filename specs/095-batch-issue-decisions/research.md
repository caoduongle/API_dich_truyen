# Research: Batch Issue Decisions & Shared Connection Caching

## Technical Decisions

### 1. IndexedDB Connection Promise Caching
- **Context**: In `src/services/hakoSessionStore.ts`, `openDatabase()` was invoked afresh on every single query or update, executing `indexedDB.open(DB_NAME, DB_VERSION)`.
- **Decision**: Cache `let dbPromise: Promise<IDBDatabase> | null = null` at the module level.
- **Rationale**:
  - Caching the `Promise<IDBDatabase>` rather than just the `IDBDatabase` object ensures that concurrent asynchronous requests arriving while the connection is still in the process of opening reuse the exact same connection promise, avoiding duplicate opening requests.
  - When connection success fires, attach `db.onclose = () => { dbPromise = null; }` and `db.onversionchange = () => { db.close(); dbPromise = null; }` to handle unexpected browser connection drops and database upgrades gracefully.
  - On error or reject, reset `dbPromise = null` so future operations can retry.
- **Alternatives Considered**:
  - *Keep opening on every request*: Severe overhead, creates lock contention and connection churn in browsers.
  - *Store raw `IDBDatabase`*: Doesn't handle simultaneous in-flight opens before `request.onsuccess` fires.

### 2. Batch Decision Hook Method (`updateMultipleIssueDecisions`)
- **Context**: Currently, UI batch confirm/dismiss iterates through filtered issues and invokes `updateIssueDecision(issue.id, 'confirmed')` individually. For 30–50 issues, this executes 30–50 state updates and 30–50 full-session IndexedDB saves.
- **Decision**: Introduce `updateMultipleIssueDecisions(issueIds: string[], decision: QualityIssueDecision): Promise<void>` in `useHakoReviewSession`.
- **Rationale**:
  - Uses `const idSet = new Set(issueIds.map(String))` to perform $O(1)$ membership checks, mapping over `current.issues` in a single pass ($O(N)$).
  - Mutates session state once and invokes `persistSession(updated, 0)` exactly once with the fully updated issue array.
  - Preserves single-issue `updateIssueDecision` for individual card clicks, meeting backwards compatibility constraints.
- **Alternatives Considered**:
  - *Debounce `updateIssueDecision`*: While debouncing reduces disk writes, it leads to intermediate state re-renders and potential race conditions if the user triggers export or re-analysis before the timer fires.
  - *Bulk update inside IndexedDB directly bypassing React state*: Causes state desynchronization between React memory and IndexedDB.

### 3. Review Panel Callback Wiring
- **Context**: `HakoIssueReviewPanel` receives `onDecisionChange`.
- **Decision**: Add optional `onBatchDecisionChange?: (issueIds: string[], decision: QualityIssueDecision) => void` prop to `HakoIssueReviewPanelProps`.
- **Rationale**:
  - In `handleBatchConfirm` and `handleBatchDismiss`, collect all `pending` issue IDs matching the current active filter.
  - If `onBatchDecisionChange` is provided, invoke it with the array of pending IDs.
  - Fallback to `pendingIds.forEach(id => onDecisionChange(id, ...))` if `onBatchDecisionChange` is undefined, guaranteeing non-breaking backward compatibility.
  - Wire `onBatchDecisionChange={updateMultipleIssueDecisions}` in `HakoCheckerWorkspace.tsx`.
- **Alternatives Considered**:
  - *Breaking change removing `onDecisionChange`*: Violates existing single-issue card callbacks.
