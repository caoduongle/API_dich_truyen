# Implementation Plan: AI Pipeline Safety and Response Validation Hardening

**Branch**: `155-ai-pipeline-safety-hardening` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/155-ai-pipeline-safety-hardening/spec.md`

## Summary

This plan addresses the remaining P1 and P2 priorities from the architectural audit to ensure end-to-end pipeline robustness and honest privacy disclosures:
1. **User Interface Privacy Claim**: Update `src/components/api-settings/KeyListSection.tsx` to remove misleading "100% riêng tư" copy, aligning with the actual zero-application-backend and direct-to-Gemini data flow.
2. **Prompt Sanitization**: Apply `sanitizePromptInput` to `targetText`, `context`, and `issueMessage` in `src/services/translation/sentenceRewrite.ts` to defend against prompt injection and invisible Unicode formatting.
3. **Structured Response Validation**: Standardize structured parsing across all core translation services (`rawTranslation.ts`, `polishTranslation.ts`, `qaCritique.ts`, `sentenceRewrite.ts`) by introducing explicit schema validators and routing through `parseGeminiStructuredResponse`.
4. **Transport Timeout Ceiling**: Add a 60-second default timeout to `executeGeminiFetch` in `src/services/gemini/geminiTransport.ts`, chained to caller abort signals, preventing zombie connections.
5. **Documentation Synchronization**: Synchronize `docs/model-system.md` to reflect header-based authentication (`x-goog-api-key`) and active Gemma 4 31B IT quota configurations.
6. **Maintenance**: Check dependencies and GitHub Actions configuration for deprecation warnings.

---

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19, Vite 6  
**Primary Dependencies**: `@google/genai`, `@tailwindcss/vite`, `motion`, `lucide-react`, `clsx`, `tailwind-merge`  
**Storage**: Client-Side IndexedDB (`src/services/db.ts`), `sessionStorage` (ephemeral credentials), `localStorage` (opt-in preferences)  
**Testing**: Vitest (`npm test`), TypeScript compiler (`npm run lint`), Vite build (`npm run build`)  
**Target Platform**: Modern Web Browsers (Chrome, Edge, Firefox, Safari) running Pure Client-Side SPA  
**Project Type**: Single Page Application (Zero-Backend Client-Direct Architecture)  
**Performance Goals**:
- Zero UI freeze during structured response decoding.
- Network transport terminates or aborts within 60s under connection freeze.
- Prompt sanitization overhead is < 0.1ms per rewrite request.  
**Constraints**: Pure client-side execution, no application backend, zero new NPM dependencies (satisfying Constitution Principle II).  
**Scale/Scope**: 5 service modules, 1 UI component, 1 documentation manifest, and accompanying unit test suites.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance Assessment | Status |
|:---|:---|:---|
| **I. Strict Quality Gates** | Plan requires `npm run lint`, `npm test`, and `npm run build` to pass cleanly with zero skipped or removed tests. | **PASS** |
| **II. Dependency Minimization** | Zero new dependencies introduced. All validation uses native TypeScript type guards and browser Web APIs. | **PASS** |
| **III. MVC Domain Boundaries** | Services and utils remain strictly separated from View components. `KeyListSection.tsx` change is copy-only; translation services remain in `src/services/`. | **PASS** |
| **IV. Schema & Storage Stability** | Core TypeScript interfaces in `src/types.ts` and IndexedDB storage schemas are unchanged. | **PASS** |
| **V. Atomic Commits & Docs** | All changes are focused on pipeline safety and validation. `docs/model-system.md` is synchronized 1:1 with code. | **PASS** |

---

## Project Structure

### Documentation (this feature)

```text
specs/155-ai-pipeline-safety-hardening/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Technical research & decisions (Phase 0)
├── data-model.md        # Entities & validation invariants (Phase 1)
├── quickstart.md        # Validation scenarios & test commands (Phase 1)
├── contracts/           # Interface contracts (Phase 1)
│   ├── translation-payloads.ts
│   └── gemini-transport.ts
├── checklists/
│   └── requirements.md  # Requirements quality checklist
└── tasks.md             # Implementation tasks (/speckit-tasks output)
```

### Source Code (affected paths)

```text
docs/
└── model-system.md                                  # Sync header auth & Gemma quota metadata

src/
├── components/
│   └── api-settings/
│       └── KeyListSection.tsx                       # Remove "100% riêng tư" claim
├── services/
│   ├── gemini/
│   │   ├── geminiTransport.ts                       # Add 60s timeout to executeGeminiFetch
│   │   └── __tests__/
│   │       └── geminiTransport.test.ts              # Unit tests for transport timeout
│   └── translation/
│       ├── rawTranslation.ts                        # Use parseGeminiStructuredResponse + validator
│       ├── polishTranslation.ts                     # Use parseGeminiStructuredResponse + validator
│       ├── qaCritique.ts                            # Use parseGeminiStructuredResponse + validator
│       ├── sentenceRewrite.ts                       # Sanitize inputs, use parser + validator
│       └── __tests__/
│           └── sentenceRewrite.test.ts              # Unit tests for rewrite sanitization & parsing
```

**Structure Decision**:
All modifications refine existing service and component files in place. No new architectural directories are created, maintaining 100% backwards compatibility with all existing imports and test suites.

---

## Complexity Tracking

> No violations of the Constitution occurred. No justification table required.
