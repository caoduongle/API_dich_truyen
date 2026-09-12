# Feature Specification: Hako Truncation and Omission Detection

**Feature Branch**: `120-hako-truncation-omission-detection`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "hãy kiểm tra xem phần kiểm định hoạt động như thế nào; rõ ràng lỗi chềnh ềnh ra đấy; là chương trên bị thiếu 1 khoảng rất lớn; mà nó lại báo là không có lỗi gì; tôi đang dùng tab kiểm định hako"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Heuristic Length & Omission Guard in Hako Checker (Priority: P1)

As a moderator/translator inspecting translated chapters in the Hako Quality Checker (`HakoCheckerWorkspace`), when I run quality inspection on a chapter that is severely truncated (e.g. only 80 words while the original Chinese chapter has over 1,000 characters, or only 1 paragraph while the source has multiple paragraphs), the heuristic inspection engine (`runHeuristicQualityScan`) MUST immediately flag this as a critical quality issue (`category: 'omission'`, `severity: 'critical'`), displaying a clear explanation of the length discrepancy and the missing content.

**Why this priority**: Silent omissions and severed translations are the single most damaging quality failure in novel publishing. Missing 90%+ of a chapter breaks narrative continuity completely. The heuristic scan must catch this 100% deterministically and instantaneously without relying on or burning AI tokens.

**Independent Test**:
Pass a chapter with 80 Vietnamese words and a 2,000-character Chinese raw text to `runHeuristicQualityScan`; verify that it returns an issue with `category: 'omission'`, `severity: 'critical'`, containing explicit metrics (Vietnamese word count vs Chinese char count and ratio) and suggested remediation ("Dịch lại chương hoặc dịch bổ sung phần còn thiếu").

**Acceptance Scenarios**:

1. **Given** a chapter with 2,000 characters of Chinese `rawChineseContent` and only 80 words of `vietnameseContent`, **When** heuristic scan runs, **Then** an issue is generated with `category: 'omission'`, `severity: 'critical'`, explaining that the translation covers less than 35% of the original content.
2. **Given** a Chinese source text with >= 3 paragraphs and a Vietnamese translation with only 1 paragraph whose length is < 50% of the source, **When** heuristic scan runs, **Then** an issue is generated flagging paragraph and structural truncation.
3. **Given** a chapter without raw Chinese text available, but marked as translated (`polished` or `raw`) with an abnormally short length (< 150 words), **When** heuristic scan runs, **Then** an issue is generated with `category: 'omission'`, `severity: 'major'`, warning about abnormal chapter brevity and possible truncation.
4. **Given** a legitimately short chapter (e.g. author notice of 60 words matching a 50-character Chinese raw), **When** heuristic scan runs, **Then** no omission error is falsely generated.

---

### User Story 2 - Seamless Raw Chinese Resolution in Hako Session (Priority: P1)

As a user opening the Hako Quality Checker, whenever a project is loaded, the system MUST automatically resolve and associate the original Chinese source text (`sourceText`) from IndexedDB for each chapter so that both heuristic comparison and AI bilingual audit have access to the raw text without requiring the user to manually click "+ Thêm Raw" and paste text for every chapter.

**Why this priority**: If `rawChineseContent` is missing in the review session state, the AI prompt strips out raw comparison, stripping categories `omission`, `mistranslation`, and `hallucination` entirely, blinding the audit engine to missing text.

**Independent Test**:
Select a project in Hako Checker where chapters in IndexedDB have `sourceText`; verify that chapter cards in `HakoChapterSelector` display "Đã có Raw" (or indicate raw availability) and that `chData.rawChineseContent` is automatically fed into both heuristic and AI scan pipelines.

**Acceptance Scenarios**:

1. **Given** a project with chapters stored in IndexedDB containing `sourceText`, **When** the project is loaded into `HakoCheckerWorkspace` or chapters are queued for inspection, **Then** `rawChineseContent` is automatically loaded from the database record rather than remaining `undefined`.
2. **Given** chapters with populated `sourceText` in IndexedDB, **When** rendered in `HakoChapterSelector`, **Then** the chapter badge indicates "Đã có Raw" instead of prompting "+ Thêm Raw".
3. **Given** a chapter whose raw modal is opened by clicking "+ Thêm Raw" or "Đã có Raw", **When** the modal renders, **Then** the system automatically loads `sourceText` from `getChapterFromDB(chapterId)` into the textarea and displays the actual character count instead of showing "Chưa có dữ liệu".

---

### User Story 3 - AI Audit Schema & Prompt Hardening for Omission (Priority: P2)

As an auditor utilizing Gemini AI deep critique in Hako Checker (`runAiQualityScan`), when a chapter has missing text, the AI prompt must explicitly instruct the model to verify chapter completeness against the full raw text. Furthermore, the response parser MUST NOT discard omission issues simply because `vietnameseSnippet` cannot point to missing Vietnamese text; it must allow `vietnameseSnippet` to reference the truncation point or fallback to `rawSnippet`.

**Why this priority**: When text is missing, there is literally no Vietnamese snippet to quote. Requiring `vietnameseSnippet` in the schema and dropping any issue without it (`if (!item.vietnameseSnippet) continue;`) silently discards legitimate omission issues returned by the AI.

**Independent Test**:
Simulate Gemini returning an omission issue where `vietnameseSnippet` is empty or describes the truncation point while `rawSnippet` quotes the omitted Chinese paragraphs; verify that `runAiQualityScan` retains the issue and correctly populates the Hako review list.

**Acceptance Scenarios**:

1. **Given** an AI response containing an omission issue where `vietnameseSnippet` is empty or generic, **When** parsed by `runAiQualityScan`, **Then** the issue is preserved with a valid fallback snippet (e.g. "[Đoạn kết bị cụt: ...]" or the last translated sentence) and displayed in the review list.
2. **Given** a bilingual inspection prompt sent to Gemini, **When** comparing raw and translation, **Then** the system instructions explicitly mandate checking for cut-offs, premature endings, and large omitted sections as critical issues.

---

### User Story 4 - One-Click Navigation to Translation Workspace for Recovery (Priority: P3)

As a moderator who identifies a truncated or incomplete chapter in Hako Checker, I want an action button on the issue card to directly "Mở trong bàn dịch để dịch lại" (Open in Translator Workspace to re-translate), passing the chapter ID and activating the Retranslate Integrity Guard workflow (from Feature 119) so I can immediately fix the missing content.

**Why this priority**: Finding an error is only half the battle; giving the user a 1-click pathway to re-translate and restore the missing text closes the loop seamlessly.

**Independent Test**:
Click "Mở trong bàn dịch" on an omission issue card in `HakoIssueCard`; verify that the app switches to the Translator Workspace tab with the corresponding chapter selected.

**Acceptance Scenarios**:

1. **Given** an omission issue in `HakoIssueReviewPanel`, **When** user clicks the navigation button, **Then** the application triggers `onOpenInTranslator(chapterId)` and focuses the chapter in the Translator Workspace.

---

## Edge Cases

- **Legitimately short author notes / teaser chapters**:
  Chapters with short source text (e.g. <= 150 Chinese characters) must not be flagged as truncated if the translation matches the length proportionally.
- **Pure dialogue or poetry chapters**:
  Text with low character density but matching paragraph structures must be evaluated with generous tolerance so non-standard layouts aren't falsely reported.
- **Network timeout / AI token overflow mid-inspection**:
  If Gemini exhausts context or errors out during AI scan, the heuristic scan results MUST still be displayed and preserved, ensuring the user sees the length/omission warning even if AI fails.
- **Projects imported without Chinese raw**:
  When a project only has translated text (e.g. imported from .txt or .docx), the system must fallback to absolute length sanity heuristics (e.g. < 150 words for a finished chapter) while clearly stating that raw Chinese comparison is unavailable.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `runHeuristicQualityScan` MUST accept `rawChineseContent?: string` and evaluate draft completeness using character/word ratio and paragraph structure heuristics.
- **FR-002**: If `rawChineseContent` has > 150 characters and `vietnameseContent` has a character count < 35% of the raw length, `runHeuristicQualityScan` MUST emit a `critical` severity issue with category `omission`.
- **FR-003**: If `rawChineseContent` has >= 3 paragraphs but `vietnameseContent` has <= 1 paragraph and length < 50% of the raw, `runHeuristicQualityScan` MUST emit a `critical` severity issue with category `omission`.
- **FR-004**: If `rawChineseContent` is absent or empty, but `vietnameseContent` has < 150 words and chapter status indicates completion, `runHeuristicQualityScan` MUST emit a `major` severity issue with category `omission` warning of abnormal brevity.
- **FR-005**: `HakoCheckerWorkspace`, `useHakoReviewSession`, and `HakoChapterSelector` MUST automatically hydrate `rawChineseContent` from `Chapter.sourceText` in IndexedDB (both during inspection and when opening the raw text modal), ensuring the textarea is never empty when `sourceText` exists in the database.
- **FR-006**: In `runAiQualityScan`, the JSON schema for issues MUST allow `vietnameseSnippet` to be optional or nullable when `category === 'omission'`, and the parser MUST NOT drop omission issues if `rawSnippet` and `explanation` are present.
- **FR-007**: The AI prompt in `runAiQualityScan` MUST explicitly mandate checking for chapter completeness, sudden cut-offs, and omitted paragraphs.
- **FR-008**: The report generator (`generateQualityReport`) and audit bridge (`auditBridgeService`) MUST properly format and prioritize `omission` issues in export summaries and audit score calculations.

### Key Entities

- **QualityIssue**:
  - `category`: includes `'omission'` for missing/truncated text.
  - `severity`: `'critical'` for severe truncation (> 60% missing), `'major'` for suspicious brevity (< 150 words without raw).
  - `vietnameseSnippet`: Last translated sentence or truncation marker if full snippet is absent.
  - `rawSnippet`: Beginning or continuation of the omitted Chinese text.
  - `explanation`: Detailed explanation with word count and length percentages.
- **ProjectReviewChapter**:
  - `rawChineseContent`: Auto-hydrated from `Chapter.sourceText`.
  - `wordCount`: Live count of Vietnamese words in the active draft.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of chapters with length < 35% of Chinese raw text are detected as `critical` omission issues in Hako Checker.
- **SC-002**: Detection of truncated chapters occurs in < 10ms during the deterministic heuristic pass, before any AI call is dispatched.
- **SC-003**: False positive rate on legitimately short chapters (<= 150 characters of source) is 0%.
- **SC-004**: Chapter selection UI accurately reflects raw availability without requiring manual copy-paste when chapters exist in IndexedDB.

---

## Assumptions

- Standard web novel chapters range between 1,000 and 4,000 Chinese characters (producing 800 to 3,500 Vietnamese words).
- A chapter with only 80 Vietnamese words while the original Chinese has over 1,000 characters is a 90%+ truncation defect resulting from AI token limits, network interruption, or pipeline error.
- The user's IndexedDB database already stores `sourceText` in `chapters` store, which can be retrieved using existing `getChapterFromDB(id)`.
