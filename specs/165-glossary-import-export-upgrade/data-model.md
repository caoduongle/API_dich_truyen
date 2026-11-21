# Data Model: Cải tiến Xuất & Nhập File Cẩm Nang Từ Điển

**Feature**: `165-glossary-import-export-upgrade` | **Date**: 2026-11-22

> **Lưu ý Schema**: Không thay đổi `src/types.ts` hay IndexedDB schema (`GlossaryItem` đã có `createdAt?: string`). Các kiểu dưới đây là kiểu dữ liệu nội bộ của tầng service/UI cho luồng xuất/nhập.

## 1. Export Options & Payload (`GlossaryExportOptions`)

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `format` | `'md' \| 'csv' \| 'json'` | Định dạng tệp xuất ra (mặc định `'md'`) |
| `scope` | `'all' \| 'filtered'` | Xuất toàn bộ từ điển dự án hoặc chỉ danh sách đang lọc |
| `projectName` | `string` (tùy chọn) | Tên dự án hiển thị trong header tệp xuất và tên tệp tải xuống |

### Định dạng đầu ra theo từng format
- **Markdown (`.md`)**:
  - Header: `# Từ Điển Dự Án` (kèm tên dự án nếu có), `> Xuất tự động lúc: ...`, `> Tổng số thuật ngữ: ...`.
  - Mỗi nhóm `## <Loại> (<số lượng>)` chứa bảng 5 cột:
    `| Tiếng Trung | Phiên âm | Tiếng Việt | Ghi chú | Ngày thêm |`
  - Giá trị `Ngày thêm`: `DD/MM/YYYY` (theo `vi-VN`) nếu `createdAt` hợp lệ, ngược lại `—`.
- **CSV (`.csv`)**:
  - UTF-8 BOM (`\uFEFF`) để Excel mở đúng dấu tiếng Việt.
  - Header: `Tiếng Trung,Phiên âm,Tiếng Việt,Loại,Ghi chú,Biến thể,Ngày thêm`
  - Giá trị `Ngày thêm`: `DD/MM/YYYY` nếu có `createdAt`, ngược lại để trống `""`.
- **JSON (`.json`)**:
  - Object chuẩn hóa: `{ version: 1, exportedAt: string, projectName?: string, total: number, items: GlossaryItem[] }` (giữ nguyên `createdAt` ISO, `variants`, `origin`, `isPinned`, `characterProfile`).

## 2. Import Parse Result (`GlossaryImportParseResult`)

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `mode` | `'direct' \| 'ai'` | Phương thức phân tích đã dùng (`direct` = đọc trực tiếp cục bộ; `ai` = trích xuất qua Gemini) |
| `sourceFormat` | `'md' \| 'csv' \| 'json' \| 'txt'` | Định dạng tệp nguồn |
| `items` | `Omit<GlossaryItem, 'id'>[]` | Các mục hợp lệ đã chuẩn hóa (giữ `createdAt` từ tệp nếu hợp lệ) |
| `skippedRows` | `number` | Số dòng bị bỏ qua do thiếu trường bắt buộc (Tiếng Trung hoặc Tiếng Việt) |
| `warnings` | `string[]` | Cảnh báo (vd: nội dung AI bị cắt ngắn, dòng sai định dạng) |

## 3. Import Conflict Analysis (`GlossaryImportPreview`)

| Trường | Kiểu | Mô tả |
|--------|------|-------|
| `cleanItems` | `Omit<GlossaryItem, 'id'>[]` | Mục mới hoàn toàn, không trùng trong từ điển hiện tại và không tự trùng trong tệp |
| `conflicts` | `ImportConflictItem[]` | Mục trùng với từ điển hiện tại hoặc lặp nội bộ trong tệp, kèm `existingId?`, `existingItem?`, `reason` |
| `mode` | `'direct' \| 'ai'` | Chế độ phân tích |
| `skippedRows` | `number` | Số dòng không hợp lệ bị bỏ qua |
| `warnings` | `string[]` | Danh sách cảnh báo cho người dùng |

## 4. Duplicate Resolution Strategy (`DuplicateResolutionStrategy`)

- `'review'`: Thêm các mục mới, đẩy các mục trùng vào hàng chờ **Rà soát trùng lặp** (hành vi tương thích ngược).
- `'skip'`: Thêm các mục mới, bỏ qua toàn bộ mục trùng.
- `'overwrite'`: Thêm các mục mới, đồng thời cập nhật/ghi đè mục trùng đã có trong từ điển (giữ `id` cũ, cập nhật `pinyin`, `vietnamese`, `type`, `note`, `variants`, và giữ `createdAt` cũ hoặc cập nhật theo lựa chọn an toàn).
