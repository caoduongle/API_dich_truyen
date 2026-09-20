# Quickstart Validation Guide: AI Pipeline Safety & Validation Hardening

**Feature**: [spec.md](./spec.md) | **Branch**: `155-ai-pipeline-safety-hardening`

This guide outlines runnable verification procedures to validate that the pipeline safety and structured validation improvements work properly end-to-end.

---

## Prerequisites

- Node.js 20+ installed
- Working directory: Repository root (`e:\tailieuhoctap\laptrinhnangcao\th\merged`)
- Dependencies installed (`npm install`)

---

## Verification Scenarios

### 1. UI Privacy Label Verification

**Objective**: Verify that `KeyListSection.tsx` contains no misleading "100% riêng tư" claims.

**Run Command**:
```bash
npx vitest run src/components/__tests__/KeyListSectionLagFix.test.ts
```

**Manual Inspection**:
- Open `src/components/api-settings/KeyListSection.tsx` and confirm line 255 does not include "100% riêng tư".

---

### 2. Sentence Rewrite Prompt Sanitization & Parsing

**Objective**: Verify that `rewriteSentenceDirect` strips hidden characters from prompt inputs and uses `parseGeminiStructuredResponse` with `isSentenceRewriteResponse`.

**Run Command**:
```bash
npx vitest run src/services/translation/__tests__/sentenceRewrite.test.ts
```

**Expected Outcome**:
- Injected control characters in `targetText`, `context`, and `issueMessage` are stripped.
- Invalid non-string responses throw descriptive validation errors.

---

### 3. Translation Stages Structured Response Validation

**Objective**: Verify that `rawTranslation.ts`, `polishTranslation.ts`, and `qaCritique.ts` safely handle malformed or unexpected response types.

**Run Command**:
```bash
npx vitest run src/services/__tests__/chapterTranslationService.test.ts src/services/translation/__tests__/
```

**Expected Outcome**:
- Translation and critique stages succeed or fail gracefully with clean error messages without throwing unhandled `TypeError: ...trim is not a function`.

---

### 4. Transport Connection Timeout (60s)

**Objective**: Verify that `executeGeminiFetch` aborts on connection stalls and cleans up timers.

**Run Command**:
```bash
npx vitest run src/services/gemini/__tests__/geminiTransport.test.ts
```

**Expected Outcome**:
- Stalled requests automatically trigger abort and reject after the configured timeout.
- Providing an external signal cancels the fetch immediately and clears the timer.

---

### 5. Full Quality Gate Verification

**Run Commands**:
```bash
npm run lint
npm test
npm run build
```

**Expected Outcome**:
- Zero type errors (`npm run lint`).
- 100% passing tests (`npm test`).
- Production build succeeds cleanly (`npm run build`).
