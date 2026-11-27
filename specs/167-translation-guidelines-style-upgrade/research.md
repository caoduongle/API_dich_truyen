# Research & Technical Decisions: Feature 167

**Feature**: `specs/167-translation-guidelines-style-upgrade`  
**Date**: 2026-11-27

## 1. Zero-Schema-Break Persistence (Constitution Principle IV)

- **Decision**: Giữ nguyên hoàn toàn `StoryProject` trong `src/types.ts` và schema IndexedDB (`genre: string`, `tone: string`, `description: string`). Giá trị thể loại và tông giọng tùy chỉnh được lưu trực tiếp dưới dạng chuỗi hợp lệ trong `genre` và `tone`. Cẩm nang dịch thuật có cấu trúc được tuần tự hóa sang chuỗi Markdown chuẩn với các tiêu đề tiếng Việt cố định lưu ngay trong `description`:
  - `### Bối cảnh & Tóm tắt`
  - `### Quy tắc xưng hô mặc định`
  - `### Mức độ Hán-Việt / Thuần Việt`
  - `### Danh xưng, Cấp bậc & Tên ngoại lai`
  - `### Điều cần tránh`
- **Rationale**:
  - Đảm bảo tương thích ngược 100% với toàn bộ dự án đang lưu trong IndexedDB, bản đồng bộ Google Drive (`driveBundleSync` / `driveGranularSync`) và tài liệu CRDT (`crdtDocManager`) mà không cần migration dữ liệu hay thay đổi phiên bản DB.
  - Tuân thủ tuyệt đối Nguyên tắc IV của Hiến pháp (không sửa `src/types.ts` và schema IndexedDB nếu không có yêu cầu bắt buộc).
  - Các dự án cũ lưu văn bản tự do không có heading vẫn đọc/hiển thị nguyên vẹn ở chế độ văn bản thuần hoặc ánh xạ tự nhiên vào `contextSummary`/`extraNotes` khi chuyển sang chế độ có cấu trúc mà không làm mất ký tự nào.
- **Alternatives considered**:
  - *Thêm các field mới như `customGenre`, `structuredGuidelines` vào `StoryProject`*: Bị loại bỏ vì làm tăng bề mặt thay đổi schema lõi, kéo theo cần cập nhật serialize/merge của Drive bundle & CRDT không cần thiết cho mục tiêu bài toán.

## 2. Unified Style Catalog Architecture (`src/config/translationStyles.ts`)

- **Decision**: Tạo một module domain thuần TypeScript tại `src/config/translationStyles.ts` (tầng Model/Config, không import React component hay hook) chứa:
  - **17 `GenreProfile` dựng sẵn** (bao gồm 11 thể loại hiện có + 6 dòng truyện phổ biến còn thiếu: `Cổ Đại / Xuyên Không`, `Cung Đấu / Gia Đấu`, `Mạt Thế / Sinh Tồn`, `Huyền Nghi / Trinh Thám`, `Đồng Nhân / Light Novel`, `Hài Hước / Sảng Văn`) cùng tùy chọn `Khác` / thể loại tự nhập. Mỗi hồ sơ gồm `id`, `label`, `group`, `sealChar` (chữ Hán cho `GenreMark`), `registerClass`, `shortDescription`, `styleGuide` (đa chiều: từ vựng, xưng hô, nhịp câu, hội thoại vs tự sự, lỗi cần tránh), `recommendedTones`, và `starterTemplate`.
  - **11 `ToneProfile` dựng sẵn** (bao gồm 8 tông hiện có + 3 tông mới: `Trầm lắng tinh tế`, `Hài hước dí dỏm`, `Sắc sảo cung đấu`) cùng tùy chọn tông giọng tự nhập. Mỗi hồ sơ gồm `id`, `label`, `registerClass`, `hanVietLevel`, `shortDescription`, và `styleGuide` (quy chuẩn hành vi cụ thể cho tỷ lệ Hán-Việt, nhịp điệu, giọng tự sự và đối thoại).
  - Các hàm thuần (`pure functions`): `getGenreStyleGuide`, `getToneStyleGuide`, `detectStyleConflicts`, `parseStructuredGuidelines`, `serializeStructuredGuidelines`, `formatGuidelinesMarkdownExport`, `parseGuidelinesMarkdownLocal`, `extractGuidelinesProseSection`.
  - Re-export `getGenreStyleGuide` từ `src/lib/text.ts` để giữ nguyên 100% chữ ký/import hiện tại ở các caller và unit test (`src/lib/__tests__/text.test.ts`).
  - Cập nhật `src/components/ui/GenreMark.tsx` lấy `sealChar` trực tiếp từ `src/config/translationStyles.ts` (fallback chữ `'卷'`) thay vì hard-code bản đồ `GENRE_MARKS` riêng.
- **Rationale**:
  - Loại bỏ tình trạng nhân đôi và lệch danh sách giữa `ProjectFormModal.tsx`, `ProjectMetadataModal.tsx`, `prompts.ts`, `GenreMark.tsx` và `text.ts`.
  - Đáp ứng triệt để Nguyên tắc III (MVC boundary: View chỉ render dữ liệu từ tầng Config/Service).
- **Alternatives considered**:
  - *Mở rộng trực tiếp trong `src/lib/text.ts`*: Làm `src/lib/text.ts` (~1.400 dòng) phình to thêm và trộn lẫn tiện ích xử lý chuỗi/JSON/an toàn với danh mục dữ liệu nghiệp vụ thể loại/tông giọng.

## 3. Full-Document Guideline Analysis Without Silent Truncation (`directGlossaryEngine.ts`, `constants.ts`, `prompts.ts`)

- **Decision**:
  - Nâng `GLOSSARY_LIMITS.MAX_CHARS_FOR_GUIDELINES_ANALYSIS` trong `src/config/constants.ts` từ `4000` lên `24000`.
  - Trước khi gửi văn bản cẩm nang sang phân tích AI, tiền xử lý bằng hàm thuần `extractGuidelinesProseSection(text)` để lọc bỏ các bảng thuật ngữ Markdown dài (`| ... |`) và danh sách glossary dạng gạch đầu dòng chỉ chứa cặp `Trung -> Việt` (vốn đã được `parseGlossaryFromMd` bóc tách đầy đủ không giới hạn ký tự), giúp giữ trọn vẹn phần quy tắc văn phong/xưng hô/cấm kỵ dù chúng nằm ở cuối tệp dài > 15.000–30.000 ký tự.
  - Bổ sung phân tích cục bộ tất định `parseGuidelinesMarkdownLocal(text)` làm tầng trích xuất nền và cơ chế dự phòng ngoại tuyến/không có API key trong `analyzeGuidelinesDirect` (`analysisMode: 'ai' | 'local_fallback'`). Khi phân tích AI khả dụng, AI tinh chỉnh thêm thể loại/tông giọng/tóm tắt; nếu không khả dụng hoặc hết key, hệ thống vẫn trả về kết quả cục bộ thay vì làm hỏng quy trình nhập.
  - Mở khóa schema của `buildAnalyzeGuidelinesPayload` trong `src/services/ai/prompts.ts`: bỏ `enum` đóng cứng 12/8 giá trị cũ, chuyển sang gợi ý các giá trị chuẩn trong mô tả prompt đồng thời chấp nhận giá trị tùy chỉnh hợp lệ nếu tài liệu quy định rõ.
- **Rationale**:
  - Giải quyết trực tiếp gốc rễ lỗi cắt cụt âm thầm tại 4.000 ký tự và tình huống bảng từ điển đứng đầu tệp chiếm hết hạn mức ký tự.
  - Đáp ứng đầy đủ FR-008, FR-009, SC-004 và giả định vận hành cục bộ/dự phòng trong `spec.md`.
- **Alternatives considered**:
  - *Chỉ tăng hằng số từ 4.000 lên 24.000 mà không tách bảng từ vựng*: Vẫn có nguy cơ thất lạc quy tắc cuối tệp khi người dùng có bảng glossary hàng trăm dòng (~30.000+ ký tự) đứng đầu file.

## 4. Deterministic Precedence Across All 4 Translation Stages (`prompts.ts`, `targetedRepair.ts`)

- **Decision**:
  - Chuẩn hóa `buildInstructionPriorityBlock` trong `src/services/ai/prompts.ts` thành 4 tầng phân minh:
    - `#1 (BẤT KHẢ XÂM PHẠM)`: Trung thành 100% nguyên tác + Bảng từ điển + Bảo toàn cấu trúc 1-1 (xuống dòng, ngắt câu, dấu câu, thoại).
    - `#2`: **Quy tắc dịch riêng của dự án** (`description`) > Hồ sơ nhân vật > Yêu cầu biên tập bổ sung.
    - `#3`: **Quy chuẩn Tông giọng biên tập** (`getToneStyleGuide(cleanTone)`).
    - `#4`: **Chỉ dẫn Thể loại chính** (`getGenreStyleGuide(cleanGenre)`).
  - Truyền đầy đủ cả `getGenreStyleGuide(cleanGenre)` và `getToneStyleGuide(cleanTone)` vào đủ 4 công đoạn:
    1. Giai đoạn 1 Dịch thô (`buildRawTranslationPayload`)
    2. Giai đoạn 2 Chuốt văn nhiều lượt (`buildPolishTranslationPayload`)
    3. Giai đoạn 3 Kiểm duyệt QA (`buildQaCritiquePayload`) — kèm lưu ý QA không báo lỗi khi bản dịch tuân thủ đúng quy tắc riêng hoặc tông giọng đã chọn
    4. Sửa lỗi cục bộ (`buildTargetedRepairPayload` trong `src/services/translation/targetedRepair.ts`) — bổ sung cả `getToneStyleGuide` và `getGenreStyleGuide` cùng thứ tự ưu tiên tương đồng.
- **Rationale**:
  - Trước đây `targetedRepair.ts` chỉ in tên thô `${cleanTone}` và `${cleanGenre}`, còn `prompts.ts` chỉ gọi `getGenreStyleGuide` mà chưa có `getToneStyleGuide`. Đồng bộ hóa cả 4 bước giúp đầu ra giữ văn phong nhất quán từ dịch thô đến sửa lỗi, đồng thời khóa chặt bất biến cấu trúc 1-1 từ Feature 166.
- **Alternatives considered**:
  - *Chỉ truyền chỉ dẫn chi tiết ở GĐ2 Chuốt văn*: Không đạt vì GĐ1 Dịch thô sẽ chọn sai đại từ/vốn từ nền, còn GĐ3 QA & Sửa cục bộ có thể sửa ngược về văn phong mặc định chung chung.

## 5. Shared UI Architecture & Design System Compliance (`StyleGuidelineEditor.tsx`)

- **Decision**:
  - Trích xuất phần cấu hình Thể loại chính, Tông giọng biên tập, Quy tắc dịch / Cẩm nang dịch thuật, Cảnh báo mâu thuẫn, Nhập/Xuất `.md` và Xem trước áp dụng thành component UI dùng chung `src/components/common/StyleGuidelineEditor.tsx` để cả `ProjectFormModal.tsx` (tạo mới / sửa ở danh sách dự án) và `ProjectMetadataModal.tsx` (chỉnh sửa trong workspace) dùng chung một nguồn chân lý UI.
  - Tuân thủ quy chuẩn `.agents/rules/design-system.md` ("Mực & Chu Sa"):
    - Tái sử dụng `cn()`, `Button`, `Badge`, `GenreMark` (con dấu triện chữ Hán, tuyệt đối không dùng emoji nền tảng).
    - Dùng token sẵn có (`bg-ink`, `bg-parchment`, `border-parchment-2`, `text-text-main`, `text-text-muted`, `polish` cho hành động chính, `amber-950/amber-300` cho cảnh báo mâu thuẫn không chặn thao tác lưu).
    - Bo góc `rounded-[2px]` / `rounded-[3px]` / `rounded-md`; không thêm dependency NPM mới.
  - Bổ sung kiểm tra dữ liệu đầy đủ ở cả hai modal: chặn lưu khi chọn Thể loại/Tông giọng tùy chỉnh mà bỏ trống hoặc chỉ nhập khoảng trắng.
- **Rationale**:
  - Đạt 100% đồng nhất UI/UX (SC-001) giữa luồng tạo dự án và luồng biên tập trong workspace với lượng mã ngắn gọn, dễ kiểm thử và bảo trì.
- **Alternatives considered**:
  - *Sao chép JSX sang `ProjectMetadataModal.tsx`*: Vi phạm nguyên tắc không lặp logic/UI và chắc chắn gây lệch hành vi về sau.
