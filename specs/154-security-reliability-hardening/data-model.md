# Data Model: Security & Reliability Hardening

**Feature**: [spec.md](./spec.md) | **Branch**: `154-security-reliability-hardening`

## Entities

### 1. Client Credential State (`ClientCredentialState`)

Represents the user's configured AI API keys within the browser environment.

| Field | Type | Storage Location | Default | Description |
|:---|:---|:---|:---|:---|
| `apiKeys` | `string[]` | `sessionStorage` (active) / `localStorage` (if opted-in) | `[]` | List of valid Google Gemini API keys |
| `rememberKeys` | `boolean` | `localStorage['app_ui_prefs'].rememberKeys` | `false` | When `false`, keys exist solely in `sessionStorage` for the tab lifecycle. When `true`, keys persist across browser sessions |
| `savedKeys` | `string[]` | `localStorage['app_ui_prefs'].savedKeys` | `[]` | Persisted keys mirror; MUST be empty if `rememberKeys === false` |

#### State Transitions
```
[User Enters Key]
       │
       ▼
rememberKeys === true?
  ├── YES ──► Save in sessionStorage + localStorage['app_ui_prefs'].savedKeys
  └── NO  ──► Save ONLY in sessionStorage (localStorage purged of savedKeys)
       │
[User Clears Key]
       │
       ▼
Purge from sessionStorage + localStorage + NO residual entries in memory caches
```

---

### 2. Model Discovery Request (`ModelDiscoveryRequest`)

Governs the lifecycle of an external model enumeration network call.

| Field | Type | Default | Description |
|:---|:---|:---|:---|
| `apiKey` | `string` | *(Required)* | Valid API key passed via HTTP header `x-goog-api-key` |
| `timeoutMs` | `number` | `15000` (15s) | Hard ceiling for network roundtrip |
| `signal` | `AbortSignal?` | `undefined` | Caller-provided cancellation signal (e.g. on component unmount) |
| `status` | `enum` | `'idle'` | `'idle'` \| `'pending'` \| `'success'` \| `'timeout'` \| `'error'` |

---

### 3. Structured AI Response Boundary (`StructuredAiResponse<T>`)

Encapsulates the normalization, extraction, and validation of structured outputs from external AI services.

| Field | Type | Description |
|:---|:---|:---|
| `rawText` | `string` | Raw text payload returned by the AI provider |
| `cleanedText` | `string` | Payload with markdown fences and wrapper formatting removed |
| `data` | `T` | Parsed and validated typed output |
| `status` | `enum` | `'valid'` \| `'fallback'` \| `'malformed'` |

#### Validation Lifecycle
```
Raw AI Output (string)
       │
       ▼
safeParseJson(rawText) ──► Fails? ──► Extract balanced bracket substring
       │
       ├── Success ──► Run validator(parsedData)
       │                    ├── Valid ──► Return typed object T
       │                    └── Invalid ──► Throw Error or return fallback
       └── Failure ──► Throw Error or return fallback
```

---

### 4. Data Flow Disclosure Model (`DataFlowDisclosure`)

Defines the formal boundaries of user data lifecycle across the application.

| Data Category | Client Local (`IndexedDB`) | AI Provider (`Google Gemini`) | Cloud Sync (`Google Drive`) | App Server (`Backend`) |
|:---|:---|:---|:---|:---|
| **Manuscript Text** | Primary Storage | Transmitted on translation/QA | Transmitted on explicit sync | **Never** (Zero Backend) |
| **Glossary Terms** | Primary Storage | Transmitted as prompt context | Transmitted on explicit sync | **Never** |
| **API Keys** | Ephemeral / Opt-in | Transmitted via HTTPS header | Never | **Never** |
| **HTTP Access Logs** | N/A | Provider telemetry | Google OAuth telemetry | **CDN / Static Host only** |
