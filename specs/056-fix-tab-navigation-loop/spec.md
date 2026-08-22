# Feature Specification: Fix Tab Navigation Infinite Loop

**Feature Branch**: `056-fix-tab-navigation-loop`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "Tab navigation only moves right, never left — caused by infinite render loop in useChapterCRDT hook"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigate Between All Tabs Freely (Priority: P1)

As a translator, I need to click on any of the 5 main navigation tabs (Dịch / Tự động dịch / Thuật ngữ / Lịch sử / Dự án) and have the application switch to the selected tab immediately, regardless of whether it is to the left or right of the currently active tab.

**Why this priority**: This is the core functionality being broken. Without bidirectional tab navigation, users cannot access previously visited tabs, rendering the application's main navigation unusable for returning to prior workspaces.

**Independent Test**: Can be fully tested by clicking tabs in both directions (left and right) and verifying the correct panel content displays each time.

**Acceptance Scenarios**:

1. **Given** the user is on the "Tự động dịch" (Batch Auto-Translator) tab, **When** the user clicks "Dịch" (Translation Workspace) to the left, **Then** the Translation Workspace panel content is displayed and the tab is visually highlighted as active.
2. **Given** the user is on the "Lịch sử" (Chapter History) tab, **When** the user clicks "Dịch" (Translation Workspace) three tabs to the left, **Then** the Translation Workspace panel content is displayed.
3. **Given** the user is on any tab, **When** the user presses the keyboard shortcut Alt+1 through Alt+5, **Then** the corresponding tab panel is displayed regardless of current position.
4. **Given** the user rapidly clicks between tabs (e.g., tab 1 → 3 → 2 → 5 → 1), **Then** the final tab clicked is correctly displayed without lag, flicker, or stale content.

---

### User Story 2 - No Console Errors During Normal Navigation (Priority: P2)

As a user, the application should not produce "Maximum update depth exceeded" errors during normal usage, as these errors degrade performance and block legitimate state updates across the entire component tree.

**Why this priority**: The infinite loop error is the root cause of the tab navigation bug, and also causes performance degradation for all interaction within the TranslatorWorkspace component.

**Independent Test**: Can be tested by opening the browser console, navigating through tabs, and confirming zero "Maximum update depth exceeded" errors appear.

**Acceptance Scenarios**:

1. **Given** the application loads with an active project, **When** the user navigates between all tabs and interacts with the TranslatorWorkspace, **Then** the browser console shows zero "Maximum update depth exceeded" errors.
2. **Given** the CRDT hook initializes for a chapter (shared or non-shared), **When** the component re-renders due to normal user interaction, **Then** the useEffect in useChapterCRDT does not re-trigger unless its genuine dependencies (projectId, chapterId, isShared) actually change.

---

### User Story 3 - CRDT Real-Time Collaboration Remains Functional (Priority: P2)

As a collaborator on a shared project, the CRDT real-time synchronization must continue to work correctly after the fix — remote changes should still propagate to the local UI, and the collaborator presence bar should still display accurate status.

**Why this priority**: The fix must not regress the real-time collaboration feature. The `onRemoteChange` callback must still be invoked correctly when remote changes arrive.

**Independent Test**: Can be tested by opening two browser tabs on a shared project and verifying that edits in one tab appear in the other.

**Acceptance Scenarios**:

1. **Given** two users are editing the same shared chapter, **When** user A modifies the raw translation, **Then** user B sees the change reflected in their Translation Workspace.
2. **Given** the CRDT hook is initialized for a shared project, **When** the WebSocket connection status changes, **Then** the CollaboratorPresenceBar displays the correct status (connected / connecting / offline).

---

### Edge Cases

- What happens when the user switches tabs while the CRDT WebSocket is in the "connecting" state? The cleanup must run reliably without leaving orphaned listeners.
- What happens when `onRemoteChange` is called during a React transition? The state updates from remote changes must not be blocked or dropped.
- What happens when `chapterId` changes rapidly (user quickly switching chapters)? The effect cleanup and re-initialization cycle must be stable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `onRemoteChange` callback passed to `useChapterCRDT` MUST be stabilized using `useCallback` (or equivalent memoization) so that its identity does not change on every render of the parent component.
- **FR-002**: The `useEffect` dependency array in `useChapterCRDT` MUST only include values whose identity genuinely determines whether the effect should re-run (projectId, chapterId, isShared, user identity fields). Callback-type dependencies MUST be stored in refs to avoid triggering re-runs.
- **FR-003**: After the fix, calling `switchTab(anyTab)` from any current tab MUST successfully change `activeTab` state and update the displayed panel, in both left and right directions.
- **FR-004**: The fix MUST NOT break real-time CRDT synchronization — the `onRemoteChange` callback must still be invoked correctly with up-to-date closure values when remote Y.Doc updates arrive.
- **FR-005**: After the fix, the browser console MUST NOT log any "Maximum update depth exceeded" errors during normal application usage.

### Key Entities

- **`useChapterCRDT` hook** (`src/hooks/useChapterCRDT.ts`): The CRDT lifecycle hook whose `useEffect` has an unstable dependency causing infinite re-renders.
- **`TranslatorWorkspace`** (`src/components/TranslatorWorkspace.tsx`): The parent component that passes an inline `onRemoteChange` callback, creating a new function reference every render.
- **`switchTab`** (`src/App.tsx`): The tab navigation function whose `startTransition(() => setActiveTab(tab))` calls are being dropped because React hits its maximum update depth limit from the infinite loop in a sibling component tree.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can navigate to any tab from any other tab (all 20 directional combinations of 5 tabs) successfully on first click.
- **SC-002**: Zero "Maximum update depth exceeded" errors in the browser console during a full session of tab switching and chapter editing.
- **SC-003**: All existing automated tests (`npm test`) continue to pass without modification.
- **SC-004**: The application builds successfully (`npm run build`) and type-checks cleanly (`npm run lint`).
- **SC-005**: Real-time CRDT sync continues to propagate remote changes to the UI without regression.

## Assumptions

- The root cause is the unstable `onRemoteChange` inline callback in `TranslatorWorkspace.tsx` line 109, which is included in the `useEffect` dependency array in `useChapterCRDT.ts` line 208, causing an infinite effect → setState → re-render → new callback → effect re-trigger loop.
- The `debouncedSaveToDb` callback is already properly memoized with `useCallback` and is NOT a contributing factor.
- The fix is a targeted 2-file change (stabilize callback + adjust deps), not a rewrite of the CRDT system.
- This bug was introduced with spec 055 (CRDT Real-Time Collaboration), the most recent feature added to the repository.
