# Feature Specification: Reading & Editor Theme System (Dark, Light, Sepia, Custom)

**Feature Branch**: `053-reading-theme-system`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "Thêm hệ thống chế độ màu đọc/biên tập gồm 4 lựa chọn — Tối (mặc định, giữ nguyên bảng màu 'Mực & Chu Sa' hiện có, không đổi gì), Sáng, Sepia (giấy cũ), và Tùy chỉnh — để giảm mỏi mắt khi đọc/biên tập chương dài trong BilingualEditor.tsx (3 vùng textarea: nguồn Hán, dịch thô, dịch đã biên tập) và áp dụng luôn toàn app vì kiến trúc token đã tập trung sẵn. KHÔNG tạo bảng màu trung tính/xanh dương kiểu SaaS chung chung — đọc .agents/rules/design-system.md trước khi làm, đây chính là bài test 'đổi logo mà giao diện vẫn giống app khác' mà file đó đề cập. Cách làm: biến 6 token ngữ nghĩa đã có trong src/index.css (--color-ink, --color-parchment, --color-parchment-2, --color-text-main, --color-text-muted, --color-polish) thành theme-aware bằng cách override giá trị CSS custom property theo thuộc tính data-theme trên thẻ html (dark|light|sepia|custom) thay vì hard-code hex mới rải rác trong component — giữ đúng nguyên tắc 'đừng hard-code hex mới' đã ghi trong design-system.md, và giữ diff nhỏ vì mọi component đã dùng class Tailwind (bg-ink, text-text-main...) gắn với các biến này rồi, không phải sửa từng file. Giá trị đề xuất cho từng mode (đã tự kiểm tra tỉ lệ tương phản WCAG) — Sáng: nền ấm kiểu giấy ngà #F7F2E9 (không dùng trắng tinh AI-generic), chữ nâu-đen ấm #3A2E22, chữ phụ #8A7A63, khối/card #FFFFFF, viền #E4DCC8; Sepia: giữ gần nguyên bộ giá trị bạn đã đề xuất vì đã hợp bản sắc bản thảo cổ phong và pass contrast — nền #F4ECD8, chữ #5B4636, chữ phụ #7A6A5A, khối #EBE0C9, viền #D5C5A5; Tối: giữ y nguyên token hiện tại, không đổi gì. QUAN TRỌNG — màu nhấn (--color-polish): giữ NGUYÊN đỏ chu sa #B8402C xuyên suốt cả 3 mode thay vì đổi sang xanh dương/xanh ngọc — đã verify #B8402C đạt contrast ratio hợp lệ trên cả nền tối lẫn 2 nền sáng mới, và đổi sang xanh sẽ phá quy tắc 'một điểm nhấn duy nhất' + làm giao diện giống dashboard SaaS chung chung mà design-system.md đang cố tránh; nếu thực sự muốn đổi màu nhấn theo bản xanh dương/ngọc đã gợi ý ban đầu thì đây là quyết định đổi bản sắc thương hiệu, cần hỏi lại trước khi làm, không tự quyết. Mode Tùy chỉnh: cho phép chọn cả 6 token trên bằng input type=color thuần (không thêm thư viện color-picker mới, đúng nguyên tắc không thêm dependency nếu làm được với những gì đã cài), có xem trước trực tiếp, và hiển thị cảnh báo (tái dùng Badge tone=warning có sẵn) nếu cặp màu người dùng tự chọn không đạt tối thiểu 4.5:1 (chữ thường) hoặc 3:1 (UI lớn/nhấn) — không chặn cứng, chỉ cảnh báo, vì đây là lựa chọn cá nhân của người dùng cuối. Lưu lựa chọn theme vào localStorage qua 1 ThemeContext mới, mirror đúng pattern src/i18n/I18nContext.tsx đang dùng để lưu ngôn ngữ — KHÔNG lưu vào IndexedDB vì đó là nơi chứa dữ liệu dự án/chương theo AGENTS.md, không đụng schema db.ts/types.ts cho việc này. Lần đầu mở app khi chưa có lựa chọn nào lưu, tự nhận diện prefers-color-scheme để chọn Sáng/Tối mặc định, sau khi người dùng bấm chọn 1 mode rõ ràng thì nhớ đúng lựa chọn đó, không tự đổi theo hệ điều hành nữa. Thêm 1 nút chuyển theme mới trong header (src/App.tsx, đặt cạnh LanguageSelector dòng ~211, cùng hàng sticky header z-30) — icon từ lucide-react đã có sẵn trong deps (không dùng emoji), dropdown/popover dùng z-40 theo đúng thang z-index của design-system.md, bo góc rounded-[2px]/[3px], không rounded-xl/2xl/full. Việc cần làm KHÔNG bao gồm: sửa logic dịch/gọi Gemini trong server/ hay src/services/, đổi schema IndexedDB, đổi nội dung tiếng Việt hiển thị sẵn có (chỉ thêm nhãn mới cho nút/menu theme). Chia nhỏ theo context-engineering.md (~4.000 token/task): (1) hạ tầng CSS variable + data-theme cho 3 mode cố định, (2) ThemeContext + persistence + auto-detect lần đầu, (3) component ThemeSwitcher trong header, (4) mode Tùy chỉnh + cảnh báo contrast — checkpoint sau mỗi phase, chạy npm run lint && npm test && npm run build sau mỗi phase, và nếu có browser tool thì chụp ảnh BilingualEditor + header ở cả 4 mode trước/sau."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instant Reading Theme Switching Across Presets (Dark, Light, Sepia) (Priority: P1)

As a translator or reader working on long Chinese-Vietnamese chapters in `BilingualEditor`, I want to switch between three distinct visual reading themes — Dark (Mực & Chu Sa, default), Light (Giấy Ngà), and Sepia (Giấy Cũ) — so that I can read and edit for extended periods without eye fatigue, while preserving the application's unique literary manuscript aesthetic and cinnabar red (`#B8402C`) accent across all views without hardcoding colors or disrupting existing UI components.

**Why this priority**: Directly solves reading comfort and eye strain for intensive translation work while leveraging the existing centralized CSS variable architecture with 0 component diffs.

**Independent Test**: Open `BilingualEditor` on a project with active chapters, toggle between Dark, Light, and Sepia via the theme switcher, verify that all three editor panels (Source, Raw, Polished), the header, sidebar, and modals immediately reflect the warm ivory/sepia/dark palette with legible contrast, and verify that the cinnabar red accent (`#B8402C`) remains consistent.

**Acceptance Scenarios**:

1. **Given** the application is running in Dark mode (default), **When** the user selects "Sáng (Giấy Ngà)", **Then** the `html` element is updated with `data-theme="light"`, mapping `--color-ink` to `#FFFFFF`, `--color-parchment` to `#F7F2E9`, `--color-parchment-2` to `#E4DCC8`, `--color-text-main` to `#3A2E22`, and `--color-text-muted` to `#8A7A63`, while retaining `--color-polish` at `#B8402C`.
2. **Given** the application is running in Light mode, **When** the user selects "Sepia (Giấy Cũ)", **Then** `data-theme="sepia"` maps `--color-ink` to `#EBE0C9`, `--color-parchment` to `#F4ECD8`, `--color-parchment-2` to `#D5C5A5`, `--color-text-main` to `#5B4636`, and `--color-text-muted` to `#7A6A5A`.
3. **Given** any of the 3 presets, **When** reviewing text in `BilingualEditor`, **Then** the text contrast ratio strictly adheres to WCAG AA standards (>= 4.5:1 for normal text and >= 3:1 for UI elements and cinnabar red accents).

---

### User Story 2 - Theme Persistence & System Scheme Auto-Detection (Priority: P1)

As a returning user, I want the application to automatically detect my OS color scheme preference on initial visit and reliably remember my chosen theme in `localStorage` across browser refreshes and sessions, without storing theme data in the IndexedDB project database.

**Why this priority**: Provides a seamless, friction-free startup experience that respects user preference across sessions and maintains strict domain separation between app configuration (`localStorage`) and novel content (`IndexedDB`).

**Independent Test**: Open the application in a fresh incognito window with OS Dark Mode (loads Dark theme), switch OS to Light Mode on a fresh profile (loads Light theme), explicitly select "Sepia", reload the page (verifies Sepia remains active), and inspect `IndexedDB` to ensure 0 schema changes or theme keys.

**Acceptance Scenarios**:

1. **Given** a user opens the app for the very first time with no stored preference in `localStorage`, **When** the browser's `prefers-color-scheme` is `light`, **Then** the app defaults to "Sáng"; if `dark` or unsupported, it defaults to "Tối".
2. **Given** a user has explicitly selected a theme (e.g. "Sepia"), **When** the user reloads the browser or opens a new tab, **Then** the app immediately loads with `data-theme="sepia"` without theme flickering, ignoring OS scheme changes.
3. **Given** any theme change, **When** checking `localStorage`, **Then** the value is stored under a dedicated key (`ai_dich_truyen_theme`) without writing to IndexedDB or modifying project records.

---

### User Story 3 - Header Theme Switcher Navigation Component (Priority: P1)

As a user navigating the application, I want a dedicated Theme Switcher dropdown button in the sticky top header (adjacent to `LanguageSelector`), rendered with clean Lucide icons and adhering to the project's Z-index ladder (z-40 for popover, z-30 for header) and angular border radius (`rounded-[2px]` / `rounded-[3px]`), so that I can quickly preview and select my preferred mode with keyboard or mouse.

**Why this priority**: Exposes the theme feature in the primary navigation header in complete alignment with `.agents/rules/design-system.md`.

**Independent Test**: Click the theme button in the header, verify that a z-40 popover opens with 4 distinct options (Tối, Sáng, Sepia, Tùy chỉnh), test navigation using keyboard arrows / Escape key to close, and verify that the active theme is marked with a checkmark / highlight.

**Acceptance Scenarios**:

1. **Given** the sticky header in `src/App.tsx`, **When** rendered, **Then** the `ThemeSwitcher` appears next to `LanguageSelector` at z-30, displaying an icon representing the current mode (`Moon`, `Sun`, `BookOpen`, `Palette`).
2. **Given** the `ThemeSwitcher` is clicked, **When** the menu opens, **Then** it renders at z-40 with `rounded-[2px]`, `border-parchment-2`, `bg-parchment`, and no generic rounded-xl/full or AI-slop gradients.
3. **Given** the dropdown is open, **When** pressing Escape or clicking outside, **Then** the dropdown closes smoothly.

---

### User Story 4 - Custom Theme Studio with Live Contrast Auditing (Priority: P2)

As an advanced reader with specific visual requirements, I want to customize all 6 color tokens (`--color-ink`, `--color-parchment`, `--color-parchment-2`, `--color-text-main`, `--color-text-muted`, `--color-polish`) using standard native HTML color pickers (`<input type="color">`), view a real-time preview of the reading editor, and receive non-blocking WCAG contrast warnings (via `Badge tone="warning"`) if my chosen combination has low legibility, so that I can craft my own comfortable reading palette without installing extra NPM dependencies.

**Why this priority**: Empowers users with bespoke accessibility requirements while maintaining zero new NPM package dependencies and preventing accidental unreadable configurations.

**Independent Test**: Open Custom Theme Modal, modify the background and text color inputs, observe live preview updates, intentionally set low-contrast colors (e.g. light gray text on white background), verify that a warning badge appears showing contrast ratio `< 4.5:1`, click "Lưu bảng màu", and verify that the custom palette applies across the app and persists in `localStorage`.

**Acceptance Scenarios**:

1. **Given** the user selects "Tùy chỉnh" in the theme switcher, **When** the Custom Theme Modal opens, **Then** 6 native `<input type="color">` pickers are provided for the 6 core semantic tokens.
2. **Given** custom color selections, **When** the relative luminance contrast ratio between `--color-text-main` and `--color-parchment` drops below 4.5:1, **Then** a warning badge (`Badge tone="warning"`) displays the computed ratio (e.g. `Tương phản: 2.8:1 (Khuyến nghị >= 4.5:1)`) without blocking the save button.
3. **Given** the user clicks "Lưu bảng màu", **When** saved, **Then** the custom colors are stored in `localStorage` under `ai_dich_truyen_custom_colors`, `data-theme="custom"` is set, and the custom CSS properties are applied to `:root`.
4. **Given** the user wants to reset, **When** clicking "Khôi phục mặc định", **Then** the values reset to the default "Mực & Chu Sa" dark palette.

---

### Edge Cases

- **JavaScript Disabled / Hydration Delay**: The `index.html` inline script applies the stored `data-theme` attribute synchronously before first paint to eliminate white/dark flash (FOUC).
- **Invalid Custom Hex Values**: If malformed hex strings are found in `localStorage`, the system gracefully falls back to the default Dark theme without throwing runtime errors.
- **Extreme High Contrast / Monochromatic Custom Themes**: All UI primitives (borders, badges, buttons) use semantic variable mappings, ensuring that even high-contrast custom palettes maintain structural visibility.
- **Dynamic System Theme Changes**: If the user has NOT explicitly chosen a theme yet, listening to `window.matchMedia('(prefers-color-scheme: dark)')` will adjust dynamically; once explicitly chosen, the explicit choice takes precedence.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST define and override the 6 core semantic CSS custom properties (`--color-ink`, `--color-parchment`, `--color-parchment-2`, `--color-text-main`, `--color-text-muted`, `--color-polish`) in `src/index.css` scoped by `data-theme="dark"`, `data-theme="light"`, `data-theme="sepia"`, and `data-theme="custom"`.
- **FR-002**: The system MUST preserve the existing "Mực & Chu Sa" palette for the default `dark` theme without altering existing color tokens.
- **FR-003**: The `light` theme MUST use warm ivory paper (`#F7F2E9`), warm brown-black text (`#3A2E22`), muted text (`#8A7A63`), card surface (`#FFFFFF`), and border (`#E4DCC8`).
- **FR-004**: The `sepia` theme MUST use vintage manuscript paper (`#F4ECD8`), deep sepia text (`#5B4636`), muted sepia (`#7A6A5A`), card surface (`#EBE0C9`), and border (`#D5C5A5`).
- **FR-005**: The cinnabar red accent `--color-polish` MUST remain `#B8402C` across all 3 built-in presets (`dark`, `light`, `sepia`).
- **FR-006**: The system MUST provide a `ThemeContext` (mirroring `src/i18n/I18nContext.tsx`) that manages theme state, persistence to `localStorage`, and DOM `data-theme` synchronization.
- **FR-007**: On first application load without a stored theme preference, the system MUST auto-detect the user's OS preference via `window.matchMedia('(prefers-color-scheme: light)')`. Once an explicit theme is chosen, that choice MUST be persisted in `localStorage` and take precedence.
- **FR-008**: The system MUST render a `ThemeSwitcher` dropdown button in the sticky top header (`src/App.tsx`) next to `LanguageSelector` at z-30 with a z-40 popover menu following `.agents/rules/design-system.md`.
- **FR-009**: The system MUST provide a Custom Theme modal allowing customization of all 6 color tokens using native HTML `<input type="color">` elements without adding any third-party color picker NPM packages.
- **FR-010**: The Custom Theme modal MUST compute and display relative luminance contrast ratios (WCAG 2.1) in real-time, surfacing a non-blocking `Badge tone="warning"` if contrast is below 4.5:1 for body text or 3:1 for accents.
- **FR-011**: The system MUST NOT modify IndexedDB database schemas, `src/types.ts` project models, or backend translation logic.
- **FR-012**: All quality gates (`npm run lint`, `npm test`, `npm run build`) MUST pass cleanly.

---

### Key Entities *(include if feature involves data)*

- **Theme Mode (`ThemeMode`)**: `'dark' | 'light' | 'sepia' | 'custom'`.
- **Custom Theme Palette (`CustomThemePalette`)**:
  ```typescript
  export interface CustomThemePalette {
    ink: string;         // Card & panel surface
    parchment: string;   // Page background
    parchment2: string;  // Border & subtle divider
    textMain: string;    // Primary readable text
    textMuted: string;   // Secondary / caption text
    polish: string;      // Accent / highlight color
  }
  ```
- **Theme Context State (`ThemeContextType`)**:
  ```typescript
  export interface ThemeContextType {
    theme: ThemeMode;
    customPalette: CustomThemePalette;
    setTheme: (theme: ThemeMode) => void;
    setCustomPalette: (palette: CustomThemePalette) => void;
    resetCustomPalette: () => void;
  }
  ```

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of pages and components (including `BilingualEditor`, `GlossaryManager`, `ProjectList`, modals, and navigation) seamlessly adapt to Dark, Light, Sepia, and Custom themes with 0 hardcoded color overrides needed in individual component files.
- **SC-002**: Text contrast in Dark, Light, and Sepia presets meets or exceeds WCAG 2.1 AA standard (contrast ratio >= 4.5:1 for body text, >= 3:1 for accents).
- **SC-003**: 0 new NPM packages are introduced (native color inputs and native Web API contrast math).
- **SC-004**: Theme switching executes instantly (< 16ms / 1 frame) without layout reflow or page reload.
- **SC-005**: 0 IndexedDB schema changes and 0 modifications to server/Gemini translation services.
- **SC-006**: All quality gates (`npm run lint`, `npm test`, `npm run build`) pass cleanly.

---

## Assumptions

- The browser supports CSS Custom Properties (`var(--...)`) and DOM attribute selectors (`[data-theme="..."]`), which is standard across all modern browsers.
- Users configuring custom themes desire real-time contrast feedback to avoid unreadable combinations, but have the final freedom to save any palette.
- Cinnabar red (`#B8402C`) is the core brand identity accent and achieves sufficient contrast on both dark (`#12100E`), ivory (`#F7F2E9`), and sepia (`#F4ECD8`) backgrounds.
