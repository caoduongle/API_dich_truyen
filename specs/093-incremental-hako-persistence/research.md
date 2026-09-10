# Research: Incremental Quality Review Session Persistence & Partial State Handling

**Feature**: `093-incremental-hako-persistence`  
**Date**: 2026-09-10  
**Status**: Completed  

## 1. Problem Statement & Root Cause Analysis

### Background
In `src/components/hako-checker/HakoCheckerWorkspace.tsx`, the `handleStartAnalysis` function executes a multi-step quality evaluation:
1. **JIT Content Loading**: Fetches full text for up to 12 selected chapters from IndexedDB.
2. **Heuristic Scan**: Runs fast, in-memory regex/rule checks (`runHeuristicQualityScan`) sequentially for all loaded chapters, appending results into local variable `allDetectedIssues`.
3. **AI Semantic Scan**: Calls `runAiQualityScan` via Gemini API for all valid chapters in a single batch call.
4. **Session Persistence**: Calls `updateSessionChaptersAndIssues(updatedChaptersRecord, allDetectedIssues)` **exactly once at the very end** when all chapters succeed.

### The Problem
If a moderator clicks **"Hủy phân tích"** (cancelling execution via `AbortController`), or if a transient network failure occurs during AI evaluation on chapter $K$ of $N$:
- An `AbortError` or network error is thrown.
- The execution jumps immediately to the `catch (err: any)` block:
  ```typescript
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.log('[HakoCheckerWorkspace] Phân tích đã bị hủy bởi người dùng.');
    } else {
      console.error(...); setError({...});
    }
  } finally {
    setIsAnalyzing(false);
    abortControllerRef.current = null;
  }
  ```
- Because `allDetectedIssues` was purely local and never saved to IndexedDB, **all issues identified prior to the error/cancellation (including 100% of the free heuristic findings and any AI critique from earlier chapters) are instantly lost**.
- The user is left with an empty session and has to start the entire process over again, wasting time, effort, and API quota.

---

## 2. Architectural Decisions & Patterns

### Decision 1: Per-Chapter Atomic Persistence vs. Timer-Based Persistence
- **Chosen Approach**: **Per-Chapter Incremental Persistence** (quét và lưu tăng dần theo từng chương).
  - For each chapter $i \in [1..N]$:
    1. Update chapter status to `'analyzing'`.
    2. Run heuristic quality scan $\to$ push new issues into `allDetectedIssues`.
    3. Run AI semantic scan for this single chapter (calling `runAiQualityScan({ chapters: [currentChapter], ... })`) $\to$ push AI issues into `allDetectedIssues`.
    4. Update chapter status to `'done'`.
    5. Call `updateSessionChaptersAndIssues(updatedChaptersRecord, allDetectedIssues, isLast ? 'completed' : 'analyzing')`.
  - In the `catch` block (abort or error):
    - Call `updateSessionChaptersAndIssues(updatedChaptersRecord, allDetectedIssues, 'partial')`.
- **Rationale**:
  - **Natural Domain Boundary**: Each chapter constitutes a discrete, self-contained unit of review. Storing immediately upon chapter completion aligns state perfectly: the chapter is marked `'done'`, its word count is recorded, and its issues are safely in IndexedDB.
  - **Deterministic & Zero-Race**: Timer-based debouncing or intervals introduce race conditions when the user hits abort abruptly, risking discarding the last few seconds of discovered issues.
  - **Extremely Low I/O Cost**: Under the JIT architecture (feature 077), sessions do not store full text—only metadata and issues. Each write to IndexedDB takes $\approx 5\text{--}15\text{ms}$. With a maximum of 12 chapters per run (`MAX_CHAPTERS_LIMIT = 12`), 12 small writes over minutes of AI scanning is negligible and imperceptible to the browser.
- **Alternatives Considered**:
  - *Time-based debounce interval (e.g. save every 5s)*: Rejected because if an abort happens at second 4.9, the latest issues are in memory and may be missed if unmount occurs.
  - *Save only heuristic in advance, AI at the end*: Rejected because AI scanning takes the vast majority of time. If a user cancels during chapter 8 of 10, all AI findings from chapters 1 through 7 would still be lost.

### Decision 2: Session Lifecycle State Machine Expansion ('partial' status)
- **Chosen Approach**: Extend `QualityReviewSession.status` to include `'partial'`:
  ```typescript
  export interface QualityReviewSession {
    // ...
    status: 'idle' | 'analyzing' | 'completed' | 'partial' | 'error';
  }
  ```
- **Rationale**:
  - Distinguishes clearly between a session where all selected chapters were analyzed (`'completed'`), an active review (`'analyzing'`), and an interrupted review (`'partial'`).
  - Allows the UI to conditionally display a helpful banner (`"Kết quả kiểm định chưa đầy đủ: Đã dừng giữa chừng ở chương X/Y"`) while still rendering the `HakoIssueReviewPanel` so the moderator can inspect, confirm, or export the issues already captured.
- **Alternatives Considered**:
  - *Reusing 'completed' with an error message*: Confusing to users and misleading in exported audit reports.
  - *Reusing 'error'*: 'error' typically implies nothing succeeded and hides the review panel.

### Decision 3: Flexible `updateSessionChaptersAndIssues` Signature
- **Chosen Approach**: Update `updateSessionChaptersAndIssues` in `src/hooks/useHakoReviewSession.ts`:
  ```typescript
  updateSessionChaptersAndIssues: (
    chapters: Record<string, ProjectReviewChapter>,
    issues: QualityIssue[],
    status?: 'completed' | 'partial' | 'analyzing'
  ) => Promise<void>;
  ```
  Defaulting `status` to `'completed'` when omitted.
- **Rationale**: Maintains 100% backwards compatibility with any existing callers or tests while enabling callers to explicitly control the resulting lifecycle status.
- **Alternatives Considered**:
  - *Creating a separate `updatePartialSession` function*: Creates unnecessary duplication since the sanitization and persistence logic is identical.

### Decision 4: Catch-Block Guarantee (Fail-Safe Sweep)
- **Chosen Approach**: Even with per-chapter saving, if an abort or error occurs during chapter $K$ (for example, while heuristic scan completed but before the chapter finished), the `catch` block performs a final persistence call with whatever `allDetectedIssues` contains and sets `status: 'partial'`.
- **Rationale**: Guarantees that even partial progress within the interrupted chapter (such as instant heuristic findings) is never dropped.

---

## 3. Compatibility & Boundary Verification

- **Files to Modify**:
  1. `src/types/hakoChecker.ts`: Add `'partial'` to `QualityReviewSession.status`.
  2. `src/hooks/useHakoReviewSession.ts`: Add optional `status` parameter to `updateSessionChaptersAndIssues`.
  3. `src/components/hako-checker/HakoCheckerWorkspace.tsx`: Convert analysis pipeline to per-chapter execution with incremental persistence, catch-block fail-safe, and partial UI presentation.
- **No modification to other files**:
  - `src/services/hakoQualityEngine.ts` is untouched (already accepts `chapters: [...]` array and `signal`).
  - `src/services/hakoSessionStore.ts` is untouched (`sanitizeSession` and `saveSession` work generically on `QualityReviewSession`).
  - `src/types.ts` is untouched.
- **Dependency impact**: Zero new NPM dependencies.
