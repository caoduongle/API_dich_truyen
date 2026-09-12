# Contract: Batch Draft Operations and Contrast Styling

## 1. Pure Transformation Functions Contract
```typescript
/**
 * Deletes the polished translation, preserving raw translation 100%.
 */
export function transformChapterDeletePolished(chap: Chapter): Chapter;

/**
 * Deletes the raw translation, preserving polished translation if present.
 */
export function transformChapterDeleteRaw(chap: Chapter): Chapter;

/**
 * Promotes the polished translation into rawTranslation and clears polishedTranslation.
 */
export function transformChapterPromotePolishedToRaw(chap: Chapter): Chapter;
```

## 2. Component Batch Handlers Contract (`ChapterHistoryPanel.tsx`)

```typescript
// Reset all selected chapters back to Chinese source
const handleResetSelectedToSource = async (): Promise<void>;

// Bulk clear polished translation for all selected chapters with polished text
const handleDeleteSelectedPolished = async (): Promise<void>;

// Bulk clear raw translation for all selected chapters with raw text
const handleDeleteSelectedRaw = async (): Promise<void>;

// Bulk promote polished translation to raw translation for all selected chapters with polished text
const handlePromoteSelectedPolishedToRaw = async (): Promise<void>;
```

## 3. Contrast & Typography Tokens Contract

| Element | Light Theme (`html[data-theme="light"]`) | Sepia Theme (`html[data-theme="sepia"]`) | Dark Theme (`html[data-theme="dark"]`) | WCAG AA Ratio |
|---|---|---|---|---|
| **Warning/Reset Text** | `text-amber-800` (`#92400e`) | `text-amber-800` (`#92400e`) | `dark:text-amber-300` (`#fcd34d`) | $\ge 7.5:1$ (Pass) |
| **Warning/Reset Border** | `border-amber-300/80` | `border-amber-300/80` | `dark:border-amber-800/40` | Crisp outline |
| **Warning/Reset Hover BG**| `hover:bg-amber-100/60` | `hover:bg-amber-100/60` | `dark:hover:bg-amber-950/20` | Subtle feedback |
| **Promote Button** | `text-text-main` | `text-text-main` | `text-text-main` | $\ge 4.5:1$ (Pass) |
