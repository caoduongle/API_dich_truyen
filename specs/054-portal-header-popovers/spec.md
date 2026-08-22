# Feature Specification: Portal-Based Header Popovers (ThemeSwitcher & LanguageSelector)

**Feature Branch**: `054-portal-header-popovers`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "Fix lỗi popup của ThemeSwitcher (src/components/common/ThemeSwitcher.tsx) bị thanh tab điều hướng (App.tsx dòng ~259, sticky top-14 z-30) che mất khi mở — nguyên nhân đã xác định rõ, KHÔNG cần dò lại từ đầu: header (App.tsx dòng ~195, sticky top-0 z-30) và thanh tab là 2 stacking context ngang hàng cùng z-30, thanh tab render sau trong DOM nên đè lên toàn bộ header kể cả popup z-40 bên trong nó (ThemeSwitcher.tsx dòng ~107) — KHÔNG sửa bằng cách tăng z-index của popup (z-50, z-[999]...), cách đó không giải quyết được vì popup vẫn bị nhốt trong stacking context z-30 của header dù giá trị z-index của nó là bao nhiêu. Cách fix: dùng ReactDOM.createPortal render phần menu popup (phần div role='menu') ra document.body thay vì để lồng trong header, định vị bằng position: fixed + toạ độ lấy từ getBoundingClientRect() của nút trigger (Button đã hỗ trợ forwardRef sẵn, dùng ref đó), tính lại toạ độ mỗi lần mở popup và khi resize/scroll. Giữ nguyên z-40 cho nội dung popup sau khi portal (đúng ngữ nghĩa thang z-index đã có trong .agents/rules/design-system.md, giờ mới thực sự phát huy vì đã thoát bẫy stacking context) — KHÔNG đổi giá trị z-30 của header hay thanh tab, thang đó đã được audit kỹ, đừng động vào. LanguageSelector.tsx (dòng ~49) có structure 'absolute ... z-40' giống hệt và nằm trong cùng header nên dính đúng lỗi này (kể cả nếu bạn chưa thấy user report) — sửa luôn, đừng bỏ sót; vì 2 nơi cần logic giống hệt nhau, trích xuất phần portal + tính toạ độ + đóng khi click-outside/Escape thành 1 hook dùng chung kiểu src/hooks/useDropdownPosition.ts (hoặc bọc thành component src/components/ui/Popover.tsx nếu thấy hợp lý hơn — tuỳ bạn), rồi cho cả ThemeSwitcher và LanguageSelector cùng dùng lại thay vì viết portal riêng 2 lần. LƯU Ý QUAN TRỌNG khi refactor phần đóng-khi-click-ngoài: code hiện tại (dropdownRef.current.contains(event.target)) chỉ đúng khi popup còn nằm trong cùng cây DOM với nút — sau khi portal ra document.body, phải giữ thêm 1 ref cho chính nội dung đã portal và coi click là 'outside' chỉ khi nó nằm ngoài CẢ nút trigger LẪN nội dung popup đã portal, nếu không popup sẽ tự đóng ngay lúc vừa mở vì portal target (document.body) nằm ngoài dropdownRef gốc. Giữ nguyên mọi hành vi khác không đổi: đóng khi bấm Escape, animation animate-in/fade-in/zoom-in-95 hiện có, giao diện/label các item trong menu — chỉ đổi cơ chế render+định vị, không đổi nội dung hay style hiển thị. Việc cần làm KHÔNG bao gồm: đổi giá trị z-index trong .agents/rules/design-system.md, đổi cấu trúc header/thanh tab ở App.tsx, đổi logic dịch/gọi API."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unclipped ThemeSwitcher Popover over Sticky Navigation Tabs (Priority: P1)

As a translator using the top header in `App.tsx`, I want the `ThemeSwitcher` popover menu to display completely above the sibling sticky navigation tab bar (`sticky top-14 z-30`) without being visually clipped, obscured, or cut off when open, so that I can see and select all 4 theme options (Tối, Sáng, Sepia, Tùy chỉnh) seamlessly at all viewport positions.

**Why this priority**: Directly fixes a critical UI stacking context bug where child dropdown menus inside the header (`sticky top-0 z-30`) are clipped by the adjacent tab bar (`sticky top-14 z-30`).

**Independent Test**: Open the application, view the header with the navigation tab bar visible directly beneath it, click the Theme Switcher button, and verify that the 4-item dropdown menu renders completely on top of the tab bar with no clipping or visual occlusion.

**Acceptance Scenarios**:

1. **Given** the application is rendered with the sticky header (`top-0 z-30`) and sticky tab bar (`top-14 z-30`), **When** the user clicks the Theme Switcher trigger button, **Then** the popover menu is rendered via `ReactDOM.createPortal` into `document.body` at `z-40` with `position: fixed`.
2. **Given** the Theme Switcher popover is open, **When** inspecting its position, **Then** its top and right coordinates precisely align with the trigger button's bottom-right bounding box plus spacing (`rect.bottom + 4`, `window.innerWidth - rect.right`).
3. **Given** the Theme Switcher popover is open, **When** the user scrolls or resizes the browser window, **Then** the popover coordinates dynamically adjust to track the trigger button.

---

### User Story 2 - Unclipped LanguageSelector Popover over Sticky Navigation Tabs (Priority: P1)

As a multilingual user, I want the `LanguageSelector` dropdown to display fully above the navigation tab bar without clipping, using the identical portal mechanism and maintaining keyboard accessibility (Escape) and click-outside dismissal.

**Why this priority**: Eliminates the identical stacking context vulnerability in `LanguageSelector.tsx` located in the same header.

**Independent Test**: Click the Language Selector button in the header, verify that the language list floats cleanly on top of the sticky navigation tab bar, select a language (e.g. English), and verify that language switches and menu closes.

**Acceptance Scenarios**:

1. **Given** the `LanguageSelector` in the header, **When** clicked, **Then** its menu renders via `ReactDOM.createPortal` at `z-40` over `document.body`.
2. **Given** the menu is open, **When** clicking a language option (e.g. English), **Then** the language updates and the popover closes cleanly.
3. **Given** the menu is open, **When** pressing Escape or clicking outside both trigger and menu, **Then** the menu closes without unintended dismissal while interacting with menu items.

---

### User Story 3 - Reusable Dropdown Positioning & Safe Outside-Click Hook (Priority: P1)

As a frontend developer, I want a reusable hook (`src/hooks/useDropdownPosition.ts`) that manages portal coordinate calculations, dynamic window resize/scroll tracking, and safe outside-click detection across portaled elements, so that future header or navbar dropdowns avoid stacking context traps without duplicate logic.

**Why this priority**: Centralizes positioning and event listeners while preventing the common bug where portaled elements trigger immediate self-dismissal due to being outside the trigger's DOM subtree.

**Independent Test**: Mount both `ThemeSwitcher` and `LanguageSelector`, verify that interacting inside the portaled menu does NOT trigger outside-click dismissal, while clicking anywhere else on the document closes the active menu immediately.

**Acceptance Scenarios**:

1. **Given** `useDropdownPosition`, **When** the popover is open, **Then** a global `mousedown` listener checks `!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)` before calling `onClose`.
2. **Given** `useDropdownPosition`, **When** the window is scrolled or resized, **Then** an optimized layout effect updates the `{ top, right }` fixed coordinates.
3. **Given** the hook is unmounted or closed, **When** destroyed, **Then** all window scroll, resize, and keydown event listeners are cleaned up completely.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST render popover menus for `ThemeSwitcher` and `LanguageSelector` into `document.body` using `ReactDOM.createPortal` to escape the header's stacking context.
- **FR-002**: The system MUST position the portaled popover using `position: fixed` with calculated coordinates (`top = rect.bottom + 4`, `right = window.innerWidth - rect.right`) based on `triggerRef.current.getBoundingClientRect()`.
- **FR-003**: The system MUST recalculate coordinates whenever the popover opens, and dynamically on `window.addEventListener('resize', ...)` and `window.addEventListener('scroll', ..., true)`.
- **FR-004**: The system MUST retain `z-40` for the portaled popover content, strictly following `.agents/rules/design-system.md` without modifying `z-30` of header or tab bar.
- **FR-005**: The system MUST implement safe outside-click dismissal checking that a click target is outside BOTH the trigger element AND the portaled menu element (`!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)`).
- **FR-006**: The system MUST dismiss open popovers when the `Escape` key is pressed.
- **FR-007**: The system MUST extract shared positioning, portal coordinates, and dismiss logic into a reusable hook `src/hooks/useDropdownPosition.ts`.
- **FR-008**: The system MUST preserve all existing styles, animations (`animate-in fade-in zoom-in-95`), border radiuses (`rounded-[2px]`), labels, and keyboard behaviors.
- **FR-009**: All quality gates (`npm run lint`, `npm test`, `npm run build`) MUST pass cleanly.

---

### Key Entities & Types

```typescript
export interface DropdownCoords {
  top: number;
  right: number;
}

export interface UseDropdownPositionOptions {
  isOpen: boolean;
  onClose: () => void;
  offsetY?: number;
}

export interface UseDropdownPositionReturn {
  triggerRef: React.RefObject<HTMLButtonElement | HTMLElement | null>;
  menuRef: React.RefObject<HTMLDivElement | null>;
  coords: DropdownCoords | null;
}
```

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of popovers in `ThemeSwitcher` and `LanguageSelector` float completely above the sibling sticky tab bar without being clipped by the header's stacking context.
- **SC-002**: Clicking inside the portaled popover menu executes item selection without triggering outside-click self-dismissal.
- **SC-003**: Pressing Escape or clicking outside both trigger and menu immediately closes the popover.
- **SC-004**: 0 changes made to the design system Z-index ladder (`z-30` header/tab bar, `z-40` popovers remain intact).
- **SC-005**: All quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly.

---

## Assumptions

- `document.body` is always available in the browser runtime.
- The `Button` component in `src/components/ui/Button.tsx` supports `ref` forwarding (`React.forwardRef`) or standard HTML button refs.
