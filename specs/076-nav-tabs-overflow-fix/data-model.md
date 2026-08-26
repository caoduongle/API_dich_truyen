# Data Model & State: Kế Hoạch Toàn Diện — Thanh Điều Hướng Tab Chính

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

export interface UseScrollOverflowReturn<T extends HTMLElement = HTMLElement> {
  containerRef: React.RefObject<T | null>;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  checkOverflow: () => void;
  scrollToElement: (elementOrId: HTMLElement | string | null, behavior?: ScrollBehavior) => void;
  scrollByOffset: (offset: number, behavior?: ScrollBehavior) => void;
  scrollLeftAction: () => void;
  scrollRightAction: () => void;
}

export interface NavTabItemConfig {
  key: ActiveNavTab;
  id: string;
  labelKey: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
  warningCount?: number;
}
```

---

## 2. Navigation Interaction State Diagram

```mermaid
stateDiagram-v2
  [*] --> Idle: Mount Navigation Bar
  Idle --> UserClickTab: Direct Tab Click
  Idle --> HotkeyTrigger: Press Alt+1..6
  Idle --> ClickChevron: Click < or > button
  Idle --> OpenMoreMenu: Click "Thêm ▾"
  Idle --> WindowResize: Screen size changes

  UserClickTab --> SwitchTab: switchTab(key)
  HotkeyTrigger --> SwitchTab: switchTab(key)
  OpenMoreMenu --> DropdownOpen: Render 6 items
  DropdownOpen --> SwitchTab: Select item in dropdown & close

  SwitchTab --> AutoScroll: scrollToElement('tab-' + key)
  ClickChevron --> ScrollByOffset: scrollByOffset(+/- 200px)
  AutoScroll --> CheckOverflow: scroll event fired
  ScrollByOffset --> CheckOverflow: scroll event fired
  WindowResize --> CheckOverflow: resize event fired

  CheckOverflow --> UpdateVisualState: canScrollLeft / canScrollRight
  UpdateVisualState --> Idle: Update Chevrons & Gradient Masks
```
