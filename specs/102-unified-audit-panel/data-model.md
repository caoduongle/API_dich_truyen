# Data Model & State Architecture: Unified Audit Panel

**Feature Branch**: `102-unified-audit-panel`  
**Date**: 2026-09-10  
**Status**: Completed

## 1. Component Interfaces & Props

### UnifiedAuditPanelProps

```typescript
export interface UnifiedAuditPanelProps {
  /** Danh sách lỗi quy tắc được phát hiện từ Hako Quality Engine */
  hakoIssues: QualityIssue[];
  
  /** Danh sách góp ý ngữ nghĩa/đối soát từ AI QA Critique */
  qaIssues: DirectQaCritiqueIssue[];
  
  /** Cờ trạng thái đang chạy kiểm duyệt AI QA Critique */
  isCheckingQa: boolean;
  
  /** Hàm kích hoạt chạy kiểm định chất lượng AI thủ công */
  onRunAiQaCritique: () => void;
  
  /** Callback khi người dùng click vào một issue card (chuẩn bị cho Prompt B4/B5) */
  onIssueClick?: (issue: UnifiedAuditIssue) => void;
  
  /** Cảnh báo lệch đoạn văn bản giữa bản gốc và bản dịch */
  isMismatch?: boolean;
  
  /** Số đoạn văn bản nguồn */
  sourceParaCount?: number;
  
  /** Số đoạn văn bản dịch */
  translationParaCount?: number;
  
  /** Thông báo lỗi nếu quá trình gọi AI QA Critique thất bại (để hiển thị Error State) */
  qaError?: string | null;
}
```

---

## 2. Internal State & Derived Models

### Filter Tabs

```typescript
export type AuditFilterTab = 'all' | 'hako_rule' | 'ai_critique' | 'pending';
```

### Stats Computation Model

```typescript
export interface AuditStats {
  total: number;
  hakoCount: number;
  qaCount: number;
  pendingCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
}
```

---

## 3. Transformation & Bridge Pipeline

```
[hakoIssues: QualityIssue[]] -----------> mapHakoIssueToUnified() -------\
                                                                          +---> [unifiedIssues: UnifiedAuditIssue[]]
[qaIssues: DirectQaCritiqueIssue[]] ----> mapQaIssueToUnified() ---------/
                                                                          |
                                                                          v
                                                               [Filter: AuditFilterTab]
                                                                          |
                                                                          v
                                                              [filteredIssues: UnifiedAuditIssue[]]
                                                                          |
                                                                          v
                                                               [Render Compact Cards]
```

### Severity to Design System Token Mapping

| UnifiedSeverity | Badge Tone | Visual Presentation | Meaning |
|---|---|---|---|
| `error` | `tone="danger"` | Amber/Dark Red accent, high contrast | Lỗi quy chuẩn hoặc bỏ sót nghiêm trọng |
| `warning` | `tone="warning"` | Amber border and text | Cảnh báo nghi vấn / lỗi nhỏ cần kiểm tra |
| `info` | `tone="neutral"` | Parchment-2 muted border and text | Góp ý văn phong hoặc thông tin bổ sung |

---

## 4. Lifecycle & UI States

| State | Trigger Condition | Visual Output | Action Available |
|---|---|---|---|
| **Loading** | `isCheckingQa === true` | `<Skeleton>` placeholders animated | Button disabled with spinner |
| **Empty** | `filteredIssues.length === 0` | `<EmptyState>` with ink/parchment styling | Button "Chạy AI Thẩm định" |
| **Error** | `qaError !== null && qaError !== ''` | Error alert with specific message | Button "Thử lại" (`onRunAiQaCritique`) |
| **Populated** | `filteredIssues.length > 0` | Scrollable list of compact issue cards | Click issue card (`onIssueClick`) |
| **Mismatch Alert** | `isMismatch === true` | Amber banner showing paragraph delta | Visual notice for bilingual alignment |
