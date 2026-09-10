# Research: Unified Audit Issue Types & Bridge Service

## Decision 1: Explicit Severity Translation Tables

### Decision
Define explicit, immutable lookup tables for mapping engine severities to `UnifiedSeverity` in `src/types/audit.ts`:

```typescript
export const HAKO_SEVERITY_MAP: Record<QualityIssueSeverity, UnifiedSeverity> = {
  critical: 'error',
  major: 'error',
  minor: 'warning',
  warning: 'warning',
};

export const QA_SEVERITY_MAP: Record<DirectQaCritiqueIssue['severity'], UnifiedSeverity> = {
  critical: 'error',
  warning: 'warning',
  info: 'info',
};
```

Provide helper functions `mapHakoSeverity(severity: QualityIssueSeverity): UnifiedSeverity` and `mapQaSeverity(severity: DirectQaCritiqueIssue['severity']): UnifiedSeverity` that use these tables and fall back safely to `'warning'` for undefined/unknown values.

### Rationale
- Centralizes mapping logic into single-source-of-truth constants rather than scattered ternary expressions across UI components.
- Hako issues rated `critical` and `major` both indicate serious flaws requiring immediate user attention, thus mapping to `'error'`. `minor` and `warning` map to `'warning'`.
- QA critique issues rated `critical` map to `'error'`, `warning` to `'warning'`, and `info` directly preserves its informational status as `'info'`.

### Alternatives Considered
- *Implicit inline mapping in UI components*: Rejected because it leads to inconsistent severity displays across different views (e.g. editor highlight vs sidebar review).

---

## Decision 2: Category-Based AutoFixable Classification

### Decision
Determine `autoFixable` in `mapHakoIssueToUnified` using an explicit category evaluation:

```typescript
export const AUTO_FIXABLE_HAKO_CATEGORIES: ReadonlySet<QualityIssueCategory> = new Set([
  'raw_leak',    // Heuristic rule can strip or replace un-translated Chinese/CJK characters
  'repetition',  // Heuristic rule can remove redundant adjacent identical paragraphs
]);
```

All other categories evaluate to `autoFixable: false`:
- `mistranslation`, `omission`, `hallucination`: Involve deep cross-lingual semantic discrepancies that cannot be resolved safely with heuristic text replacement; they require LLM re-translation or human editorial judgment.
- `inconsistent_name`, `pronoun_gender`, `terminology_drift`: Involve domain knowledge, character arcs, and glossary context; naive automatic replacement risks introducing unintended grammar and gender errors.
- `wrong_chapter`, `other`: Structural anomalies requiring human inspection.

For QA critique issues, `autoFixable` is always `false` at this stage, as fixing LLM QA defects requires calling Gemini rewrite pipelines (to be developed in later prompts).

### Rationale
- Prevents destructive automated edits on nuanced literary text while enabling one-click resolution for deterministic syntactic defects (raw leaks, duplicated paragraphs).

---

## Decision 3: Deterministic Identification for QA Issues

### Decision
Allow `mapQaIssueToUnified(issue: DirectQaCritiqueIssue, id?: string)` to accept an optional `id` parameter. If not provided, generate a deterministic or timestamped identifier:
`id || 'qa-' + Math.random().toString(36).substring(2, 9)` or similar browser-safe UUID.

### Rationale
- Hako issues always come with `issue.id` (`issue-172...`). QA Critique issues returned from the Gemini JSON array do not contain an `id` field. Allowing an optional `id` parameter lets callers provide an indexed key while ensuring the resulting `UnifiedAuditIssue.id` is never empty or undefined.

---

## Decision 4: Lifecycle Status Mapping

### Decision
- For Hako issues:
  - If `issue.decision === 'dismissed'`, map to `status: 'ignored'`.
  - Otherwise (`'pending'`, `'confirmed'`, `'review_needed'`), map to `status: 'pending'` (active defect requiring attention).
- For QA issues:
  - Always initialize with `status: 'pending'`.
