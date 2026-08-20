# Tasks: Pipeline Translation Hardening (BUG 1 & BUG 2)

**Feature**: `specs/034-pipeline-translation-fixes/spec.md`  
**Plan**: `specs/034-pipeline-translation-fixes/plan.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish helper signatures, constants, and test fixtures for title preservation and Chinese character detection.

- [X] T001 Define helper function signatures and exports in `server/utils/text.ts`
- [X] T002 [P] Create mock fixtures and sample chapter texts in `server/utils/__tests__/textTestFixtures.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core string analysis and validation logic that MUST be complete before pipeline integration.

- [X] T003 Implement `countChineseCharacters(text)` and `calculateChineseCharRatio(text)` using native Unicode Han regex in `server/utils/text.ts`
- [X] T004 [P] Implement `validateTranslationOutput(text, minLength, maxRatio)` throwing `UNTRANSLATED_CHINESE_LEFTOVER` in `server/utils/text.ts`
- [X] T005 [P] Implement `isChapterTitleLine(line)` and `extractChapterTitle(text)` in `server/utils/text.ts`
- [X] T006 [P] Implement `ensureChapterTitlePreserved(rawText, polishedText)` in `server/utils/text.ts`

---

## Phase 3: User Story 1 - Bảo tồn 100% Tiêu đề chương qua Giai đoạn 2 (Priority: P1) 🎯 MVP

**Goal**: Đảm bảo tiêu đề chương ở Giai đoạn 1 (Dịch thô) được giữ nguyên vẹn trên dòng đầu tiên ở Giai đoạn 2 (Chuốt văn/Biên tập), tự động khôi phục nếu model vô tình lược bỏ.

**Independent Test**: Truyền bản thô `Chương 1: ABC\n\nNội dung` và bản chuốt chỉ có `Nội dung đã chuốt` (mất tiêu đề); gọi `ensureChapterTitlePreserved` và xác minh kết quả trả về `Chương 1: ABC\n\nNội dung đã chuốt`.

### Tests for User Story 1 🧪

- [X] T007 [P] [US1] Write unit tests in `server/utils/__tests__/text.test.ts` for title detection, title preservation, and dropped title restoration

### Implementation for User Story 1

- [X] T008 [US1] Integrate `ensureChapterTitlePreserved` into `callPolishDirect` and `polishWithContentSplit` in `server/controllers/translation/polishController.ts`
- [X] T009 [US1] Harden prompt and system instruction in `server/controllers/translation/polishController.ts` for invariant chapter titles

---

## Phase 4: User Story 2 - Tự động phát hiện bản dịch sót chữ Hán & Kích hoạt Retry Divide & Conquer (Priority: P1) 🎯 MVP

**Goal**: Tự động phát hiện khi kết quả AI trả về chứa tỉ lệ ký tự Hán bất thường (> 10%) và kích hoạt cơ chế chia nhỏ Adaptive Split Retry.

**Independent Test**: Gọi `validateTranslationOutput` với văn bản chứa 80% chữ Hán; xác minh ném lỗi `UNTRANSLATED_CHINESE_LEFTOVER` và `isSafetyOrEmptyError` trả về `true`.

### Tests for User Story 2 🧪

- [X] T010 [P] [US2] Write unit tests in `server/utils/__tests__/text.test.ts` for Chinese character counting, ratio calculation, and validation threshold exceptions

### Implementation for User Story 2

- [X] T011 [US2] Update `isSafetyOrEmptyError` in `server/services/geminiService.ts` to recognize `UNTRANSLATED_CHINESE_LEFTOVER`
- [X] T012 [US2] Integrate `validateTranslationOutput` into `callRawTranslationDirect` in `server/controllers/translation/rawController.ts` and `callPolishDirect` in `server/controllers/translation/polishController.ts`

---

## Phase 5: User Story 3 - Củng cố Chỉ thị & Đồng bộ Divide & Conquer (Priority: P2)

**Goal**: Đồng bộ bảo toàn cấu trúc tiêu đề và ngưỡng ký tự Hán khi chạy qua Divide & Conquer và Segment Translation.

**Independent Test**: Giả lập model trả về nguyên tác tiếng Trung trong `translateRawWithContentSplit`, xác minh hệ thống kích hoạt split và dịch lại thành công.

### Tests for User Story 3 🧪

- [X] T013 [P] [US3] Write integration tests in `server/controllers/__tests__/translationController.test.ts` simulating model dropping titles and model returning untranslated Chinese

### Implementation for User Story 3

- [X] T014 [US3] Ensure Divide & Conquer and Segment Translation only attach chapter titles to chunk index 0 in `server/controllers/translation/rawController.ts` and `server/controllers/translation/polishController.ts`

---

## Phase 6: Polish & Quality Gates

**Purpose**: Verify translation routes integration, run full quality gates, and execute quickstart validation.

- [X] T015 [P] Run full quality gate checks (`npm run lint`, `npm test`, `npm run build`) and verify 0 regressions
- [X] T016 Execute quickstart validation scenarios from `specs/034-pipeline-translation-fixes/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1: Setup (T001, T002)
   │
   ▼
Phase 2: Foundational (T003, T004, T005, T006) [BLOCKS ALL USER STORIES]
   │
   ├──────────────────────────────┬──────────────────────────────┐
   ▼                              ▼                              ▼
Phase 3: User Story 1 (P1)    Phase 4: User Story 2 (P2)    Phase 5: User Story 3 (P3)
(T007 -> T008, T009)           (T010 -> T011, T012)           (T013 -> T014)
   │                              │                              │
   └──────────────────────────────┼──────────────────────────────┘
                                  ▼
                     Phase 6: Polish & Quality Gates
                     (T015, T016)
```
