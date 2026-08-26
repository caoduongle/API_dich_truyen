# Feature Specification: High-Contrast CJK Raw Snippet & Bilingual Evidence Display

**Feature Branch**: `078-fix-raw-snippet-contrast`

**Created**: 2026-08-27

**Status**: Draft

**Input**: User description: "Màu chữ của đoạn gốc tiếng Trung (Raw Snippet) bị mờ và không đọc được là do class CSS đang áp dụng màu tương phản quá thấp (ví dụ: `text-amber-200` hoặc `text-stone-300` trên nền trắng `bg-white`), vi phạm nghiêm trọng tiêu chuẩn tương phản WCAG (dưới 1.5:1) đối với các nét chữ Hán phức tạp."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - High-Contrast CJK Raw Snippet Legibility (Priority: P1)

As a moderator reviewing quality checker issues across any display theme (Light, Dark, or Sepia), I want original Chinese raw snippets to display with high contrast and sharp typography so that I can read complex CJK characters and stroke details without eye strain or text fading into the background.

**Why this priority**: Resolves critical readability failures where raw Chinese text was practically invisible on light and sepia backgrounds due to low contrast ratios (< 1.5:1).

**Independent Test**: Open an issue containing a Chinese raw snippet across Light, Dark, and Sepia themes; verify that Chinese characters are immediately legible with a measured contrast ratio $\ge 7:1$ (WCAG AAA standard).

**Acceptance Scenarios**:

1. **Given** the application is set to Light theme (white/parchment background), **When** an issue with a raw Chinese snippet is rendered, **Then** the raw text displays in high-contrast dark tones (`text-text-main` / `#1c1917` or deep ink) with high legibility.
2. **Given** the application is set to Dark theme, **When** an issue with a raw Chinese snippet is rendered, **Then** the raw text displays in high-contrast light tones (`text-text-main` / `#DCD1BC` or warm amber-100) against the dark card surface.
3. **Given** the application is set to Sepia theme, **When** an issue with a raw Chinese snippet is rendered, **Then** the raw text displays in deep brown-ink tones against the sepia background with clear distinction.

---

### User Story 2 - Distinct Bilingual Visual Hierarchy (Priority: P2)

As a moderator comparing bilingual translations, I want the Vietnamese evidence box and the Chinese raw snippet box to have clearly differentiated visual styling and accent borders so that I can instantly distinguish translation outputs from source text.

**Why this priority**: Clear visual hierarchy speeds up bilingual scanning and prevents confusion between original source text and flagged translation snippets.

**Independent Test**: View an issue card with both Vietnamese evidence and raw Chinese snippets; verify that each snippet container has distinct accent borders and background tones.

**Acceptance Scenarios**:

1. **Given** an issue card with both snippets, **When** viewed on screen, **Then** the Vietnamese evidence snippet features a Cinnabar/red accent border and the Chinese raw snippet features an Amber/parchment accent border.
2. **Given** a user navigates between issues, **When** scanning the list, **Then** the container layout and typography maintain consistent alignment and visual weight.

---

### User Story 3 - CJK Font Stack & Glyph Sharpness (Priority: P3)

As a moderator reading dense literary or classical Chinese phrases, I want Chinese text rendered with a dedicated CJK serif font stack and medium font weight so that complex radicals and strokes do not clip, blur, or break.

**Why this priority**: Complex CJK characters require appropriate font rendering rules and stroke weights to prevent character degradation on different operating systems.

**Independent Test**: Inspect raw snippets containing complex multi-stroke characters (e.g. 龙, 涎, 瀚, 饕, 餮); verify that characters render with complete strokes and balanced letter spacing.

**Acceptance Scenarios**:

1. **Given** an issue with complex multi-stroke Hanzi characters, **When** rendered in the browser, **Then** the characters are rendered using the designated CJK serif font family with crisp stroke boundaries and optimal line-height.

---

### User Story 4 - Quick One-Click Copy for Raw Snippets (Priority: P4)

As a moderator looking up unfamiliar Chinese idioms or terms in external references, I want a quick copy button on the raw snippet box so that I can copy the exact original text to my clipboard with a single click.

**Why this priority**: Facilitates fast external dictionary verification without requiring manual text highlighting.

**Independent Test**: Click the "Copy Raw" button on any raw snippet card; verify that the raw string is copied to the system clipboard and a brief confirmation feedback indicator is shown.

**Acceptance Scenarios**:

1. **Given** an issue card with a raw snippet, **When** the user clicks the copy button on the raw snippet header, **Then** the exact raw text is copied to the clipboard and the icon changes to a checkmark confirmation for 2 seconds.

---

### Edge Cases

- **Missing Raw Snippet**: If an issue was detected without corresponding raw text (e.g. heuristic repetition or non-raw issues), the raw snippet container is omitted cleanly without visual blank space.
- **Very Long Raw Snippet**: Raw snippets spanning multiple sentences or paragraphs wrap cleanly with comfortable line-height without overflowing the card boundaries.
- **Clipboard Permission Denied**: If the browser denies clipboard write permissions, the copy button fails gracefully without throwing unhandled exceptions.
- **Theme Switching**: Dynamically changing between Light, Dark, and Sepia themes updates text and background colors immediately with zero flash of unstyled contrast.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST render Chinese raw snippet text with a contrast ratio meeting or exceeding WCAG AAA standard ($\ge 7:1$) across all supported color themes (Light, Dark, Sepia).
- **FR-002**: The system MUST present Vietnamese translation evidence and Chinese raw source snippets in distinct, visually separated containers with differentiated accent borders.
- **FR-003**: The system MUST apply a dedicated CJK serif font stack (`Noto Serif SC`, `Source Han Serif`, `PingFang SC`, `Microsoft YaHei`, `serif`) and medium weight to Chinese raw text.
- **FR-004**: The system MUST provide a one-click copy button on the raw snippet header that copies the raw text to clipboard and provides immediate visual feedback.
- **FR-005**: The system MUST hide the raw snippet section entirely when `rawSnippet` is absent, null, or empty on a quality issue record.
- **FR-006**: The system MUST maintain native text selection capability on both Vietnamese and Chinese snippet text for manual copying and lookup.

### Key Entities *(include if feature involves data)*

- **QualityIssue**: Record containing `vietnameseSnippet` (mandatory string), `rawSnippet` (optional string), `explanation`, `suggestedFix`, and decision attributes.
- **CjkSnippetStyle**: Design token specification for background tone, text color, accent border, and typography rules mapped across Light, Sepia, and Dark themes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of Chinese raw snippet text achieves a minimum contrast ratio of 7:1 (WCAG AAA) across Light, Sepia, and Dark themes.
- **SC-002**: Reviewers can read and identify Chinese raw text within 1 second of viewing an issue card without squinting or changing browser zoom.
- **SC-003**: Copying raw text via the one-click copy button completes in under 50ms with clear visual confirmation.
- **SC-004**: Zero rendering glitches, clipping, or unreadable glyphs occur across major web browsers (Chrome, Edge, Firefox, Safari).

## Assumptions

- Users may use Light, Sepia, or Dark themes depending on their reading preferences and ambient lighting.
- The `Noto Serif SC` font is imported in `src/index.css` and available for CJK rendering.
- Standard Clipboard API (`navigator.clipboard.writeText`) is supported by modern browsers with fallback for non-secure contexts.
