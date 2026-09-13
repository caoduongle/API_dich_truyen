# Feature Specification: Anti-Scraping Invisible Character Stripping, NFC Normalization & Storage Usage Visibility

**Feature Branch**: `127-textcleaner-storage-estimate`

**Created**: 2026-09-13

**Status**: Draft

**Input**: User prompt detailing:
- Nhóm B: Bổ sung vào hàm `cleanChineseText` trong `src/utils/textCleaner.ts` việc loại bỏ các ký tự vô hình chống cào (\u200B, \uFEFF, \u200D, \u200C) và chuẩn hóa Unicode NFC (`.normalize('NFC')`); viết test đầy đủ, đảm bảo không phá vỡ `separateChapterTitleAndBody` hay lọc watermark.
- Nhóm C: Tận dụng `estimateStorageUsage()` từ `src/services/db.ts` để hiển thị dung lượng IndexedDB đã dùng trong màn hình Cài đặt (`ApiSettings.tsx`), cập nhật khi mở và khi nhấn nút làm mới thủ công; ẩn khối UI nếu hàm trả về `null` thay vì hiện số 0.
- Nhóm D (Ranh giới phạm vi / Trì hoãn): Giữ nguyên Dockerfile, không tự ý thêm PWA hay Web Crypto khi chưa có yêu cầu phạm vi lớn; không can thiệp cách xử lý `opencc-js` trong `vite.config.ts`.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean Invisible Anti-Scraping Characters & Enforce Unicode NFC Normalization (Priority: P1)

As a translator importing raw Chinese web novels from various online aggregators, I want the raw text cleaner to automatically strip hidden anti-scraping zero-width characters (Zero-Width Space, BOM, Zero-Width Joiner, Zero-Width Non-Joiner) and normalize decomposed unicode characters into canonical NFC form, so that AI translation engines and glossary extractors receive pristine, contiguous Chinese text without tokenization fragmentation or dictionary lookup failures.

**Why this priority**: Web novel scrapers insert zero-width characters inside Chinese compounds or sentences to break copy-paste algorithms and automated tools. When fed into Gemini, these invisible tokens fragment Chinese word tokens, cause hallucinations, or disrupt glossary exact matching.

**Independent Test**: Provide dirty Chinese sample texts containing `\u200B`, `\uFEFF`, `\u200D`, and `\u200C` embedded within words, alongside decomposed Unicode characters. Run `cleanChineseText()` and assert that all zero-width characters are eliminated, the text is NFC-normalized, and title separation remains intact.

**Acceptance Scenarios**:

1. **Given** a Chinese text containing zero-width spaces (`\u200B`), byte order mark (`\uFEFF`), zero-width joiner (`\u200D`), and zero-width non-joiner (`\u200C`) embedded inside words, **When** `cleanChineseText` is executed, **Then** all zero-width characters are completely removed from the text.
2. **Given** a raw text string with decomposed Unicode characters (e.g. NFD), **When** `cleanChineseText` processes the string, **Then** the final output is normalized to canonical Unicode NFC (`.normalize('NFC')`).
3. **Given** a text requiring chapter title separation, **When** `separateChapterTitleAndBody` processes the output of `cleanChineseText`, **Then** chapter title detection, newline spacing, and watermark removal continue to operate identically without regression.

---

### User Story 2 - IndexedDB Storage Usage Transparency in Settings (Priority: P2)

As a translator managing multiple long-running novel projects with hundreds of chapters stored in browser IndexedDB, I want to see how much browser storage is currently used and available from the Settings modal, with the ability to refresh the measurement on demand, so that I can monitor local database capacity before storage limits are reached.

**Why this priority**: "Bản Thảo Chu Sa" is a pure client-side SPA where IndexedDB is the single source of truth. Users need visibility into local disk usage without guessing whether their browser is running out of allocated storage.

**Independent Test**: Open the Settings modal (`ApiSettings.tsx`) and verify that local storage usage (used bytes, quota, percentage, and progress bar) is fetched via `estimateStorageUsage()` and rendered. Click the "Làm mới" button and verify that storage figures update. Simulate an unsupported browser environment where `estimateStorageUsage()` resolves to `null` and assert that the storage widget is gracefully hidden.

**Acceptance Scenarios**:

1. **Given** the user opens the Settings modal (`ApiSettings.tsx`), **When** the component mounts, **Then** it automatically invokes `estimateStorageUsage()` and displays the current IndexedDB storage consumption (formatted usage, quota, and percentage progress indicator).
2. **Given** the storage usage card is rendered in Settings, **When** the user clicks the manual refresh button ("Làm mới dung lượng"), **Then** the estimate is re-queried from `navigator.storage.estimate()` and the UI updates smoothly.
3. **Given** a browser or private mode environment where `navigator.storage.estimate()` is unavailable or throws an error (returning `null`), **When** the storage widget evaluates the state, **Then** it renders nothing (`null`) instead of displaying misleading 0% or empty figures.

---

### Edge Cases

- **What happens when Chinese text is empty, null, or undefined?**: `cleanChineseText` returns `""` immediately without throwing errors.
- **What happens when text contains only zero-width characters and spaces?**: The cleaner trims all invisible characters and returns an empty string `""`.
- **What happens when storage quota is near capacity (e.g. >= 80%)?**: The storage display flags `isNearLimit` with an amber/warning visual badge to notify the user to export or clean up old projects.
- **What happens if `navigator.storage.estimate()` rejects with Permission Denied?**: The existing `estimateStorageUsage()` implementation catches the exception and returns `null`; the Settings component handles `null` by safely concealing the storage section.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `cleanChineseText` in `src/utils/textCleaner.ts` MUST strip all occurrences of Zero-Width Space (`\u200B`), Byte Order Mark (`\uFEFF`), Zero-Width Joiner (`\u200D`), and Zero-Width Non-Joiner (`\u200C`).
- **FR-002**: `cleanChineseText` in `src/utils/textCleaner.ts` MUST normalize the resulting text string to Unicode Normalization Form C (`.normalize('NFC')`) before returning.
- **FR-003**: Unit test suite `src/utils/__tests__/textCleaner.test.ts` MUST include dedicated test assertions verifying zero-width character stripping and NFC normalization, while confirming zero regressions in `cleanChineseText` and `separateChapterTitleAndBody`.
- **FR-004**: System MUST add a local storage estimation display in `src/components/ApiSettings.tsx` (or dedicated subcomponent `src/components/api-settings/StorageUsageSection.tsx`) utilizing `estimateStorageUsage()` from `src/services/db.ts`.
- **FR-005**: The storage display MUST query storage usage upon mount and provide a manual refresh trigger allowing users to re-estimate usage at any time.
- **FR-006**: The storage display MUST gracefully hide (render `null`) whenever `estimateStorageUsage()` returns `null`, preventing false 0% indicators on unsupported browsers or restricted contexts.
- **FR-007**: Scope boundaries MUST be strictly honored:
  - DO NOT add PWA plugin (`vite-plugin-pwa`) or offline service worker until explicitly confirmed.
  - DO NOT implement Web Crypto AES-GCM for API keys in this scope.
  - DO NOT delete or archive `Dockerfile` or `.dockerignore`.
  - DO NOT alter `opencc-js` configuration in `vite.config.ts`.

### Key Entities

- **StorageUsageEstimate**: Entity defined in `src/services/db.ts` containing `usage` (number), `quota` (number), `percentUsed` (number), `isNearLimit` (boolean), `formattedUsage` (string), and `formattedQuota` (string).
- **CleanedChineseText**: Sanitized string output free of advertising noise, HTML entities, zero-width characters, and normalized to canonical NFC.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of zero-width characters (`\u200B`, `\uFEFF`, `\u200D`, `\u200C`) are stripped from Chinese raw text input during preprocessing.
- **SC-002**: 100% of processed text outputs from `cleanChineseText` are verified to be in canonical Unicode NFC format.
- **SC-003**: Settings modal displays real-time IndexedDB storage metrics when supported, and accurately hides the widget when unsupported.
- **SC-004**: All quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly with 0 type errors and 100% passing tests.

---

## Assumptions

- Users import novel chapters from various third-party novel websites that employ zero-width anti-crawling techniques.
- Modern browsers (Chrome, Edge, Firefox, Safari) support `navigator.storage.estimate()` in standard contexts, but private/incognito modes may restrict or mock it.
- Existing translation pipelines (`directTranslationEngine.ts`, `chapterTranslationService.ts`) continue to rely on `cleanChineseText` for initial text sanitization.

