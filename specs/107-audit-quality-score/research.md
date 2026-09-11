# Research: Translation Quality Audit Score (0-100)

## Overview

This research explores the architecture, mathematical formula, UX presentation, and edge cases for introducing an aggregate quality score (0–100) in the Translation Quality Audit system (`UnifiedAuditPanel` and `auditBridgeService`).

---

## Decision 1: Scoring Formula & Deduction Weights

### Decision
Base score starts at **100**. Deductions are applied exclusively to issues whose `status` is `'pending'`.
- `error`: -8 points
- `warning`: -3 points
- `info`: -1 point
The resulting score is clamped to `[0, 100]` and rounded to the nearest integer.

```typescript
export function calculateAuditScore(issues: UnifiedAuditIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    if (issue.status !== 'pending') continue;
    if (issue.severity === 'error') {
      score -= 8;
    } else if (issue.severity === 'warning') {
      score -= 3;
    } else if (issue.severity === 'info') {
      score -= 1;
    }
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}
```

### Rationale
- 8 points per error means 1 critical error reduces the score to 92 (high quality with minor reservation). 4 errors drop it to 68, crossing into the "Cần rà soát lại" (< 70) threshold, which aligns with editorial intuition where 4 critical flaws (such as raw leaks, serious mistranslations, or hallucinations) indicate an unpolished translation.
- Warnings (-3 points) represent terminology drift or minor stylistic slips: up to 3 warnings keep the score in the "Xuất sắc" tier (91), but 10 warnings drop it into "Khá" (70).
- Info suggestions (-1 point) provide gentle feedback without significantly degrading the score.
- Issues with `status === 'resolved'` or `status === 'ignored'` do not cause deductions. When a user applies a 1-click Auto-Fix or an AI rewrite, the issue transitions to `'resolved'`, and the score recovers immediately.

### Alternatives Considered
- *Multiplicative or percentage decay*: (e.g. `100 * (0.9^errors) * ...`). Rejected: harder for translators to calculate mentally and less predictable.
- *Total word/character count weighting*: (deductions per 1,000 words). Rejected: introduces unnecessary complexity and dependency on raw/translated word counting when chapters in web novels are typically 2,000–4,000 characters.

---

## Decision 2: Qualitative Tiers and Tones

### Decision
Define 3 qualitative tiers with semantic badge tones mapped to the design system:
1. **90 – 100**: "Xuất sắc" (`tone="polish"`)
2. **70 – 89**: "Khá" (`tone="warning"`)
3. **0 – 69**: "Cần rà soát lại" (`tone="danger"`)

```typescript
export interface AuditScoreTier {
  label: string;
  tone: 'polish' | 'warning' | 'danger';
}

export function getAuditScoreTier(score: number): AuditScoreTier {
  if (score >= 90) return { label: 'Xuất sắc', tone: 'polish' };
  if (score >= 70) return { label: 'Khá', tone: 'warning' };
  return { label: 'Cần rà soát lại', tone: 'danger' };
}
```

### Rationale
- Aligns with Vietnamese educational/editorial standards: >=90 (Xuất sắc / Giỏi), 70–89 (Khá), <70 (Trung bình / Cần rà soát lại).
- Tones map cleanly to `src/components/ui/Badge.tsx`: `polish` (emerald/green), `warning` (amber), `danger` (crimson/chu sa).

### Alternatives Considered
- *4 or 5 tiers (e.g. Xuất sắc, Tốt, Khá, Trung bình, Kém)*: Overcomplicates a simple reference score. 3 tiers provide crisp, immediate decision signals (Ready to publish / Minor review / Needs serious editing).

---

## Decision 3: UI Presentation & Advisory Transparency

### Decision
Display in `UnifiedAuditPanel.tsx` header bar alongside `評 Thẩm định chất lượng` and `{stats.total} vấn đề`.
- Use simple text `{score}/100` with `font-mono font-bold text-xs` + `Badge`.
- Enclose in a container with `title="Điểm chất lượng tham khảo ước tính dựa trên số lỗi chưa xử lý, không phải đánh giá tuyệt đối."` and `cursor-help`.
- No gauge wheels, circular progress bars, or canvas charts.

### Rationale
- Adheres to `AGENTS.md` and `.agents/rules/design-system.md` ("tránh giao diện AI slop chung chung", no gratuitous gauges or charts).
- Clear tooltip ensures user understands the score is an advisory heuristic based on remaining unresolved issues, not an absolute judgment.

---

## Decision 4: Reactive Updates

### Decision
In `UnifiedAuditPanel.tsx`, `unifiedIssues` is already memoized against `[hakoIssues, qaIssues, resolvedIssueIds]`.
Deriving:
```typescript
const auditScore = useMemo(() => calculateAuditScore(unifiedIssues), [unifiedIssues]);
const scoreTier = useMemo(() => getAuditScoreTier(auditScore), [auditScore]);
```
ensures that resolving an issue via 1-click Auto-Fix or AI rewrite instantly triggers a recalculation and renders the updated score in < 16ms without network roundtrips or extra state management.
