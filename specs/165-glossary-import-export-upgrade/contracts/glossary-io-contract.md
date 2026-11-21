# Interface Contracts: Glossary Export & Import (`glossaryIO`)

**Feature**: `165-glossary-import-export-upgrade` | **Date**: 2026-11-22

## 1. Service Contract (`src/services/glossaryIO.ts`)

Các hàm thuần (pure functions, không phụ thuộc React/DOM/IndexedDB):

### `formatGlossaryCreatedDate(createdAt?: string): string`
- Chuyển `createdAt` (ISO string hoặc chuỗi ngày hợp lệ) sang định dạng `DD/MM/YYYY` (`vi-VN`).
- Nếu `createdAt` rỗng hoặc không hợp lệ -> trả về `'—'`.

### `parseGlossaryCreatedDate(raw?: string): string | undefined`
- Chấp nhận:
  - ISO-8601 (`2026-11-22T02:43:25.000Z`, `2026-11-22`)
  - `DD/MM/YYYY` hoặc `D/M/YYYY` (và kèm `HH:mm` / `HH:mm:ss`) — parse tường minh theo thứ tự Ngày/Tháng/Năm, không truyền thẳng vào `new Date(raw)` để tránh đảo `MM/DD`.
- Trả về ISO string hợp lệ, hoặc `undefined` nếu `raw` rỗng, `'—'`, `'--'`, hoặc ngày không tồn tại (vd `31/02/2026`).

### `serializeGlossary(items: GlossaryItem[], options: GlossaryExportOptions): { content: string; mimeType: string; filename: string }`
- Tạo nội dung tệp xuất theo `options.format` (`'md' | 'csv' | 'json'`).
- Luôn bao gồm **Ngày thêm** cho mỗi mục từ.
- Với `.csv`: thêm UTF-8 BOM (`\uFEFF`) và chống CSV Formula Injection (prefix `'` nếu ô bắt đầu bằng `=`, `+`, `-`, `@`, `\t`, `\r`).
- Tên tệp: slugified `projectName` (nếu có) + hậu tố ngày/timestamp + đuôi mở rộng phù hợp.

### `parseStructuredGlossaryFile(content: string, fileName: string): GlossaryImportParseResult | null`
- Giới hạn kích thước tệp đọc vào bộ nhớ tối đa 10 MB ở tầng gọi/UI.
- Nếu đuôi `.json`: parse JSON; whitelist tường minh các trường của `GlossaryItem` (chống prototype pollution), chuẩn hóa `GlossaryType` và `normalizeCharacterProfile`; ném lỗi tiếng Việt rõ ràng nếu JSON không hợp lệ hoặc sai cấu trúc.
- Nếu đuôi `.csv`: parse CSV (RFC 4180, hỗ trợ `,` hoặc `;`, strip prefix `'` chống formula nếu có); trả về `GlossaryImportParseResult` với `mode: 'direct'`.
- Nếu đuôi `.md` (hoặc `.txt`):
  - Tìm các bảng Markdown có header map được ít nhất `chinese` và `vietnamese`.
  - Hỗ trợ đọc ngược cột `Ngày thêm` (giữ `createdAt` nếu parse được), `Phiên âm`, `Ghi chú`, `Loại` (hoặc suy ra `GlossaryType` từ heading `## ...` phía trên bảng).
  - Hỗ trợ unescape `\|` -> `|` trong ô Markdown.
  - Nếu tìm thấy ít nhất 1 bảng cấu trúc hợp lệ -> trả về `GlossaryImportParseResult` với `mode: 'direct'`.
  - Nếu không có bảng hợp lệ -> trả về `null` (báo hiệu tầng hook chuyển sang luồng AI `analyzeGuidelinesDirect`).

### `analyzeGlossaryImportConflicts(parsedItems: Omit<GlossaryItem, 'id'>[], existingGlossary: GlossaryItem[]): { cleanItems: Omit<GlossaryItem, 'id'>[]; conflicts: ImportConflictItem[] }`
- Kiểm tra trùng lặp tiếng Trung (qua `isHanEquivalent` từ `src/lib/sinoNormalize.ts`) và trùng nghĩa tiếng Việt (chuẩn hóa trim/lowercase) cả với `existingGlossary` lẫn nội bộ tệp.
- Trả về `cleanItems` và `conflicts`. Chiến lược `'overwrite'` chỉ áp dụng cho mục trùng khóa Tiếng Trung (`existingId` khớp `isHanEquivalent`); mục trùng chéo nghĩa Việt với mục khác hoặc lặp nội bộ tệp được giữ nguyên trạng thái rà soát/bỏ qua và ghi vào `warnings`.
- Khi thực thi `'overwrite'` hàng loạt trong `useGlossaryState`, ưu tiên gộp cập nhật qua `onUpdateProject` một lần duy nhất để tránh nhiều lượt ghi IndexedDB liên tiếp.

## 2. Hook Contract (`src/hooks/useGlossaryState.ts`)

Bổ sung/cập nhật các API trả về cho `GlossaryManager`:
- `exportGlossary(options: GlossaryExportOptions)`: xuất toàn bộ hoặc `filteredGlossary` theo định dạng `md | csv | json`. (Giữ alias `exportGlossaryToMd` gọi `exportGlossary({ format: 'md', scope: 'all' })` để tương thích ngược).
- `importPreview: GlossaryImportPreview | null`: trạng thái xem trước sau khi phân tích tệp.
- `handleImportFile(file: File)`: xử lý cả từ `<input type="file">` và sự kiện `onDrop`.
- `confirmImport(strategy: DuplicateResolutionStrategy)`: thực thi lưu `cleanItems` và áp dụng chiến lược cho `conflicts` (`skip` / `overwrite` / `review`).
- `resetImportPreview()`: hủy xem trước để chọn tệp khác.
