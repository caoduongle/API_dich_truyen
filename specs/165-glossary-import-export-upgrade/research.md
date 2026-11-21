# Research: Cải tiến Xuất & Nhập File Cẩm Nang Từ Điển

**Feature**: `165-glossary-import-export-upgrade` | **Date**: 2026-11-22

## 1. Hiện trạng Xuất & Nhập Từ Điển trong Codebase

- **Xuất từ điển (`src/hooks/useGlossaryState.ts`, `exportGlossaryToMd`)**:
  - Hiện chỉ xuất duy nhất định dạng `.md` với tên `tu-dien-du-an-${Date.now()}.md`.
  - Bảng Markdown hiện chỉ có 4 cột: `| Tiếng Trung | Phiên âm | Tiếng Việt | Ghi chú |`. Thiếu hoàn toàn cột **Ngày thêm** (`createdAt`), thiếu tên dự án, và không hỗ trợ xuất theo bộ lọc hiện tại hay định dạng `.csv` / `.json`.
- **Nhập cẩm nang (`src/hooks/useGlossaryState.ts`, `handleMdImportFileChange` & `src/components/glossary-manager/ImportGuidelinesModal.tsx`)**:
  - Chỉ nhận `.md` và luôn gửi toàn bộ text lên AI (`analyzeGuidelinesDirect`), kể cả khi người dùng nhập lại chính file `.md` vừa xuất từ app.
  - Bị giới hạn độ dài phân tích AI (cắt ngắn nếu vượt ngưỡng), tốn quota/thời gian, không hoạt động khi offline/thiếu API key, và luôn ghi đè `createdAt` bằng `new Date().toISOString()`.
  - `ImportGuidelinesModal.tsx` ghi "Kéo thả tệp cẩm nang truyện (.md) tại đây" nhưng chưa gắn `onDragOver` / `onDrop`.
  - Mục trùng lặp luôn bị đẩy vào `reviewQueue` mà không cho xem trước hay chọn xử lý hàng loạt (bỏ qua / ghi đè / rà soát).

## 2. Quyết định Thiết kế

### Decision 1: Tách toàn bộ logic parse/serialize sang module thuần `src/services/glossaryIO.ts`
- **Rationale**: Tuân thủ Constitution Principle III (MVC separation): logic nghiệp vụ, parse/serialize Markdown/CSV/JSON, chuẩn hóa ngày tháng và phân tích trùng lặp không nằm trong component hay hook. Module thuần dễ viết unit test Vitest với edge cases đầy đủ.
- **Alternatives considered**: Viết trực tiếp trong `useGlossaryState.ts` — bị loại vì làm phình hook (đã 541 dòng) và khó test độc lập.

### Decision 2: Định dạng cột "Ngày thêm" khi xuất & parse linh hoạt khi nhập
- **Rationale**:
  - Trong Markdown (`.md`) và CSV (`.csv`): hiển thị `Ngày thêm` dạng `DD/MM/YYYY` (khớp với `GlossaryTable.tsx` đang dùng `new Date(item.createdAt).toLocaleDateString('vi-VN')`), hoặc `DD/MM/YYYY HH:mm`? Dùng `DD/MM/YYYY` gọn đẹp trong bảng, hoặc nếu muốn chính xác hơn vẫn giữ được ngày. Với mục cũ không có `createdAt`, hiển thị `—`.
  - Trong JSON (`.json`): lưu nguyên vẹn `createdAt` dạng ISO-8601 (`2026-11-22T02:43:25.000Z`) cùng toàn bộ metadata (`variants`, `origin`, `isPinned`, `characterProfile`).
  - Khi parse nhập liệu từ `.md` / `.csv`: hỗ trợ nhiều biến thể tiêu đề cột (`Ngày thêm`, `Ngày tạo`, `Created`, `createdAt`, `Date`) và nhiều định dạng ngày (`DD/MM/YYYY`, `DD/MM/YYYY HH:mm(:ss)`, `YYYY-MM-DD`, ISO-8601). Nếu giá trị là `—`, `--`, rỗng hoặc không hợp lệ -> `undefined` (khi tạo item mới sẽ fallback về `new Date().toISOString()`).
- **Alternatives considered**: Chỉ hỗ trợ ISO-8601 trong Markdown — bị loại vì kém thân thiện với người đọc tiếng Việt.

### Decision 3: Chiến lược nhận diện cấu trúc khi nhập (Direct-first, AI fallback)
- **Rationale**:
  - File `.json`: parse JSON trực tiếp (hỗ trợ cả mảng `GlossaryItem[]` hoặc object `{ items/glossary: GlossaryItem[] }`).
  - File `.csv`: parse RFC 4180 CSV (hỗ trợ dấu ngoặc kép, xuống dòng trong ô, BOM UTF-8, tự động nhận diện dấu `,` hoặc `;`).
  - File `.md`: quét tìm các bảng Markdown chuẩn có ít nhất cột Tiếng Trung & Tiếng Việt (và nhận diện heading `## Nhân vật`, `## Địa danh`, `## Bí kíp / Vật phẩm`, `## Thành ngữ / Cụm từ`, `## Thuật ngữ khác` để suy ra `GlossaryType`). Nếu tìm thấy bảng hợp lệ -> parse trực tiếp ngoại tuyến (không gọi AI, không cắt ngắn). Nếu không tìm thấy bảng hợp lệ (văn xuôi tự do) hoặc file `.txt` -> chuyển sang luồng AI `analyzeGuidelinesDirect`.
- **Alternatives considered**: Thêm nút toggle thủ công "Dùng AI / Đọc trực tiếp" bắt người dùng tự chọn — chọn tự động nhận diện là chính, kèm chỉ báo rõ chế độ đang dùng trên preview (và cho phép ép dùng AI nếu người dùng muốn phân tích phần văn xuôi).

### Decision 4: Không thêm dependency mới, không sửa `src/types.ts` hay IndexedDB schema
- **Rationale**: Constitution Principle II & IV. CSV/Markdown/JSON parser & serializer hoàn toàn tự viết gọn nhẹ (~200–300 dòng thuần TypeScript) không cần thư viện ngoài (như `papaparse` hay `marked`). `GlossaryItem` trong `src/types.ts` đã có sẵn `createdAt?: string`, `variants?: string[]`, `origin?: ...`, `characterProfile?: ...`.

### Decision 5: Giao diện tuân thủ Design System "Mực & Chu Sa"
- **Rationale**: Dùng các primitive sẵn có (`Modal`, `Button`, `Badge`, `cn()`), token `bg-ink`, `bg-parchment`, `border-parchment-2`, `text-polish`, `amber-950/amber-300` cho cảnh báo, không dùng emoji nền tảng, bo góc `rounded-[2px]` / `rounded-md`.
