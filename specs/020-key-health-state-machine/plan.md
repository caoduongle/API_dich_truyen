# Implementation Plan: Key Health State Machine & Recovery Engine

**Branch**: `020-key-health-state-machine` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/020-key-health-state-machine/spec.md`

## Summary

Unify disjointed blacklist and cooldown maps across `geminiService.ts` into a deterministic Key Health State Machine in `quotaService.ts` (`HEALTHY`, `DEGRADED`, `RATE_LIMITED`, `QUOTA_EXHAUSTED`, `AUTH_FAILED`, `COOLDOWN`, `DISABLED`). Record explicit transition causes for every state change and enforce designated recovery policies (TTL auto-recovery, PST midnight quota rollover, success probes, and permanent non-recovery for invalid authentication credentials). Display real state in UI using existing Design System Badges.

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 18+  
**Primary Dependencies**: Express.js, React 19  
**Target Platform**: Node.js Server & React Client  
**Testing**: Vitest (`npm test`), TypeScript compiler (`tsc --noEmit`), Vite production build (`npm run build`)  
**Performance Goals**: State evaluation in <0.01ms  
**Constraints**: Eliminate `blacklistedKeys` Map from `geminiService.ts`; preserve Design System badges and tones; maintain backward-compatible runtime properties.

## Constitution Check

| Principle | Assessment | Status |
|---|---|---|
| **I. Strict Quality Gates & Verification** | Validated via `npm run lint`, `npm test`, and `npm run build`. | **PASS** |
| **II. Dependency Minimization** | Pure TypeScript state machine with no new packages. | **PASS** |
| **III. Strict Concern Separation** | Health state management encapsulated in `quotaService.ts`. | **PASS** |
| **IV. Immutable Core Schemas & Storage Stability** | IndexedDB schemas and `src/types.ts` unmodified. | **PASS** |
| **V. Atomic Commits & Documentation Sync** | Architecture documented across `specs/020-key-health-state-machine/` and test suites. | **PASS** |

## Project Structure

### Documentation (this feature)

```text
specs/020-key-health-state-machine/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── key-health.contract.md
├── checklists/
│   └── requirements.md
└── spec.md              # Feature specification
```

### Source Code Impact Layout

```text
server/
├── services/
│   ├── quotaService.ts                # Enhance KeyHealthState machine, transition reasons & recovery
│   └── geminiService.ts               # Remove legacy blacklistedKeys and delegate to quotaService
└── services/__tests__/
    └── keyHealthStateMachine.test.ts  # Test state transitions and recovery policies

src/
└── components/
    └── QuotaPanel.tsx                 # Render live health state badges (polish, warning, neutral)
```

## Complexity Tracking

> **No violations of constitutional rules identified.**
