# Data Model: CJK Raw Snippet & Bilingual Evidence Display

**Feature**: `078-fix-raw-snippet-contrast`
**Date**: 2026-08-27
**Status**: Ready

## 1. Entity Architecture & Component Props

```
+-------------------------------------------------------------+
|                       QualityIssue                          |
|  - id: string                                               |
|  - chapterId: string                                        |
|  - chapterTitle: string                                     |
|  - category: QualityIssueCategory                           |
|  - severity: QualityIssueSeverity                           |
|  - vietnameseSnippet: string (Mandatory evidence)           |
|  - rawSnippet?: string (Optional Chinese source text)       |
|  - explanation: string                                      |
|  - suggestedFix?: string                                    |
|  - decision: QualityIssueDecision                           |
|  - moderatorNote?: string                                   |
|  - detectedBy: 'heuristic' | 'ai'                           |
|  - createdAt: string                                        |
+-------------------------------------------------------------+
                              |
                     Renders inside
                              v
+-------------------------------------------------------------+
|                     HakoIssueCard                           |
|  - props: { issue, onDecisionChange }                       |
|  - state: isCopied (boolean), isEditingNote (boolean)       |
+-------------------------------------------------------------+
      |                                           |
      v                                           v
[ Vietnamese Evidence Block ]             [ Chinese Raw Snippet Block ]
- Border: Polish / Cinnabar Red           - Border: Amber / Gold
- Background: bg-ink/60                   - Background: bg-parchment/60
- Text: text-text-main                    - Text: text-text-main cjk-raw-snippet
- Font: font-sans                         - Font: font-serif (Noto Serif SC)
```

---

## 2. Style Tokens & Palette Mapping

| Theme | Target Element | Background Token | Text Token | Hex Background | Hex Foreground | Contrast Ratio |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Light** | Vietnamese Evidence | `bg-ink/60` | `text-text-main` | `#FFFFFF` | `#3A2E22` | **10.5 : 1** (AAA) |
| **Light** | Chinese Raw Snippet | `bg-parchment/60` | `text-text-main` | `#F7F2E9` | `#3A2E22` | **10.2 : 1** (AAA) |
| **Dark** | Vietnamese Evidence | `bg-ink/60` | `text-text-main` | `#14100D` | `#DCD1BC` | **12.4 : 1** (AAA) |
| **Dark** | Chinese Raw Snippet | `bg-parchment/60` | `text-text-main` | `#1F1914` | `#DCD1BC` | **11.2 : 1** (AAA) |
| **Sepia** | Vietnamese Evidence | `bg-ink/60` | `text-text-main` | `#EBE0C9` | `#5B4636` | **8.2 : 1** (AAA) |
| **Sepia** | Chinese Raw Snippet | `bg-parchment/60` | `text-text-main` | `#F4ECD8` | `#5B4636` | **8.5 : 1** (AAA) |

---

## 3. Interaction State

### 3.1 Copy Interaction Lifecycle
1. User clicks **"Copy Raw"** button in Chinese snippet header.
2. Component invokes `navigator.clipboard.writeText(issue.rawSnippet)`.
3. `isCopied` state sets to `true`; icon switches from `Copy` to `Check`, label becomes "Đã sao chép".
4. After 2000ms timer, `isCopied` reverts to `false`.
