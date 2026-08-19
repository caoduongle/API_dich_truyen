# Implementation Plan: Decoupling Logical Requests and Provider Attempts

**Branch**: `018-logical-vs-provider-metrics` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/018-logical-vs-provider-metrics/spec.md`

## Summary

Decouple translation metrics and quota semantics to clearly distinguish between **Logical Translation Requests** (user tasks), **Provider Attempts** (physical upstream calls to Gemini API keys), and **Retries**. This ensures dashboards accurately reflect user throughput while retaining granular per-key physical quota counters for rate-limiting calculations (RPM/TPM/RPD), updating UI labels to intuitive Vietnamese terms without violating the design system.

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19, Node.js 18+  
**Primary Dependencies**: Express.js, React, Tailwind CSS v4, Lucide React  
**Target Platform**: Node.js Server Runtime & Browser Client  
**Testing**: Vitest (`npm test`), TypeScript compiler (`tsc --noEmit`), Vite production build (`npm run build`)  
**Performance Goals**: Zero overhead for metric recording (<0.05ms)  
**Constraints**: Do NOT modify translation prompt logic; do NOT change design system colors or UI component primitives; maintain backward compatibility for existing `requestsTotal`/`requestsToday` snapshot consumers.

## Constitution Check

| Principle | Assessment | Status |
|---|---|---|
| **I. Strict Quality Gates & Verification** | Validated via `npm run lint`, `npm test`, and `npm run build`. | **PASS** |
| **II. Dependency Minimization** | Uses existing in-memory data structures in `quotaService.ts`. No new libraries. | **PASS** |
| **III. Strict Concern Separation** | Metrics recording decoupled from prompt generation and translation business logic. | **PASS** |
| **IV. Immutable Core Schemas & Storage Stability** | IndexedDB schemas and `src/types.ts` unmodified. | **PASS** |
| **V. Atomic Commits & Documentation Sync** | Architecture documented across `specs/018-logical-vs-provider-metrics/` and test suites. | **PASS** |

## Project Structure

### Documentation (this feature)

```text
specs/018-logical-vs-provider-metrics/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── metrics.contract.md
├── checklists/
│   └── requirements.md
└── spec.md              # Feature specification
```

### Source Code Impact Layout

```text
server/
├── services/
│   ├── quotaService.ts                # Add LogicalSummaryStats and recordLogicalRequest
│   ├── geminiService.ts               # Wrap rotation lifecycle with recordLogicalRequest
│   └── __tests__/
│       └── logicalMetrics.test.ts     # Unit tests for logical vs provider metrics & rotation retries
src/
├── components/
│   └── QuotaPanel.tsx                 # Update metric card labels: Yêu cầu dịch / Lượt gọi API / Lượt thử lại
```

## Complexity Tracking

> **No violations of constitutional rules identified.**
