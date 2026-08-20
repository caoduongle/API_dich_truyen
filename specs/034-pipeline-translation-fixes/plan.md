# Implementation Plan: Pipeline Translation Hardening (BUG 1 & BUG 2)

**Branch**: `034-pipeline-translation-fixes` | **Date**: 2026-08-20 | **Spec**: [specs/034-pipeline-translation-fixes/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/034-pipeline-translation-fixes/spec.md)

---

## Summary

Resolve two critical issues in the two-stage AI translation pipeline (Raw Translation $\to$ Polishing) through prompt hardening, deterministic chapter title preservation/restoration, Unicode Han character ratio validation, and automatic Divide & Conquer retry triggers.

---

## Technical Context

- **Language/Version**: TypeScript 5.8 / Node.js 20+ (Express 4)
- **Primary Dependencies**: Native regular expressions (zero new dependencies per Principle II)
- **Storage**: Unchanged (no schema modifications per Principle IV)
- **Testing**: `vitest run`
- **Target Platform**: Node.js Backend Server (`server/`)
- **Performance Goals**: Sub-millisecond title preservation & Chinese ratio validation; 100% chapter title retention; 0% untranslated Chinese text leakage to users
- **Constraints**: Strict adherence to project Constitution (Principle I, II, III, IV, V)

---

## Constitution Check

- [X] **Principle I (Quality Gates)**: Mandatory `npm run lint`, `npm test`, and `npm run build` must pass cleanly with 0 errors.
- [X] **Principle II (Zero New Dependencies)**: Reuses existing Unicode Han character regex in `server/utils/text.ts`.
- [X] **Principle III (Backend Scope)**: Focuses strictly on backend translation pipeline (`server/controllers/translation/` and `server/utils/text.ts`).
- [X] **Principle IV (No Schema Churn)**: Preserves `src/types.ts` and IndexedDB schema as-is.
- [X] **Principle V (Atomic Scope)**: Directly addresses BUG 1 and BUG 2 with clean, modular diffs.

---

## Project Structure

### Documentation (this feature)

```text
specs/034-pipeline-translation-fixes/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (/speckit-plan output)
├── research.md          # Phase 0 technical research
├── data-model.md        # Phase 1 data entities and helper signatures
├── quickstart.md        # Phase 1 validation scenarios
├── contracts/           # Phase 1 contracts
│   ├── text-validation.md
│   └── error-handling.md
└── tasks.md             # Phase 2 tasks list (/speckit-tasks output)
```

### Source Code

```text
server/
├── utils/
│   ├── text.ts                       # [MODIFY] Add countChineseCharacters, calculateChineseCharRatio, validateTranslationOutput, isChapterTitleLine, extractChapterTitle, ensureChapterTitlePreserved
│   └── __tests__/
│       └── text.test.ts              # [MODIFY] Unit tests for title preservation & Chinese character detection
├── services/
│   └── geminiService.ts              # [MODIFY] Add UNTRANSLATED_CHINESE_LEFTOVER check to isSafetyOrEmptyError
└── controllers/
    ├── translation/
    │   ├── rawController.ts          # [MODIFY] Add validateTranslationOutput check in callRawTranslationDirect
    │   └── polishController.ts       # [MODIFY] Add prompt hardening, validateTranslationOutput, and ensureChapterTitlePreserved
    └── __tests__/
        └── translationController.test.ts # [MODIFY] Integration tests for title restoration & untranslated Chinese retries
```

---

## Implementation Phases

### Phase 1: Text Utilities & Helper Functions
- Implement `isChapterTitleLine(line)`, `extractChapterTitle(text)`, `ensureChapterTitlePreserved(rawText, polishedText)` in `server/utils/text.ts`.
- Implement `countChineseCharacters(text)`, `calculateChineseCharRatio(text)`, `validateTranslationOutput(text)` in `server/utils/text.ts`.
- Write comprehensive unit tests in `server/utils/__tests__/text.test.ts`.

### Phase 2: Error Classifier & Pipeline Controllers Integration
- Update `isSafetyOrEmptyError` in `server/services/geminiService.ts` to recognize `UNTRANSLATED_CHINESE_LEFTOVER`.
- Update `callRawTranslationDirect` in `server/controllers/translation/rawController.ts` with `validateTranslationOutput`.
- Update `callPolishDirect` in `server/controllers/translation/polishController.ts` with prompt hardening, `validateTranslationOutput`, and `ensureChapterTitlePreserved`.

### Phase 3: Integration Tests & Quality Gates
- Add test cases in `server/controllers/__tests__/translationController.test.ts` for:
  - Model dropping title in Phase 2 $\to$ system restores it.
  - Model returning untranslated Chinese $\to$ system triggers Divide & Conquer retry.
- Run `npm run lint`, `npm test`, `npm run build`.
