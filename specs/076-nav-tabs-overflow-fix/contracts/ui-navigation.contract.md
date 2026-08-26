# Contract: UI Navigation Bar & Scroll Overflow

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

---

## 2. Scroll & Fade Behavior Contract

- **Auto Scroll**:
  ```typescript
  const tabEl = document.getElementById(`tab-${activeTab}`);
  tabEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  ```
- **Overflow Detection**:
  - `canScrollLeft`: `container.scrollLeft > 1`
  - `canScrollRight`: `container.scrollLeft + container.clientWidth < container.scrollWidth - 1`
- **Fade Overlays**:
  - Left overlay active when `canScrollLeft === true`.
  - Right overlay active when `canScrollRight === true`.
  - Both overlays MUST have `pointer-events: none` and `z-index: 10` (beneath header buttons, above tab background).
