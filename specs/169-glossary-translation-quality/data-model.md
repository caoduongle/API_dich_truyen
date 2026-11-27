# Data Model: Cải Tiến Từ Điển Để Cải Thiện Chất Lượng Dịch

**Feature**: `169-glossary-translation-quality` | **Date**: 2026-11-27

## Bất biến Schema cốt lõi (Constitution Principle IV)
- **KHÔNG sửa** các kiểu dữ liệu cốt lõi `GlossaryItem`, `PendingGlossaryItem`, `CharacterProfile`, `StoryProject` trong `src/types.ts`.
- **KHÔNG thay đổi** IndexedDB schema hay version trong `src/services/db.ts`.
- Tất cả mô hình dữ liệu mới dưới đây là kiểu tính toán trên bộ nhớ (in-memory) hoặc kiểu tùy chọn thuộc tầng helper/service/UI trong `src/lib/glossaryMatch.ts`, `src/services/glossaryIO.ts`, `src/hooks/useGlossaryState.ts` và các sub-component `src/components/glossary-manager/`.

---

## 1. Glossary Health Diagnostic Model

```ts
export type GlossaryHealthFilter = 'all' | 'conflicts' | 'missing_profile' | 'incomplete';

export interface GlossaryHealthReport {
  /** Tổng số nhóm xung đột nghĩa dịch khác nhau (tính cả Giản/Phồn thể & biến thể) */
  conflictGroupCount: number;
  /** ID của tất cả các mục đang thuộc một nhóm xung đột nghĩa dịch */
  conflictItemIds: string[];
  /** ID các mục nhân vật (type === 'character') chưa có giới tính rõ ràng hoặc đại từ tự sự */
  missingProfileCharIds: string[];
  /** ID các mục bị thiếu bản dịch tiếng Việt */
  incompleteViIds: string[];
  /** Số lượng mục duy nhất đang có ít nhất một vấn đề chất lượng */
  totalIssueItems: number;
}
```

### Quy tắc tính toán
- Một mục `g` thuộc `conflictItemIds` khi nằm trong bất kỳ `GlossaryConflictWarning` nào từ `resolveGlossaryConflicts(glossary)` (cùng cụm chuẩn hóa `chinese` hoặc `variants` tương đương, và có ít nhất 2 nghĩa tiếng Việt khác nhau sau `.trim().toLowerCase()`).
- Một mục `g` thuộc `missingProfileCharIds` khi `g.type === 'character'` và `!profile?.gender || profile.gender === 'unknown'` đồng thời `!profile?.defaultNarrativePronoun`.
- Một mục `g` thuộc `incompleteViIds` khi `!g.vietnamese || !g.vietnamese.trim()`.
- `totalIssueItems` là kích thước hợp (`Set`) của `conflictItemIds`, `missingProfileCharIds`, `incompleteViIds`.

---

## 2. Role-Based Prompt Grouping Model

```ts
export type GlossaryPromptRoleBucket =
  | 'character_profiled'
  | 'character_plain'
  | 'location'
  | 'term'
  | 'phrase_other'
  | 'pinned_reference';

export interface GroupedGlossarySections<T extends GlossaryEntryLike = GlossaryItem> {
  characterProfiled: T[];
  characterPlain: T[];
  location: T[];
  term: T[];
  phraseOther: T[];
  pinnedReference: T[];
}
```

---

## 3. Non-Overlapping Paragraph Matching Model

```ts
export interface MatchedGlossarySpan<T extends GlossaryEntryLike = GlossaryItem> {
  item: T;
  /** Chuỗi bề mặt thực tế xuất hiện trong đoạn văn bản nguồn */
  matchedForm: string;
  /** Vị trí bắt đầu (inclusive) trong chuỗi đoạn văn nguồn */
  startIndex: number;
  /** Vị trí kết thúc (exclusive) trong chuỗi đoạn văn nguồn */
  endIndex: number;
}
```

### Ràng buộc khớp
- Các ứng viên được sắp xếp theo độ dài chuỗi bề mặt giảm dần trước khi quét.
- Vùng ký tự đã được một cụm dài chiếm chỗ (`[startIndex, endIndex)`) bị đánh dấu khóa (`claimed`) để mọi cụm ngắn hơn lọt hoàn toàn hoặc giao cắt bên trong đều bị bỏ qua tại vị trí đó.
- Từ đơn đúng 1 ký tự Hán chỉ khớp khi ký tự liền trước và liền sau đều không phải ký tự Hán (`HAN_CHAR_REGEX`).

---

## 4. Two-Mode Import Model (`src/services/glossaryIO.ts`)

```ts
export type GlossaryImportMode = 'append' | 'replace_all';
```

Mở rộng interface `GlossaryImportPreview` (tương thích ngược bằng trường mới):

```ts
export interface GlossaryImportPreview {
  fileName: string;
  mode: 'direct' | 'ai';
  sourceFormat: 'md' | 'csv' | 'json' | 'txt';
  cleanItems: Omit<GlossaryItem, 'id'>[];
  conflicts: ImportConflictItem[];
  /** Toàn bộ mục hợp lệ sau khi khử trùng nội bộ tệp (dùng cho chế độ 'replace_all') */
  allValidItems: Omit<GlossaryItem, 'id'>[];
  skippedRows: number;
  warnings: string[];
  rawTextForAiFallback?: string;
}
```

### Chuyển đổi trạng thái khi xác nhận nhập
- Khi `importMode === 'append'` (mặc định): dùng `cleanItems` + `conflicts` theo `DuplicateResolutionStrategy` (`'review' | 'skip' | 'overwrite'`).
- Khi `importMode === 'replace_all'`:
  - Kiểm tra điều kiện chặn: `allValidItems.length === 0` → từ chối thay thế, giữ nguyên `project.glossary`.
  - Khi xác nhận hợp lệ: thay `project.glossary` bằng các bản ghi mới tạo từ `allValidItems`; giữ nguyên `project.pendingGlossary` và `reviewQueue`; làm sạch `selectedIds`.

---

## 5. Multi-Select & Bulk Action State Transitions (`src/hooks/useGlossaryState.ts`)

- `selectedIds: string[]` (hoặc `Set<string>` với `useMemo` helper tra cứu `O(1)`):
  - Tự động prune bất kỳ `id` nào không còn nằm trong `glossary` mỗi khi `glossary` thay đổi.
- Các thao tác hàng loạt:
  - `bulkDeleteSelected`: xóa toàn bộ mục có `id ∈ selectedIds` sau xác nhận `showConfirm`; xóa rỗng `selectedIds`.
  - `bulkSetPinnedSelected(isPinned)`: gán hoặc xóa thuộc tính `isPinned` cho mọi mục được chọn; giữ nguyên `selectedIds` hoặc thông báo số lượng cập nhật.
  - `bulkSetTypeSelected(nextType)`: cập nhật `type = nextType` cho mọi mục được chọn; nếu chuyển từ `'character'` sang loại khác, vẫn không xóa phá `characterProfile` nếu không cần, hoặc chuẩn hóa bình thường.
  - `bulkSetGenderSelected(gender)`: chỉ cập nhật `characterProfile` cho các mục `item.type === 'character'` nằm trong `selectedIds`; dùng `normalizeCharacterProfile({ ...item.characterProfile, gender })` để bảo toàn tuyệt đối `defaultSelfPronoun`, `defaultNarrativePronoun`, `relations`.
