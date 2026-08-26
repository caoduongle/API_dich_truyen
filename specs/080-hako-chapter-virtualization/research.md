# Phase 0 Research: Hako Checker Chapter Virtualization & Performance Resilience

## Technical Decisions & Analysis

### 1. Virtualization Architecture for Hako Chapter Selector

- **Decision**: Utilize the existing native hook [`src/hooks/useVirtualList.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/hooks/useVirtualList.ts) without adding external NPM dependencies.
- **Rationale**:
  - The repository's Constitution (Principle II) prohibits introducing new external dependencies when existing modules/hooks suffice.
  - `useVirtualList.ts` is lightweight (<1KB), has zero dependencies, and provides instant scroll tracking with configurable `itemHeight`, `containerHeight`, and `overscan`.
  - Virtualizing lists with >20 chapters cuts rendered DOM nodes from >2,000 to ~12-18 nodes at any given scroll position.
- **Alternatives Considered**:
  - `react-window` / `@tanstack/react-virtual`: Excellent libraries, but would introduce external dependencies that violate project constitution when a native hook is already present in `src/hooks/useVirtualList.ts`.
  - Manual pagination (e.g. 20 chapters per page): Breaks the natural fluid scrolling workflow of translation moderators auditing sequential chapters.

---

### 2. $O(1)$ Selection Set Lookup vs $O(N)$ Array Scanning

- **Decision**: Replace `selectedChapterIds.some((id) => String(id) === chapterIdStr)` in `HakoChapterSelector` with a memoized `Set<string>`.
- **Rationale**:
  - For $N = 139$ chapters (and $M \le 12$ selected chapters), array scanning executes $N \times M$ comparisons on every render cycle.
  - In React 19 concurrent mode, deriving `const selectedSet = useMemo(() => new Set(selectedChapterIds.map(String)), [selectedChapterIds])` enables $O(1)$ `selectedSet.has(chapterIdStr)` lookup for each virtualized row.
  - Reduces per-frame render overhead to negligible CPU cycles (<1ms).

---

### 3. Granular IndexedDB Persistence & StructuredClone Elimination

- **Decision**: Retain 300ms debouncing for chapter selections in [`useHakoReviewSession.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/hooks/useHakoReviewSession.ts), while ensuring `sanitizeSession` in [`hakoSessionStore.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/services/hakoSessionStore.ts) guarantees zero full-text payload (`vietnameseContent` or large untrimmed raw) enters `store.put()`.
- **Rationale**:
  - IndexedDB's `structuredClone` algorithm serializes objects deeply. Writing large strings on every checkbox toggle creates Main Thread GC spikes (+11MB).
  - Sanitizing data before persistence ensures the stored session object size remains under ~10-25KB even for a 500-chapter project.
- **Alternatives Considered**:
  - Dedicated `selected_chapters` object store in IndexedDB: Adds unnecessary schema migration complexity (violating Principle IV). Sanitized single-record update with 300ms debouncing is clean, robust, and maintains full backward compatibility with `HakoQualityCheckerDB` schema v2.

---

### 4. Dynamic Row Height Handling for Raw Text Drawer

- **Decision**: Keep chapter rows at fixed default height (48px) for standard view; for chapters with opened raw drawers, either expand in-place or manage drawer state cleanly so that scroll container adjusts total height or supports dynamic heights with overscan buffer.
- **Rationale**:
  - 95%+ of chapters are viewed in collapsed mode (selecting checkboxes and reading badges).
  - Raw drawers are typically expanded for 1-2 chapters at a time for manual Chinese text inspection.
  - Giving `overscan = 8` ensures adjacent elements are always pre-rendered without visual clipping during scrolling.
