# Research & Architecture Decisions: Fix Disappearing Project Card Grid

**Feature Directory**: `specs/059-fix-project-list-disappearing`  
**Feature Branch**: `059-fix-project-list-disappearing`  

---

## 1. Technical Context & Problem Investigation

### Problem
In `src/App.tsx`, tab switching retains previously visited tabs in the DOM and toggles visibility via CSS `className={activeTab !== 'projects' ? 'hidden' : ''}` (Tailwind `hidden` applies `display: none !important`).

When `ProjectList` re-renders while `#panel-projects` is hidden (for instance, when project data or translation state updates in the background), the `<motion.div>` wrapper around each project card resets to `initial="hidden"` (`opacity: 0; transform: translateY(10px)`). Because the container has `display: none`, the browser halts Web Animations / `requestAnimationFrame` animation playback. When the user navigates back to "Quản Lý Truyện", `#panel-projects` becomes visible, but the cards remain stuck with inline styles `opacity: 0; transform: translateY(10px)`.

---

## 2. Architecture & Design Decisions

### Decision 1: Remove Motion Staggered Entrance Wrapper in `src/components/ProjectList.tsx`
- **Chosen Approach**: Replace `<motion.div key={proj.id} custom={i} initial="hidden" animate="show" variants={CARD_ENTRANCE}>` with standard `<div>` (or directly render `<ProjectCard>`).
- **Rationale**:
  - Eliminates JS-driven animation state locks in `display: none` containers.
  - Ensures 100% reliable card visibility with immediate `opacity: 1` on every render.
  - Preserves exact visual design, spacing, borders, tags, progress bars, and click interactions.
  - Reduces unnecessary re-render overhead in the project grid.
- **Alternatives Considered**:
  - *Setting `initial={false}` on `motion.div`*: While it skips initial animation on mount, subsequent variant evaluations or motion tree re-renders can still cause inconsistencies in `display: none`.
  - *Unmounting tabs instead of using `display: none`*: Rejected because keeping visited tabs in the DOM is an essential UX requirement for instant switching, preserving translation workspace input, and avoiding repeated database fetch spikes.

### Decision 2: State Stability Verification in `src/hooks/useProjects.ts`
- **Chosen Approach**: Keep `setProjects` memoized with `useCallback(..., [])` and keep `useEffect(..., [setProjects])` running on mount.
- **Rationale**:
  - Empirically verified in browser runtime and unit tests that `setProjects` maintains reference stability across all renders.
  - `loadData()` runs strictly on application initialization.

---

## 3. Risk Assessment & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Card visual styling regression | Low | Low | Keep exact Tailwind classnames (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`) and `ProjectCard` props intact. |
| Tap animation inside `ProjectCard` | Low | Low | `ProjectCard` internally uses `whileTap={{ scale: 0.99 }}` which only activates on user click while visible; verified safe. |
| Test suite regressions | Low | Low | Run full unit test suite `npm test` and typecheck `npm run lint`. |
