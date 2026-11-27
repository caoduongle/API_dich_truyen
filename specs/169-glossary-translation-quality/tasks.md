# Tasks: Cải Tiến Từ Điển Để Cải Thiện Chất Lượng Dịch

**Input**: Design documents from `/specs/169-glossary-translation-quality/`

**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/glossary-quality-contracts.md`, `quickstart.md`

**Tests**: Bổ sung unit tests và UI/hook tests cho từng User Story nhằm đáp ứng Constitution Principle I (`npm run lint`, `npm test`, `npm run build`).

**Organization**: Các tác vụ được chia theo User Story (`US1`–`US5`) để mỗi phần có thể triển khai và kiểm thử độc lập, có lồng ghép sẵn 6 điểm gia cố từ phiên rà soát thiết kế (`Pre-Implementation Engineering Review`).

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Có thể chạy song song (tệp khác nhau, không phụ thuộc tác vụ chưa xong).
- **[Story]**: Ánh xạ về User Story tương ứng (`[US1]`–`[US5]`).

---

## Phase 1: Setup (Baseline Verification)

**Purpose**: Kiểm tra baseline của mã nguồn và test suite từ điển hiện tại trước khi sửa đổi.

- [X] T001 Verify baseline TypeScript and existing glossary test suite pass via `npm run lint` and targeted `vitest run` on `src/lib/__tests__/glossaryMatch.test.ts`, `src/services/ai/__tests__/prompts.test.ts`, `src/services/translation/__tests__/translationValidation.test.ts`, `src/services/__tests__/glossaryIO.test.ts`, `src/hooks/__tests__/useGlossaryIO.test.ts`, and `src/components/__tests__/GlossaryManager.test.ts`

---

## Phase 2: Foundational (Blocking Core Logic)

**Purpose**: Chuẩn hóa 2 tầng nền tảng dùng chung cho nhiều User Stories (`resolveGlossaryConflicts` mở rộng biến thể và `prepareFileDeduplicatedItems` / `allValidItems` trong nhập tệp).

**⚠️ CRITICAL**: Cần hoàn thành `T002` và `T003` trước khi triển khai các User Stories phụ thuộc.

- [X] T002 Extend `resolveGlossaryConflicts` with variant-aware equivalence and non-destructive losing-variant stripping (collapse duplicate primary `chinese` entries to one deterministic winner while stripping only colliding `variants` on losing entries and recording `GlossaryConflictWarning` across primary/variant collisions) in `src/lib/glossaryMatch.ts`
- [X] T003 [P] Add `GlossaryImportMode` (`'append' | 'replace_all'`), `prepareFileDeduplicatedItems` (routed exclusively through `buildSafeImportedItem` against prototype pollution), and populate `allValidItems` on `GlossaryImportPreview` in `src/services/glossaryIO.ts`

**Checkpoint**: Nền tảng giải quyết xung đột theo biến thể và mô hình nhập tệp 2 chế độ đã sẵn sàng cho các User Stories.

---

## Phase 3: User Story 1 - Cung cấp đầy đủ ngữ cảnh từ điển đồng nhất qua mọi bước dịch và biên tập (Priority: P1) 🎯 MVP

**Goal**: Bảo đảm bước Dịch thô (Raw), Chuốt văn phong (Polish, mọi lượt) và Kiểm duyệt (QA) nhận đầy đủ ngữ cảnh (`note`, `type`, `variants`, `characterProfile`), được sắp xếp theo vai trò ưu tiên rõ ràng và dùng cùng một kết quả giải quyết xung đột.

**Independent Test**: Gọi `buildRawTranslationPayload`, `buildPolishTranslationPayload` và `buildQaCritiquePayload` trên cùng từ điển mẫu (nhân vật có hồ sơ + ghi chú + biến thể + cặp xung đột) và xác nhận cả 3 pha đều nhận đủ `note`/`variants`/`characterProfile`, giữ tiêu đề gốc và sắp nhóm đúng thứ tự vai trò.

### Implementation for User Story 1

- [X] T004 [US1] Implement `GroupedGlossarySections` and `groupGlossaryByRole` (sorting matched entries into `characterProfiled`, `characterPlain`, `location`, `term`, `phraseOther`, and separating `pinnedReference`) in `src/lib/glossaryMatch.ts`
- [X] T005 [US1] Update `buildRawTranslationPayload`, `buildPolishTranslationPayload` (include full `type` and `note` in `formatPolishGlossaryLine`), and `buildQaCritiquePayload` to organize glossary blocks by `groupGlossaryByRole` nested under existing section headers in `src/services/ai/prompts.ts`
- [X] T006 [P] [US1] Add unit tests covering variant conflict preservation/stripping, role grouping order, and full 3-phase prompt parity in `src/lib/__tests__/glossaryMatch.test.ts` and `src/services/ai/__tests__/prompts.test.ts`

**Checkpoint**: User Story 1 hoàn chỉnh và kiểm thử độc lập thành công (MVP ready).

---

## Phase 4: User Story 2 - Khớp thuật ngữ thông minh, loại bỏ báo lỗi giả do cụm từ lồng nhau (Priority: P1)

**Goal**: Loại bỏ 100% cảnh báo sai thuật ngữ khi cụm từ điển ngắn nằm lọt bên trong cụm dài hơn đã khớp, đồng thời vẫn bắt chính xác nếu cụm ngắn đứng độc lập ở vị trí khác trong đoạn và nhận diện đầy đủ biến thể / Giản-Phồn thể.

**Independent Test**: Kiểm tra `checkGlossaryCompliance` với đoạn văn chứa cụm dài (vd `"张三丰"`) và bản dịch dùng đúng `"Trương Tam Phong"` trong khi từ điển cũng chứa `"三丰"` (`"Tam Phong"`), xác nhận `0` cảnh báo giả tại vị trí lồng nhau nhưng vẫn bắt lỗi khi `"三丰"` xuất hiện độc lập ở câu khác trong cùng đoạn.

### Implementation for User Story 2

- [X] T007 [US2] Implement `MatchedGlossarySpan` and `findNonOverlappingParagraphTerms` (greedy longest-match span masking, canonical Simplified/Traditional + `variants` matching, and standalone boundary check for 1-Han-character terms) in `src/lib/glossaryMatch.ts`
- [X] T008 [US2] Update `checkGlossaryCompliance` to pass only `checkableItems` (non-empty `vietnamese`) into `findNonOverlappingParagraphTerms` per source slice before asserting expected Vietnamese translations in `src/services/translation/translationValidation.ts`
- [X] T009 [P] [US2] Add unit tests for nested vs independent occurrences, empty-Vietnamese long terms not masking valid shorter terms, variants, and single-Han boundaries in `src/lib/__tests__/glossaryMatch.test.ts` and `src/services/translation/__tests__/translationValidation.test.ts`

**Checkpoint**: User Story 2 hoàn chỉnh và triệt tiêu hoàn toàn báo lỗi giả do cụm lồng nhau.

---

## Phase 5: User Story 3 - Tự động làm giàu hồ sơ nhân vật và lọc nhiễu khi quét/trích xuất từ điển (Priority: P2)

**Goal**: Ưu tiên loại trừ đúng các thuật ngữ đã biết xuất hiện trong chương khi từ điển lớn (>150–500 mục), lọc từ phổ thông nhiễu khỏi việc tự động thêm vào từ điển chính, và tự gợi ý giới tính nhân vật mới từ ngữ cảnh rõ ràng mà không ghi đè mục `manual` / `isPinned` / hồ sơ sẵn có.

**Independent Test**: Chạy `classifyDiscoveredEntitiesForGlossary` và `useGlossaryScan` với từ điển >300 mục, thực thể nhiễu (`"他们"`), nhân vật mới có dấu hiệu giới tính tường minh, và nhân vật đã ghim/chỉnh sửa thủ công; xác nhận thứ tự loại trừ, lọc nhiễu, gợi ý giới tính an toàn và bảo toàn hồ sơ cũ.

### Implementation for User Story 3

- [X] T010 [US3] Implement `prioritizeKnownTermsForChapter`, `isNoisyGlossaryTerm`, and strict boundary-matched `inferCharacterGenderFromContext` (returning `undefined` on ambiguous or conflicting cues), and integrate noise filtering + safe gender enrichment into `classifyDiscoveredEntitiesForGlossary` in `src/lib/glossaryMatch.ts`
- [X] T011 [US3] Wire `prioritizeKnownTermsForChapter` into `buildAnalyzeGlossaryPayload` (`src/services/ai/prompts.ts`) and reuse `prioritizeKnownTermsForChapter`, `isNoisyGlossaryTerm`, and `inferCharacterGenderFromContext` in `src/hooks/useGlossaryScan.ts` (never overwriting manual/pinned profiles)
- [X] T012 [P] [US3] Add tests for chapter-prioritized exclusions (>300 glossary items), noisy-word filtering, unambiguous vs ambiguous gender inference (avoiding substring false positives like `"phía nam"`), and scan hook integration in `src/lib/__tests__/glossaryMatch.test.ts`, `src/services/ai/__tests__/prompts.test.ts`, and `src/hooks/__tests__/useGlossaryScan.test.ts`

**Checkpoint**: User Story 3 hoàn chỉnh; luồng quét sỉ và dịch đều dùng chung một đường lọc nhiễu & làm giàu hồ sơ.

---

## Phase 6: User Story 4 - Chẩn đoán sức khỏe từ điển và xử lý xung đột nhanh trước khi dịch (Priority: P2)

**Goal**: Hiển thị khu vực chẩn đoán "Sức khỏe từ điển" đếm chính xác xung đột nghĩa dịch (gồm cả Giản/Phồn thể và biến thể), nhân vật thiếu hồ sơ giới tính/đại từ tự sự, và mục thiếu bản dịch tiếng Việt, kèm lọc 1 chạm và sửa lỗi mất metadata khi `saveEdit`.

**Independent Test**: Render `GlossaryManager` / `useGlossaryState` với bộ từ điển có 1 cặp xung đột, 2 nhân vật thiếu giới tính và 1 mục trống nghĩa Việt; kiểm tra bộ đếm và từng bộ lọc 1 chạm cùng nút khôi phục khi danh sách lọc rỗng.

### Implementation for User Story 4

- [X] T013 [US4] Implement `GlossaryHealthReport`, `GlossaryHealthFilter`, and `computeGlossaryHealth` reusing `resolveGlossaryConflicts` conflict groups in `src/lib/glossaryMatch.ts`
- [X] T014 [US4] Add `healthReport`, `healthFilter`, `setHealthFilter`, and `clearAllFilters` to `filteredGlossary`, and fix `saveEdit` to preserve `...currentItem` fields (`isPinned`, `variants`, `characterProfile`, `sourceChapterId`) in `src/hooks/useGlossaryState.ts`
- [X] T015 [P] [US4] Create Mực & Chu Sa `src/components/glossary-manager/GlossaryHealthBar.tsx` (using `Badge`, `Button`, `lucide-react`, no platform emojis) and connect `healthReport`/`healthFilter` in `src/components/GlossaryManager.tsx`
- [X] T016 [P] [US4] Add tests for `computeGlossaryHealth`, `healthFilter` filtering, and `saveEdit` metadata preservation in `src/lib/__tests__/glossaryMatch.test.ts` and `src/hooks/__tests__/useGlossaryState.test.ts`

**Checkpoint**: User Story 4 hoàn chỉnh; người dịch thấy ngay sức khỏe từ điển và lọc sửa được chỉ với 1 chạm.

---

## Phase 7: User Story 5 - Thao tác hàng loạt trên từ điển và chọn chế độ Thay toàn bộ / Chỉ thêm khi nhập tệp (Priority: P2)

**Goal**: Cung cấp chọn nhiều dòng (từng dòng, trang hiện tại, toàn bộ kết quả lọc) + thanh thao tác hàng loạt 4 hành động (Xóa, Ghim/Bỏ ghim, Đổi phân loại, Gán giới tính nhân vật), và lựa chọn 2 chế độ **Chỉ thêm thuật ngữ** vs **Thay toàn bộ thuật ngữ** khi nhập tệp (có cảnh báo xác nhận, giữ nguyên hàng chờ kiểm duyệt và chặn tệp không có mục hợp lệ).

**Independent Test**: Test cả 4 thao tác hàng loạt (gồm tập chọn hỗn hợp nhân vật + địa danh, giữ nguyên đại từ/quan hệ sẵn có của nhân vật) và test nhập tệp ở cả chế độ `append` lẫn `replace_all` (có cảnh báo số mục cũ, giữ nguyên `pendingGlossary`/`reviewQueue`, chặn nếu file rỗng).

### Implementation for User Story 5

- [X] T017 [US5] Add synchronous multi-select state (`selectedIds`, `selectedIdSet`, auto-prune on `glossary` change, `toggleSelectItem`, `toggleSelectPage`, `selectAllFiltered`, `clearSelection`), 4 synchronous atomic bulk handlers (`bulkDeleteSelected`, `bulkSetPinnedSelected`, `bulkSetTypeSelected`, `bulkSetGenderSelected`), and synchronous `confirmImport(strategy, importMode = 'append')` with `replace_all` empty-file guard, `pendingGlossary`/`reviewQueue` preservation, and `onUpdateProject` / callback fallback in `src/hooks/useGlossaryState.ts`
- [X] T018 [P] [US5] Create `src/components/glossary-manager/GlossaryBulkActionBar.tsx` with Mực & Chu Sa styling, all 4 bulk normalization actions, and View-layer `showConfirm` confirmation before bulk deletion
- [X] T019 [P] [US5] Update `src/components/glossary-manager/GlossaryTable.tsx` using an outer `flex items-center` wrapper (`w-9 shrink-0` checkbox column + existing `flex-1 grid grid-cols-12` layout across header/rows/skeleton with `e.stopPropagation()`), page-level select-all checkbox, and `EmptyState` "Xóa bộ lọc" action when filtered empty
- [X] T020 [P] [US5] Update `src/components/glossary-manager/ImportGuidelinesModal.tsx` with the 2-mode selector (**Chỉ thêm thuật ngữ** default vs **Thay toàn bộ thuật ngữ**), amber replacement-count warning + explicit confirmation dialog/guard (`allValidItems.length === 0` blocked), and wire bulk + import props through `src/components/GlossaryManager.tsx`
- [X] T021 [P] [US5] Add comprehensive unit and hook/UI tests for `prepareFileDeduplicatedItems`, bulk selection & all 4 bulk actions (including mixed-type selection and profile preservation), and `replace_all` import safety in `src/services/__tests__/glossaryIO.test.ts`, `src/hooks/__tests__/useGlossaryState.test.ts`, and `src/hooks/__tests__/useGlossaryIO.test.ts`

**Checkpoint**: Toàn bộ 5 User Stories hoạt động độc lập và tương thích ngược với bộ test hiện tại.

---

## Phase 8: Polish & Verification (Quality Gates)

**Purpose**: Xác minh toàn bộ dự án sau hoàn thiện bằng các cổng kiểm tra bắt buộc.

- [X] T022 Run full quality gates (`npm run lint`, `npm test`, `npm run build`), verify `quickstart.md` scenarios, and confirm `src/types.ts` and `src/services/db.ts` remain untouched via `git status -s -- src/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Không phụ thuộc — chạy trước tiên.
- **Phase 2 (Foundational)**: Phụ thuộc `T001` — hoàn thành `T002` và `T003` trước khi làm các User Stories dùng chúng (`T002` cần cho `US1`, `US4`; `T003` cần cho `US5`).
- **Phase 3–5 (US1, US2, US3)**: Có thể triển khai song song hoặc nối tiếp trên `src/lib/glossaryMatch.ts` và `src/services/`:
  - `US1` (`T004`–`T006`) là **MVP cốt lõi**.
  - `US2` (`T007`–`T009`) độc lập về compliance/matching, dùng lại helper từ `glossaryMatch.ts`.
  - `US3` (`T010`–`T012`) độc lập cho scan & entity classification.
- **Phase 6–7 (US4, US5)**:
  - `US4` (`T013`–`T016`) phụ thuộc `T002` (`computeGlossaryHealth` tái dùng `resolveGlossaryConflicts`).
  - `US5` (`T017`–`T021`) phụ thuộc `T003` (`GlossaryImportMode` / `allValidItems`) và nên làm phần hook `src/hooks/useGlossaryState.ts` nối tiếp sau `T014` để tránh xung đột sửa cùng 1 file.
- **Phase 8 (Polish)**: Chạy sau khi hoàn tất toàn bộ `T001`–`T021`.

### Parallel Opportunities

- Trong Phase 2: `T002` (`src/lib/glossaryMatch.ts`) và `T003` (`src/services/glossaryIO.ts`) chạy song song.
- Trong Phase 3–5: các task test (`T006`, `T009`, `T012`) chạy song song sau phần implement tương ứng.
- Trong Phase 7: `T018` (`GlossaryBulkActionBar.tsx`), `T019` (`GlossaryTable.tsx`), và `T020` (`ImportGuidelinesModal.tsx`) chạy song song ngay khi hợp đồng hook `T017` đã cố định.

---

## Parallel Example: User Story 5

```text
# Sau khi hoàn tất T017 (useGlossaryState.ts):
Parallel:
- T018 [P] [US5] Create src/components/glossary-manager/GlossaryBulkActionBar.tsx
- T019 [P] [US5] Update src/components/glossary-manager/GlossaryTable.tsx
- T020 [P] [US5] Update src/components/glossary-manager/ImportGuidelinesModal.tsx & src/components/GlossaryManager.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Hoàn thành Phase 1 (`T001`) + Phase 2 (`T002`–`T003`).
2. Hoàn thành Phase 3 (`T004`–`T006` — US1).
3. Kiểm thử độc lập US1 (`glossaryMatch.test.ts` & `prompts.test.ts`) → Giá trị cốt lõi cải thiện chất lượng dịch ngay từ MVP.

### Incremental Delivery

1. `T001`–`T006` (Foundation + US1: Ngữ cảnh đầy đủ 3 pha & nhóm vai trò).
2. `T007`–`T009` (US2: Khớp cụm dài nhất không chồng lấn trong QA compliance).
3. `T010`–`T012` (US3: Ưu tiên loại trừ theo chương, lọc nhiễu & gợi ý giới tính an toàn).
4. `T013`–`T016` (US4: Thanh Sức khỏe từ điển & lọc 1 chạm + fix `saveEdit`).
5. `T017`–`T021` (US5: Thao tác hàng loạt 4 hành động & Nhập tệp 2 chế độ Chỉ thêm / Thay toàn bộ).
6. `T022` (Full lint, test, build & diff check).
