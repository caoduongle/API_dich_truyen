# Quickstart & Validation Guide: Feature 174 Glossary Filter & OpenAI-Compatible Adapter

**Feature**: `174-chapter-glossary-filter-openai-adapter`  
**Artifacts**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/174-chapter-glossary-filter-openai-adapter/spec.md) | [data-model.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/174-chapter-glossary-filter-openai-adapter/data-model.md) | [provider-and-glossary-contracts.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/174-chapter-glossary-filter-openai-adapter/contracts/provider-and-glossary-contracts.md)

---

## 1. Prerequisites

- Baseline validation commands:
  - Typecheck: `npm run lint` (`tsc --noEmit`)
  - Test suite: `npm test` (`vitest run`)
  - Production build: `npm run build` (`tsc && vite build`)

---

## 2. End-to-End Validation Scenarios

### Scenario 1 — Strict Chapter Glossary Filter on 577 Entries (`US2`, `FR-001`–`FR-003`, `SC-001`)
1. Prepare a glossary with `577` entries (including `100` entries marked `isPinned: true` that do NOT appear in Chapter 1) and a Chapter 1 Chinese source referencing only `18` entries (including Traditional/Simplified and `variants`).
2. Build prompts via `buildRawTranslationPayload`, `buildPolishTranslationPayload`, `buildQaCritiquePayload`, and `buildAnalyzeGlossaryPayload` under default config (`includePinnedGlossary = false`).
3. Verify each prompt contains ONLY the `18` matching entries (`18/577`), excludes all `559` non-appearing entries (including unreferenced `isPinned` items), and does not exceed matched entries.
4. Toggle `includePinnedGlossary = true` and verify pinned extras append cleanly when explicitly enabled.

### Scenario 2 — OpenAI-Compatible Full 3-Stage Pipeline (`US1`, `FR-004`, `FR-006`, `SC-002`)
1. Switch provider mode to `'openai-compatible'` with preset `'deepseek'` (or `'qwen'` / `'groq'` / `'nvidia-nim'`), Base URL, model ID, and mocked API key.
2. Execute a chapter translation through `executeSingleChapterTranslation` (Raw GĐ1 → Polish GĐ2 → QA Critique GĐ3) with `fetch` mocked to a `/v1/chat/completions` responder.
3. Verify zero requests hit Google Gemini endpoints, all 3 stages target `${baseUrl}/chat/completions`, structured JSON results parse cleanly, and chapter output saves successfully.

### Scenario 3 — Local Ollama / LM Studio Keyless Mode, Model Discovery & CORS Error (`US3`, `US4`, `FR-007`–`FR-008`, `FR-011`, `SC-003`)
1. Select `'ollama'` (`http://localhost:11434/v1`) or `'lm-studio'` (`http://localhost:1234/v1`) with an empty API keys array `[]`.
2. Verify `testOpenAIConnection`, `listOpenAIModels`, and `executeSingleChapterTranslation` succeed without requiring an API key and omit the `Authorization` header.
3. Reject insecure remote `http://` URLs via `validateProviderBaseUrl('http://api.example.com/v1')`.
4. Mock a browser `TypeError: Failed to fetch` against `http://localhost:11434/v1` and confirm the error message clearly surfaces Vietnamese CORS setup instructions (`OLLAMA_ORIGINS` / LM Studio CORS).

### Scenario 4 — Reasoning `<think>` Tag Stripping, Schema Downgrade & Gemini Regression Safety (`US4`, `FR-005`, `FR-010`, `SC-004`, `SC-005`, `SC-006`)
1. Mock HTTP `400` rejecting `response_format.type = "json_schema"` on the 1st request; confirm `callOpenAICompatible` retries immediately with `json_object` (and `prompt_only` if needed) and parses `<think>internal reasoning</think>\n\`\`\`json {"rawTranslation": "...", "discoveredEntities": []} \`\`\`` cleanly.
2. Switch back to `'gemini'` mode and confirm Gemini multi-key rotation and Feature 173 per-model quota checks remain 100% functional.
3. Verify raw API keys never appear in thrown errors or translation logs (`SC-006`).

---

## 3. Quality Gate Execution

```bash
npm run lint; if ($LASTEXITCODE -eq 0) { npm test }; if ($LASTEXITCODE -eq 0) { npm run build }
```
