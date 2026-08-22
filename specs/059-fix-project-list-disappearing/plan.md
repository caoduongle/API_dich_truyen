# Implementation Plan: Fix Disappearing Project Card Grid on Tab Navigation

**Feature Directory**: `specs/059-fix-project-list-disappearing`  
**Feature Branch**: `059-fix-project-list-disappearing`  
**Spec**: [`specs/059-fix-project-list-disappearing/spec.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/059-fix-project-list-disappearing/spec.md)  

---

## 1. Technical Context & Overview

### Summary
Fix the visual disappearance of project cards when users navigate away from the "Quản Lý Truyện" tab and return, by removing the JS-driven motion entrance animation that freezes in a transparent state inside `display: none` tab containers.

### Key Files
- `src/components/ProjectList.tsx`: Remove `motion.div` wrapper and `CARD_ENTRANCE` variants.
- `src/components/__tests__/ProjectList.test.tsx`: Verify unit test coverage for project card list rendering and interactions.

---

## 2. Constitution & Rules Check

- **Lint/Typecheck**: `npm run lint` (`tsc --noEmit`) MUST be 100% clean.
- **Unit Tests**: `npm test` (`vitest run`) MUST pass all tests.
- **Production Build**: `npm run build` MUST succeed.
- **Deny-List Compliance**:
  - No changes to server translation logic or Gemini endpoints.
  - No changes to IndexedDB schema (`src/services/db.ts`) or `types.ts`.
  - No new external packages.
  - Browser verification with real before/after validation in Chrome.

---

## 3. Proposed Changes

### Component: `src/components/ProjectList.tsx`
- Remove `import { motion, type Variants } from 'motion/react';` (keep or adjust imports).
- Remove `CARD_ENTRANCE` variants definition.
- Replace `<motion.div key={proj.id} custom={i} initial="hidden" animate="show" variants={CARD_ENTRANCE}>` with standard `<div>` (or directly `<ProjectCard key={proj.id} ... />`).
- Ensure all card props and callbacks remain intact.

---

## 4. Verification Plan

### Automated Checks
- `npm run lint`
- `npm test`
- `npm run build`

### Manual Chrome DevTools Verification
- Capture before/after screenshots of "Quản Lý Truyện" tab.
- Perform multi-tab navigation loop (Alt+5 -> Alt+1 -> Alt+2 -> Alt+3 -> Alt+4 -> Alt+5) and verify all cards remain visible with `opacity: 1`.
