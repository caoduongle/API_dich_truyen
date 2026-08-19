# Data Model: Modal Standardization & Component Interfaces

**Feature**: `007-modal-migration-bundle-opt`  
**Created**: 2026-08-19  

---

## 1. Unified Modal Interface (`src/components/ui/Modal.tsx`)

```typescript
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl' | 'full';

export interface ModalProps {
  /** Trạng thái mở/đóng của modal */
  open: boolean;
  /** Callback được gọi khi modal đóng (phím Escape, click backdrop, nút X) */
  onClose: () => void;
  /** Tiêu đề chính của modal */
  title?: React.ReactNode;
  /** Mô tả phụ dưới tiêu đề */
  description?: React.ReactNode;
  /** Icon hiển thị bên trái tiêu đề */
  icon?: React.ReactNode;
  /** Thành phần phụ trợ nằm ở góc phải header */
  headerExtra?: React.ReactNode;
  /** Footer modal (chứa các nút hành động Hủy / Lưu) */
  footer?: React.ReactNode;
  /** Nội dung thân modal */
  children: React.ReactNode;
  /** Kích thước chiều rộng tối đa của modal */
  size?: ModalSize;
  /** Class tùy biến cho hộp dialog */
  className?: string;
  /** Class tùy biến cho vùng body */
  bodyClassName?: string;
  /** Hiển thị nút đóng X ở góc trên phải (mặc định: true) */
  showCloseButton?: boolean;
  /** Đóng khi click vào vùng backdrop mờ (mặc định: true) */
  closeOnBackdropClick?: boolean;
  /** Đóng khi bấm phím Escape (mặc định: true) */
  closeOnEscape?: boolean;
}
```

---

## 2. Migrated Component Props

### 2.1. `ImportGuidelinesModalProps` (`src/components/glossary-manager/ImportGuidelinesModal.tsx`)
```typescript
export interface ImportGuidelinesModalProps {
  /** Cờ điều khiển hiển thị Modal */
  isImporting: boolean;
  /** Setter cập nhật trạng thái mở/đóng */
  setIsImporting: (b: boolean) => void;
  /** Tên file Markdown đã chọn */
  mdFileName: string;
  /** Trạng thái AI đang phân tích cẩm nang */
  isAnalyzingMd: boolean;
  /** Tham chiếu đến input file ẩn */
  mdInputRef: React.RefObject<HTMLInputElement | null>;
  /** Handler khi người dùng chọn file từ máy tính */
  handleMdImportFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
```

### 2.2. `QuickAddTermModalProps` (`src/components/translator-workspace/QuickAddTermModal.tsx`)
```typescript
export interface QuickAddTermModalProps {
  /** Cụm từ tiếng Trung được bôi đen */
  selectedTerm: string;
  /** Ngữ cảnh xung quanh cụm từ bôi đen */
  selectedContext: string;
  /** Callback đóng thanh tra cứu và xóa vùng chọn */
  onClose: () => void;
  /** Dự án truyện đang thao tác */
  activeProject: StoryProject;
  /** Handler cập nhật dự án khi thêm từ mới */
  onUpdateProject: (p: StoryProject) => void;
  /** Danh sách API key hiện có */
  apiKeys: string[];
  /** Model Gemini đang chọn */
  selectedModel: string;
}
```

---

## 3. Z-Index Ladder Mapping

| Layer Class | Numeric Range | Component Trực Quan |
|:---|:---|:---|
| `z-10` | 10 | Phần tử nội bộ, badge, overlay cục bộ |
| `z-30` | 30 | `header.sticky`, `nav.sticky` trong `App.tsx` |
| `z-40` | 40 | `LanguageSelector` dropdown listbox, Tooltip |
| `z-50` | 50 | `Modal` backdrop + dialog, `NotificationSystem` confirm dialog, Floating widgets |
| `z-[60]` | 60 | `NotificationSystem` toast notification stack |
