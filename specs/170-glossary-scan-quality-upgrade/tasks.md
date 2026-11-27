# Tasks: Cải Tiến Chất Lượng Quét Thuật Ngữ Cho Mô Hình Tốc Độ Cao

**Input**: Design documents from `/specs/170-glossary-scan-quality-upgrade/`

**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/glossary-scan-quality-contracts.md`, `quickstart.md`

**Tests**: Bổ sung unit tests và hook/UI tests cho từng User Story để bảo đảm chất lượng và tái hiện đủ 5 nhóm lỗi từ bộ 592 thuật ngữ thực tế.

**Organization**: Các tác vụ được chia theo User Story (`US1`–`US4`) và đã tích hợp đầy đủ 5 ràng buộc từ bước rà soát thiết kế (`Pre-Implementation Engineering Review`).

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Có thể chạy song song (tệp khác nhau, không phụ thuộc tác vụ chưa xong).
- **[Story]**: Ánh xạ về User Story tương ứng (`[US1]`–`[US4]`).

---

## Phase 1: Setup (Baseline Verification)

**Purpose**: Kiểm tra baseline TypeScript và bộ test quét/từ điển hiện tại trước khi sửa đổi.

- [X] T001 Verify baseline TypeScript and scan-related test suite pass via `npm run lint` and targeted `vitest run` on `src/lib/__tests__/glossaryMatch.test.ts`, `src/services/ai/__tests__/prompts.test.ts`, `src/hooks/__tests__/useGlossaryScan.test.ts`, and `src/components/__tests__/GlossaryManagerUI.test.tsx`

---

## Phase 2: Foundational (Acyclic Primitives & Backward-Compatible Health Types)

**Purpose**: Chuẩn bị các hàm nhận diện ngôn ngữ dùng chung ở tầng nền theo đồ thị phụ thuộc một chiều (tránh circular import `glossaryMatch.ts ↔ glossaryScanQuality.ts`) và giữ tương thích ngược cho `GlossaryHealthReport`.

**⚠️ CRITICAL**: Cần hoàn thành `T002` trước khi triển khai các User Stories phụ thuộc.

- [X] T002 Add `containsHanChars` and precision-guarded `detectMandarinPinyin` (Tier-1 Pinyin tone diacritics plus Tier-2 untoned Mandarin patterns excluding Vietnamese diacritics and Western names), and extend `GlossaryHealthFilter` (`'format_issues'`) & optional `formatIssueIds?: string[]` on `GlossaryHealthReport` inside `computeGlossaryHealth` in `src/lib/glossaryMatch.ts`

**Checkpoint**: Nền tảng phát hiện Bính âm/Han và kiểu dữ liệu Sức khỏe mở rộng đã sẵn sàng mà không gây circular import hay vỡ test UI cũ.

---

## Phase 3: User Story 1 - Chuẩn hóa Phiên âm Hán-Việt, Bản dịch Việt và Ghi chú thuần Việt khi quét thuật ngữ (Priority: P1) 🎯 MVP

**Goal**: Ngăn chặn 100% Bính âm và chữ Hán rò rỉ vào cột Phiên âm, cột Tiếng Việt hoặc cột Ghi chú ngay từ chỉ dẫn quét lẫn cổng hậu kiểm client (0 tốn thêm API call).

**Independent Test**: Đưa các ứng viên lỗi định dạng (`huò zūn`, `秦局`, `đi cùng 李倩`, `Hai`) qua `evaluateScannedTermCandidate` và kiểm tra chỉ dẫn trích xuất mới; xác nhận mục lỗi bị chặn khỏi từ điển chính, ghi chú lẫn chữ Hán được làm sạch khi đủ nghĩa hoặc chuyển hàng chờ kèm lý do tiếng Việt cụ thể.

### Implementation for User Story 1

- [X] T003 [US1] Create `src/lib/glossaryScanQuality.ts` (importing one-way from `src/lib/glossaryMatch.ts` and `src/lib/sinoNormalize.ts`) with `ScanQualityVerdict`, `ScanQualityEvaluation`, `sanitizeScannedNote`, and `evaluateScannedTermCandidate` format checks (mapping `reason` strictly to closed `PendingGlossaryItem['reason']` union and putting detailed Vietnamese explanations in `originalValue`)
- [X] T004 [US1] Fix the Traditional/Simplified example typo (`'萬劍歸宗'`) and harden `buildEntityExtractionInstruction` + `buildEntitySchema` with explicit anti-Pinyin, anti-Han-in-note, and anti-noise directives in `src/services/ai/glossaryPrompts.ts`
- [X] T005 [P] [US1] Create `src/lib/__tests__/glossaryScanQuality.test.ts` covering Tier-1/Tier-2 Pinyin detection, zero false positives on Western names (`Marshall`, `Jack`, `Will`, `Owen`, `Alice`) and Vietnamese names, Han-in-reading checks, and `sanitizeScannedNote` cleanup

**Checkpoint**: User Story 1 hoàn chỉnh và kiểm thử độc lập thành công (MVP ready).

---

## Phase 4: User Story 2 - Chặn từ phổ thông, câu thoại, mã ngắn và mảnh tên bị cắt cụt làm hỏng chất lượng dịch (Priority: P1)

**Goal**: Lọc bỏ rác rõ rệt (`A1/A2`, `电脑`, `步行街`, `我想看鬼`, `暗度陈仓`, câu dài có dấu câu) và chuyển hàng chờ kiểm duyệt các mục rủi ro (từ đơn đúng 1 chữ Hán như `海`/`昆`, mảnh cắt trùng như `苍一` vs `钱仓一`, `天马博士` vs `天马`) mà không làm hỏng các thuật ngữ hợp lệ chứa chữ cái/số (`42号`, `G-3218号`, `词_chap_1`).

**Independent Test**: Chạy `classifyScannedGlossaryBatch` trên tập hỗn hợp tái hiện bộ 592 thuật ngữ (tên chuẩn, `42号`, `A1`, `电脑`, `我想看鬼`, `海`, `苍一` khi đã có `钱仓一`, `天马博士` khi đã có `天马`) và xác nhận phân 3 luồng `accept` / `review` / `reject` chính xác 100%.

### Implementation for User Story 2

- [X] T006 [US2] Implement `isShortAlphanumericCode`, `hasSentencePunctuationOrOverlong`, `isCommonEverydayScanNoise`, strict `isSingleHanCharTerm` (`countHanChars === 1 && Array.from(cleaned).length === 1`), and `findSubTermOrCompositeOverlap` inside `src/lib/glossaryScanQuality.ts`
- [X] T007 [US2] Implement `ScanBatchClassificationResult` and unified `classifyScannedGlossaryBatch` (combining 3-way verdicts, closed `PendingGlossaryItem['reason']` + `originalValue`, `cleanedNote`, safe gender enrichment, and 3 telemetry counts) in `src/lib/glossaryScanQuality.ts`
- [X] T008 [P] [US2] Extend `src/lib/__tests__/glossaryScanQuality.test.ts` with tests for `A1/A2`, `电脑`/`我想看鬼`/`暗度陈仓`, strict 1-Han `海`/`昆` vs composite `42号`/`词_chap_1`, and sub-term/composite overlaps (`苍一` vs `钱仓一`, `天马博士` vs `天马`)

**Checkpoint**: User Story 2 hoàn chỉnh; cổng hậu kiểm chặn rác và mảnh cắt trùng lặp mà vẫn giữ an toàn thuật ngữ hợp lệ.

---

## Phase 5: User Story 3 - Truyền ngữ cảnh từ điển hiện có và phong cách truyện ngay từ Vòng 1 khi quét (Priority: P2)

**Goal**: Cung cấp bối cảnh truyện (`genre`, `tone`, `description`) và danh sách thuật ngữ đã biết có mặt trong chương (kèm nghĩa Việt chuẩn) ngay từ Vòng 1 cho cả quét sỉ và quét đơn chương, giữ đồng bộ cách đặt tên xuyên suốt bộ truyện.

**Independent Test**: Gọi `buildAnalyzeGlossaryPayload`, `useGlossaryScan` (với `extractionLoops = 1`) và `useWorkspaceState` trên dự án có thể loại, tông giọng và từ điển nền; xác nhận ngay tại Vòng 1 prompt gửi đi đã chứa bối cảnh truyện và cặp `chinese -> vietnamese` của các thuật ngữ khớp chương.

### Implementation for User Story 3

- [X] T009 [US3] Implement `ChapterScanAnchorEntry` and `prioritizeKnownAnchorEntriesForChapter` in `src/lib/glossaryScanQuality.ts`, and extend `buildAnalyzeGlossaryPayload` (`src/services/ai/prompts.ts`) + `DirectGlossaryCommonParams` (`src/services/directGlossaryEngine.ts`) to inject project `genre`/`tone`/`description` and chapter-relevant `knownGlossaryEntries` (`chinese -> vietnamese`) on Loop 1 and deeper loops
- [X] T010 [US3] Pass Loop-1 anchor context (`prioritizeKnownAnchorEntriesForChapter`) and project `genre`/`tone`/`description` into `analyzeGlossaryDirect` calls in `src/hooks/useGlossaryScan.ts` and `src/hooks/useWorkspaceState.ts`
- [X] T011 [P] [US3] Add tests in `src/services/ai/__tests__/prompts.test.ts` verifying Loop-1 anchor context injection (`genre`, `tone`, `knownGlossaryEntries`) and hardened anti-Pinyin / anti-Han-note instructions

**Checkpoint**: User Story 3 hoàn chỉnh; cả Vòng 1 lẫn Vòng 2+ đều nhận đủ neo ngữ cảnh dự án và từ điển.

---

## Phase 6: User Story 4 - Cổng hậu kiểm độ tin cậy & Tóm tắt minh bạch sau khi quét (Priority: P2)

**Goal**: Nối cổng hậu kiểm 3 luồng vào quét sỉ & đơn chương kèm dòng log thống kê 3 chỉ số (`Đã thêm` / `Chờ duyệt` / `Đã lọc nhiễu`) và bổ sung pill lọc `"Lỗi phiên âm / ghi chú"` (`format_issues`) trên `GlossaryHealthBar` để rà soát lỗi cũ trong từ điển.

**Independent Test**: Chạy `useGlossaryScan` với đầu ra hỗn hợp (đạt chuẩn + Bính âm/1 chữ + rác đại từ/mã ngắn) để xác nhận 3 luồng định tuyến + log `[Tổng kết hậu kiểm]`, và kiểm tra `GlossaryHealthBar` lọc đúng các mục lỗi cũ.

### Implementation for User Story 4

- [X] T012 [US4] Route raw scan suggestions through `classifyScannedGlossaryBatch` in `src/hooks/useGlossaryScan.ts` (accumulating `acceptedCount`, `reviewCount`, `rejectedCount` and logging `[Tổng kết hậu kiểm]` summary at completion/stop) and apply `evaluateScannedTermCandidate` + sanitized metadata in `src/hooks/useWorkspaceState.ts` (`handleImportSuggestions`)
- [X] T013 [P] [US4] Wire `healthFilter === 'format_issues'` into `src/hooks/useGlossaryState.ts` (`healthReport.formatIssueIds ?? []`) and add the Mực & Chu Sa `"Lỗi phiên âm / ghi chú"` filter pill in `src/components/glossary-manager/GlossaryHealthBar.tsx`
- [X] T014 [P] [US4] Add integration & UI tests covering 3-way scan gate + `[Tổng kết hậu kiểm]` log in `src/hooks/__tests__/useGlossaryScan.test.ts`, `formatIssueIds` detection in `src/lib/__tests__/glossaryMatch.test.ts`, and `format_issues` pill rendering/filtering in `src/components/__tests__/GlossaryManagerUI.test.tsx`

**Checkpoint**: Toàn bộ 4 User Stories hoạt động đồng bộ, bảo toàn test cũ và kiểm chứng đủ 5 nhóm lỗi từ bộ 592 thuật ngữ.

---

## Phase 7: Polish & Verification (Quality Gates)

**Purpose**: Xác minh toàn bộ dự án sau hoàn thiện bằng các cổng kiểm tra bắt buộc.

- [X] T015 Run full quality gates (`npm run lint`, `npm test`, `npm run build`), verify `quickstart.md` scenarios, and confirm `src/types.ts` and `src/services/db.ts` remain untouched via `git status -s -- src/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Chạy đầu tiên (`T001`).
- **Phase 2 (Foundational)**: Phụ thuộc `T001` — `T002` bắt buộc hoàn thành trước khi tạo `glossaryScanQuality.ts` (`T003`) và UI health (`T013`).
- **Phase 3–4 (`US1`, `US2`)**: Chạy nối tiếp trên `src/lib/glossaryScanQuality.ts` (`T003` → `T006` → `T007`); task `T004` (`glossaryPrompts.ts`) và các task test (`T005`, `T008`) có thể chạy song song với nhánh không trùng file.
- **Phase 5–6 (`US3`, `US4`)**: `T009` → `T010` → `T012` trên `useGlossaryScan.ts` / `useWorkspaceState.ts`; `T013` (`useGlossaryState.ts` & `GlossaryHealthBar.tsx`) và `T014` chạy song song được sau `T002`.
- **Phase 7 (Polish)**: Chạy sau khi hoàn tất toàn bộ `T001`–`T014`.

### Parallel Opportunities

- `T003` (`glossaryScanQuality.ts`) || `T004` (`glossaryPrompts.ts`)
- `T005` (`glossaryScanQuality.test.ts`) || `T006` / `T009` nếu tách file khác nhau (hoặc gom viết test sau `T007` trên cùng file `glossaryScanQuality.test.ts`)
- `T012` (`useGlossaryScan.ts` & `useWorkspaceState.ts`) || `T013` (`useGlossaryState.ts` & `GlossaryHealthBar.tsx`)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Hoàn thành `T001`–`T002` (Baseline + Foundational predicates).
2. Hoàn thành `T003`–`T005` (US1 — Hardened prompts + Bính âm & Han-in-note detection).
3. Chạy test độc lập `glossaryScanQuality.test.ts` → Khắc phục ngay lỗi nghiêm trọng nhất là Bính âm & rò chữ Hán.

### Incremental Delivery

1. `T001`–`T005` (Foundation + US1: Chuẩn hóa Hán-Việt & Ghi chú sạch).
2. `T006`–`T008` (US2: Chặn rác `A1/A2`, từ phổ thông, câu lệnh & mảnh cắt trùng).
3. `T009`–`T011` (US3: Truyền neo từ điển & phong cách truyện ngay từ Vòng 1).
4. `T012`–`T014` (US4: Nối cổng 3 luồng, telemetry 3 chỉ số & health filter `format_issues`).
5. `T015` (Full `lint`, `test`, `build` & diff audit).
