# Feature Specification: Typography Settings (Font & Font Size) for Reader & Workspace

**Feature Branch**: `063-reader-typography-settings`

**Created**: 2026-08-23

**Status**: Ready

**Input**: User description: "### YÊU CẦU: Thêm tùy chỉnh Font chữ và Cỡ chữ (Typography Settings) cho Khung đọc & Bản thảo. Bổ sung phân vùng tùy chỉnh Typography cho giao diện đọc và biên tập truyện (tích hợp trong Modal Tùy chỉnh Giao diện CustomThemeModal.tsx hoặc thanh công cụ đọc), cho phép người dùng: 1. Lựa chọn Font chữ (fontFamily) từ danh sách cài sẵn: System Default, Arial, Helvetica, Roboto, Georgia, Merriweather, Source Serif 4. Tự động nạp Google Fonts khi cần. 2. Điều chỉnh Cỡ chữ (fontSize) trong dải từ 14px đến 50px thông qua nút tăng/giảm + / -. 3. Lưu trạng thái vào localStorage và cập nhật CSS Variables (--reader-font-family, --reader-font-size) lên document.documentElement hoặc áp dụng trực tiếp cho khung đọc BilingualEditor. Cập nhật types/theme.ts theo mẫu."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Font Family Customization with Dynamic Font Loading (Priority: P1)

As a translator or reader reading Chinese novel raw text and Vietnamese translations in the workspace, I want to choose my preferred font family (e.g. Merriweather, Source Serif 4, Georgia, Roboto, Arial, Helvetica, or System Default) from a dedicated Typography section in the theme modal, so that text is rendered in a typography style that provides maximum comfort and legibility for long reading sessions.

**Why this priority**: Reader readability and typographical aesthetic are central to prolonged translation and proofreading workflows.

**Independent Test**: Open `CustomThemeModal`, select a font family (e.g. "Source Serif 4"), verify that the font stylesheet is dynamically loaded if it is a Google Font, and verify that the reader editor text and preview change font immediately.

**Acceptance Scenarios**:

1. **Given** a user opening `CustomThemeModal`, **When** viewing the Typography section, **Then** a font selector with 7 font options is displayed with the active font selected.
2. **Given** the user selects a Google Font (`roboto`, `merriweather`, `source-serif-4`), **When** selected, **Then** the font link/stylesheet is dynamically injected if not already present, and `--reader-font-family` CSS variable is applied.
3. **Given** the user selects a system/web-safe font (`system`, `arial`, `helvetica`, `georgia`), **When** selected, **Then** the corresponding standard font stack is applied immediately without external network requests.
4. **Given** the user saves the settings, **When** closing and reopening the app, **Then** the selected font family is restored from `localStorage`.

---

### User Story 2 - Incremental Font Size Adjustment with Range Limits (Priority: P1)

As a user with specific visual requirements or screen sizes (mobile, tablet, desktop monitor), I want to increase or decrease the reading and editing font size in the range of 14px to 50px using `+` and `-` buttons or a direct input/slider, so that I can comfortably read text at my ideal size.

**Why this priority**: Font size scaling directly impacts visual accessibility and ergonomics for different device display densities.

**Independent Test**: In the Typography controls, click `+` to increase size and `-` to decrease size; verify that `--reader-font-size` updates on the DOM, font size scales smoothly between 14px and 50px, and boundaries at 14px and 50px are strictly enforced.

**Acceptance Scenarios**:

1. **Given** the default font size (22px), **When** the user clicks `+`, **Then** the font size increases (e.g. by 1px or 2px) and the live preview / editor reflects the larger size.
2. **Given** the user clicks `-` until reaching 14px, **When** clicking `-` again at 14px, **Then** the font size does not decrease below `MIN_READER_FONT_SIZE` (14px) and the `-` button becomes disabled or clamped.
3. **Given** the user increases font size to 50px, **When** clicking `+` at 50px, **Then** the font size does not exceed `MAX_READER_FONT_SIZE` (50px) and the `+` button becomes disabled or clamped.
4. **Given** the user clicks "Khôi phục mặc định", **When** reset, **Then** font family reverts to `'merriweather'` and font size reverts to `22px`.

---

### User Story 3 - Full Synchronization Across Reading Frames & Live Preview (Priority: P2)

As a translator editing bilingual paragraphs, I want the chosen typography settings to seamlessly apply to both the Live Preview inside `CustomThemeModal` and the actual translation workspace (`BilingualEditor`), so that there is zero visual disconnect between setting choices and actual working view.

**Why this priority**: Guarantees end-to-end consistency and visual fidelity across all reading and editing surfaces.

**Independent Test**: Adjust font and size in `CustomThemeModal`, observe the modal's Live Preview update in real-time, click "Lưu", and verify that the translation paragraphs in `BilingualEditor` adopt the exact same typography.

**Acceptance Scenarios**:

1. **Given** changes in the Typography settings in `CustomThemeModal`, **When** adjusting draft font or size, **Then** the Live Preview box inside the modal updates in real-time.
2. **Given** settings are saved, **When** navigating to `BilingualEditor`, **Then** the translated text areas utilize `var(--reader-font-family)` and `var(--reader-font-size, 22px)`.

---

### Edge Cases

- **Offline / Network failure for Google Fonts**: If an external Google Font fails to load due to offline status, the CSS `fontFamilyCss` fallback stack (e.g. `Georgia, serif` or `sans-serif`) ensures text remains legible without breaking layout.
- **LocalStorage corrupted or invalid values**: If `localStorage` contains an invalid font ID or an out-of-range number, the system clamps the font size to `[14, 50]` and falls back to default font `'merriweather'`.
- **Rapid button clicks on +/-**: State updates are synchronous and throttled/clamped to avoid invalid states.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `src/types/theme.ts` MUST export `ReaderFontId`, `ReaderFontOption`, `READER_FONT_OPTIONS`, `MIN_READER_FONT_SIZE` (14), `MAX_READER_FONT_SIZE` (50), `DEFAULT_READER_FONT_SIZE` (22), and `DEFAULT_READER_FONT` ('merriweather').
- **FR-002**: `ThemeContext` (`src/context/ThemeContext.tsx`) MUST manage `readerFont: ReaderFontId` and `readerFontSize: number`, providing getters and setters (`setReaderFont`, `setReaderFontSize`, `resetReaderTypography`).
- **FR-003**: `ThemeContext` MUST persist typography settings to `localStorage` under `ai_dich_truyen_reader_font` and `ai_dich_truyen_reader_font_size`.
- **FR-004**: `ThemeContext` MUST apply `--reader-font-family` and `--reader-font-size` CSS custom properties to `document.documentElement`.
- **FR-005**: Google Fonts dynamically requested (`roboto`, `merriweather`, `source-serif-4`) MUST be dynamically injected into the document `<head>` when activated if not already loaded.
- **FR-006**: `CustomThemeModal.tsx` MUST include a Typography section allowing font family selection from the 7 options and font size increment/decrement with `+` / `-` buttons, bound within `[14, 50]`.
- **FR-007**: `CustomThemeModal.tsx` Live Preview MUST reflect the draft font family and font size in real time.
- **FR-008**: Reader and translation containers (such as `BilingualEditor.tsx`) MUST apply `var(--reader-font-family)` and `var(--reader-font-size)` to editor text content.

### Key Entities

- **`ThemeContext`** (`src/context/ThemeContext.tsx`): Manages global theme mode, custom palette, and reader typography state.
- **`CustomThemeModal`** (`src/components/common/CustomThemeModal.tsx`): Modal dialog for theme colors and typography customization.
- **`BilingualEditor`** (`src/components/translator-workspace/BilingualEditor.tsx`): Primary reader and translation editing surface.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the 7 predefined font options correctly apply their CSS font stacks when selected.
- **SC-002**: Font size adjustments are strictly bounded between 14px (minimum) and 50px (maximum) with 0 out-of-bound values permitted.
- **SC-003**: 100% of typography selections persist across page reloads via `localStorage`.
- **SC-004**: All quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly.

## Assumptions

- Pre-loading / dynamically linking Google Fonts for `'roboto'`, `'merriweather'`, and `'source-serif-4'` uses standard Google Fonts CDN with `font-display: swap` for optimal loading speed.
- The default font `'merriweather'` with default size `22px` delivers optimal serif reading experience for Sino-Vietnamese literary texts.
