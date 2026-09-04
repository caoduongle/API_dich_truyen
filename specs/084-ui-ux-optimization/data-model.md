# Phase 1 Data Model: UI States & Interface Entities

**Feature**: `084-ui-ux-optimization`  
**Date**: 2026-09-05  

---

## 1. UI Navigation & Viewport State

Quản lý trạng thái hiển thị của các thành phần giao diện theo kích thước màn hình:

```typescript
/**
 * Trạng thái mở/đóng của ngăn kéo điều hướng di động (Mobile Drawer)
 */
interface MobileNavigationState {
  isOpen: boolean;
  activeTab: 'translate' | 'auto-translate' | 'glossary' | 'history' | 'projects' | 'hako-checker';
}

/**
 * Ngữ cảnh tiêu đề và siêu dữ liệu trang
 */
interface PageMetadataContext {
  activeTab: string;
  projectTitle?: string;
  tabTitleMap: Record<string, string>;
  resolvedDocumentTitle: string;
  metaDescription: string;
}
```

---

## 2. Form Validation & Error State Model

Mô hình quản lý lỗi tại chỗ cho các form nhập liệu (Thuật ngữ, Dự án):

```typescript
/**
 * Trạng thái lỗi phân bổ theo từng trường của form nhập thuật ngữ
 */
interface GlossaryFormErrors {
  chinese?: string;
  vietnamese?: string;
  pinyin?: string;
}

/**
 * Trạng thái lỗi phân bổ theo từng trường của form tạo/sửa dự án
 */
interface ProjectFormErrors {
  title?: string;
  author?: string;
  genre?: string;
}
```

---

## 3. Feedback Notification Model

Tái sử dụng interface `ToastOptions` đã có trong `src/components/NotificationSystem.tsx`:

```typescript
export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  onUndo?: () => void | Promise<void>;
  undoLabel?: string;
}
```

---

## 4. 404 Route / Fallback Entity Model

Thực thể truyền vào component `NotFoundPage`:

```typescript
interface NotFoundPageProps {
  onBackHome: () => void;
  message?: string;
  errorCode?: string; // Mặc định "404"
}
```
