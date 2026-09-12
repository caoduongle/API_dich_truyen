# Contract Specification: Prompt Pipeline Validation & End-to-End Wiring

**Feature Branch**: `113-verify-prompt-pipeline`  
**Date**: 2026-09-12  
**Status**: Formal Contract  

---

## 1. Contract: `buildRawTranslationPayload` (Phase 1)

### Signature
```typescript
function buildRawTranslationPayload(params: BuildRawTranslationPromptParams): {
    systemInstruction: string;
    prompt: string;
    schema: Record<string, any>;
}
```

### Invariants & Guarantees
- **Genre & Tone Enforcement**:
  - `systemInstruction` MUST contain `getGenreStyleGuide(params.genre)`.
  - `prompt` MUST include lines `Thể loại: ${genre}` and `Tông giọng: ${tone}`.
- **Description Enforcement**:
  - If `params.description` is non-empty, `systemInstruction` MUST include rule:
    `\n9. BẮT BUỘC TUÂN THỦ nguyên tắc xưng hô và phong cách dịch đặc biệt của truyện: ${params.description.trim()}`.
  - `prompt` MUST embed the text under `Nguyên tắc dịch thuật & Quy tắc xưng hô từ cẩm nang:`.
- **Glossary Retention**:
  - When `params.glossary` contains items, `prompt` MUST output the full glossary table under `--- TỪ ĐIỂN TÊN NHÂN VẬT & THUẬT NGỮ (ĐÃ CÓ - BẮT BUỘC TUÂN THỦ) ---`.
  - The string `"(Không có từ điển tùy chọn, dịch tự động...)"` MUST ONLY be emitted when `params.glossary` is genuinely empty or undefined.
  - Pre-substitution in `substitutedText` MUST be idempotent and must NOT duplicate bracket prefixes if terms already begin with `[`.
- **Formatting Preservation**:
  - `systemInstruction` MUST enforce 100% preservation of paragraph breaks (`\n\n`) and isolated chapter titles.

---

## 2. Contract: `buildPolishTranslationPayload` (Phase 2)

### Signature
```typescript
function buildPolishTranslationPayload(params: BuildPolishTranslationPromptParams): {
    systemInstruction: string;
    prompt: string;
    schema: Record<string, any>;
}
```

### Invariants & Guarantees
- **System Instruction Directive**:
  - `systemInstruction` MUST begin with `LITERARY_TRANSLATION_FRAMING`.
  - If `params.description` is non-empty, `systemInstruction` MUST include:
    `\n8. BẮT BUỘC TUÂN THỦ NGUYÊN TẮC DỊCH THUẬT & QUY TẮC XƯNG HÔ CỦA TRUYỆN:\n${params.description.trim()}`.
  - For rounds > 1, `systemInstruction` MUST announce round number and focus directive: `CHỈ ĐẠO TRỌNG TÂM LƯỢT NÀY: ${strategy.directive}`.
- **Additional Instructions**:
  - If `params.additionalInstructions` is provided, `prompt` MUST include:
    `Yêu cầu dịch thuật bổ sung từ người dùng:\n${params.additionalInstructions.trim()}`.
  - If empty, the system MUST fallback to `"Hãy tối ưu ngữ điệu mượt mà, bay bổng nhất có thể, giữ trọn vẹn văn phong tiểu thuyết."`.
- **Glossary Table In Prompt**:
  - Even if `sourceText` was pre-marked with `[Tên_Việt]`, `params.glossary` MUST NOT be empty.
  - `matchedTermsList` MUST be computed and rendered whenever terms from `params.glossary` appear in the source text.
- **Entity Extraction**:
  - When `params.isExtractionEnabled === true`, schema MUST require `discoveredEntities` with fields `chinese`, `pinyin`, `vietnamese`, `type`, `note`.

---

## 3. Contract: `buildQaCritiquePayload` (Phase 3)

### Signature
```typescript
function buildQaCritiquePayload(params: BuildQaCritiquePromptParams): {
    systemInstruction: string;
    prompt: string;
    schema: Record<string, any>;
}
```

### Invariants & Guarantees
- **Context Awareness**:
  - When `params.genre` or `params.tone` is provided, `systemInstruction` MUST instruct AI to evaluate tone against the expected genre convention.
  - When `params.description` is provided, `systemInstruction` MUST instruct AI that non-standard addressing conforming to `description` is INTENTIONAL and MUST NOT be flagged as an omission or hallucination.
  - When `params.glossary` is provided, `prompt` MUST include the glossary reference table so AI can accurately detect `terminology` errors.
- **Error Types & Schema**:
  - Output schema MUST require `isValid: boolean` and `issues: Array<{ type, severity, targetText, description }>`.
  - `type` enum MUST be `["omission", "addition", "repetition", "terminology", "other"]`.
  - `targetText` MUST be exact verbatim Vietnamese text or empty string for complete omissions.

---

## 4. Contract: `rewriteSentenceDirect` (Targeted AI Rewriting)

### Signature
```typescript
function rewriteSentenceDirect(params: DirectRewriteSentenceParams): Promise<DirectRewriteSentenceResult>
```

### Invariants & Guarantees
- `params.targetText` MUST be non-empty.
- If `params.genre` or `params.tone` is passed:
  - `systemInstruction` MUST incorporate style guidance:
    `Phong cách thể loại: ${params.genre}. Tông giọng mong muốn: ${params.tone}.`
- Network payload MUST NOT transmit the full chapter; it MUST only transmit `targetText` and immediate `context`.
- Response MUST parse `rewrittenSentence` and verify that it is non-empty before returning.

---

## 5. Contract: State Persistence & UI Synchronization

### Invariants
1. **`additionalInstructions` Synchronization**:
   - Modifying `additionalInstructions` in `TranslationConfigPanel` MUST update `activeProject.additionalInstructions` in IndexedDB via `onUpdateProject`.
   - Opening `BilingualEditor` for any chapter in the same project MUST reflect the saved `additionalInstructions`.
2. **Batch QA Issues Persistence**:
   - In `chapterTranslationService.ts`, when `enableAiQaCritique === true`, the returned `qaData.issues` MUST be saved into `updatedFullChapter.qaIssues` via `saveChapterToDB`.
   - Loading the chapter in `BilingualEditor` MUST populate `qaIssues` state from `chapter.qaIssues` so they display in `UnifiedAuditPanel` without requiring a re-run.
