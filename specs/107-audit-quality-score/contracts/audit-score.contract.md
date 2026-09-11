# Interface Contract: Audit Quality Score

## 1. Service Layer Contract (`src/services/auditBridgeService.ts`)

### Exported Types & Functions

```typescript
import type { UnifiedAuditIssue } from '../types/audit';

export interface AuditScoreTier {
  label: 'Xuất sắc' | 'Khá' | 'Cần rà soát lại';
  tone: 'polish' | 'warning' | 'danger';
}

/**
 * Tính điểm chất lượng bản dịch tổng hợp (0 - 100) từ danh sách vấn đề kiểm định.
 * - Điểm gốc: 100
 * - Trừ theo severity của mỗi issue có status === 'pending':
 *   - error: -8 điểm
 *   - warning: -3 điểm
 *   - info: -1 điểm
 * - Không trừ điểm với issue đã resolved hoặc ignored.
 * - Điểm luôn được giới hạn trong khoảng [0, 100] và làm tròn số nguyên.
 */
export function calculateAuditScore(issues: UnifiedAuditIssue[]): number;

/**
 * Trả về phân hạng chất lượng định tính và tone màu Badge tương ứng:
 * - 90 - 100: "Xuất sắc" (tone: 'polish')
 * - 70 - 89: "Khá" (tone: 'warning')
 * - 0 - 69: "Cần rà soát lại" (tone: 'danger')
 */
export function getAuditScoreTier(score: number): AuditScoreTier;
```

---

## 2. Component Contract (`src/components/translator-workspace/UnifiedAuditPanel.tsx`)

### Header Presentation

In `UnifiedAuditPanel`, within the Header Action Bar (`flex items-center gap-2`), directly following `<Badge tone="neutral">{stats.total} vấn đề</Badge>`:

```tsx
<div 
  className="flex items-center gap-1.5 pl-1.5 border-l border-parchment-2/50 cursor-help"
  title="Điểm chất lượng tham khảo ước tính dựa trên số lỗi chưa xử lý, không phải đánh giá tuyệt đối."
>
  <span className="font-mono font-bold text-xs text-text-main">
    {auditScore}/100
  </span>
  <Badge tone={scoreTier.tone} className="font-sans text-[10px] px-1.5 py-0.2">
    {scoreTier.label}
  </Badge>
</div>
```

### Reactivity Guarantees
- Recomputation time: `< 1ms` for standard chapter issue volumes (10–50 issues).
- Synchronous derivation with React memoization (`useMemo`).
- Automatic updates on issue resolution or ignore actions.
