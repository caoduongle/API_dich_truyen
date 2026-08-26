# Data Model & State: Nav Tabs Overflow & Visibility

**Feature**: `076-nav-tabs-overflow-fix`
**Date**: 2026-08-27
**Status**: Completed

---

## 1. Type Definitions

```typescript
export type ActiveNavTab =
  | 'translate'
  | 'auto-translate'
  | 'glossary'
  | 'history'
  | 'projects'
  | 'hako-checker';

export interface ScrollOverflowState {
  canScrollLeft: boolean;
  canScrollRight: boolean;
}

export interface NavTabItem {
  id: string;             // e.g. "tab-translate"
  key: ActiveNavTab;      // e.g. "translate"
  labelKey: string;       // e.g. "nav.translate"
  shortcut: string;       // e.g. "Alt+1"
  icon: string;           // icon component
  badgeCount?: number;    // optional count badge
  warningCount?: number;  // optional warning badge
}
```

---

## 2. State & Flow

```mermaid
stateDiagram-v2
  [*] --> TabRendered: Component Mount
  TabRendered --> CheckOverflow: Layout / Resize / Scroll
  CheckOverflow --> ShowFadeLeft: scrollLeft > 1
  CheckOverflow --> ShowFadeRight: scrollLeft + clientWidth < scrollWidth - 1
  CheckOverflow --> HideFades: No overflow

  TabRendered --> SwitchTab: User clicks or presses Alt+1..6
  SwitchTab --> AutoScroll: element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  AutoScroll --> CheckOverflow
```
