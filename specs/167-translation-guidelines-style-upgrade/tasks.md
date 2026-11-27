---
description: "Task list for Feature 167: Cáº£i tiáº¿n Cáº©m nang dá»‹ch thuáº­t, Quy táº¯c dá»‹ch, TÃ´ng giá»ng biÃªn táº­p & Thá»ƒ loáº¡i chÃ­nh"
---

# Tasks: Cáº£i Tiáº¿n Cáº©m Nang Dá»‹ch Thuáº­t, Quy Táº¯c Dá»‹ch, TÃ´ng Giá»ng BiÃªn Táº­p & Thá»ƒ Loáº¡i ChÃ­nh

**Input**: Design documents from `/specs/167-translation-guidelines-style-upgrade/`  
**Prerequisites**: [plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/167-translation-guidelines-style-upgrade/plan.md), [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/167-translation-guidelines-style-upgrade/spec.md), [research.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/167-translation-guidelines-style-upgrade/research.md), [data-model.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/167-translation-guidelines-style-upgrade/data-model.md), [translation-style-contracts.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/167-translation-guidelines-style-upgrade/contracts/translation-style-contracts.md), [quickstart.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/167-translation-guidelines-style-upgrade/quickstart.md)

**Organization**: CÃ¡c tÃ¡c vá»¥ Ä‘Æ°á»£c chia theo User Story (`US1`â€“`US4`) Ä‘á»ƒ má»—i giai Ä‘oáº¡n cÃ³ thá»ƒ triá»ƒn khai, kiá»ƒm thá»­ Ä‘á»™c láº­p vÃ  tÃ­ch há»£p sáºµn cÃ¡c chá»‘t an toÃ n vá» tÆ°Æ¡ng thÃ­ch test (`prompts.test.ts`), báº£o máº­t upload/prompt, lÆ°u nguyÃªn tá»­ trong modal vÃ  tÃ¡ch lá»c báº£ng glossary an toÃ n.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: CÃ³ thá»ƒ cháº¡y song song (khÃ¡c tá»‡p, khÃ´ng phá»¥ thuá»™c tÃ¡c vá»¥ chÆ°a hoÃ n thÃ nh)
- **[Story]**: Ãnh xáº¡ tá»›i User Story tÆ°Æ¡ng á»©ng (`[US1]`, `[US2]`, `[US3]`, `[US4]`) â€” Phase Setup, Foundational vÃ  Polish khÃ´ng gáº¯n nhÃ£n `[Story]`

---

## Phase 1: Setup & Security Guards

**Purpose**: Chuáº©n bá»‹ ngÆ°á»¡ng xá»­ lÃ½ tÃ i liá»‡u lá»›n vÃ  bá»™ kiá»ƒm tra an toÃ n cho tá»‡p cáº©m nang táº£i lÃªn

- [X] T001 Raise `GLOSSARY_LIMITS.MAX_CHARS_FOR_GUIDELINES_ANALYSIS` from `4000` to `24000` and add `MAX_GUIDELINES_UPLOAD_BYTES` (`5 * 1024 * 1024`) in `src/config/constants.ts`
- [X] T002 [P] Add `validateGuidelinesUploadFile(file: File)` validating `.md`/`.txt` extensions, `<= MAX_GUIDELINES_UPLOAD_BYTES`, and non-empty files (keeping `validateUploadFile` intact) in `src/utils/fileValidator.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Táº¡o nguá»“n chÃ¢n lÃ½ táº­p trung cho danh má»¥c Thá»ƒ loáº¡i, TÃ´ng giá»ng, phÃ¢n tÃ­ch/tuáº§n tá»± hÃ³a Cáº©m nang vÃ  phÃ¡t hiá»‡n mÃ¢u thuáº«n mÃ  má»i User Story Ä‘á»u sá»­ dá»¥ng

**âš ï¸ CRITICAL**: Cáº§n hoÃ n táº¥t Phase 2 trÆ°á»›c khi báº¯t Ä‘áº§u triá»ƒn khai cÃ¡c User Story

- [X] T003 Create unified domain module defining 17 built-in `GenreProfile`s (with Hanzi `sealChar`, `group`, `registerClass`, detailed `styleGuide`, `recommendedTones`, 5-section `starterTemplate`), 11 built-in `ToneProfile`s (with `'Trang nghiÃªm cá»• kÃ­nh'` â†’ `'Trang nghiÃªm cá»• phong'` legacy alias), custom genre/tone helpers, `getGenreStyleGuide`, `getToneStyleGuide`, `getRecommendedTonesForGenre`, `getGenreStarterTemplateText`, `parseStructuredGuidelines`, `serializeStructuredGuidelines`, `formatGuidelinesMarkdownExport`, `extractGuidelinesProseSection` (stripping Markdown tables and Hanzi/glossary-heading blocks while preserving Vietnamese rule bullets), `parseGuidelinesMarkdownLocal`, and `detectStyleConflicts` in `src/config/translationStyles.ts`
- [X] T004 [P] Re-export `getGenreStyleGuide` and `getToneStyleGuide` delegating to `src/config/translationStyles.ts` for full caller and test backward compatibility in `src/lib/text.ts`
- [X] T005 [P] Update `GenreMark` to resolve Hanzi `sealChar` from `getGenreProfile(genre)?.sealChar || 'å·'` in `src/config/translationStyles.ts` while keeping UI visual motif identical in `src/components/ui/GenreMark.tsx`

**Checkpoint**: Ná»n táº£ng danh má»¥c, hÃ m thuáº§n vÃ  `GenreMark` sáºµn sÃ ng â€” cÃ³ thá»ƒ triá»ƒn khai song song/tÄƒng dáº§n `US1`â€“`US4`.

---

## Phase 3: User Story 1 - Chuáº©n hÃ³a & má»Ÿ rá»™ng há»‡ thá»‘ng Thá»ƒ loáº¡i chÃ­nh kÃ¨m chá»‰ dáº«n vÄƒn phong chuyÃªn sÃ¢u (Priority: P1) ðŸŽ¯ MVP

**Goal**: Äá»“ng nháº¥t danh má»¥c 17 thá»ƒ loáº¡i + tÃ¹y chá»‰nh giá»¯a mÃ n hÃ¬nh táº¡o dá»± Ã¡n má»›i vÃ  chá»‰nh sá»­a dá»± Ã¡n trong workspace, gáº¯n bá»™ chá»‰ dáº«n chuyÃªn sÃ¢u cho tá»«ng thá»ƒ loáº¡i vÃ  gá»£i Ã½ tÃ´ng giá»ng phÃ¹ há»£p.

**Independent Test**: Má»Ÿ há»™p thoáº¡i táº¡o truyá»‡n má»›i vÃ  há»™p thoáº¡i chá»‰nh sá»­a dá»± Ã¡n Ä‘á»ƒ kiá»ƒm tra sá»± Ä‘á»“ng nháº¥t cá»§a 17 thá»ƒ loáº¡i + tÃ¹y chá»n tá»± nháº­p, lÆ°u má»™t thá»ƒ loáº¡i tÃ¹y chá»‰nh há»£p lá»‡ (cháº·n lÆ°u chuá»—i rá»—ng/khoáº£ng tráº¯ng), vÃ  cháº¡y test xÃ¡c nháº­n má»—i thá»ƒ loáº¡i tráº£ vá» chá»‰ dáº«n chuyÃªn sÃ¢u riÃªng biá»‡t.

### Tests for User Story 1

- [X] T006 [P] [US1] Write unit tests covering all 17 built-in `GenreProfile`s, distinct rich `styleGuide` strings, Hanzi `sealChar`, custom genre fallback, and `getRecommendedTonesForGenre` in `src/config/__tests__/translationStyles.test.ts`

### Implementation for User Story 1

- [X] T007 [US1] Create shared editor component skeleton with unified Primary Genre selector (grouped by `GenreGroup`, inline `GenreMark` seal preview, custom genre text input when `KhÃ¡c` is active with trimmed non-empty validation) adhering to Ink & Cinnabar design tokens in `src/components/common/StyleGuidelineEditor.tsx`
- [X] T008 [US1] Integrate `StyleGuidelineEditor` for the genre configuration block and enforce trimmed non-empty custom genre validation on submit in `src/components/project-list/ProjectFormModal.tsx` and `src/components/translator-workspace/ProjectMetadataModal.tsx`

**Checkpoint**: User Story 1 hoáº¡t Ä‘á»™ng Ä‘á»™c láº­p vÃ  kiá»ƒm thá»­ Ä‘Æ°á»£c á»Ÿ cáº£ hai mÃ n hÃ¬nh dá»± Ã¡n (MVP).

---

## Phase 4: User Story 2 - NÃ¢ng cáº¥p há»‡ thá»‘ng TÃ´ng giá»ng biÃªn táº­p vá»›i quy chuáº©n diá»…n Ä‘áº¡t cá»¥ thá»ƒ (Priority: P1)

**Goal**: Äá»“ng nháº¥t danh má»¥c 11 tÃ´ng giá»ng + tÃ¹y chá»‰nh vá»›i mÃ´ táº£ tÃ¡c Ä‘á»™ng trá»±c quan, gá»£i Ã½ tÆ°Æ¡ng thÃ­ch theo thá»ƒ loáº¡i, vÃ  truyá»n bá»™ quy chuáº©n hÃ nh vi cá»¥ thá»ƒ cá»§a tÃ´ng giá»ng vÃ o cáº£ 4 cÃ´ng Ä‘oáº¡n dá»‹ch thuáº­t (`Raw`, `Polish`, `QA Critique`, `Targeted Repair`).

**Independent Test**: Äá»‘i chiáº¿u danh má»¥c tÃ´ng giá»ng trÃªn mÃ n hÃ¬nh táº¡o má»›i vÃ  chá»‰nh sá»­a dá»± Ã¡n; cháº¡y test payload cho `buildRawTranslationPayload`, `buildPolishTranslationPayload`, `buildQaCritiquePayload` vÃ  `targetedRepair` vá»›i hai tÃ´ng giá»ng khÃ¡c nhau Ä‘á»ƒ xÃ¡c nháº­n quy chuáº©n diá»…n Ä‘áº¡t riÃªng biá»‡t Ä‘Æ°á»£c tiÃªm Ä‘áº§y Ä‘á»§ mÃ  khÃ´ng lÃ m há»ng Ä‘Ã¡nh sá»‘ rule `1..10` hay rule `8.` hiá»‡n cÃ³.

### Tests for User Story 2

- [X] T009 [P] [US2] Add unit tests verifying all 11 built-in `ToneProfile`s, legacy alias `'Trang nghiÃªm cá»• kÃ­nh'` â†’ `'Trang nghiÃªm cá»• phong'`, and custom tone handling in `getToneStyleGuide` inside `src/config/__tests__/translationStyles.test.ts`

### Implementation for User Story 2

- [X] T010 [US2] Extend `StyleGuidelineEditor` with unified Editing Tone selector (highlighting recommended tones for current genre, showing `shortDescription`, supporting custom tone input with trimmed non-empty validation) in `src/components/common/StyleGuidelineEditor.tsx`
- [X] T011 [US2] Inject `getToneStyleGuide(cleanTone)` alongside `getGenreStyleGuide(cleanGenre)` inside `buildRawTranslationPayload` (preserving rule `1..10` numbering and normalizing default tone to `'Trang nghiÃªm cá»• phong'`), `buildPolishTranslationPayload` (preserving rule `8.` numbering), and `buildQaCritiquePayload` in `src/services/ai/prompts.ts`
- [X] T012 [P] [US2] Update `buildTargetedRepairPayload` to inject both `getToneStyleGuide(cleanTone)` and `getGenreStyleGuide(cleanGenre)` while preserving strict 1-1 structure parity rules in `src/services/translation/targetedRepair.ts`

**Checkpoint**: User Stories 1 vÃ  2 hoáº¡t Ä‘á»™ng Ä‘á»™c láº­p, cáº£ 4 pha dá»‹ch thuáº­t Ä‘á»u nháº­n Ä‘á»§ chá»‰ dáº«n thá»ƒ loáº¡i vÃ  tÃ´ng giá»ng.

---

## Phase 5: User Story 3 - Cáº¥u trÃºc hÃ³a Cáº©m nang dá»‹ch thuáº­t & Quy táº¯c dá»‹ch, há»— trá»£ máº«u khá»Ÿi táº¡o vÃ  nháº­p/xuáº¥t Ä‘áº§y Ä‘á»§ (Priority: P1)

**Goal**: Cung cáº¥p trÃ¬nh soáº¡n tháº£o Cáº©m nang dá»‹ch thuáº­t 2 cháº¿ Ä‘á»™ (CÃ³ cáº¥u trÃºc 5 má»¥c â‡„ Markdown thÃ´ báº£o toÃ n dá»¯ liá»‡u cÅ©), chÃ¨n máº«u khá»Ÿi táº¡o theo thá»ƒ loáº¡i cÃ³ xÃ¡c nháº­n, nháº­p tá»‡p `.md` á»Ÿ cáº£ táº¡o má»›i láº«n chá»‰nh sá»­a dá»± Ã¡n khÃ´ng cáº¯t cá»¥t quy táº¯c cuá»‘i tá»‡p (cÃ³ fallback cá»¥c bá»™), hiá»ƒn thá»‹ xem trÆ°á»›c há»£p nháº¥t/ghi Ä‘Ã¨ vá»›i commit nguyÃªn tá»­ chá»‰ khi LÆ°u, vÃ  xuáº¥t `.md` chuáº©n hÃ³a.

**Independent Test**: ChÃ¨n máº«u khá»Ÿi táº¡o trÃªn dá»± Ã¡n trá»‘ng vÃ  dá»± Ã¡n Ä‘Ã£ cÃ³ ná»™i dung (kiá»ƒm tra há»i thay tháº¿/chÃ¨n thÃªm); nháº­p tá»‡p `.md` > 15.000 kÃ½ tá»± chá»©a báº£ng glossary lá»›n á»Ÿ Ä‘áº§u vÃ  quy táº¯c xÆ°ng hÃ´ á»Ÿ cuá»‘i Ä‘á»ƒ xÃ¡c nháº­n pháº§n quy táº¯c cuá»‘i tá»‡p váº«n hiá»‡n Ä‘á»§ trong khung xem trÆ°á»›c; thá»­ báº¥m Há»§y trÃªn modal Ä‘á»ƒ cháº¯c cháº¯n glossary hiá»‡n cÃ³ khÃ´ng bá»‹ thay Ä‘á»•i.

### Tests for User Story 3

- [X] T013 [P] [US3] Add unit tests covering `parseStructuredGuidelines`/`serializeStructuredGuidelines` round-trip (including legacy unstructured text preservation), `formatGuidelinesMarkdownExport`/`parseGuidelinesMarkdownLocal`, and `extractGuidelinesProseSection` (preserving Vietnamese rules & tail sections in >15,000-char `.md` files) in `src/config/__tests__/translationStyles.test.ts`

### Implementation for User Story 3

- [X] T014 [US3] Update `buildAnalyzeGuidelinesPayload` to call `sanitizePromptInput(params.guidelinesSection)`, reference all 17 genres and 11 tones as classification hints, and remove rigid schema `enum` locks in `src/services/ai/prompts.ts`
- [X] T015 [US3] Upgrade `analyzeGuidelinesDirect` to filter glossary blocks via `extractGuidelinesProseSection(text)`, apply `24000`-char head+tail budget (`18000` + `6000` reporting `truncated`, `proseLength`, `analyzedLength`), fall back cleanly to `parseGuidelinesMarkdownLocal` (`analysisMode: 'local_fallback'`) when offline/missing keys/AI error, and retain full compatibility with `useGlossaryState` in `src/services/directGlossaryEngine.ts`
- [X] T016 [P] [US3] Create `GuidelineImportPreview` component displaying detected `genre`, `tone`, `description`, `extractedGlossary` count, truncation/`local_fallback` notices, and per-field actions (`apply`/`keep`, `replace`/`merge`/`keep`, defaulting glossary to `'merge'` on existing projects with inline confirmation before `'replace'`) in `src/components/common/GuidelineImportPreview.tsx`
- [X] T017 [US3] Extend `StyleGuidelineEditor` with dual-mode rules editor (Structured 5-section inputs â‡„ Raw Markdown textarea without mutating untouched legacy text), 1-click genre starter template insertion (inline Replace/Append/Cancel guard), unified `.md` guideline upload (`validateGuidelinesUploadFile` â†’ `analyzeGuidelinesDirect` â†’ `GuidelineImportPreview`), and sanitized `.md` export download in `src/components/common/StyleGuidelineEditor.tsx`
- [X] T018 [US3] Wire atomic staged glossary & metadata commit on form Save (discarded cleanly on Cancel), remove duplicate Box 2 `.md` upload section from `ProjectFormModal`, pass workspace `apiKeys`/`selectedModel`/`showToast`/`existingGlossaryCount` to `ProjectMetadataModal`, and validate `editGenre`/`editTone` non-empty in `handleSaveMetadata` across `src/components/project-list/ProjectFormModal.tsx`, `src/components/translator-workspace/ProjectMetadataModal.tsx`, `src/components/TranslatorWorkspace.tsx`, and `src/hooks/useWorkspaceState.ts`

**Checkpoint**: User Story 3 hoÃ n thiá»‡n luá»“ng soáº¡n tháº£o, máº«u khá»Ÿi táº¡o, nháº­p khÃ´ng cáº¯t cá»¥t vÃ  xuáº¥t `.md` Ä‘á»“ng bá»™ á»Ÿ cáº£ 2 mÃ n hÃ¬nh dá»± Ã¡n.

---

## Phase 6: User Story 4 - Kiá»ƒm tra mÃ¢u thuáº«n cáº¥u hÃ¬nh & Ã¡p dá»¥ng nháº¥t quÃ¡n theo thá»© tá»± Æ°u tiÃªn (Priority: P2)

**Goal**: Cáº£nh bÃ¡o nháº¹ theo thá»i gian thá»±c khi Thá»ƒ loáº¡i, TÃ´ng giá»ng vÃ  Quy táº¯c dá»‹ch mÃ¢u thuáº«n nhau kÃ¨m nÃºt Ä‘iá»u chá»‰nh má»™t cháº¡m khÃ´ng cháº·n lÆ°u; Ä‘á»“ng thá»i báº£o Ä‘áº£m thá»© tá»± Æ°u tiÃªn phÃ¢n xá»­ nháº¥t quÃ¡n xuyÃªn suá»‘t cáº£ 4 pha dá»‹ch thuáº­t vÃ  khÃ³a cháº·t cáº¥u trÃºc 1-1.

**Independent Test**: Chá»n cáº·p xung Ä‘á»™t (`ÄÃ´ Thá»‹` + `Trang nghiÃªm cá»• phong`, hoáº·c lá»‡nh cáº¥m HÃ¡n-Viá»‡t + `Trang nghiÃªm cá»• phong`) Ä‘á»ƒ kiá»ƒm tra banner cáº£nh bÃ¡o + gá»£i Ã½ 1 cháº¡m nhÆ°ng váº«n lÆ°u Ä‘Æ°á»£c; cháº¡y unit test kiá»ƒm chá»©ng hierarchy `#1 NguyÃªn tÃ¡c & Tá»« Ä‘iá»ƒn & 1-1 > #2 Quy táº¯c riÃªng > #3 TÃ´ng giá»ng > Thá»ƒ loáº¡i` trÃªn `prompts.ts` vÃ  `targetedRepair.ts`.

### Tests for User Story 4

- [X] T019 [P] [US4] Add unit tests for `detectStyleConflicts` covering genre-tone mismatches, rule-tone conflicts (banning Han-Viet with high-Han-Viet tone), and zero false positives on compatible pairs in `src/config/__tests__/translationStyles.test.ts`

### Implementation for User Story 4

- [X] T020 [US4] Render non-blocking `StyleConflictWarning` banner (`amber-950/amber-300` design tokens, optional 1-click suggested tone button) inside `src/components/common/StyleGuidelineEditor.tsx`
- [X] T021 [US4] Refine `buildInstructionPriorityBlock` in `src/services/ai/prompts.ts` and priority rules in `src/services/translation/targetedRepair.ts` to declare explicit precedence (`#1 NguyÃªn tÃ¡c & Tá»« Ä‘iá»ƒn & 1-1 > #2 Cáº©m nang & Quy táº¯c riÃªng > Há»“ sÆ¡ nhÃ¢n váº­t > YÃªu cáº§u bá»• sung > #3 TÃ´ng giá»ng biÃªn táº­p > Thá»ƒ loáº¡i chÃ­nh`) while preserving all existing `prompts.test.ts` assertions
- [X] T022 [P] [US4] Add regression tests for 4-stage style guide injection, precedence block ordering, `sanitizePromptInput` in `buildAnalyzeGuidelinesPayload`, `targetedRepair` style directives, and >15,000-char `.md` local fallback in `src/services/ai/__tests__/prompts.test.ts`, `src/services/__tests__/directGlossaryEngine.test.ts`, and `src/services/translation/__tests__/targetedRepair.test.ts`

**Checkpoint**: ToÃ n bá»™ 4 User Story (`US1`â€“`US4`) hoáº¡t Ä‘á»™ng phá»‘i há»£p Ä‘áº§y Ä‘á»§ vÃ  cÃ³ test báº£o vá»‡.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: XÃ¡c minh há»“i quy toÃ n bá»™ repository, Ä‘áº£m báº£o khÃ´ng phÃ¡ vá»¡ thay Ä‘á»•i Ä‘ang cÃ³ vÃ  khá»›p 100% tÃ i liá»‡u kiá»ƒm thá»­

- [X] T023 [P] Run targeted unit & hook regression suites (`translationStyles.test.ts`, `text.test.ts`, `prompts.test.ts`, `directGlossaryEngine.test.ts`, `targetedRepair.test.ts`, and `src/hooks/__tests__/useGlossaryIO.test.ts`)
- [X] T024 Run full mandatory quality gates (`npm run lint`, `npm test`, `npm run build`) and resolve any type/test/build issues without weakening assertions
- [X] T025 Review final `git status -s` and `git diff --stat` confirming `src/types.ts`, IndexedDB schema, and existing uncommitted Features 165/166 files are untouched, and validate against `specs/167-translation-guidelines-style-upgrade/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1: `T001`â€“`T002`)**: KhÃ´ng phá»¥ thuá»™c â€” cÃ³ thá»ƒ cháº¡y song song ngay tá»« Ä‘áº§u.
- **Foundational (Phase 2: `T003`â€“`T005`)**: Phá»¥ thuá»™c `T001` (náº¿u cáº§n háº±ng sá»‘); **cháº·n toÃ n bá»™ `US1`â€“`US4`**. `T004` vÃ  `T005` cÃ³ thá»ƒ cháº¡y song song ngay sau `T003`.
- **User Story 1 (Phase 3: `T006`â€“`T008`)**: Phá»¥ thuá»™c Phase 2 â€” lÃ  ná»n táº£ng `StyleGuidelineEditor` cho giao diá»‡n cá»§a `US2`, `US3`, `US4`.
- **User Story 2 (Phase 4: `T009`â€“`T012`)**: `T009`, `T011`, `T012` cÃ³ thá»ƒ cháº¡y ngay sau Phase 2; `T010` má»Ÿ rá»™ng `StyleGuidelineEditor` sau `T007`.
- **User Story 3 (Phase 5: `T013`â€“`T018`)**: `T013`, `T014`, `T015`, `T016` cÃ³ thá»ƒ cháº¡y song song sau `T001`â€“`T003`; `T017` phá»¥ thuá»™c `T010`, `T015`, `T016`; `T018` phá»¥ thuá»™c `T008` vÃ  `T017`.
- **User Story 4 (Phase 6: `T019`â€“`T022`)**: `T019` cháº¡y ngay sau `T003`; `T020` má»Ÿ rá»™ng `StyleGuidelineEditor` sau `T017`; `T021` sau `T011` & `T012`; `T022` sau `T014`, `T015`, `T021`.
- **Polish (Phase 7: `T023`â€“`T025`)**: Cháº¡y sau khi hoÃ n táº¥t cÃ¡c story Ä‘Ã£ chá»n.

### Parallel Opportunities

```text
# Phase 1:
T001 (src/config/constants.ts) || T002 (src/utils/fileValidator.ts)

# Sau T003:
T004 (src/lib/text.ts) || T005 (src/components/ui/GenreMark.tsx) || T006 (translationStyles.test.ts) || T013 || T014 || T015 || T016 || T019

# Táº§ng AI prompts & targeted repair (US2 / US4):
T011 (src/services/ai/prompts.ts) || T012 (src/services/translation/targetedRepair.ts)
```

---

## Implementation Strategy

### MVP First (Phase 1 + Phase 2 + User Story 1)

1. HoÃ n táº¥t Phase 1 (`T001`â€“`T002`) vÃ  Phase 2 (`T003`â€“`T005`).
2. HoÃ n táº¥t Phase 3 (`T006`â€“`T008`) Ä‘á»ƒ bÃ n giao **Thá»ƒ loáº¡i chÃ­nh** Ä‘á»“ng nháº¥t, 17 dÃ²ng truyá»‡n + tÃ¹y chá»‰nh vÃ  bá»™ chá»‰ dáº«n chuyÃªn sÃ¢u (MVP).
3. Kiá»ƒm chá»©ng nhanh `translationStyles.test.ts` + `npm run lint`.

### Incremental Delivery

1. **Increment 1 (`US1`)**: Thá»ƒ loáº¡i chÃ­nh má»Ÿ rá»™ng & Ä‘á»“ng nháº¥t.
2. **Increment 2 (`US2`)**: TÃ´ng giá»ng biÃªn táº­p 11 cáº¥p sáº¯c thÃ¡i + truyá»n xuyÃªn suá»‘t 4 cÃ´ng Ä‘oáº¡n dá»‹ch.
3. **Increment 3 (`US3`)**: Soáº¡n tháº£o 5 má»¥c / thÃ´, máº«u theo thá»ƒ loáº¡i, nháº­p `.md` khÃ´ng cáº¯t cá»¥t (cÃ³ xem trÆ°á»›c & fallback cá»¥c bá»™) vÃ  xuáº¥t `.md`.
4. **Increment 4 (`US4`)**: Cáº£nh bÃ¡o mÃ¢u thuáº«n khÃ´ng cháº·n lÆ°u + khÃ³a cháº·t thá»© tá»± Æ°u tiÃªn & cháº¡y full quality gates (`T023`â€“`T025`).

## Notes

- TuÃ¢n thá»§ `.agents/rules/design-system.md` ("Má»±c & Chu Sa"): khÃ´ng dÃ¹ng emoji ná»n táº£ng (`âœ¨`, `âš”ï¸`, ...); dÃ¹ng `GenreMark`, `Button`, `Badge`, `cn()`, mÃ u cáº£nh bÃ¡o `amber-950`/`amber-300`.
- KhÃ´ng thay Ä‘á»•i `src/types.ts` vÃ  schema IndexedDB (`Constitution Principle IV`).
- KhÃ´ng lÃ m thay Ä‘á»•i báº¥t biáº¿n cáº¥u trÃºc 1-1 (`structureParity`) vÃ  giá»¯ nguyÃªn cÃ¡c assertion hiá»‡n cÃ³ trong `prompts.test.ts` vÃ  `text.test.ts`.
