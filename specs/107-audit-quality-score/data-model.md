# Data Model: Translation Quality Audit Score (0-100)

## Entities & Interfaces

### 1. AuditScoreTier

Defines the presentation tier and design system badge tone for an audit score.

```typescript
export interface AuditScoreTier {
  /**
   * Nhãn định tính tiếng Việt hiển thị trên UI.
   * - "Xuất sắc" (điểm >= 90)
   * - "Khá" (70 <= điểm < 90)
   * - "Cần rà soát lại" (điểm < 70)
   */
  label: 'Xuất sắc' | 'Khá' | 'Cần rà soát lại';

  /**
   * Tone màu tương ứng theo Design System (`src/components/ui/Badge.tsx`).
   * - 'polish': Màu xanh lục nhạt (emerald) biểu thị chất lượng cao.
   * - 'warning': Màu hổ phách (amber) biểu thị cần chú ý nhẹ.
   * - 'danger': Màu chu sa / đỏ sẫm (crimson) biểu thị nhiều lỗi nghiêm trọng.
   */
  tone: 'polish' | 'warning' | 'danger';
}
```

### 2. UnifiedAuditIssue (Referenced Entity)

Located in `src/types/audit.ts`.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier for issue |
| `source` | `'hako_rule' \| 'ai_critique'` | Origin of the issue |
| `severity` | `'error' \| 'warning' \| 'info'` | Normalized severity |
| `title` | `string` | Human-readable title |
| `message` | `string` | Description / explanation |
| `targetText` | `string?` | Snippet in text where issue occurs |
| `suggestion` | `string?` | Proposed replacement text |
| `autoFixable` | `boolean` | Whether 1-click deterministic fix is supported |
| `status` | `'pending' \| 'resolved' \| 'ignored'` | Resolution lifecycle state |

---

## Functions & Signatures

### 1. `calculateAuditScore(issues: UnifiedAuditIssue[]): number`

Calculates a bounded integer quality score from `0` to `100`.

- **Input**: Array of `UnifiedAuditIssue`
- **Output**: `number` (integer in range `[0, 100]`)
- **Deduction Rules**:
  - `status !== 'pending'`: 0 point deduction
  - `status === 'pending' && severity === 'error'`: -8 points
  - `status === 'pending' && severity === 'warning'`: -3 points
  - `status === 'pending' && severity === 'info'`: -1 point
- **Constraints**:
  - Base score: `100`
  - Clamped via `Math.max(0, Math.min(100, Math.round(score)))`

### 2. `getAuditScoreTier(score: number): AuditScoreTier`

Maps a numeric score to its qualitative assessment tier and UI tone.

- **Input**: `score: number`
- **Output**: `AuditScoreTier`
- **Mapping**:
  - `score >= 90` -> `{ label: 'Xuất sắc', tone: 'polish' }`
  - `70 <= score < 90` -> `{ label: 'Khá', tone: 'warning' }`
  - `score < 70` -> `{ label: 'Cần rà soát lại', tone: 'danger' }`

---

## State Lifecycle & Reactivity

```text
[ Issue List (Hako + QA) ]
            │
            ▼
[ Map to UnifiedAuditIssue[] ] ──> Apply resolvedIssueIds set ──> Status: 'resolved'
            │
            ▼
[ calculateAuditScore(unifiedIssues) ]
   (Skips resolved & ignored issues)
            │
            ▼
       [ Score 0-100 ]
            │
            ▼
 [ getAuditScoreTier(score) ]
            │
            ▼
[ Render in UnifiedAuditPanel Header ]
   - Number: "{score}/100"
   - Badge:  "{label}" with tone
   - Tooltip: Advisory explanation
```
