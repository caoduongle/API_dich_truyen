# Contract: Unified Audit Bridge Service

## Contract: `src/services/auditBridgeService.ts`

### Exported Functions

```typescript
import type { QualityIssue } from '../types/hakoChecker';
import type { DirectQaCritiqueIssue } from './directTranslationEngine';
import type { UnifiedAuditIssue, UnifiedSeverity } from '../types/audit';

/**
 * Normalizes a Hako Quality Engine issue into a UnifiedAuditIssue.
 */
export function mapHakoIssueToUnified(issue: QualityIssue): UnifiedAuditIssue;

/**
 * Normalizes an AI QA Critique issue into a UnifiedAuditIssue.
 */
export function mapQaIssueToUnified(
  issue: DirectQaCritiqueIssue,
  id?: string
): UnifiedAuditIssue;

/**
 * Helper to map Hako severity to UnifiedSeverity.
 */
export function mapHakoSeverity(severity: QualityIssue['severity']): UnifiedSeverity;

/**
 * Helper to map QA Critique severity to UnifiedSeverity.
 */
export function mapQaSeverity(severity: DirectQaCritiqueIssue['severity']): UnifiedSeverity;
```

### Invariants
1. Both functions are 100% pure (referentially transparent, 0 side effects, 0 async operations, 0 external I/O).
2. For `mapQaIssueToUnified`, `status` is strictly `'pending'` and `autoFixable` is strictly `false`.
3. For `mapHakoIssueToUnified`, `autoFixable` is strictly `true` if and only if `issue.category === 'raw_leak' || issue.category === 'repetition'`.
4. If `issue.decision === 'dismissed'`, `status` evaluates to `'ignored'`.
