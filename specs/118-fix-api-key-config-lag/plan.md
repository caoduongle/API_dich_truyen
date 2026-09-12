# Implementation Plan: Fix AI Configuration Modal Lag & API Key Lifecycle

**Branch**: `118-fix-api-key-config-lag` | **Date**: 2026-09-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/118-fix-api-key-config-lag/spec.md`

## Summary

Eliminate modal lag, dropped keystrokes, and misleading "no keys available" warnings by:
1. Buffering API key input locally in `KeyListSection.tsx` with debounced synchronization, preventing root application re-renders during typing.
2. Adding a length/validity guard in `useModelDiscovery.ts` to stop sending premature HTTP discovery requests on intermediate keystrokes.
3. Correcting model availability assessment in `computeModelStatsSummary` and `ModelSummaryCard.tsx` so preset models are presumed ready and supported, removing false negative "Model đang chọn hiện không có API key nào hỗ trợ" warnings.
4. Adding an instant "Kiểm tra kết nối" button for each key slot to provide immediate validation feedback.
5. Providing user-controlled persistent key retention across browser sessions.

## Technical Context

**Language/Version**: TypeScript 5.6+, Node.js 18+  
**Primary Dependencies**: React 19, Tailwind CSS v4, Lucide React, Vitest  
**Storage**: `sessionStorage` (`gemini_api_keys`), `localStorage` (`gemini_remember_keys`), IndexedDB  
**Testing**: Vitest (`npm test`), TypeScript compiler check (`npm run lint`), Vite build (`npm run build`)  
**Target Platform**: Modern Web Browsers (Chrome, Edge, Firefox, Safari)  
**Project Type**: Pure Client-Side SPA (Zero-Backend Mode)  
**Performance Goals**: 60 FPS smooth typing in input fields (< 16ms input latency), zero network queries during typing, instant modal launch  
**Constraints**: Zero regression on existing translation workflows, preserve all tests in `credentialStorage.test.ts` and `storageAudit.test.ts`, comply strictly with `.agents/rules/design-system.md`  
**Scale/Scope**: Multi-key management (1 to 20+ keys)  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I (Strict Quality Gates)**: Must pass `npm run lint`, `npm test`, `npm run build`. No skipped tests.
- [x] **Principle II (Dependency Minimization)**: Zero new NPM packages added; reuse existing primitives (`clsx`, `lucide-react`, `Button`, `Badge`).
- [x] **Principle III (Strict Concern Separation)**: Presentation in `src/components/`, hook state in `src/hooks/`, logic in `src/utils/` and `src/services/`.
- [x] **Principle IV (Immutable Core Schemas)**: No changes to IndexedDB schemas or `src/types.ts` core interfaces.
- [x] **Principle V (Atomic Commits)**: Scoped changes focused purely on AI settings modal performance and key lifecycle.

## Project Structure

### Documentation (this feature)

```text
specs/118-fix-api-key-config-lag/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── key-config-interaction.contract.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (affected components)

```text
src/
├── components/
│   ├── ApiSettings.tsx                       # Pass clean props, remove duplicate hook invocations
│   ├── QuotaPanel.tsx                        # Avoid running redundant duplicate useModelObservability
│   └── api-settings/
│       ├── KeyListSection.tsx                # Local draft state, debounced updates, key test button
│       └── ModelSummaryCard.tsx              # Accurate support status, eliminate false negative alerts
├── hooks/
│   ├── useAIConfig.ts                        # Key retention option, stable array references
│   └── useModelDiscovery.ts                  # Guard against probing incomplete keys, debounced refresh
├── utils/
│   └── modelRegistry.ts                      # Update computeModelStatsSummary to support preset defaults
└── services/
    └── modelVerificationService.ts           # Fast single-key ping integration
```

**Structure Decision**: Standard client-side React components, hooks, and utility modules adhering to MVC principles.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| None | All designs conform strictly to Constitution principles | N/A |
