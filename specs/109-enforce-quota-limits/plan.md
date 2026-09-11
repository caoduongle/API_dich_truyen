# Implementation Plan: Enforce Personal Quota Limits & Smart Key Selection

**Branch**: `109-enforce-quota-limits` | **Date**: 2026-09-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/109-enforce-quota-limits/spec.md`

## Summary

Resolve quota limit bypass and false-positive provider errors (such as 90 errors on exhausted keys) by:
1. Connecting user-configured personal thresholds (`gemini_quota_custom_limits` in `localStorage`) to `localQuotaTracker.ts` and `directGeminiClient.ts`.
2. Introducing pre-call key availability evaluation (`getKeyHealth`) in `callGeminiDirect` before issuing network requests.
3. Automatically bypassing keys that have met daily limits (`requestsToday >= maxRpd`), are in `QuotaExhausted`, `AuthFailed`, or cooling down, without counting skips as provider errors.
4. Distinguishing personal limit status from upstream Google 429 errors in UI badges.

## Technical Context

**Language/Version**: TypeScript 5.6+, Node.js 18+  
**Primary Dependencies**: React 19, Tailwind CSS v4, Lucide React, Vitest  
**Storage**: Browser `localStorage` (`gemini_quota_custom_limits`), `sessionStorage` (`gemini_local_quota_tracker_v1`), IndexedDB  
**Testing**: Vitest (`npm test`), TypeScript compiler check (`npm run lint`), Vite build (`npm run build`)  
**Target Platform**: Modern Web Browsers (Chrome, Edge, Firefox, Safari)  
**Project Type**: Web Application (React frontend with client-direct AI execution / Zero-Backend mode)  
**Performance Goals**: Instant synchronous key selection (< 1ms), 0 redundant failing HTTP calls, 0 network latency overhead on exhausted keys  
**Constraints**: Zero regression on existing translation workflows, adhere strictly to `.agents/rules/design-system.md`  
**Scale/Scope**: Multi-key management (1 to 20+ keys per user)  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I (Strict Quality Gates)**: Must pass `npm run lint`, `npm test`, `npm run build`. No skipped tests.
- [x] **Principle II (Dependency Minimization)**: Zero new dependencies; reuse existing `localStorage`, `localQuotaTracker`, and UI primitives.
- [x] **Principle III (Strict Concern Separation)**: Quota and key selection logic confined to `src/services/` and tested via Vitest; UI in `src/components/quota-panel/` only reads computed status.
- [x] **Principle IV (Immutable Core Schemas)**: No changes to IndexedDB schemas or `src/types.ts` chapter formats.
- [x] **Principle V (Atomic Commits)**: Scoped changes focused purely on quota enforcement and key dispatching.

## Project Structure

### Documentation (this feature)

```text
specs/109-enforce-quota-limits/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── key-availability.contract.md
│   └── direct-gemini-client.contract.md
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (affected components)

```text
src/
├── services/
│   ├── localQuotaTracker.ts          # Enhance getKeyHealth to enforce maxRpd & findNextAvailableKeyIndex
│   ├── directGeminiClient.ts         # Pre-flight check before fetch, skip exhausted keys
│   └── __tests__/
│       ├── directGeminiClient.test.ts # Add tests for personal limit enforcement & pre-call skips
│       └── clientKeyRotation.test.ts  # Test key rotation with exhausted & custom-limited keys
└── components/
    └── quota-panel/
        └── KeyCardItem.tsx           # Distinct badge for personal limit reached vs Google 429
```

**Structure Decision**: Standard client-side services and UI components under `src/services/` and `src/components/quota-panel/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| None | All designs conform strictly to Constitution principles | N/A |
