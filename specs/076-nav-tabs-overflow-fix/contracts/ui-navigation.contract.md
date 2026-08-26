# Contract: UI Navigation Bar, Chevrons & More Dropdown

**Feature**: `076-nav-tabs-overflow-fix`
**Date**: 2026-08-27
**Status**: Completed

---

## 1. Tab Elements & Accessibility Contracts

| Tab Key | Button ID | Panel ID | Shortcut | Icon | Label Key |
|---|---|---|---|---|---|
| `translate` | `tab-translate` | `panel-translate` | `Alt+1` | `BookOpenText` | `nav.translate` |
| `auto-translate` | `tab-auto-translate` | `panel-auto-translate` | `Alt+2` | `Cpu` | `nav.autoTranslate` |
| `glossary` | `tab-glossary` | `panel-glossary` | `Alt+3` | `Settings` | `nav.glossary` |
| `history` | `tab-history` | `panel-history` | `Alt+4` | `History` | `nav.history` |
| `projects` | `tab-projects` | `panel-projects` | `Alt+5` | `Folder` | `nav.projects` |
| `hako-checker` | `tab-hako-checker` | `panel-hako-checker` | `Alt+6` | `ShieldCheck` | `nav.hakoChecker` |

All tab buttons MUST implement:
- `role="tab"`
- `aria-selected={activeTab === tabKey}`
- `aria-controls={`panel-${tabKey}`}`
- `tabIndex={0}`
- `id={`tab-${tabKey}`}`
- `title={`${t(labelKey)} (${shortcut})`}` for hover accessibility

---

## 2. Scroll & Chevron Control Contract

- **Auto Scroll**:
  ```typescript
  scrollToElement(`tab-${activeTab}`, 'smooth');
  ```
- **Chevron Actions**:
  - Left Chevron (`ChevronLeft`): visible when `canScrollLeft === true`, calls `scrollLeftAction()` (-200px offset).
  - Right Chevron (`ChevronRight`): visible when `canScrollRight === true`, calls `scrollRightAction()` (+200px offset).
- **Fade Overlays**:
  - Left overlay active when `canScrollLeft === true`.
  - Right overlay active when `canScrollRight === true`.
  - Both overlays MUST have `pointer-events: none` and `z-10`.

---

## 3. More Dropdown Menu Contract

- Trigger button ID: `nav-more-menu-btn` with `aria-haspopup="true"` and `aria-expanded={isOpen}`.
- Dropdown container: `role="menu"`, positioned beneath the button with click-outside listener and `Escape` key close handler.
- Dropdown items: `role="menuitem"`, each invoking `switchTab(key)` and closing the dropdown.
