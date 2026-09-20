# Data Model: AI Pipeline Safety & Validation Hardening

**Feature**: [spec.md](./spec.md) | **Branch**: `155-ai-pipeline-safety-hardening`

## Entities

### 1. Structured AI Responses (`AiStructuredPayloads`)

Defines the runtime validated contracts for structured outputs returned by the Google Gemini API across translation stages.

#### Raw Translation Payload (`RawTranslationResponse`)
```typescript
interface RawTranslationResponse {
  rawTranslation?: string;
  translation?: string;
  vietnamese?: string;
  discoveredEntities?: Array<{
    chinese: string;
    vietnamese: string;
    type?: string;
    note?: string;
  }>;
}
```
**Validation Invariants**:
- If `rawTranslation` or `translation` is present, it MUST be of type `string`.
- If `discoveredEntities` is present, it MUST be of type `Array`.

#### Polish Translation Payload (`PolishTranslationResponse`)
```typescript
interface PolishTranslationResponse {
  polishedTranslation?: string;
  translation?: string;
  vietnamese?: string;
  discoveredEntities?: Array<{
    chinese: string;
    vietnamese: string;
    type?: string;
    note?: string;
  }>;
}
```
**Validation Invariants**:
- If `polishedTranslation` or `translation` is present, it MUST be of type `string`.
- If `discoveredEntities` is present, it MUST be of type `Array`.

#### Quality Critique Payload (`QaCritiqueResponse`)
```typescript
interface QaCritiqueResponse {
  isValid?: boolean;
  issues?: Array<{
    category: string;
    explanation: string;
    vietnameseSnippet?: string;
    targetText?: string;
  }>;
}
```
**Validation Invariants**:
- If `issues` is present, it MUST be of type `Array`.
- Each item in `issues` MUST have a non-empty `explanation` string.

#### Sentence Rewrite Payload (`SentenceRewriteResponse`)
```typescript
interface SentenceRewriteResponse {
  rewrittenSentence: string;
}
```
**Validation Invariants**:
- `rewrittenSentence` MUST be a non-empty `string`.

---

### 2. Transport Execution Request (`TransportExecutionRequest`)

Governs HTTP request dispatch to the AI API with connection deadline enforcement.

| Field | Type | Default | Description |
|:---|:---|:---|:---|
| `url` | `string` | *(Required)* | Full Gemini API endpoint URL |
| `apiKey` | `string` | *(Required)* | Google API key sent via header `x-goog-api-key` |
| `payload` | `Record<string, any>` | *(Required)* | Request body containing contents and generation config |
| `signal` | `AbortSignal?` | `undefined` | Caller-provided abort signal |
| `timeoutMs` | `number` | `60000` (60s) | Hard ceiling for connection roundtrip |

#### State Flow
```
executeGeminiFetch(url, apiKey, payload, signal, timeoutMs)
       │
       ▼
Create AbortController + Set 60s Timer
       │
       ├── Caller Signal Aborts? ──► Cancel internal controller & reject
       ├── Timer Expires?       ──► Cancel internal controller & throw TimeoutError
       └── Response Arrives?    ──► Clear Timer & return Response
```
