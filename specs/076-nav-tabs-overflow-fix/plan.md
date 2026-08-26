# Implementation Plan: Kế Hoạch Giải Quyết Toàn Diện — Thanh Điều Hướng Tab Chính

**Branch**: `076-nav-tabs-overflow-fix` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/076-nav-tabs-overflow-fix/spec.md`

## Summary

Kế hoạch giải quyết toàn diện cho thanh điều hướng tab chính gồm 3 giai đoạn:
1. **Giai đoạn 1: Container cuộn mượt mà, Nút Chevron & Auto-Scroll**:
   - Container `overflow-x-auto` với `scrollbar-none`, `scroll-behavior: smooth` và `shrink-0` cho mỗi tab.
   - Hai nút cuộn Chevron trái/phải (`<`, `>`) ở hai đầu, tự động ẩn/hiện và cuộn offset 200px.
   - Lớp phủ mờ chuyển sắc (Gradient Mask) tinh tế ở hai mép.
   - Tự động cuộn `scrollIntoView` mượt mà khi `activeTab` thay đổi.
2. **Giai đoạn 2: Tối ưu hoá mật độ hiển thị (Responsive Density)**:
   - Co giãn padding linh hoạt (`px-2.5 sm:px-3 py-1.5 sm:py-2`).
   - Ẩn phím tắt `Kbd` trên màn hình `< 1440px` (`hidden 2xl:inline-block`), hiển thị trong `title` tooltip của nút tab.
   - Tách biệt khối thông tin bộ truyện hiện tại (`activeProject.title`) ở góc phải độc lập, `truncate` có tooltip.
3. **Giai đoạn 3: Menu xổ xuống "Thêm ▾" (More Dropdown Menu)**:
   - Dropdown menu popover ở cuối dải tab liệt kê trọn bộ 6 tab, cho phép chuyển tab tức thời chỉ trong 1 click.

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19  
**Primary Dependencies**: Tailwind CSS v4, `clsx`, `tailwind-merge`, `lucide-react` (Zero new dependencies)  
**Storage**: N/A (UI layout & DOM scroll state only)  
**Testing**: Vitest 4.1 (`npm test`), TypeScript Typecheck (`npm run lint`), Production build (`npm run build`)  
**Target Platform**: Modern Desktop/Laptop Browsers (Chrome, Edge, Firefox, Safari) + Tablet/Mobile  
**Project Type**: React Web Frontend  
**Performance Goals**: Instant overflow calculation (< 16ms), smooth DOM scrolling  
**Constraints**: Zero new npm dependencies, preserve all 6 tab IDs/hotkeys/accessibility attributes, keep sticky tab bar z-index at 30.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I (Strict Quality Gates)**: `npm run lint`, `npm test`, `npm run build` must all pass cleanly.
- [x] **Principle II (Dependency Minimization)**: Zero new dependencies added. Reuses existing Tailwind tokens (`bg-parchment`, `from-parchment`), `Kbd`, `Badge`, `lucide-react`.
- [x] **Principle III (Domain Boundary Preservation)**: Only touches navigation UI in `src/App.tsx`, `src/hooks/useScrollOverflow.ts`, and optional CSS utilities. Zero modification to translation pipeline or Gemini API.
- [x] **Principle IV (Immutable Core Schemas)**: No changes to `src/types.ts` schemas or IndexedDB.
- [x] **Principle V (Atomic Commits & Docs)**: Synchronized documentation across all artifacts.

## Project Structure

### Documentation (this feature)

```text
specs/076-nav-tabs-overflow-fix/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── ui-navigation.contract.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
├── App.tsx              # Main navigation tab strip with Chevrons, Fade Masks, and More Menu
├── hooks/
│   ├── useScrollOverflow.ts # Scroll overflow calculations, offset scrolling, element scrolling
│   └── __tests__/useScrollOverflow.test.ts
└── index.css            # Utility classes (.scrollbar-none)
```

## Complexity Tracking

| Item | Decision & Rationale |
|---|---|
| Chevron Buttons | Positioned absolute at `z-20` on left and right, calling `scrollByOffset(-200)` and `scrollByOffset(200)`. |
| Gradient Masks | `pointer-events-none absolute z-10 w-10 bg-gradient-to-r/l from-parchment to-transparent`. |
| Responsive Density | `hidden 2xl:inline-block` for `Kbd`, tooltip `title` on all buttons, `shrink-0` on items. |
| More Dropdown Menu | Simple accessible popover with click-outside listener listing all 6 tabs for instant 1-click navigation. |
