# Implementation Plan: Sửa Lỗi Tràn & Hiển Thị Thanh Điều Hướng Tab Chính

**Branch**: `076-nav-tabs-overflow-fix` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/076-nav-tabs-overflow-fix/spec.md`

## Summary

Khắc phục lỗi thanh điều hướng chính trong `src/App.tsx` che mất Tab 6 ("Kiểm Tra Chất Lượng" - Alt+6) khi hiển thị trên các màn hình laptop/cửa sổ có độ rộng hạn chế. Giải pháp bao gồm:
1. **Tự động cuộn tab kích hoạt vào vùng hiển thị**: Khi người dùng click chuột hoặc dùng phím tắt `Alt+1..6`, tự động gọi `scrollIntoView` mượt mà cho nút tab tương ứng.
2. **Chỉ báo tràn mờ chuyển sắc (Fade Overlays)**: Hiển thị lớp phủ mờ tinh tế cùng tông `bg-parchment` ở mép trái/phải khi có nội dung bị khuất, `pointer-events-none`.
3. **Tách biệt khối thông tin truyện hiện tại (`activeProject.title`)**: Đưa khối tên truyện ra ngoài luồng cuộn của dải tab, hỗ trợ co giãn tối đa và `truncate` kèm tooltip.

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19  
**Primary Dependencies**: Tailwind CSS v4, `clsx`, `tailwind-merge`, `lucide-react` (Zero new dependencies)  
**Storage**: N/A (UI layout & DOM scroll behavior only)  
**Testing**: Vitest 4.1 (`npm test`), TypeScript Typecheck (`npm run lint`), Production build (`npm run build`)  
**Target Platform**: Modern Desktop/Laptop Browsers (Chrome, Edge, Firefox, Safari) + Tablet/Mobile  
**Project Type**: React Web Frontend  
**Performance Goals**: Instant overflow calculation (< 16ms), smooth DOM scrolling  
**Constraints**: Zero new npm dependencies, preserve all 6 tab IDs/hotkeys/accessibility attributes, keep sticky tab bar z-index at 30.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I (Strict Quality Gates)**: `npm run lint`, `npm test`, `npm run build` must all pass cleanly.
- [x] **Principle II (Dependency Minimization)**: Zero new dependencies added. Reuses existing Tailwind tokens (`bg-parchment`, `from-parchment`), `Kbd`, `Badge`.
- [x] **Principle III (Domain Boundary Preservation)**: Only touches navigation UI layout in `src/App.tsx` and optional scroll hook. Zero modification to translation pipeline or Gemini API.
- [x] **Principle IV (Immutable Core Schemas)**: No changes to `src/types.ts` schemas, IndexedDB, or user-facing Vietnamese strings.
- [x] **Principle V (Atomic Commits & Docs)**: Small, targeted changes to `src/App.tsx`.

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
├── App.tsx              # Main navigation tab strip, auto-scroll and overflow fade overlays
├── hooks/
│   └── useScrollOverflow.ts (optional helper hook or inline in App.tsx)
└── types.ts             # Unchanged
```

**Structure Decision**: Update `src/App.tsx` directly or provide a lightweight hook in `src/hooks/useScrollOverflow.ts` to manage horizontal scroll overflow detection and automatic scrolling for the active tab.

## Complexity Tracking

| Item | Decision & Rationale |
|---|---|
| Auto-scroll | Native `element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })` triggered on `activeTab` changes. |
| Overflow Indicators | Two absolute `div` elements with `pointer-events-none` and `bg-gradient-to-r/l from-parchment to-transparent` conditionally shown when `canScrollLeft` / `canScrollRight` is true. |
| Project Title Layout | Flex row with `flex-1 min-w-0` for tab container and `shrink-0` with max width for project title container. |
