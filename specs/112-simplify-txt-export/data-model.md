# Data Model: Tối Giản Xuất Tệp .TXT và Chuẩn Hóa Tên File Dễ Hiểu

**Feature**: `112-simplify-txt-export`  
**Date**: 2026-09-12  

---

## 1. Core Types

### 1.1. ExportMode
Chuẩn hóa kiểu dữ liệu chế độ xuất tệp, chỉ còn 2 chế độ văn bản .TXT:
```ts
export type ExportMode = 'web' | 'audio';
```

### 1.2. ExportFileNameOptions
Thông tin đầu vào để sinh tên file xuất văn bản:
```ts
export interface ExportFileNameOptions {
  projectTitle: string;    // Tên truyện
  startIndex: number;      // Số thứ tự chương đầu tiên trong tệp (1-based)
  endIndex: number;        // Số thứ tự chương cuối cùng trong tệp (1-based)
  mode: ExportMode;        // Chế độ 'web' hoặc 'audio'
}
```

---

## 2. Helper Signature

### `formatExportTxtFileName`
```ts
export function formatExportTxtFileName({
  projectTitle,
  startIndex,
  endIndex,
  mode
}: ExportFileNameOptions): string;
```

**Quy tắc định dạng**:
- Làm sạch `projectTitle` thành chuỗi ký tự an toàn cho hệ thống tệp (loại bỏ `\ / : * ? " < > | # % @ ; =`, tối đa 30 ký tự).
- Xác định `suffix`: `mode === 'audio' ? '_AUDIO' : '_WEB'`.
- Nếu `startIndex === endIndex`:
  ```ts
  return `${cleanTitle}_Chuong_${pad3(startIndex)}${suffix}.txt`;
  ```
- Nếu `startIndex !== endIndex`:
  ```ts
  return `${cleanTitle}_Chuong_${pad3(startIndex)}_den_Chuong_${pad3(endIndex)}${suffix}.txt`;
  ```
- Trong đó `pad3(n)` là `String(Math.max(1, n)).padStart(3, '0')`.

---

## 3. UI Component Props (View Layer)

### `ExportFilesPanelProps`
```ts
export interface ExportFilesPanelProps {
  exportMode: ExportMode;
  handleExportModeChange: (mode: ExportMode) => void;
  chaptersPerFile: number;
  setChaptersPerFile: (n: number) => void;
  exportScope: 'all' | 'translated';
  setExportScope: (scope: 'all' | 'translated') => void;
  isExportingTxt: boolean;
  handleExportTxt: () => void;
  exportRangeEnabled: boolean;
  setExportRangeEnabled: (b: boolean) => void;
  exportRangeStart: number;
  setExportRangeStart: (n: number) => void;
  exportRangeEnd: number;
  setExportRangeEnd: (n: number) => void;
  totalChapters: number;
}
```
*(Gỡ bỏ hoàn toàn `handleExportAlignJsonl`)*.
