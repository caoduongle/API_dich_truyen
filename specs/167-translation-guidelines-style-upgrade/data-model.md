# Data Model: Feature 167 — Nâng Cấp Cẩm Nang Dịch Thuật, Quy Tắc Dịch, Tông Giọng Biên Tập & Thể Loại Chính

**Feature**: `specs/167-translation-guidelines-style-upgrade`  
**Date**: 2026-11-27  
**Schema Impact**: Không thay đổi `StoryProject` trong `src/types.ts` và không thay đổi IndexedDB schema (tuân thủ Constitution Principle IV). Mọi kiểu dữ liệu dưới đây là kiểu domain bổ sung tại `src/config/translationStyles.ts` và tầng service/UI.

---

## 1. Domain Entities (`src/config/translationStyles.ts`)

### 1.1 `GenreProfile` (Hồ sơ Thể loại chính)

```ts
export type GenreRegisterClass =
  | 'classical_eastern'
  | 'modern_contemporary'
  | 'western_fantasy'
  | 'speculative_action'
  | 'suspense_dark'
  | 'light_slice_of_life'
  | 'neutral';

export type GenreGroup =
  | 'Cổ phong & Tu luyện'
  | 'Hiện đại & Đời sống'
  | 'Kỳ ảo & Phiêu lưu'
  | 'Trinh thám & Kinh dị'
  | 'Khác';

export interface GenreProfile {
  id: string;                      // Tên chuẩn hiển thị & lưu vào StoryProject.genre
  label: string;                   // Nhãn thân thiện kèm mô tả ngắn trên dropdown
  group: GenreGroup;               // Nhóm phân loại trên UI
  sealChar: string;                // 1 chữ Hán hiển thị trong GenreMark
  registerClass: GenreRegisterClass;
  shortDescription: string;        // Mô tả ngắn cho người dùng
  styleGuide: string;              // Chỉ dẫn hành vi đa chiều gửi vào AI prompts
  recommendedTones: string[];      // Danh sách ToneProfile.id khuyên dùng
  starterTemplate: StructuredGuidelineSections; // Mẫu cẩm nang khởi tạo cho thể loại
}
```

**Built-in 17 Thể loại chính + Tùy chỉnh**:
- *Cổ phong & Tu luyện*: `Tiên Hiệp` (`仙`), `Võ Hiệp` (`侠`), `Huyền Huyễn` (`玄`), `Lịch Sử / Quân Sự` (`史`), `Cổ Đại / Xuyên Không` (`古`), `Cung Đấu / Gia Đấu` (`宫`)
- *Hiện đại & Đời sống*: `Đô Thị` (`都`), `Ngôn Tình` (`情`), `Hệ Thống / Điền Văn` (`田`), `Hài Hước / Sảng Văn` (`乐`)
- *Kỳ ảo & Phiêu lưu*: `Huyền Huyễn Phương Tây` (`堡`), `Vô Hạn Lưu` (`无`), `Khoa Huyễn / Võng Du` (`机`), `Mạt Thế / Sinh Tồn` (`末`), `Đồng Nhân / Light Novel` (`漫`)
- *Trinh thám & Kinh dị*: `Linh Dị / Thần Quái` (`鬼`), `Huyền Nghi / Trinh Thám` (`探`)
- *Mở rộng*: `Khác` (`卷`) — cho phép nhập chuỗi thể loại tùy chỉnh khi chọn.

---

### 1.2 `ToneProfile` (Hồ sơ Tông giọng biên tập)

```ts
export type HanVietLevel = 'low' | 'balanced' | 'high' | 'domain_specific';

export interface ToneProfile {
  id: string;                      // Tên chuẩn lưu vào StoryProject.tone
  label: string;                   // Nhãn ngắn gọn
  registerClass: GenreRegisterClass;
  hanVietLevel: HanVietLevel;      // Mức độ dùng Hán-Việt để kiểm tra mâu thuẫn
  shortDescription: string;        // Tóm tắt tác động hiển thị cho người dùng
  styleGuide: string;              // Quy chuẩn diễn đạt cụ thể gửi vào AI prompts
}
```

**Built-in 11 Tông giọng + Tùy chỉnh**:
1. `Dịch thuần Việt mượt mà` (balanced-low Hán-Việt, trung tính)
2. `Trang nghiêm cổ phong` (high Hán-Việt, classical_eastern)
3. `Bình dị dân dã` (low Hán-Việt, modern / slice of life)
4. `Hùng tráng dồn dập` (balanced Hán-Việt, speculative_action)
5. `Trầm hùng dã sử` (high Hán-Việt, classical_eastern)
6. `Hiện đại công nghệ` (low Hán-Việt + domain_specific, modern_contemporary)
7. `Kịch tính ly kỳ` (balanced Hán-Việt, suspense_dark)
8. `Nhẹ nhàng điền văn` (low Hán-Việt, light_slice_of_life)
9. `Trầm lắng tinh tế` (balanced Hán-Việt, neutral) — *mới*
10. `Hài hước dí dỏm` (low Hán-Việt, light_slice_of_life) — *mới*
11. `Sắc sảo cung đấu` (high Hán-Việt, classical_eastern) — *mới*
- Kèm tùy chọn tông giọng tự nhập (`CUSTOM_TONE_SENTINEL` ở UI -> lưu chuỗi người dùng nhập vào `StoryProject.tone`).

---

### 1.3 `StructuredGuidelineSections` (Cẩm nang dịch thuật & Quy tắc dịch)

Lưu trữ an toàn dưới dạng Markdown trong `StoryProject.description`:

```ts
export interface StructuredGuidelineSections {
  contextSummary: string;          // ### Bối cảnh & Tóm tắt
  pronounRules: string;            // ### Quy tắc xưng hô mặc định
  hanVietPolicy: string;           // ### Mức độ Hán-Việt / Thuần Việt
  titlesAndForeignNames: string;   // ### Danh xưng, Cấp bậc & Tên ngoại lai
  avoidRules: string;              // ### Điều cần tránh
  extraNotes?: string;             // Nội dung ngoài 5 mục chuẩn (bảo toàn 100% khi round-trip)
}
```

**Backward Compatibility & Round-Trip**:
- Khi `description` là văn bản tự do cũ không có heading `### ...`:
  - Mở ở chế độ **Thô / Tự do (Markdown)**: hiển thị nguyên văn không thay đổi.
  - Chuyển sang chế độ **Có cấu trúc**: đưa nội dung cũ vào `contextSummary` (hoặc `extraNotes` nếu không khớp), giữ nguyên khi chưa chỉnh sửa để không phá dữ liệu cũ.

---

### 1.4 `StyleConflictWarning` (Cảnh báo Xung đột Văn phong)

```ts
export type StyleConflictSeverity = 'warning' | 'info';

export interface StyleConflictWarning {
  id: string;
  severity: StyleConflictSeverity;
  category: 'genre_tone_mismatch' | 'rule_tone_conflict' | 'rule_genre_conflict';
  message: string;
  suggestedTone?: string;
  suggestedActionLabel?: string;
}
```

**Các luật phát hiện xung đột tất định ban đầu**:
1. `genre` thuộc `modern_contemporary` (`Đô Thị`, `Khoa Huyễn / Võng Du`) hoặc `western_fantasy` (`Huyền Huyễn Phương Tây`) nhưng chọn `tone` thuộc `classical_eastern` (`Trang nghiêm cổ phong`, `Trầm hùng dã sử`, `Sắc sảo cung đấu`) → cảnh báo và gợi ý tông tương thích đầu tiên của thể loại.
2. `genre` thuộc `classical_eastern` (`Tiên Hiệp`, `Võ Hiệp`, `Lịch Sử / Quân Sự`, `Cung Đấu / Gia Đấu`, `Cổ Đại / Xuyên Không`) nhưng chọn `tone = 'Hiện đại công nghệ'` → cảnh báo và gợi ý tông cổ phong/thuần Việt phù hợp.
3. `description` chứa chỉ thị cấm/hạn chế Hán-Việt (ví dụ regex `/\b(cấm|không dùng|hạn chế tối đa|tránh dùng)\s+(từ\s+)?hán[\s-]?việt/i`) nhưng chọn `tone` có `hanVietLevel === 'high'` → cảnh báo mâu thuẫn, nhắc rằng Quy tắc riêng sẽ được ưu tiên hơn Tông giọng hoặc gợi ý chuyển sang `Dịch thuần Việt mượt mà`.
4. `genre === 'Huyền Huyễn Phương Tây'` hoặc `description` quy định giữ nguyên tên tiếng Anh, nhưng dùng tông `Trang nghiêm cổ phong` → cảnh báo tránh Hán-Việt hóa tên phương Tây.

---

### 1.5 Import Preview & Direct Analysis Models

```ts
export type GuidelineApplyMode = 'replace' | 'merge' | 'keep';

export interface GuidelineImportSelection {
  genre: 'apply' | 'keep';
  tone: 'apply' | 'keep';
  description: GuidelineApplyMode;
  glossary: GuidelineApplyMode;
}

export interface GuidelineImportPreviewData {
  fileName: string;
  analysisMode: 'ai' | 'local_fallback';
  genre: string;
  tone: string;
  description: string;
  extractedGlossary: Omit<GlossaryItem, 'id'>[];
  truncated?: boolean;
  originalLength?: number;
  analyzedLength?: number;
  proseLength?: number;
  warnings: string[];
}
```

---

## 2. Validation Rules & Constraints

1. **Custom Genre / Tone Validation (FR-001, FR-003, Edge Cases)**:
   - Chuỗi `genre` và `tone` sau `trim()` không được rỗng; độ dài tối đa 80 ký tự khi lưu từ ô nhập tùy chỉnh.
   - Nếu chọn tùy chọn "Tùy chỉnh..." nhưng người dùng để trống/khoảng trắng và bấm Lưu, biểu mẫu báo lỗi trực tiếp tại trường đó và không cho lưu giá trị rỗng.
2. **Legacy Normalization**:
   - Các dự án cũ có `tone = "Trang nghiêm cổ kính"` (xuất hiện ở fallback cũ trong `prompts.ts`) hoặc các chuỗi tự do vẫn được nhận diện hợp lệ; `getToneStyleGuide` chuẩn hóa biến thể đồng nghĩa cũ và fallback mô tả rõ ràng cho mọi chuỗi lạ.
3. **Character Budget of Prompt Guides**:
   - Mỗi `genre.styleGuide` và `tone.styleGuide` giữ súc tích trong khoảng 220–450 ký tự tiếng Việt để vừa đủ định hướng hành vi (xưng hô, tỷ lệ Hán-Việt, nhịp văn, lỗi cần tránh), vừa không làm loãng trọng tâm dịch và không ảnh hưởng tốc độ/bất biến 1-1.
4. **Long Guideline Processing Budget**:
   - `GLOSSARY_LIMITS.MAX_CHARS_FOR_GUIDELINES_ANALYSIS` = `24000` ký tự áp dụng trên **phần văn xuôi quy tắc** (`extractGuidelinesProseSection`) sau khi đã loại bảng glossary Markdown (`parseGlossaryFromMd` vẫn quét toàn bộ 100% file không cắt).
   - Nếu phần quy tắc vẫn vượt 24.000 ký tự, ghép đầu (18.000 ký tự) + cuối (6.000 ký tự) hoặc giữ nguyên thông báo `truncated = true` cùng cảnh báo cho người dùng.

---

## 3. State Transitions

### 3.1 Dual-Mode Guidelines Editor
- `RawText` ⇄ `StructuredSections`:
  - Khi người dùng bấm **Có cấu trúc**: gọi `parseStructuredGuidelines(description)` để điền 5 ô biểu mẫu. Mọi sửa đổi trên 5 ô tự động gọi `serializeStructuredGuidelines` cập nhật ngược chuỗi `description` (chỉ sinh heading cho các mục có nội dung hoặc giữ cấu trúc sạch).
  - Khi người dùng bấm **Markdown thô**: hiển thị trực tiếp chuỗi `description` hiện tại để chỉnh sửa tự do.
  - Khi bấm **Chèn mẫu theo thể loại**: nếu `description.trim()` rỗng → điền ngay mẫu của thể loại đang chọn; nếu đã có nội dung → hiển thị lựa chọn xác nhận tại chỗ (**Thay thế toàn bộ** / **Chèn thêm vào cuối** / **Hủy**), không dùng `window.confirm` chặn xấu.

### 3.2 Guideline `.md` Import Flow
1. Người dùng chọn tệp `.md`.
2. Đọc nội dung tệp (`file.text()`): nếu rỗng → báo lỗi tiếng Việt rõ ràng, giữ nguyên form.
3. Gọi `analyzeGuidelinesDirect` (nếu có API key khả dụng thì kết hợp phân tích cục bộ + AI; nếu không có API key hoặc AI lỗi thì fallback sạch sang `parseGuidelinesMarkdownLocal` với `analysisMode = 'local_fallback'` + warning thông tin).
4. Mở **Khung xem trước nhập cẩm nang** ngay trong modal (`ProjectFormModal` / `ProjectMetadataModal`):
   - Khi tạo dự án mới và các trường còn trống/mặc định: mặc định chọn áp dụng.
   - Khi chỉnh sửa dự án đã có dữ liệu: hiển thị đối chiếu và mặc định cho phép chọn rõ ràng cho từng mục (`Áp dụng` / `Hợp nhất` / `Giữ nguyên hiện tại`).
5. Bấm **Áp dụng lựa chọn** → cập nhật state form (chỉ ghi `glossary` khi người dùng chọn `Áp dụng`/`Hợp nhất`).
