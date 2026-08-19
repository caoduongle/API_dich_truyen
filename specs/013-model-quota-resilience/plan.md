# Implementation Plan: Unified Model Registry, Quota-Aware Scheduling & System Resilience

**Branch**: `013-model-quota-resilience` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/013-model-quota-resilience/spec.md`

---

## Summary

Nâng cấp toàn diện kiến trúc quản lý Model, Điều phối Hạn mức (Quota Scheduler), Kiểm soát Dung lượng Tiên lượng (Admission Control & Predictive TPM), Hàng đợi Request (Structured Queue), Phân loại Lỗi & Ngắt Mạch (Error Taxonomy & Circuit Breaker), Giảm cấp Ổn định khi Redis mất kết nối (Redis Graceful Degradation), Cơ chế Chống Trùng Lặp (Idempotency), Bộ Đệm Khám Phá Model (SWR Discovery Cache), Truy vết Yêu cầu (Request ID Tracing) và Giao diện Giám sát trực quan tuân thủ Design System "Mực & Chu Sa".

---

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js >= 20  
**Primary Dependencies**: React 19, Vite, Tailwind CSS v4, `clsx`, `tailwind-merge`, `motion`, `lucide-react`, Express.js, `ioredis`, `@google/genai`  
**Storage**: Client IndexedDB (dữ liệu dự án/chương), Redis (distributed rate limiting/caching) với In-Memory bounded fallback  
**Testing**: Vitest (`npm test`), TypeScript Compiler (`npm run lint`), Vite build (`npm run build`)  
**Target Platform**: Web Browser (Desktop/Mobile responsive) & Node.js Backend Server  
**Project Type**: Full-stack Web Application (React SPA + Express API Backend)  
**Performance Goals**: Model Selector render < 50ms (qua cache SWR), Pacing Floor 400ms server / 500ms client, 0 memory leak khi Redis down  
**Constraints**: 
- Bảo toàn tuyệt đối HTTP Anti-Abuse (`60 requests / minute / IP`) độc lập với Gemini Key Quota.
- 0 lỗi TypeScript (`npm run lint`), 100% tests pass (`npm test`), build sạch (`npm run build`).
- Tuân thủ nghiêm ngặt Design System "Mực & Chu Sa" và các nguyên tắc trong `AGENTS.md` / `constitution.md`.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check Status | Details / Compliance |
|---|---|---|
| **I. Strict Quality Gates** | PASS | Bắt buộc chạy và pass 100% `npm run lint`, `npm test`, `npm run build` trước khi hoàn tất. |
| **II. Dependency Minimization** | PASS | 100% tái sử dụng các thư viện sẵn có (`ioredis`, `clsx`, `tailwind-merge`, `crypto`, `motion`), không thêm thư viện mới. |
| **III. Concern Separation** | PASS | Phân định rõ ràng giữa UI components, Server Quota/Scheduler, và 2-Phase Translation pipeline. |
| **IV. Schema Stability** | PASS | Giữ nguyên vẹn schema IndexedDB và các nhãn tiếng Việt UI hiện hữu. |
| **V. Atomic Commits & Docs Sync** | PASS | Thực hiện theo đúng thứ tự 18 module, cập nhật tài liệu và hợp đồng đồng bộ. |

---

## Project Structure

### Documentation (this feature)

```text
specs/013-model-quota-resilience/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (this file)
├── research.md          # Technical research & decisions (Phase 0)
├── data-model.md        # Schemas & state machines (Phase 1)
├── quickstart.md        # Run & validation guide (Phase 1)
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── contracts/
    ├── model-registry.contract.md
    ├── quota-scheduler.contract.md
    └── translation-resilience.contract.md
```

### Source Code Impact Matrix

```text
shared/
├── models.ts                    # [MODIFY] Canonical ModelDefinition & Capabilities
└── constants.ts                 # [MODIFY] Model defaults and pacing floor constants

server/
├── constants/
│   └── models.ts                # [MODIFY] Re-export canonical model constants
├── middleware/
│   ├── rateLimiter.ts           # [MODIFY] Redis graceful degradation & bounded local fallback
│   ├── tracingMiddleware.ts     # [NEW] End-to-end Request ID injection & propagation
│   └── idempotencyMiddleware.ts # [NEW] Translation idempotency handler
├── services/
│   ├── geminiService.ts         # [MODIFY] Key health, quota scheduler, circuit breaker, error mapping
│   ├── quotaService.ts          # [MODIFY] KeyHealth state machine & TPM admission tracking
│   ├── modelInfoService.ts      # [MODIFY] Model discovery SWR cache
│   └── metricsService.ts        # [MODIFY] Telemetry metrics
├── controllers/
│   ├── translationController.ts # [MODIFY] Idempotency & request ID integration
│   └── quotaController.ts       # [MODIFY] Key health snapshot endpoint
└── routes/
    └── api.ts                   # [MODIFY] Model validation & custom RPM middleware

src/
├── utils/
│   ├── modelRegistry.ts         # [MODIFY] Canonical model registry & migration logic
│   └── apiClient.ts             # [MODIFY] Request ID & Idempotency key headers
├── hooks/
│   ├── useAIConfig.ts           # [MODIFY] Safe model migration & health state
│   ├── useAutoTranslationQueue.ts # [MODIFY] Admission control & cooperative pacing
│   └── useModelObservability.ts # [MODIFY] Observability metrics
└── components/
    ├── ApiSettings.tsx          # [MODIFY] Model selector lifecycle alerts & key health badges
    └── QuotaPanel.tsx           # [MODIFY] Key health visualizer & dynamic pacing stats
```

---

## Phased Implementation Sequence (18 Modules)

```text
01. Unified Model Registry     ──> Canonical ModelDefinition in @shared/models & server validation
02. Model Lifecycle            ──> active / deprecated / shutdown states with safe migration
03. Model Capability Layer     ──> generateContent validation & capability inspection
04. Quota-Aware Key Scheduler  ──> Key scoring, RPM/TPM feasibility, error penalties
05. Admission Control          ──> Pre-flight token estimation & predictive TPM checks
06. Structured Request Queue   ──> Concurrency control, timeouts, and backpressure protection
07. Error Taxonomy & Retry     ──> Standardized AIErrorCode & deterministic action mapping
08. Circuit Breaker            ──> Closed/Open/HalfOpen state machine per key/model
09. Redis Graceful Degradation ──> Bounded in-memory fallback rate limiter & auto-recovery
10. Request Tracing & Redact   ──> End-to-end requestId propagation & secret redaction
11. API Key Health State       ──> First-class KeyHealth state machine (Healthy, Degraded, etc.)
12. Observability UI           ──> Design-system compliant model & key health visualization
13. Contract Tests             ──> Frontend-backend schema validation tests
14. Idempotency                ──> In-flight deduplication & completed result replay
15. Job Architecture Eval      ──> Documented synchronous/streaming rationale
16. SWR Discovery Cache        ──> Cached model discovery with background revalidation
17. Regression Test Suite      ──> Dedicated test suite locking architectural invariants
18. Final System Audit         ──> Comprehensive lint, test, build verification & final report
```

---

## Complexity Tracking

> **No Constitution Violations Detected**
