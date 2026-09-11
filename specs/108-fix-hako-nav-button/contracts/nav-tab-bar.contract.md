# Interface Contract: Workspace Navigation Tab Bar

**Feature**: `108-fix-hako-nav-button`
**Type**: Frontend UI Presentation Contract
**Target Components**: `src/App.tsx`, `src/hooks/useScrollOverflow.ts`

## 1. DOM Element Contract & Accessibility

| Phần tử DOM | Bộ chọn (Selector / ID) | Vai trò (ARIA / Accessibility) | Thuộc tính bắt buộc |
| :--- | :--- | :--- | :--- |
| Container thanh tab | `div.sticky.top-14.z-30` | `none` | Cấp lớp `z-30` theo chuẩn Design System |
| Dải cuộn tab | `div[ref=tabNavContainerRef]` | `none` | `overflow-x-auto scrollbar-none scroll-smooth` |
| Thẻ nav | `nav[role="tablist"]` | `role="tablist"`, `aria-label="Phân vùng làm việc chính"` | `flex space-x-1 min-w-max` |
| Nút Tab 1 (Dịch thuật) | `#tab-translate` | `role="tab"`, `aria-selected`, `aria-controls="panel-translate"` | `title="Bàn Dịch Thuật (Alt+1)"` |
| Nút Tab 2 (Tự động) | `#tab-auto-translate` | `role="tab"`, `aria-selected`, `aria-controls="panel-auto-translate"` | `title="Dịch Tự Động Toàn Bộ (Alt+2)"` |
| Nút Tab 3 (Từ điển) | `#tab-glossary` | `role="tab"`, `aria-selected`, `aria-controls="panel-glossary"` | `title="Từ Điển Nhân Vật & Thuật Ngữ (Alt+3)"` |
| Nút Tab 4 (Lịch sử) | `#tab-history` | `role="tab"`, `aria-selected`, `aria-controls="panel-history"` | `title="Lịch Sử Chương Dịch (Alt+4)"` |
| Nút Tab 5 (Truyện) | `#tab-projects` | `role="tab"`, `aria-selected`, `aria-controls="panel-projects"` | `title="Quản Lý Tiểu Thuyết (Alt+5)"` |
| Nút Tab 6 (Hako) | `#tab-hako-checker` | `role="tab"`, `aria-selected`, `aria-controls="panel-hako-checker"` | `title="Kiểm Định Chất Lượng Hako (Alt+6)"` |
| Nút Menu Thêm | `#nav-more-menu-btn` | `aria-haspopup="true"`, `aria-expanded` | Hiển thị khi `screen < 1536px` hoặc khi có tràn |
| Nút Cuộn Trái | `button[aria-label="Cuộn các tab sang trái"]` | `aria-label` | Hiển thị khi `canScrollLeft === true` |
| Nút Cuộn Phải | `button[aria-label="Cuộn các tab sang phải"]` | `aria-label` | Hiển thị khi `canScrollRight === true` |

---

## 2. Breakpoint Behavior Matrix

| Độ rộng màn hình (Viewport) | Hiển thị Tab Text | Khối "Bộ đang dịch" | Menu "Thêm ▾" | Cơ chế truy cập Tab 6 |
| :--- | :--- | :--- | :--- | :--- |
| `< 640px` (Mobile) | Ẩn trên header chính | Ẩn | Chuyển sang Mobile Drawer | Mở qua Drawer Hamburger (`MoreHorizontal`) |
| `640px - 1023px` (Tablet) | Nhãn rút gọn | Co lại `max-w-[140px]`, ẩn nhãn tĩnh | Hiển thị | Qua cuộn dải tab HOẶC Menu "Thêm ▾" HOẶC `Alt+6` |
| `1024px - 1279px` (Desktop nhỏ) | Nhãn rút gọn | Co lại `max-w-[180px]`, ẩn nhãn tĩnh | Hiển thị | Hiển thị trực tiếp HOẶC Menu "Thêm ▾" HOẶC `Alt+6` |
| `1280px - 1535px` (Laptop phổ thông `xl`) | Nhãn rút gọn + padding gọn | `max-w-[220px]` | Hiển thị | **Hiển thị trực tiếp 100% trong khung nhìn** |
| `>= 1536px` (`2xl`) | Nhãn đầy đủ + phím tắt Kbd | `max-w-[300px]` đầy đủ tiền tố | Ẩn (`2xl:hidden`) | Hiển thị trực tiếp rộng rãi |

---

## 3. Hook Interface: `useScrollOverflow`

```typescript
export interface UseScrollOverflowOptions {
  threshold?: number;   // Mặc định: 2px
  scrollStep?: number;  // Mặc định: 220px
}

export interface UseScrollOverflowReturn<T extends HTMLElement = HTMLElement> {
  containerRef: RefObject<T | null>;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  checkOverflow: () => void;
  scrollToElement: (elementOrId: HTMLElement | string | null, behavior?: ScrollBehavior) => void;
  scrollByOffset: (offset: number, behavior?: ScrollBehavior) => void;
  scrollLeftAction: () => void;
  scrollRightAction: () => void;
}
```
- **Hành vi bổ sung**: Hook tự động lắng nghe sự kiện thay đổi kích thước của phần tử con (child element) bên trong container để tính toán lại `checkOverflow()` ngay khi các Badge hoặc văn bản bất đồng bộ được render.

