# Phase 1 Interface Contracts: UI/UX Audit & Standardization

**Feature**: `084-ui-ux-optimization`  
**Date**: 2026-09-05  

---

## 1. Component Contract: `Button` (`src/components/ui/Button.tsx`)

```typescript
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  type?: 'button' | 'submit' | 'reset'; // MẶC ĐỊNH PHẢI LÀ 'button' nếu không truyền
}
```

### Invariants & Accessibility Rules:
1. Nếu `type` không được truyền tường minh, component **BẮT BUỘC** gán mặc định `type="button"` để ngăn hành vi kích hoạt submit form ngầm khi nằm trong thẻ `<form>`.
2. Vùng bấm (`touch target`) trên màn hình cảm ứng (<640px) phải có chiều cao tối thiểu $\ge 38\text{px}$ đối với size `sm` và $\ge 44\text{px}$ đối với size `md`.

---

## 2. Component Contract: `NotFoundPage` (`src/components/common/NotFoundPage.tsx`)

```typescript
export interface NotFoundPageProps {
  onBackHome: () => void;
  message?: string;
}
```

### Visual & Behavioral Rules:
1. Hiển thị ấn triện `Seal` với ký tự Hán `無` (Vô/Không) và tone màu `polish` (đỏ Chu Sa).
2. Tiêu đề sử dụng font chữ `font-display` (Fraunces).
3. Nút quay về bàn dịch chính phải sử dụng biến thể `variant="primary"` với icon `ArrowLeft`.

---

## 3. Link Safety & Semantics Contract

Toàn bộ liên kết ngoại vi hoặc nội bộ phải tuân thủ nghiêm ngặt:

| Loại liên kết | Cú pháp bắt buộc | Thuộc tính bảo mật |
|---|---|---|
| **Liên kết ngoài (GitHub, Docs)** | `<a href="https://..." target="_blank" rel="noopener noreferrer">` | `rel="noopener noreferrer"` chống tabnabbing |
| **Gửi Email** | `<a href="mailto:hotro@dichtruyen.ai">` | Mở client gửi email trực tiếp |
| **Gọi Điện thoại** | `<a href="tel:+84988000111">` | Mở giao diện quay số trên điện thoại |
| **Nút hành động nội bộ** | `<button type="button" onClick={...}>` | **CẤM** dùng `<a href="#">` để gắn sự kiện click |

---

## 4. Media & Image Loading Contract

Mọi thẻ `<img>` hiển thị trên toàn bộ ứng dụng:

```tsx
<img
  src={srcUrl}
  alt={accessibleAltText}
  width={numericWidth}
  height={numericHeight}
  loading="lazy"
  decoding="async"
  onError={(e) => {
    // Fallback UI khi ảnh hỏng
  }}
/>
```
