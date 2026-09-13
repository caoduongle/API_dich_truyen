# Feature Specification: Prevent Source and Raw Translation Data Loss

**Feature Branch**: `129-prevent-source-raw-loss`

**Created**: 2026-09-13

**Status**: Draft

**Input**: User description: "kiểm tra lại toàn bộ dự án; trong quá trình dịch và kiểm định tự nhiên xóa mất bản gốc và dịch thô"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Total Text Preservation During Translation & Editing (Priority: P1) 🎯 MVP

As a translator working in the translation workspace or automated translation batch,  
I want every stage of a chapter—including the original source text (Bản gốc) and initial raw draft (Dịch thô)—to be strictly preserved when translating, polishing, or manually editing,  
So that my original material and preliminary translations are never erased or blanked out when updating polished versions.

**Why this priority**:  
Data loss of the original Chinese source text and raw translation renders chapter revision, comparative reading, and quality verification impossible. Ensuring full persistence across all chapter stages is the most fundamental guarantee of data safety in the application.

**Independent Test**:  
Select an untranslated or partially translated chapter containing source text. Complete a raw translation, perform a polishing cycle, make live edits, and verify that the chapter in both the workspace and translation history retains 100% of its original source text, raw translation draft, and polished output with zero missing content.

**Acceptance Scenarios**:

1. **Given** a chapter with original source text, **When** the user runs raw translation or contextual polishing, **Then** the chapter's original source text remains intact and accessible under the source version tab.
2. **Given** a chapter with existing raw translation, **When** polishing is generated or refined, **Then** the raw translation text is preserved and continues to display its full content under the raw draft tab rather than showing "(trống)".
3. **Given** an open chapter in the editing workspace, **When** any auto-save or explicit save operation completes, **Then** all previously present text stages (source text, raw translation, polished translation, chapter title) are persisted together without dropping unedited stages.

---

### User Story 2 - Integrity Guard During Quality Auditing & Auto-Fixes (Priority: P2)

As an editor or reviewer conducting quality audits (Kiểm định) and applying corrections to translations,  
I want one-click issue fixes and targeted sentence rewrites to modify only the targeted phrases in the designated translation stage,  
So that neither the chapter's source text nor its raw translation draft is inadvertently deleted during the audit workflow.

**Why this priority**:  
The quality audit panel is designed to improve translation accuracy. When applying corrections or sentence rewrites, users must trust that the system will not silently overwrite unrelated fields or erase historical translation drafts.

**Independent Test**:  
Run a quality audit on a chapter with known issues. Apply one or more automated fixes ("Sửa ngay") or AI-assisted rewrites. Verify that only the targeted sentence in the polished translation updates, while the original source text and raw translation draft remain completely intact.

**Acceptance Scenarios**:

1. **Given** a chapter under review in the audit panel with both source text and raw translation in storage, **When** the user applies an automated correction ("Sửa ngay") or confirms a suggested rewrite, **Then** the update modifies only the target translation stage and leaves source text and raw translation intact.
2. **Given** a chapter opened in the translation workspace directly from the audit panel, **When** reviewer adjustments are made and saved, **Then** the saved chapter record retains all existing source text, paragraphs, and raw drafts.

---

### User Story 3 - Missing Source & Raw Data Detection and Recovery (Priority: P3)

As a project manager or translator viewing the chapter history list,  
I want the system to identify chapters where original source text or raw translation was previously lost or blanked out,  
So that I can easily spot affected chapters and safely replenish or re-sync the missing original text without losing completed translations.

**Why this priority**:  
Chapters that suffered accidental source/raw erasure in prior sessions need visibility and a safe path to recover or re-supply the original Chinese text without discarding existing polished translations.

**Independent Test**:  
Navigate to Chapter History or Project Overview for a project containing chapters with missing source text. Verify that the UI clearly indicates which versions are missing, warns before any destructive actions, and permits replenishing the missing source text while preserving completed translations.

**Acceptance Scenarios**:

1. **Given** a chapter whose source text or raw translation is currently empty, **When** viewing the chapter history, **Then** the interface clearly indicates which components are present and which are empty without corrupting remaining data.
2. **Given** a chapter with existing polished translation but missing source text, **When** the user provides or re-imports the original source text, **Then** the system attaches the source text to the chapter without altering or resetting the polished translation.

---

### Edge Cases

- **Partial Save Interruption**: If a network failure, tab closure, or device sleep occurs during an active save or auto-save, the system must retain previously saved stages and never write an empty or partial placeholder over existing valid data.
- **Concurrent Editing in Same Session**: When rapid consecutive keystrokes or multiple automated corrections occur within milliseconds, all updates must merge cumulatively into the active stage without wiping out untouched fields.
- **Switching Chapters Rapidly**: When a user rapidly cycles through chapters in the selector or history view, each chapter must load its complete data snapshot, and pending saves from the previous chapter must not overwrite the newly selected chapter.
- **Re-polishing Existing Drafts**: When running translation in "Chỉ chuốt lại" (Repolish) mode, the system must use the existing raw draft as input without emptying the raw translation field upon completion.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST guarantee that saving or updating any single chapter stage (source text, raw translation, or polished translation) preserves all other existing non-empty stages of that chapter.
- **FR-002**: Automatic background synchronization and live state saving MUST merge changes with the chapter's existing stored records, ensuring that omitted, uninitialized, or unchanged fields (such as original source text, paragraph divisions, and raw drafts) are never overwritten with empty values.
- **FR-003**: When a chapter is loaded into the translation workspace via chapter selector, history link, or audit review panel, the workspace session MUST fully hydrate all existing fields (title, original source text, raw translation, polished translation, and metadata) before permitting background synchronization.
- **FR-004**: During single-chapter or automated batch translation, completing a translation stage (raw translation or polished translation) MUST atomically persist the newly produced text alongside the existing original source text and earlier translation stages.
- **FR-005**: Applying quality audit corrections (both rule-based auto-fixes and targeted sentence rewrites) MUST only modify the targeted text in the active translation stage and MUST NOT alter or clear the original source text or raw draft.
- **FR-006**: The system MUST NOT permit any background process or synchronization routine to commit a chapter update that replaces non-empty source text with an empty string.
- **FR-007**: When resolving differences between multiple versions of a chapter (e.g., during cloud synchronization or multi-tab coordination), the system MUST prioritize preserving non-empty text content over empty strings across all fields.
- **FR-008**: In the Chapter History and Chapter Details panels, version status indicators (Bản gốc, Dịch thô, Dịch biên tập) MUST accurately reflect the presence or absence of each stage, and switching between version views must never trigger state mutation or data deletion.

### Key Entities

- **Chapter Content**: The complete multi-stage text bundle for a story chapter, comprising:
  - *Identifier*: Unique chapter reference within the project.
  - *Title*: The designated chapter title or heading.
  - *Original Source Text*: The untouched source language text (Chinese characters).
  - *Raw Translation*: Preliminary machine translation draft (Giai đoạn 1).
  - *Polished Translation*: Refined, contextually polished literary output (Giai đoạn 2).
  - *Paragraphs & Alignments*: Structural breakdown mapping source paragraphs to translation lines.
  - *Status & Timestamps*: Lifecycle indicator (not started, in progress, completed) and modification history.
- **Quality Audit Issue**: A flagged anomaly (omission, addition, terminology, or formatting) with associated target snippet and proposed correction.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of chapters subjected to translation, polishing, live editing, or quality audit operations retain their original source text without accidental deletion.
- **SC-002**: 100% of chapters with completed raw translations retain their raw translation draft when subsequent polishing cycles or manual edits are applied.
- **SC-003**: Zero incidents of empty string overwrites (`sourceText: ""` or `rawTranslation: ""`) committed by background auto-save or collaborative synchronization handlers.
- **SC-004**: Translators can inspect all three text versions (Bản gốc, Dịch thô, Dịch biên tập) in Chapter History immediately after translation and audit workflows, with active tabs correctly reflecting non-empty status.

## Assumptions

- Users expect that once a chapter's source text or raw translation draft is established, it should never disappear unless the user explicitly performs a destructive action (such as "Xóa bản dịch thô" or "Reset về bản gốc") with explicit confirmation dialogs.
- Collaborative editing and auto-save mechanisms are active in the workspace and must behave defensively by merging data rather than replacing whole records with partial snapshots.
- Existing projects and chapters in local storage that have not yet experienced data loss will be fully protected, while chapters previously affected will not degrade further.
