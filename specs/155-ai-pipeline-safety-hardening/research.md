# Research & Architectural Decisions: AI Pipeline Safety and Validation Hardening

**Feature**: [spec.md](./spec.md) | **Branch**: `155-ai-pipeline-safety-hardening`

## Overview

This research document details the technical strategy for addressing the remaining P1/P2 priorities following the baseline hardening pass:
1. Reconciling UI privacy statements with actual direct-to-Gemini data flows.
2. Hardening prompt inputs against injection and invisible control codes in `sentenceRewrite.ts`.
3. Standardizing structured AI response parsing with type guard validators across all 4 translation services.
4. Implementing a 60-second connection timeout ceiling in `geminiTransport.ts`.
5. Resolving documentation drift in `docs/model-system.md`.

---

## 1. UI Privacy Label Alignment

### Decision
Update `src/components/api-settings/KeyListSection.tsx` to replace the claim `(100% riêng tư, máy chủ không xử lý hay lưu trữ văn bản)` with accurate, transparent copy:
`Ứng dụng dịch trực tiếp từ trình duyệt tới Google Gemini, không có máy chủ trung gian của ứng dụng tiếp nhận hoặc lưu trữ bản thảo. Vui lòng thêm ít nhất một API Key để bắt đầu dịch.`

### Rationale
- Calling an external AI service means manuscript excerpts leave the user's local machine and travel over the network to Google's cloud infrastructure. Calling this "100% private" creates false expectations and directly contradicts the updated `SECURITY.md` and `docs/privacy-policy.md`.
- The new wording accurately describes the architecture: **Zero Application Backend** while acknowledging that Google Gemini is the AI provider.

### Alternatives Considered
- **Hiding all data flow mentions in the key list**: Less informative for new users configuring keys.
- **Full privacy policy excerpt**: Too verbose for a sub-header instruction in the key management modal.

---

## 2. Sentence Rewrite Prompt Sanitization

### Decision
Sanitize `targetText`, `context`, and `issueMessage` in `src/services/translation/sentenceRewrite.ts` using `sanitizePromptInput` before building the prompt string.

### Rationale
- `sanitizePromptInput` in `src/lib/text.ts` strips Unicode Zero-Width spaces (`\u200B`–`\u200D`), Byte Order Marks (`\uFEFF`), direction overrides, and Unicode Tag planes (`\u{E0000}`–`\u{E007F}`).
- While `rawTranslation` and `polishTranslation` already sanitize text inputs, `sentenceRewrite` previously concatenated raw user/issue text directly into the prompt template, creating an injection vector for adversarial text snippets.

### Alternatives Considered
- **Sanitizing only `targetText`**: Incomplete, as `context` and `issueMessage` originate from chapter text and AI critique feedback respectively, both of which are untrusted external inputs.

---

## 3. End-to-End Structured Output Schema Validation

### Decision
Implement explicit TypeScript type guard validators for all structured AI response formats and route decoding through `parseGeminiStructuredResponse`:
1. `rawTranslation.ts`: `isRawTranslationResponse` validating `rawTranslation` / `translation` is string (if present) and `discoveredEntities` is array (if present).
2. `polishTranslation.ts`: `isPolishTranslationResponse` validating `polishedTranslation` / `translation` is string (if present) and `discoveredEntities` is array (if present).
3. `qaCritique.ts`: `isQaCritiqueResponse` validating `issues` is array and `isValid` is boolean.
4. `sentenceRewrite.ts`: `isSentenceRewriteResponse` validating `rewrittenSentence` is string.

### Rationale
- `safeParseJson` only prevents JSON syntax errors; it does not validate property types. If the AI returns `{ "rawTranslation": 123 }` or `{ "rewrittenSentence": {} }`, calling `.trim()` causes uncaught `TypeError: ...trim is not a function`.
- Type guards allow compile-time and runtime validation without external schema dependencies like Zod, satisfying Constitution Principle II (Dependency Minimization).

### Alternatives Considered
- **Adding Zod or Yup schema library**: Rejected because it introduces new external dependencies and increases bundle size when lightweight type guards suffice.
- **Manual typeof checks after parsing**: Repetitive and inconsistent across services. `parseGeminiStructuredResponse` centralizes error logging, fallback values, and context tracking.

---

## 4. General Gemini Transport Timeout Ceiling

### Decision
Enhance `executeGeminiFetch` in `src/services/gemini/geminiTransport.ts` with a default 60-second timeout (`60_000ms`), chained to any caller-supplied `AbortSignal`.

### Rationale
- While `listModelsDirect` has a 15s timeout, main translation requests previously relied entirely on caller signals. If network sockets freeze or Google servers keep HTTP connections open indefinitely without sending bytes, translation queues can hang indefinitely.
- 60 seconds provides sufficient headroom for large translation batches (up to 3,000 Chinese characters) while protecting against zombie connection state.

### Alternatives Considered
- **30-second timeout**: Too aggressive for large context polishing with thinking models.
- **120-second timeout**: Too long for interactive translation feedback; users would assume the app has frozen.

---

## 5. Documentation & Quota Synchronization

### Decision
Update `docs/model-system.md`:
1. Change sequence diagram from `GET /v1beta/models?key=...` to `GET /v1beta/models` with `x-goog-api-key` header authentication.
2. Synchronize Gemma 4 31B IT limits to `30 RPM / 500K TPM` matching `src/config/models.ts`.

### Rationale
- Eliminates documentation drift and ensures architectural references accurately describe security and scheduling contracts.
