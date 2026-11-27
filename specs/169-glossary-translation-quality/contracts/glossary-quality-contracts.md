# Interface Contracts: Cải Tiến Từ Điển Để Cải Thiện Chất Lượng Dịch

**Feature**: `169-glossary-translation-quality` | **Date**: 2026-11-27

## 1. Pure Glossary Matching, Enrichment & Health Contracts (`src/lib/glossaryMatch.ts`)

### 1.1 `resolveGlossaryConflicts`
- **Input**: `glossary: T[]`
- **Contract**:
  - Hợp nhất các mục có cùng cụm chữ Hán chuẩn hóa (`canonicalizeHan`) **trên cả `item.chinese` lẫn bất kỳ phần tử nào trong `item.variants`**.
  - Chọn đúng 1 `winningItem` cho mỗi nhóm tương đương theo thứ tự tất định: `isPinned > origin (manual > guideline > scanned) > hasCharacterProfile > chineseLength > createdAt > id`.
  - Phát sinh `GlossaryConflictWarning` khi trong nhóm tồn tại tối thiểu 2 nghĩa tiếng Việt khác nhau (sau `.trim().toLowerCase()`).

### 1.2 `groupGlossaryByRole`
- **Signature**: `groupGlossaryByRole<T extends GlossaryEntryLike>(entries: T[], matchedInSource: T[]): GroupedGlossarySections<T>`
- **Contract**:
  - Tách biệt rõ các mục khớp trực tiếp trong văn bản nguồn (`matchedInSource`) khỏi các mục chỉ được ghim (`pinnedReference`).
  - Trong `matchedInSource`, phân nhóm theo thứ tự ưu tiên: nhân vật có `characterProfile` → nhân vật khác → địa danh (`location`) → thuật ngữ/chiêu thức (`term`) → thành ngữ/khác (`phrase`/`other`).

### 1.3 `findNonOverlappingParagraphTerms`
- **Signature**: `findNonOverlappingParagraphTerms<T extends GlossaryEntryLike>(sourceParagraph: string, candidateItems: T[]): MatchedGlossarySpan<T>[]`
- **Contract**:
  - Tìm các vị trí khớp thực tế trong `sourceParagraph` (hỗ trợ `chinese`, `variants`, và biến thể Giản/Phồn thể) theo thứ tự độ dài giảm dần.
  - Bất kỳ vị trí nào đã bị cụm dài hơn chiếm chỗ đều bị mask; cụm ngắn hơn chỉ được trả về nếu có mặt tại một vị trí độc lập chưa bị mask.
  - Từ 1 ký tự Hán chỉ khớp khi đứng độc lập (ký tự liền kề không phải ký tự Hán).

### 1.4 `prioritizeKnownTermsForChapter`
- **Signature**: `prioritizeKnownTermsForChapter(sourceText: string, knownTerms: Array<string | GlossaryEntryLike>, maxLimit?: number): string[]`
- **Contract**:
  - Mặc định `maxLimit = 150`.
  - Ưu tiên đưa toàn bộ thuật ngữ đã biết có xuất hiện trong `sourceText` (kể cả Giản/Phồn thể và biến thể) lên đầu kết quả; phần còn lại lấp đầy từ các mục ghim/khác cho tới `maxLimit`.
  - Không trùng lặp cụm chữ Hán chuẩn hóa trong danh sách kết quả.

### 1.5 `isNoisyGlossaryTerm` & `inferCharacterGenderFromContext`
- **Signature**:
  - `isNoisyGlossaryTerm(chinese: string, type?: string): boolean`
  - `inferCharacterGenderFromContext(params: { chinese: string; note?: string; sourceParagraph?: string }): 'male' | 'female' | undefined`
- **Contract**:
  - `isNoisyGlossaryTerm`: Trả về `true` cho chuỗi rỗng, toàn số/dấu câu, chuỗi chỉ gồm đại từ nhân xưng/hư từ phổ thông trong stop-list (vd `我`, `你`, `他`, `她`, `他们`, `自己`, `这里`, `什么`, ...).
  - `inferCharacterGenderFromContext`: Chỉ trả về `'male'` hoặc `'female'` khi có dấu hiệu rõ ràng không mâu thuẫn trong `note` hoặc câu văn `sourceParagraph`; trả về `undefined` nếu mơ hồ hoặc xung đột tín hiệu.
  - `classifyDiscoveredEntitiesForGlossary`: Bỏ qua mục có `isNoisyGlossaryTerm(...) === true` (không tự động thêm vào `newGlossaryItems`); tự điền `characterProfile: { gender }` cho nhân vật mới nếu `inferCharacterGenderFromContext` trả về `'male' | 'female'`; **không bao giờ** ghi đè `existingGlossary`.

### 1.6 `computeGlossaryHealth`
- **Signature**: `computeGlossaryHealth(glossary: GlossaryEntryLike[]): GlossaryHealthReport`
- **Contract**:
  - Tính nhất quán `conflictGroupCount`, `conflictItemIds` (qua `resolveGlossaryConflicts`), `missingProfileCharIds`, `incompleteViIds`, và `totalIssueItems`.

---

## 2. Prompt & Validation Contracts (`src/services/ai/prompts.ts`, `src/services/translation/translationValidation.ts`)

- **`buildRawTranslationPayload` & `buildPolishTranslationPayload` & `buildQaCritiquePayload`**:
  - Dùng `groupGlossaryByRole` để tổ chức khối từ điển theo vai trò rõ ràng.
  - Dòng định dạng từ điển ở **Giai đoạn 2 (Chuốt văn phong)** bắt buộc bao gồm đầy đủ `type`, `note`, `variants` và `characterProfile` tương đương Giai đoạn 1 và Giai đoạn 3.
- **`buildAnalyzeGlossaryPayload`**:
  - Chấp nhận `knownChineseTerms?: string[]` đã được `prioritizeKnownTermsForChapter` chọn lọc (hoặc tự ưu tiên theo `params.text` nếu nhận mảng lớn > 150 phần tử).
- **`checkGlossaryCompliance`**:
  - Sử dụng `findNonOverlappingParagraphTerms(srcSlice, checkableItems)` để lấy danh sách thuật ngữ thực sự xuất hiện độc lập (không bị nuốt bởi cụm dài hơn), sau đó kiểm tra xem `normTransSlice` có chứa `vietnamese` quy ước hay không.

---

## 3. File Import Contracts (`src/services/glossaryIO.ts`)

- Export mới:
  - `export type GlossaryImportMode = 'append' | 'replace_all';`
  - `export function prepareFileDeduplicatedItems(parsedItems: Omit<GlossaryItem, 'id'>[]): Omit<GlossaryItem, 'id'>[];`
- Contract:
  - `prepareFileDeduplicatedItems`: Lọc bỏ dòng thiếu `chinese`/`vietnamese`, khử trùng lặp nội bộ theo chữ Hán chuẩn hóa và nghĩa Việt (giữ bản xuất hiện đầu tiên có đầy đủ thông tin), chuẩn hóa `pinyin`, `type`, `note`, `variants`, `isPinned`, `characterProfile`, `origin`, `createdAt`.
  - Mọi nhánh tạo `GlossaryImportPreview` đều gán `allValidItems`.

---

## 4. State Hook & UI Component Contracts

### 4.1 `useGlossaryState` (`src/hooks/useGlossaryState.ts`)
- Export thêm trạng thái và hành động:
  - `healthReport: GlossaryHealthReport`
  - `healthFilter: GlossaryHealthFilter` & `setHealthFilter` (tự động tích hợp vào `filteredGlossary`)
  - `selectedIds: string[]`, `selectedIdSet: Set<string>`
  - `toggleSelectItem(id: string)`, `toggleSelectPage(pageItems: GlossaryItem[])`, `selectAllFiltered()`, `clearSelection()`
  - `bulkDeleteSelected()`, `bulkSetPinnedSelected(isPinned: boolean)`, `bulkSetTypeSelected(type: GlossaryType)`, `bulkSetGenderSelected(gender: CharacterGender)`
  - `confirmImport(strategy: DuplicateResolutionStrategy, importMode?: GlossaryImportMode)` (bảo đảm khi `importMode === 'replace_all'`, yêu cầu xác nhận rõ ràng, chặn nếu `allValidItems.length === 0`, giữ nguyên `pendingGlossary` & `reviewQueue`).
  - `saveEdit`: giữ nguyên toàn bộ thuộc tính phụ (`...currentItem`) khi lưu inline edit.

### 4.2 `GlossaryHealthBar` (`src/components/glossary-manager/GlossaryHealthBar.tsx`)
- Props: `healthReport`, `healthFilter`, `onSelectFilter`, `totalGlossaryCount`.
- Hiển thị trạng thái Sức khỏe từ điển theo design system Mực & Chu Sa (`Badge`, `Button`, icon `lucide-react`, không emoji). Bấm vào từng badge sẽ chuyển `healthFilter` để lọc nhanh bảng `GlossaryTable`.

### 4.3 `GlossaryBulkActionBar` (`src/components/glossary-manager/GlossaryBulkActionBar.tsx`)
- Props: `selectedCount`, `totalFilteredCount`, `selectedCharacterCount`, `onSelectAllFiltered`, `onClearSelection`, `onBulkPin`, `onBulkUnpin`, `onBulkChangeType`, `onBulkChangeGender`, `onBulkDelete`.
- Chỉ hiển thị khi `selectedCount > 0`; hỗ trợ 4 nhóm hành động chuẩn hóa đầy đủ (`FR-014`).

### 4.4 `GlossaryTable` (`src/components/glossary-manager/GlossaryTable.tsx`)
- Thêm cột checkbox đầu dòng (`w-8` gọn trong grid 12 cột hoặc `flex` đầu hàng giữ nguyên cân đối hiển thị), checkbox chọn tất cả trang hiện tại ở header, và không làm hỏng click chọn dòng mở sidebar chi tiết (`e.stopPropagation()` trên ô checkbox).

### 4.5 `ImportGuidelinesModal` (`src/components/glossary-manager/ImportGuidelinesModal.tsx`)
- Thêm bộ chọn 2 chế độ **Chỉ thêm thuật ngữ** (`'append'`, mặc định) vs **Thay toàn bộ thuật ngữ** (`'replace_all'`) trong màn hình xem trước (`importPreview`), kèm hộp cảnh báo số lượng mục cũ `existingGlossaryCount` sẽ bị thay thế và trạng thái chặn khi `allValidItems.length === 0`.
