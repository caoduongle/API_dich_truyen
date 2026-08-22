# Feature Specification: Fix Disappearing Project Card Grid on Tab Navigation

**Feature Directory**: `specs/059-fix-project-list-disappearing`  
**Feature Branch**: `059-fix-project-list-disappearing`  
**Created**: 2026-08-22  
**Status**: DRAFT  

---

## 1. Executive Summary & Root Cause Analysis

### Problem Description
When navigating to the "Quản Lý Truyện" (Novel Projects, `Alt+5`) tab, switching to another tab (e.g. "Bàn Biên Soạn", "Tự Động Dịch"), and returning to "Quản Lý Truyện", the project card grid disappears visually (rendered blank), while the top header and action buttons remain visible and the card area still responds to clicks.

### Verified Root Cause
1. **Motion Animation Freeze in `display: none` (`src/components/ProjectList.tsx:L304-310`)**:
   - `ProjectList.tsx` wrapped each project card in `<motion.div key={proj.id} custom={i} initial="hidden" animate="show" variants={CARD_ENTRANCE}>` with `CARD_ENTRANCE = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, ... } }`.
   - In `src/App.tsx`, tab switching keeps visited tab panels mounted in the DOM and toggles visibility via `className={activeTab !== 'projects' ? 'hidden' : ''}` (Tailwind `hidden` sets CSS `display: none`).
   - When state updates happen while `#panel-projects` is hidden (`display: none`), React re-renders `ProjectList`. Motion initializes the element at `initial="hidden"` (`opacity: 0`), but the browser cannot execute Web Animations / RAF transitions on elements inside `display: none`.
   - When the user switches back to "Quản Lý Truyện", `#panel-projects` removes `display: none`, but the `motion.div` children retain their inline style `opacity: 0; transform: translateY(10px);`.
   - Because the elements are physically present in the DOM, clicking in the blank space still triggers the card's `onClick` handler, matching the exact user observation: *"phần lưới thẻ truyện biến mất (trống), nhưng phần header/nút phía trên vẫn hiển thị đúng, và vùng đó vẫn phản hồi click được."*

2. **Verification of `src/hooks/useProjects.ts`**:
   - `setProjects` is defined with `useCallback(..., [])` (empty dependency array), ensuring a stable reference across all renders.
   - The `useEffect(..., [setProjects])` hook in `useProjects.ts` executes strictly once on initial mount, and does not re-run during tab transitions.

---

## 2. User Scenarios & Acceptance Criteria

### User Story 1: Persistent & Reliable Project Cards Display Across Tab Switches (Priority: P1) 🎯 MVP
**As a** translator managing multiple translation projects,  
**I want** the project card grid in "Quản Lý Truyện" to remain 100% visible and accessible every time I switch between tabs,  
**So that** I never experience blank screens or disappearing cards when navigating around the application.

#### Acceptance Scenarios:
1. **Initial Visit**: User visits "Quản Lý Truyện" (Alt+5); all project cards render clearly with full visibility (`opacity: 1`).
2. **Tab Switch & Return**: User switches from "Quản Lý Truyện" to "Dịch" (Alt+1) or any other tab, performs actions, and switches back to "Quản Lý Truyện" (Alt+5); 100% of project cards are immediately and fully visible.
3. **Multiple Re-visits**: User repeatedly switches between all 5 navigation tabs; project cards in "Quản Lý Truyện" never freeze in a hidden or transparent state.

---

### User Story 2: Preserved Interactive Capabilities (Priority: P2)
**As a** translator,  
**I want** project card actions (select, edit, delete, export, backup, share) to continue working smoothly with responsive hover and click feedback,  
**So that** fixing the visibility bug does not compromise any project management features.

#### Acceptance Scenarios:
1. **Selecting a Project**: Clicking a project card selects it as the active project and switches to the Translation Workspace.
2. **Editing / Exporting / Sharing**: Clicking edit, download JSON, or share triggers the respective modal/action without errors.

---

## 3. Functional Requirements

- **FR-001**: Project cards rendered in `src/components/ProjectList.tsx` MUST always be rendered at full opacity (`opacity: 1`) on every tab visit, without depending on JS-driven animation states that freeze in `display: none` containers.
- **FR-002**: Removing or standardizing the card container element in `ProjectList.tsx` MUST NOT alter the responsive grid layout (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`).
- **FR-003**: All project card operations (selecting, editing, deleting, backup export, text/epub export, Google Drive share) MUST remain 100% functional.
- **FR-004**: Existing design system tokens and styling rules defined in `.agents/rules/design-system.md` MUST be preserved.

---

## 4. Success Criteria

- **SC-001**: 100% of project cards in "Quản Lý Truyện" remain visible with `opacity: 1` upon switching to other tabs and returning back.
- **SC-002**: Zero invisible clickable card areas or blank card grids on tab revisit.
- **SC-003**: All automated Quality Gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly with 0 errors.

---

## 5. Assumptions & Scope Boundaries

- **Assumptions**:
  - The tab panel switching architecture in `App.tsx` (using CSS `hidden` to preserve loaded state in visited tabs) is optimal and should be kept as-is.
  - Entrance animations for tab sub-elements should be CSS-driven or resilient to `display: none` lifecycle changes.
- **Out of Scope**:
  - Modifying IndexedDB schema or project data structure.
  - Modifying AI translation logic or server endpoints.
  - Changing visual design, typography, or color tokens of project cards.
