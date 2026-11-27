# Tasks: Cải thiện chất lượng dịch — Bảo toàn cấu trúc 1-1 với bản raw

**Input**: Design documents from `specs/166-strict-raw-structure-parity/`
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/structure-parity-contract.md`

**Tests**: Bổ sung unit tests toàn diện cho module `structureParity.ts`, prompts và pipeline hội nhập theo `plan.md` & `AGENTS.md` §14.

**Organization**: Tasks được tổ chức theo từng User Story (`US1` – `US4`) để có thể triển khai và kiểm chứng độc lập, tích hợp đầy đủ 7 chốt chặn từ bước rà soát kỹ thuật.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Có thể chạy song song (khác file, không phụ thuộc task chưa hoàn thành)
- **[Story]**: Nhãn User Story (`[US1]`, `[US2]`, `[US3]`, `[US4]`) — chỉ gắn cho các phase User Story

---

## Phase 1: Setup (Đồng bộ Thiết kế & Chốt chặn Kiến trúc)

**Purpose**: Cập nhật tài liệu thiết kế với 4 điều chỉnh từ bước rà soát kỹ thuật trước khi viết mã nguồn.

- [X] T001 Đồng bộ danh sách file (`src/services/translation/index.ts`, `src/services/translation/bilingualSplit.ts`) và 4 quy tắc an toàn (ngoặc lồng `‘’`/`『』` → `'`, không chuẩn hóa dấu câu trong `fallbackSinoVietnameseLine`, tách `checkStructureParityIssues` khỏi rollback đơn đoạn của `targetedRepair.ts`, nguyên tắc Non-Regression trong `evaluatePolishRoundFidelity`) vào `specs/166-strict-raw-structure-parity/plan.md` và `specs/166-strict-raw-structure-parity/contracts/structure-parity-contract.md`

---

## Phase 2: Foundational (Hạ tầng Chữ ký Cấu trúc & Barrel Exports)

**Purpose**: Khởi tạo kiểu dữ liệu và bộ trích xuất chữ ký cấu trúc tuyến tính `O(n)` dùng chung cho mọi User Story.

**⚠️ CRITICAL**: Hoàn thành Phase 2 trước khi bắt đầu US1–US4.

- [X] T002 Mở rộng tương thích ngược interface `PolishFidelityReport` (thêm các trường tùy chọn `previousStructurePenalty`, `candidateStructurePenalty`, `structureDiscrepancyCount`) trong `src/services/translation/types.ts`
- [X] T003 Tạo file `src/services/translation/structureParity.ts` định nghĩa `ParagraphStructuralSignature`, `StructureDiscrepancyKind`, `ParagraphParityDiscrepancy`, `StructureParityReport` và hiện thực `extractParagraphSignature` quét tuyến tính `O(n)` trên từng dòng đơn (chống ReDoS, nhận diện tiêu đề, dòng phân cảnh, số câu không nhầm số thập phân `3.5`, dấu `?`/`!`/`...`/`—`, số cặp ngoặc thoại và dấu câu CJK)
- [X] T004 Re-export toàn bộ public API của `./structureParity` thông qua `src/services/translation/index.ts` (tự động xuất qua facade `src/services/directTranslationEngine.ts`)

**Checkpoint**: Hạ tầng kiểu và `extractParagraphSignature` biên dịch sạch, sẵn sàng cho US1–US4.

---

## Phase 3: User Story 1 - Bảo toàn chính xác 1-1 cấu trúc dòng và đoạn văn so với bản raw (Priority: P1) 🎯 MVP

**Goal**: Mọi đoạn văn, dòng thoại, dòng thơ, tiêu đề và dòng phân cảnh trong bản dịch thô và bản chuốt văn khớp chính xác 1-1 về số lượng và thứ tự với bản raw (kể cả chương ngắn < 5 đoạn và chương dài chia phần).

**Independent Test**: Dịch và chuốt văn chương mẫu có tiêu đề, hội thoại ngắn liên tiếp, thơ và dòng phân cảnh `***`; xác nhận số đoạn ở Bản gốc, Dịch thô và Dịch biên tập khớp 1-1 tuyệt đối (`0` đoạn bị gộp/tách).

### Implementation for User Story 1

- [X] T005 [US1] Hiện thực `realignParagraphStructure`, `analyzeStructureParity` (ưu tiên kiểm tra `sourceParagraphs.length === translatedParagraphs.length` trước khi bù trừ offset `isChapterTitleLine`) và `validateStrictStructureParity` (chỉ tách dòng thoại gộp khi `^"[^"]+"\s+"[^"]+"$` không có dẫn truyện xen giữa và khớp 2 dòng thoại gốc; chỉ ném `PARAGRAPH_STRUCTURE_DIVERGENCE` khi `countChineseCharacters(referenceText) > 0` để giữ tương thích test tiếng Việt giả lập) trong `src/services/translation/structureParity.ts`
- [X] T006 [P] [US1] Đồng bộ `extractParagraphs` trong `src/services/translation/bilingualSplit.ts` để tách dòng nhất quán theo `\r?\n+` khi bản gốc và bản thô có dòng đơn xen lẫn `\n\n`, tránh gom nhầm nhiều dòng thoại/thơ thành một khối khi chia phần ở GĐ2
- [X] T007 [US1] Tích hợp `realignParagraphStructure` và `validateStrictStructureParity` vào `callRawDirectCore` trong `src/services/translation/rawTranslation.ts` (không áp dụng lên nhánh dự phòng `fallbackSinoVietnameseLine`)
- [X] T008 [US1] Tích hợp `realignParagraphStructure` và `validateStrictStructureParity` (truyền `referenceRawText: rawTranslation`) vào `callPolishDirectCore` trong `src/services/translation/polishTranslation.ts`, đồng thời giữ nguyên hàm `validateParagraphParity` cũ trong `src/lib/text.ts`

**Checkpoint**: User Story 1 hoàn chỉnh — cả GĐ1, GĐ2 và bộ chia phần song ngữ bảo toàn đối xứng dòng/đoạn 1-1 với bản raw.

---

## Phase 4: User Story 2 - Chuẩn hóa và bảo toàn 1-1 hệ thống dấu câu từ bản raw (Priority: P1)

**Goal**: Toàn bộ dấu câu tiếng Trung được chuyển sang dấu câu tiếng Việt chuẩn 1-1 (`0` sót dấu câu toàn giác), bảo toàn dấu ngữ khí (`?`, `!`, `...`, `—`), dấu tên tác phẩm (`«...»`), ngoặc lồng (`'...'`) và lời thoại trực tiếp (`"..."`).

**Independent Test**: Đưa vào văn bản chứa đủ `。`, `，`, `、`, `；`, `：`, `？`, `！`, `……`, `。。。`, `——`, `“...”`, `「...」`, `『...』`, `‘...’`, `（...）`, `《...》`, `【...】`; xác nhận đầu ra sạch 100% dấu câu toàn giác CJK và giữ đúng từng loại dấu ngữ khí/cặp ngoặc.

### Implementation for User Story 2

- [X] T009 [US2] Hiện thực `normalizeTranslatedPunctuation` trong `src/services/translation/structureParity.ts` (ánh xạ `。→.`, `，/、→,`, `；→;`, `：→:`, `？→?`, `！→!`, `……/…+/。。。+→...`, `——/──→—`, ngoặc thoại ngoài `“”/「」→"`, ngoặc lồng trong `‘’/『』→'`, `（）→()`, `《》→«»`, `【】→[]`, `～→~`; giữ nguyên số thập phân `3.5`, dấu chấm giữa tên `·`, dòng phân cảnh và xuống dòng)
- [X] T010 [US2] Gắn `normalizeTranslatedPunctuation` vào đầu ra AI của `callRawDirectCore` trong `src/services/translation/rawTranslation.ts`, `callPolishDirectCore` trong `src/services/translation/polishTranslation.ts` và `repairChapterCriticalIssuesDirect` trong `src/services/translation/targetedRepair.ts` (tuyệt đối không sửa `fallbackSinoVietnameseLine` trong `src/services/translation/rawTranslation.ts`)
- [X] T011 [US2] Bổ sung bảng quy tắc ánh xạ dấu câu 1-1 và ràng buộc giữ nguyên lời thoại trực tiếp trong ngoặc vào `buildRawTranslationPayload`, `buildPolishTranslationPayload` và `buildQaCritiquePayload` trong `src/services/ai/prompts.ts` (giữ nguyên đánh số `1.`..`10.` và chỉ xuất văn bản nguồn 1 lần ở GĐ1)

**Checkpoint**: User Story 2 hoàn chỉnh — 0 dấu câu CJK toàn giác còn sót và dấu thoại/ngữ khí được chuẩn hóa đồng nhất.

---

## Phase 5: User Story 3 - Giữ nguyên cách ngắt câu và nhịp văn của bản raw qua mọi lượt dịch & chuốt văn (Priority: P1)

**Goal**: Bảo toàn số lượng và trật tự câu trong từng đoạn, loại bỏ các chỉ dẫn mặc định khuyến khích viết bay bổng tự do làm gộp/tách câu qua nhiều lượt chuốt văn.

**Independent Test**: Kiểm tra payload prompt GĐ1/GĐ2 và chiến lược các lượt chuốt văn xác nhận ràng buộc 1-1 ngắt câu/dấu câu/xuống dòng đứng ở ƯU TIÊN #1, kèm bản đồ số đoạn định lượng và chỉ dẫn mặc định trung thành cấu trúc.

### Implementation for User Story 3

- [X] T012 [P] [US3] Cập nhật `LITERARY_TRANSLATION_FRAMING` và `getPolishStrategyForRound` (lượt 1 → 5+) trong `src/lib/text.ts` để khóa cứng ranh giới câu, cấm gộp nhiều câu ngắn thành câu dài, cấm cắt vụn câu gốc và cấm biến thoại trực tiếp thành gián tiếp
- [X] T013 [US3] Cập nhật `buildInstructionPriorityBlock`, đính kèm chỉ dẫn định lượng số đoạn `[BẢN ĐỒ CẤU TRÚC ĐOẠN BẮT BUỘC]` và thay câu mặc định `'Hãy tối ưu ngữ điệu mượt mà, bay bổng nhất có thể...'` bằng chỉ dẫn chuốt văn tự nhiên bảo toàn cấu trúc 1-1 trong `src/services/ai/prompts.ts` và `src/services/chapterTranslationService.ts`
- [X] T014 [US3] Đồng bộ kiểm thử chỉ dẫn chuốt văn mặc định (FR-007) và bổ sung kiểm thử xác nhận quy tắc ngắt câu/dấu câu/bản đồ số đoạn không phá vỡ đánh số `1.`..`10.` trong `src/services/ai/__tests__/prompts.test.ts`

**Checkpoint**: User Story 3 hoàn chỉnh — toàn bộ chỉ dẫn các giai đoạn và các vòng chuốt văn thống nhất khóa cấu trúc ngắt câu 1-1.

---

## Phase 6: User Story 4 - Tự động phát hiện, phục hồi và cảnh báo sai lệch cấu trúc 1-1 (Priority: P2)

**Goal**: Phát hiện tất định các sai lệch dấu thoại, dấu ngữ khí, sót dấu câu CJK và gộp/tách câu theo từng đoạn; chặn mọi lượt chuốt văn làm thoái hóa cấu trúc so với lượt trước; gắn cảnh báo đúng chỉ số đoạn trong kiểm duyệt và bảo vệ sửa cục bộ.

**Independent Test**: Mô phỏng lượt chuốt văn làm gộp đoạn hoặc làm mất dấu ngoặc thoại/dấu hỏi — xác nhận `evaluatePolishRoundFidelity` bác bỏ ngay từ Lượt 1+, `checkStructureParityIssues` trả về cảnh báo đúng `paragraphIndex`, và `targetedRepair` giữ nguyên 1 đoạn đơn mà không rollback nhầm bản sửa `omission`.

### Implementation for User Story 4

- [X] T015 [US4] Hiện thực `checkStructureParityIssues` trong `src/services/translation/structureParity.ts` (ánh xạ sang `QaIssueType` hiện có `'raw_leak' | 'omission' | 'addition' | 'other'` kèm `[Cấu trúc 1-1]` và `paragraphIndex` chính xác; miễn trừ cảnh báo ngoặc vuông hệ thống khi đoạn gốc chứa `【...】` hoặc `[...]`)
- [X] T016 [US4] Nâng cấp `evaluatePolishRoundFidelity` (áp dụng nguyên tắc Non-Regression so với `previousDraft` cho mọi lượt `roundIndex >= 1`: từ chối nếu lệch số đoạn thân bài hoặc tăng lỗi cấu trúc nghiêm trọng/điểm phạt) và mở rộng tùy chọn `includeStructureParity?: boolean` cho `runDeterministicTranslationChecks` trong `src/services/translation/translationValidation.ts`
- [X] T017 [P] [US4] Cập nhật `repairChapterCriticalIssuesDirect` trong `src/services/translation/targetedRepair.ts` để gia cố chỉ dẫn giữ cấu trúc 1-1 đoạn nguồn và kiểm tra hậu kiểm cục bộ (đúng 1 đoạn, 0 dấu câu CJK, không làm mất ngoặc thoại vốn có của `primarySourcePara`) mà không bật `includeStructureParity` gây rollback nhầm khi sửa `omission`
- [X] T018 [US4] Bật `includeStructureParity: true` khi gọi `runDeterministicTranslationChecks` ở cấp chương và cập nhật nhãn log `onSplitRetry` nhận diện `PARAGRAPH_STRUCTURE_DIVERGENCE` / `POLISH_TRUNCATION_DETECTED` trong `src/services/chapterTranslationService.ts` và `src/hooks/useWorkspaceState.ts`, đồng thời siết `checkParagraphParityPassed` khớp 1-1 thân bài trong `src/services/translation/qualityEvaluator.ts`

**Checkpoint**: User Story 4 hoàn chỉnh — vòng khép kín phát hiện, phục hồi, chống thoái hóa chuốt văn và cảnh báo kiểm duyệt theo từng đoạn hoạt động đầy đủ.

---

## Phase 7: Polish, Testing & Quality Gates

**Purpose**: Kiểm thử tự động toàn diện cho toàn bộ kịch bản 1-1 (dấu câu, ngắt câu, xuống dòng, split-retry, multi-round polish, targeted repair) và xác minh tất cả cổng chất lượng dự án.

- [X] T019 [P] Viết bộ unit & integration tests toàn diện trong `src/services/translation/__tests__/structureParity.test.ts` (bao phủ: chuẩn hóa mọi dấu câu CJK & ngoặc lồng, số thập phân `3.5`, chương ngắn < 5 đoạn, thơ/dòng phân cảnh, tách thoại gộp an toàn vs không tách câu có dẫn truyện xen giữa, split-retry khi lệch đoạn ở GĐ1/GĐ2, Non-Regression guard ở `evaluatePolishRoundFidelity`, và định vị `paragraphIndex` của `checkStructureParityIssues`)
- [X] T020 Chạy toàn bộ cổng chất lượng bắt buộc `npm run lint`, `npm test`, `npm run build` và kiểm tra không có bất kỳ hồi quy nào trên 111+ file test hiện có
- [X] T021 Rà soát `git diff` và `git status` đảm bảo không chạm `src/types.ts` hay IndexedDB schema và không có thay đổi ngoài phạm vi `166-strict-raw-structure-parity`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup)** → **Phase 2 (Foundational)**: Bắt buộc hoàn thành trước khi vào US1–US4.
- **Phase 3 (US1 - P1)** & **Phase 4 (US2 - P1)**: Có thể thực hiện nối tiếp nhanh trong `structureParity.ts`, sau đó tích hợp song song vào prompts và GĐ1/GĐ2.
- **Phase 5 (US3 - P1)**: Có thể thực hiện song song với US1/US2 trên `src/lib/text.ts` (`T012`), sau đó hợp nhất vào `prompts.ts` (`T013`–`T014`).
- **Phase 6 (US4 - P2)**: Phụ thuộc US1 & US2 (`analyzeStructureParity`, `normalizeTranslatedPunctuation`).
- **Phase 7 (Polish & Quality Gates)**: Chạy sau khi hoàn tất tất cả các phase trên.

### Parallel Opportunities
- `T006` (`bilingualSplit.ts`) và `T012` (`src/lib/text.ts`) có thể triển khai song song với các task trong `structureParity.ts` (`T005`, `T009`).
- `T017` (`targetedRepair.ts`) có thể triển khai song song với `T016` (`translationValidation.ts`).
- `T019` (`structureParity.test.ts`) có thể phát triển song song với `T018`.

### Suggested MVP Scope
- **MVP**: Hoàn thành **Phase 1 + Phase 2 + Phase 3 (US1) + Phase 4 (US2) + Phase 5 (US3)** — giải quyết trọn vẹn yêu cầu cốt lõi 1-1 về xuống dòng, dấu câu và cách ngắt câu ở cả GĐ1 và GĐ2; tiếp theo bổ sung Phase 6 (US4) để khóa chặt hậu kiểm tự động và cảnh báo kiểm duyệt.
