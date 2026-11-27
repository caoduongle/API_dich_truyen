# Internal Module & Format Contracts: Feature 167

**Feature**: `specs/167-translation-guidelines-style-upgrade`  
**Date**: 2026-11-27

---

## 1. Domain Catalog & Utilities Contract (`src/config/translationStyles.ts`)

Module thuần TypeScript (tầng Config/Model, **không** import `react`, UI component, hoặc hook):

- **Constants**:
  - `GENRE_PROFILES: readonly GenreProfile[]` (17 thể loại chuẩn + `'Khác'`)
  - `TONE_PROFILES: readonly ToneProfile[]` (11 tông giọng chuẩn)
  - `CUSTOM_GENRE_OPTION_VALUE` / helper `isBuiltInGenre(value: string): boolean`
  - `CUSTOM_TONE_OPTION_VALUE` / helper `isBuiltInTone(value: string): boolean`
  - `GUIDELINE_SECTION_HEADINGS`: Bảng ánh xạ chuẩn 5 tiêu đề Markdown <-> key của `StructuredGuidelineSections`

- **Pure Functions**:
  - `getGenreProfile(genre: string): GenreProfile | undefined` — khớp chính xác (và hỗ trợ biến thể chuẩn hóa khoảng trắng/chữ hoa thường).
  - `getGenreStyleGuide(genre: string): string` — trả về chỉ dẫn chuyên sâu cho thể loại dựng sẵn; với thể loại tùy chỉnh trả về hướng dẫn linh hoạt giữ nguyên bối cảnh thể loại mà người dùng khai báo. (Re-export lại tại `src/lib/text.ts`).
  - `getToneProfile(tone: string): ToneProfile | undefined` — khớp chính xác + ánh xạ alias cũ như `'Trang nghiêm cổ kính'` → `'Trang nghiêm cổ phong'`.
  - `getToneStyleGuide(tone: string): string` — trả về quy chuẩn diễn đạt cụ thể (tỷ lệ Hán-Việt, nhịp câu, thoại, tự sự) cho tông dựng sẵn hoặc hướng dẫn tôn trọng mô tả cho tông tùy chỉnh.
  - `getRecommendedTonesForGenre(genre: string): string[]` — trả về danh sách tên tông giọng tương thích (mặc định `['Dịch thuần Việt mượt mà']` nếu là thể loại tùy chỉnh).
  - `getGenreStarterTemplateText(genre: string): string` — sinh chuỗi Markdown mẫu khởi tạo tương ứng với thể loại.
  - `parseStructuredGuidelines(markdownText: string): StructuredGuidelineSections` — bóc 5 mục chuẩn từ văn bản, phần văn bản ngoài heading được giữ nguyên vào `contextSummary` (nếu toàn văn bản chưa có heading) hoặc `extraNotes` (nếu nằm ngoài các heading chuẩn).
  - `serializeStructuredGuidelines(sections: StructuredGuidelineSections): string` — chuyển ngược về Markdown chuẩn, giữ thứ tự các mục và không làm mất `extraNotes`.
  - `formatGuidelinesMarkdownExport(input: { title?: string; genre: string; tone: string; description: string }): string` — tạo nội dung tệp `.md` xuất ra để lưu trữ hoặc tái nhập ở dự án khác.
  - `extractGuidelinesProseSection(markdownText: string): string` — loại bỏ các bảng glossary Markdown (`| Trung | ... |`) và danh sách thuần cặp từ điển (`- A -> B`) để giữ tối đa phần văn xuôi/quy tắc cẩm nang trước khi phân tích AI.
  - `parseGuidelinesMarkdownLocal(markdownText: string): { genre: string; tone: string; description: string }` — trích xuất tất định thể loại, tông giọng (nếu được khai báo dạng `Thể loại: ...` / `Tông giọng: ...` hoặc heading tương ứng) và giữ toàn bộ phần quy tắc dịch sạch làm fallback cục bộ.
  - `detectStyleConflicts(params: { genre: string; tone: string; description: string }): StyleConflictWarning[]` — phát hiện xung đột văn phong không chặn lưu.

---

## 2. Guideline Analysis Service Contract (`src/services/directGlossaryEngine.ts`)

```ts
export interface AnalyzeGuidelinesDirectParams extends DirectGlossaryCommonParams {
  text: string;
}

export interface AnalyzeGuidelinesDirectResult {
  extractedGlossary: GlossarySuggestion[];
  genre: string;
  tone: string;
  description: string;
  successKeyIndex: number;
  analysisMode?: 'ai' | 'local_fallback';
  truncated?: boolean;
  originalLength?: number;
  analyzedLength?: number;
  proseLength?: number;
}
```

**Behavioral Guarantees**:
1. `parseGlossaryFromMd(text)` luôn chạy trên **toàn bộ `text`** không cắt xén.
2. Phần văn xuôi quy tắc đi qua `extractGuidelinesProseSection(text)` trước khi so sánh với `MAX_CHARS_FOR_GUIDELINES_ANALYSIS` (`24_000` ký tự). Nếu phần văn xuôi dài hơn `24_000`, lấy lát cắt bảo toàn phần đầu (`18_000`) + phần cuối (`6_000`) kèm đánh dấu `truncated: true`, `proseLength`, `analyzedLength` để UI hiển thị cảnh báo rõ ràng (FR-009).
3. Nếu không có `apiKeys` hợp lệ hoặc lời gọi AI thất bại, thay vì văng lỗi làm mất toàn bộ quy trình nhập từ tệp có sẵn nội dung hợp lệ, hàm fallback sang `parseGuidelinesMarkdownLocal(prose)` (với `analysisMode: 'local_fallback'`, `successKeyIndex: -1`) nếu trích xuất cục bộ tìm thấy ít nhất quy tắc hoặc glossary; chỉ ném lỗi khi tệp hoàn toàn rỗng hoặc không trích xuất được gì cả.

---

## 3. Translation Pipeline Prompt Contract (`src/services/ai/prompts.ts` & `src/services/translation/targetedRepair.ts`)

1. **Deterministic Priority Order** trong `buildInstructionPriorityBlock`:
   - `#1 (BẤT KHẢ XÂM PHẠM)`: Trung thành nguyên tác + Bảng từ điển + Cấu trúc 1-1 (xuống dòng, ngắt câu, dấu câu, ngoặc thoại).
   - `#2`: Quy tắc dịch riêng của dự án (`description`) > Hồ sơ nhân vật > Yêu cầu biên tập bổ sung.
   - `#3`: Quy chuẩn Tông giọng biên tập (`getToneStyleGuide(cleanTone)`).
   - `#4`: Chỉ dẫn Thể loại chính (`getGenreStyleGuide(cleanGenre)`).
2. **Stage Coverage**:
   - `buildRawTranslationPayload`: nhúng `getGenreStyleGuide(cleanGenre)` + `getToneStyleGuide(cleanTone)` + `cleanDescription` với thứ tự ưu tiên trên.
   - `buildPolishTranslationPayload`: nhúng `getGenreStyleGuide(cleanGenre)` + `getToneStyleGuide(cleanTone)` + `cleanDescription` ở cả `systemInstruction` và `prompt` (tôn trọng lựa chọn nhiều lượt `getPolishStrategyForRound`).
   - `buildQaCritiquePayload`: nhúng `cleanGenre` (kèm tóm tắt ngắn quy chuẩn), `cleanTone` (kèm quy chuẩn tông giọng) và `cleanDescription`, nêu rõ không đánh dấu lỗi `pronoun`/`other` khi bản dịch tuân thủ chủ ý trong Quy tắc riêng hoặc Tông giọng.
   - `buildTargetedRepairPayload` (`targetedRepair.ts`): nhúng `getToneStyleGuide(cleanTone)` + `getGenreStyleGuide(cleanGenre)` + `cleanDesc` theo đúng thứ tự `#2 > #3 > #4` và khóa chặt cấu trúc 1-1.

---

## 4. Shared UI Editor Contract (`src/components/common/StyleGuidelineEditor.tsx`)

**Props Interface**:
```ts
export interface StyleGuidelineEditorProps {
  genre: string;
  onGenreChange: (value: string) => void;
  tone: string;
  onToneChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  projectTitle?: string;
  existingGlossaryCount?: number;
  hasExistingMetadata?: boolean;
  validationError?: string | null;
  onApplyImportedGlossary?: (
    items: Omit<GlossaryItem, 'id'>[],
    mode: 'replace' | 'merge'
  ) => Promise<void> | void;
  apiKeys?: string[];
  selectedModel?: string;
  showToast?: (opts: { message: string; type: 'success' | 'warning' | 'error' | 'info' }) => void;
}
```

**Consumer Responsibilities**:
- `ProjectFormModal.tsx`: truyền state form tạo/sửa dự án, tích hợp `onApplyImportedGlossary` để cập nhật/hợp nhất `analyzedGlossary` (khi tạo mới) hoặc glossary dự án (khi sửa), kiểm tra validate custom genre/tone trước `onSave`.
- `ProjectMetadataModal.tsx`: mở rộng props tùy chọn tương thích ngược (truyền `existingGlossaryCount`, `onApplyImportedGlossary`, `apiKeys`, `selectedModel`, `showToast` từ `TranslatorWorkspace.tsx` mà không làm vỡ test/caller cũ nếu chỉ truyền props cơ bản).

---

## 5. Exported Markdown Guideline Format Contract

Tệp Markdown xuất từ `formatGuidelinesMarkdownExport` tuân theo cấu trúc có thể đọc tự nhiên bởi con người và tái nhập chuẩn xác qua `parseGuidelinesMarkdownLocal`:

```markdown
# Cẩm nang dịch thuật: <Tên truyện>

- Thể loại chính: <genre>
- Tông giọng biên tập: <tone>

## Quy tắc dịch thuật

### Bối cảnh & Tóm tắt
...

### Quy tắc xưng hô mặc định
...

### Mức độ Hán-Việt / Thuần Việt
...

### Danh xưng, Cấp bậc & Tên ngoại lai
...

### Điều cần tránh
...
```
