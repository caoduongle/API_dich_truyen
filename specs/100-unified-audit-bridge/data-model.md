# Data Model: Unified Audit Issue Types & Bridge Service

## Entity: UnifiedAuditIssue

Represents a normalized quality defect produced by either Hako Quality Engine rules or AI QA Critique.

### Fields

| Field Name | Type | Required | Description | Value Domain / Validation |
|------------|------|----------|-------------|---------------------------|
| `id` | `string` | Yes | Unique defect identifier | Non-empty string (e.g. `issue-1234` or `qa-abcd123`) |
| `source` | `IssueSource` | Yes | Originating detection engine | `'hako_rule' \| 'ai_critique'` |
| `severity` | `UnifiedSeverity` | Yes | Normalized severity rating | `'error' \| 'warning' \| 'info'` |
| `title` | `string` | Yes | Human-readable defect title or category | Non-empty string |
| `message` | `string` | Yes | Detailed explanation or defect description | Non-empty string |
| `targetText` | `string` | No | Verbatim excerpt from Vietnamese text | Optional string (or undefined/empty) |
| `suggestion` | `string` | No | Proposed fix or correction advice | Optional string (or undefined) |
| `autoFixable` | `boolean` | Yes | Whether defect can be auto-resolved | `true` for deterministic rules, `false` otherwise |
| `status` | `'pending' \| 'resolved' \| 'ignored'` | Yes | Lifecycle review status | `'pending'`, `'resolved'`, or `'ignored'` |

---

## Severity Mapping Rules

```text
Hako Severity           Unified Severity
-------------           ----------------
'critical'      ───►    'error'
'major'         ───►    'error'
'minor'         ───►    'warning'
'warning'       ───►    'warning'

QA Severity             Unified Severity
-----------             ----------------
'critical'      ───►    'error'
'warning'       ───►    'warning'
'info'          ───►    'info'
```

---

## Category AutoFixable Rules (Hako Engine)

```text
Category                autoFixable     Rationale
--------                -----------     ---------
'raw_leak'              true            Can deterministically strip/replace un-translated CJK chars
'repetition'            true            Can deterministically prune adjacent identical paragraphs
'inconsistent_name'     false           Requires literary context and character arc inspection
'pronoun_gender'        false           Requires grammatical context and narrative perspective
'terminology_drift'     false           Requires glossary reconciliation and narrative continuity
'mistranslation'        false           Requires bilingual comprehension and re-translation
'omission'              false           Requires re-translation of missing original sentences
'hallucination'         false           Requires pruning hallucinated sentences with semantic care
'wrong_chapter'         false           Structural data error requiring chapter replacement
'other'                 false           Unspecified editorial defect requiring human review
```
