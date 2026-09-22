# Data Model: AI Pipeline Deep Hardening

**Feature**: `156-ai-pipeline-deep-hardening` | **Date**: 2026-09-22

## Entities

### 1. StructuredParseResult\<T\> (NEW)

Tri-state wrapper returned by the enhanced `parseGeminiStructuredResponse`.

| Field | Type | Description |
| :--- | :--- | :--- |
| `data` | `T \| null` | Parsed and validated data (null when parse or validation fails) |
| `state` | `'VALID' \| 'PARSE_FAILED' \| 'SCHEMA_INVALID'` | Classification of the parse outcome |

**State transitions**:
- Input text → `safeParseJson` fails → `{ data: null, state: 'PARSE_FAILED' }`
- Input text → `safeParseJson` succeeds → validator rejects → `{ data: null, state: 'SCHEMA_INVALID' }`
- Input text → `safeParseJson` succeeds → validator passes → `{ data: parsed, state: 'VALID' }`

---

### 2. DiscoveredEntity (NEW — replaces `any` in pipeline)

Validated, strongly-typed entity extracted from AI translation responses.

| Field | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `chinese` | `string` | Yes | — | Source Chinese characters (preserved original form) |
| `pinyin` | `string` | Yes | `''` | Sino-Vietnamese pronunciation |
| `vietnamese` | `string` | Yes | `''` | Vietnamese translation / restored English name |
| `type` | `GlossaryType` | Yes | `'other'` | Classification: `'character' \| 'location' \| 'term' \| 'phrase' \| 'other'` |
| `note` | `string` | Yes | `''` | Contextual annotation |
| `needsReview` | `boolean` | No | `false` | Flag for hallucination suspect / unmatched entity |

**Validation rules**:
- `chinese` must be a non-empty string after `.trim()`. Entries with empty `chinese` are filtered out.
- `pinyin`, `vietnamese`, `note` must be strings; if missing or non-string, default to `''`.
- `type` must be a valid `GlossaryType` enum value; if invalid, default to `'other'`.
- `needsReview` must be boolean; if missing/non-boolean, default to `false`.

---

### 3. DirectRawTranslationResult (MODIFIED)

| Field | Type (Before) | Type (After) |
| :--- | :--- | :--- |
| `rawTranslation` | `string` | `string` (unchanged) |
| `discoveredEntities` | `any[]` | `DiscoveredEntity[]` |
| `successKeyIndex` | `number` | `number` (unchanged) |

---

### 4. DirectPolishTranslationResult (MODIFIED)

| Field | Type (Before) | Type (After) |
| :--- | :--- | :--- |
| `polishedTranslation` | `string` | `string` (unchanged) |
| `discoveredEntities` | `any[]` → optional | `DiscoveredEntity[]` → optional |
| `successKeyIndex` | `number` | `number` (unchanged) |
| `isPartial` | `boolean` → optional | `boolean` → optional (unchanged) |

---

### 5. CumulativeDeadlineOptions (NEW — in geminiClient)

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `overallDeadlineMs` | `number` | `60_000` | Maximum total wall-clock time for the entire logical request |
| `minPerAttemptMs` | `number` | `5_000` | Minimum timeout granted to each individual attempt |

---

### 6. Existing Validators (MODIFIED)

#### `isRawTranslationResponse` — Tightened

**Before**: Accepts `{}` (all keys optional, no presence check).
**After**: Requires at least one known translation key (`rawTranslation`, `translation`, `vietnamese`, `text`, `output`, `raw_translation`) to be a non-empty string.

#### `isPolishTranslationResponse` — Tightened

**Before**: Accepts `{}`.
**After**: Requires at least one known translation key to be a non-empty string.
