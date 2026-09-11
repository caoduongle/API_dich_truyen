# Implementation Plan: Keyboard Navigation and Quick Execution for Audit Issues

**Branch**: `105-audit-keyboard-navigation` | **Date**: 2026-09-11 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/105-audit-keyboard-navigation/spec.md)

**Input**: Feature specification from `/specs/105-audit-keyboard-navigation/spec.md`

## Summary

Implement keyboard-driven triage for audit issues in `UnifiedAuditPanel.tsx` using `useHotkeys`.
Users can navigate up/down through filtered audit issues using `Alt+J` and `Alt+K` with bounded clamping and smooth scrolling into view, and press `Enter` to either auto-fix deterministic errors or focus and select the problematic excerpt in the editor. Strict form guards prevent interference with textarea newlines.

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19, Vite 6  
**Primary Dependencies**: Tailwind CSS v4, Lucide React, `useHotkeys` (custom hook in `src/hooks/useHotkeys.ts`)  
**Storage**: N/A (UI-only state in React component)  
**Testing**: Vitest (`vitest run`)  
**Target Platform**: Modern Web Browsers  
**Project Type**: Single-page application UI component  
**Performance Goals**: Hotkey response < 16ms, zero scroll stutter  
**Constraints**:
- Confine changes strictly to `UnifiedAuditPanel.tsx` and/or `BilingualEditor.tsx` (and respective unit tests)
- 0 modification to existing `Ctrl+S` / `Ctrl+Enter` shortcut behaviors
- Zero new external dependencies — reuse `useHotkeys`
- Double guard `Enter` hotkey (`enableOnFormTags: false` + `document.activeElement` checks)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I (Quality Gates)**: `npm run lint`, `npm test`, `npm run build` must pass cleanly. (PASS)
- **Principle II (Dependency Minimization)**: Reuses existing `useHotkeys.ts` hook without new npm packages. (PASS)
- **Principle III (Domain Boundary)**: UI-only scope, 0 changes to translation engine, Gemini calls, or backend. (PASS)
- **Principle IV (Immutable Core Schemas)**: No changes to `types.ts` or IndexedDB storage. (PASS)
- **Principle V (Atomic Commits)**: Small, focused changes strictly in `UnifiedAuditPanel.tsx`. (PASS)

## Project Structure

### Documentation (this feature)

```text
specs/105-audit-keyboard-navigation/
├── plan.md              # This file
├── research.md          # Architecture decisions (placement, clamping, collision guard)
├── data-model.md        # State transitions and pure navigation functions
├── quickstart.md        # Walkthrough validation scenarios
└── contracts/
    └── audit-keyboard-navigation.contract.md # Hotkey contracts & CSS specifications
```

### Source Code (in scope)

```text
src/
└── components/
    └── translator-workspace/
        ├── UnifiedAuditPanel.tsx
        └── __tests__/
            └── UnifiedAuditPanel.test.tsx
```

## Complexity Tracking

No constitution violations detected. Standard hook and pure functions guarantee bounded safety without complexity.
