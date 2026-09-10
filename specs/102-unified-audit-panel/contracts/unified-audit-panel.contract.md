# Interface Contract: UnifiedAuditPanel Component

**Component**: `UnifiedAuditPanel`  
**File**: `src/components/translator-workspace/UnifiedAuditPanel.tsx`  
**Target Consumers**: `BilingualEditor.tsx`

---

## 1. Export Contract

```typescript
import React from 'react';
import type { QualityIssue } from '../../types/hakoChecker';
import type { DirectQaCritiqueIssue } from '../../services/directTranslationEngine';
import type { UnifiedAuditIssue } from '../../types/audit';

export interface UnifiedAuditPanelProps {
  hakoIssues: QualityIssue[];
  qaIssues: DirectQaCritiqueIssue[];
  isCheckingQa: boolean;
  onRunAiQaCritique: () => void;
  onIssueClick?: (issue: UnifiedAuditIssue) => void;
  isMismatch?: boolean;
  sourceParaCount?: number;
  translationParaCount?: number;
  qaError?: string | null;
}

export declare function UnifiedAuditPanel(props: UnifiedAuditPanelProps): React.JSX.Element;
export default UnifiedAuditPanel;
```

---

## 2. Behavioral & Event Contracts

### 2.1 Action Trigger Contract
- The "Chạy AI Thẩm định" button MUST call `props.onRunAiQaCritique()` when clicked.
- While `props.isCheckingQa` is `true`:
  - The button MUST be disabled (`disabled={true}`).
  - A loading spinner icon (`<Loader2 className="animate-spin" />`) MUST be displayed.
  - The issue list MUST render `<Skeleton>` items.

### 2.2 Filter Tab Contract
- Clicking a tab button MUST update the internal active tab filter state.
- Tab count badges MUST reflect the actual number of issues matching each filter criterion:
  - "Tất cả": `total`
  - "Quy chuẩn Hako": count of issues where `source === 'hako_rule'`
  - "Góp ý AI": count of issues where `source === 'ai_critique'`
  - "Chưa xử lý": count of issues where `status === 'pending'`

### 2.3 Issue Card Selection Contract
- Clicking an issue card MUST call `props.onIssueClick(issue)` passing the selected `UnifiedAuditIssue`.
- Card elements must have `cursor-pointer` and accessible keyboard interaction.

### 2.4 Error & Retry Contract
- When `props.qaError` is truthy, an error card MUST be displayed with the specific message and a "Thử lại" button.
- Clicking "Thử lại" MUST call `props.onRunAiQaCritique()`.

### 2.5 Deprecation & Removal Contract
- `QaCritiquePanel` is completely deprecated and removed.
- All former consumers of `QaCritiquePanelProps` MUST migrate to `UnifiedAuditPanelProps`.
