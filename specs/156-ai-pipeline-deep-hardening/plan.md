# Implementation Plan: AI Pipeline Deep Hardening and Structural Resilience

**Branch**: `156-ai-pipeline-deep-hardening` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/156-ai-pipeline-deep-hardening/spec.md`

## Summary

Commit `090b0398` introduced structured response parsing, prompt sanitization, and transport timeouts for the AI translation pipeline. However, audit revealed three P1 gaps and several P2 issues that undermine the hardening:

1. **Schema-invalid JSON bypass**: Valid JSON with wrong keys can pass the validator and then be mistakenly used as translated text via a legacy plain-text fallback path.
2. **Entity item-level crash risk**: `discoveredEntities: any[]` flows through the pipeline without field validation, causing `.trim()` crashes in `useWorkspaceState.ts` when AI omits fields.
3. **Incomplete prompt sanitization**: `genre`, `tone`, `description`, `additionalInstructions`, and glossary fields are interpolated into prompts without `sanitizePromptInput()`.
4. **Per-key timeout accumulation**: 60s timeout applies per key attempt, not cumulatively, so N keys can stall up to N×60s.
5. **Documentation/config drift**: Quota labels, model labels, Vitest vulnerability, and privacy-policy placeholder.

The plan addresses all items through targeted modifications to the parsing layer, entity validation, prompt construction, transport client, and documentation.

## Technical Context

**Language/Version**: TypeScript 5.8, React 19, Vite 6

**Primary Dependencies**: `@google/genai`, `clsx`, `tailwind-merge`, `motion`, `lucide-react`, `yjs`, `y-indexeddb`

**Storage**: IndexedDB (client-side), Google Drive v3 REST API (optional sync)

**Testing**: Vitest 4.1.x (to be updated to ≥4.1.11)

**Target Platform**: Modern browsers (Chrome, Firefox, Safari, Edge)

**Project Type**: Pure Client-side SPA (Zero Application Backend)

**Performance Goals**: Translation requests complete within 60s cumulative deadline

**Constraints**: No new dependencies (Constitution Principle II); no schema/storage mutations for UI tasks (Principle IV)

**Scale/Scope**: 5 source files modified, 3-4 test files modified/created, 4 documentation files updated

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
| :--- | :--- | :--- |
| **I. Strict Quality Gates** | ✅ Pass | All 3 gates (`lint`, `test`, `build`) required to pass. No tests deleted or skipped. |
| **II. Dependency Minimization** | ✅ Pass | No new dependencies added. Vitest bumped from 4.1.9 → 4.1.11 (patch, not new dep). |
| **III. MVC Separation** | ✅ Pass | Changes confined to Model/Service layer (`src/services/`, `src/lib/`) and documentation. No UI component changes. Hook changes limited to defensive entity handling. |
| **IV. Immutable Core Schemas** | ✅ Pass | `src/types.ts` not modified. `translation/types.ts` changes `any[]` → `DiscoveredEntity[]` (type narrowing, not schema mutation). No IndexedDB schema changes. |
| **V. Atomic Commits** | ✅ Pass | Changes organized into 5 cohesive modules: parser, entity validation, sanitization, transport, docs. |

## Project Structure

### Documentation (this feature)

```text
specs/156-ai-pipeline-deep-hardening/
├── plan.md              # This file
├── research.md          # Phase 0 output — completed
├── data-model.md        # Phase 1 output — completed
├── quickstart.md        # Phase 1 output — completed
├── contracts/
│   └── internal-contracts.md  # Phase 1 output — completed
└── tasks.md             # Phase 2 output (via /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── text.ts                          # [MODIFY] parseGeminiStructuredResponseWithState,
│   │                                    #          validateDiscoveredEntity, tighten validators
│   ├── sinoNormalize.ts                 # (no changes needed — entity validation added upstream)
│   └── __tests__/
│       └── text.test.ts                 # [MODIFY] new tests for tri-state parser, entity validator,
│                                        #          tightened type guards
├── services/
│   ├── ai/
│   │   ├── prompts.ts                   # [MODIFY] sanitize genre, tone, description,
│   │   │                                #          additionalInstructions, glossary fields
│   │   └── __tests__/
│   │       └── prompts.test.ts          # [MODIFY/NEW] sanitization coverage tests
│   ├── gemini/
│   │   ├── geminiClient.ts              # [MODIFY] cumulative deadline logic
│   │   ├── geminiTransport.ts           # (no changes — already accepts timeoutMs)
│   │   └── __tests__/
│   │       └── geminiClient.test.ts     # [MODIFY] cumulative deadline tests
│   ├── translation/
│   │   ├── types.ts                     # [MODIFY] any[] → DiscoveredEntity[]
│   │   ├── rawTranslation.ts            # [MODIFY] use tri-state parser, gate fallback
│   │   ├── polishTranslation.ts         # [MODIFY] use tri-state parser, gate fallback
│   │   ├── sentenceRewrite.ts           # [MODIFY] sanitize genre/tone
│   │   └── qaCritique.ts               # (no changes — already safe)
│   ├── chapterTranslationService.ts     # [MODIFY] defensive entity field access
│   └── directGeminiClient.ts            # (no changes — facade delegates to callGemini)
├── hooks/
│   └── useWorkspaceState.ts             # [MODIFY] defensive entity field access
├── config/
│   └── models.ts                        # [MODIFY] labels, timestamps, quota terminology
└── types.ts                             # (no changes)

docs/
├── model-system.md                      # [MODIFY] quota terminology, model labels
└── privacy-policy.md                    # [MODIFY] replace placeholder date

package.json                             # [MODIFY] vitest ^4.1.11
```

**Structure Decision**: Modifications are confined to the existing single-project SPA structure. No new modules or directories are created beyond the `contracts/` subfolder in the specs directory.

## Complexity Tracking

No Constitution violations requiring justification. All changes are within existing module boundaries and use only existing dependencies.
