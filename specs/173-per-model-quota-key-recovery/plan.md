# Implementation Plan: Cô lập Hạn mức theo Mô hình, Khôi phục Trạng thái Khóa & Minh bạch Nguyên nhân Cạn Quota

**Branch**: `173-per-model-quota-key-recovery` | **Date**: 2026-11-28 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/173-per-model-quota-key-recovery/spec.md)  
**Input**: Feature specification from `/specs/173-per-model-quota-key-recovery/spec.md`

## Summary

Feature `173-per-model-quota-key-recovery` khắc phục trực tiếp 5 điểm nghẽn phát hiện từ nhật ký dịch thực tế và Bảng điều khiển Quota:
1. Cô lập máy trạng thái hạn mức (`Healthy`, `RateLimited`, `Cooldown`, `Degraded`, `QuotaExhausted`) theo từng cặp `(Key, Model)` trong `LocalQuotaTracker` (chỉ giữ `AuthFailed` ở cấp toàn khóa) để đổi sang model còn quota chạy được ngay (`FR-001`, `FR-002`, `FR-011`).
2. Chấm dứt việc tự nâng cấp oan lỗi `429` mơ hồ (`MessageFallback_AmbiguousQuota`) thành `QuotaExhausted` sau lần lỗi thứ 2 liên tiếp khi lượt dùng ngày còn thấp — thay bằng tạm nghỉ ngắn hạn tăng dần có trần `<= 120s` (`60s -> 120s`) và chỉ khóa ngày khi nhà cung cấp báo cạn ngày tường minh (`per day`/`RPD`) hoặc chạm ngưỡng tự đặt (`FR-009`).
3. Phân tích đúng chuỗi thời lượng ghép (`12h5m53.421929668s`) để đếm ngược mốc mở lại thực tế (`FR-006`), bổ sung nút **Mở khóa** / **Mở khóa tất cả** kèm bảo vệ `maxRpd` cá nhân và hiển thị rõ nguyên nhân khóa ngay trên thẻ khóa (`FR-003`, `FR-004`, `FR-005`).
4. Chuẩn hóa tham chiếu giới hạn theo dòng model (`15 RPM / 250K TPM / 500 RPD` cho Flash Lite thay vì `1M TPM`) và hiển thị chính xác số khóa khả dụng của model đang chọn trên banner (`FR-007`, `FR-008`).
5. Mở rộng dung sai căn chỉnh cấu trúc đoạn GĐ1 có điều kiện (0 chữ Hán sót, đủ độ dài, giữ tiêu đề) để giảm chia nhỏ cấp 1 thừa gây tốn RPD (`FR-010`).

## Technical Context

**Language/Version**: TypeScript ~5.8.2 (`strict` mode) + React 19.0.1 + Vite 6.4.6  
**Primary Dependencies**: `@google/genai`, `lucide-react`, `motion`, `clsx`, `tailwind-merge` (zero new npm dependencies added)  
**Storage**: Client-side `sessionStorage` (`gemini_local_quota_tracker_v1`) & `localStorage` (`gemini_quota_custom_limits`, `gemini_discovered_models`, `gemini_custom_models`); IndexedDB (`src/services/db.ts`) & `src/types.ts` untouched  
**Testing**: Vitest 4.1.12 (`vitest run`) with `jsdom` 29.1.1  
**Target Platform**: Pure client-side Web SPA (desktop/mobile modern browsers)  
**Project Type**: Pure Client-Side Web Application (React + TypeScript SPA)  
**Performance Goals**: O(N_keys) quota status calculation, zero extra network calls for local unlock/summary, `React.memo` leaf card preservation (`KeyCardItem`)  
**Constraints**: Strict MVC separation (`Services/Utils -> Hooks -> Components`); full backward compatibility with legacy `sessionStorage` snapshots and callers omitting `model`; ink-and-cinnabar design system (`#14100D` / `#B8402C` / `amber-950/300`, `rounded-[2px]`, no emojis); zero raw API key exposure  
**Scale/Scope**: Client pool of up to `20` API keys (`MAX_API_KEYS_PER_REQUEST`), multi-model quota tracking per key, 6 service/config/util files + 1 hook + 4 UI components + unit/UI regression tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Pre-Design | Post-Design | Verification Notes |
|-----------|------------|-------------|-------------------|
| **I. Strict Quality Gates & Verification** | PASS | PASS | Implementation must pass `npm run lint`, `npm test`, and `npm run build` cleanly; existing tests updated only where behavior intentionally changed (`rpmProactiveGateAndRecovery.test.ts`). |
| **II. Dependency Minimization & Existing Library Reuse** | PASS | PASS | Reuses existing `Button`, `Badge`, `CountdownBadge`, `lucide-react`, `cn()`. Zero packages added. |
| **III. Strict Concern Separation & MVC** | PASS | PASS | Model/Service logic stays in `src/services/`, `src/utils/`, `src/config/`, `src/types/quota.ts`; state orchestration in `src/hooks/useModelObservability.ts`; presentation in `src/components/`. No upward imports. |
| **IV. Immutable Core Schemas & Storage Stability** | PASS | PASS | `src/types.ts` and IndexedDB schema (`src/services/db.ts`, `DB_VERSION = 5`) remain completely untouched. Legacy `sessionStorage` data migrates lazily in memory without breaking. |
| **V. Atomic Commits & Documentation Synchronization** | PASS | PASS | Design artifacts synchronized under `specs/173-per-model-quota-key-recovery/`; changes strictly scoped to Feature 173 FRs. |

## Project Structure

### Documentation (this feature)

```text
specs/173-per-model-quota-key-recovery/
├── spec.md                                 # Feature specification (updated Session 2026-11-28)
├── checklists/
│   └── requirements.md                     # Spec quality checklist (16/16 pass)
├── plan.md                                 # This implementation plan
├── research.md                             # Phase 0 design decisions (D1–D6)
├── data-model.md                           # Phase 1 entities & state transitions
├── quickstart.md                           # Phase 1 end-to-end validation guide
└── contracts/
    └── quota-recovery-contracts.md         # Service, hook, and UI contracts
```

### Source Code (repository root)

```text
src/
├── types/
│   └── quota.ts                            # Optional per-model health fields on ModelUsageStats & KeyRuntimeStatus
├── config/
│   └── models.ts                           # Accurate reference limits (250K TPM / 500 RPD for Flash Lite presets)
├── utils/
│   ├── modelRegistry.ts                    # getModelReferenceLimits() + runtime-aware computeModelStatsSummary()
│   └── __tests__/modelRegistry.test.ts     # Tests for model reference limits & runtime summary
├── services/
│   ├── localQuotaTracker.ts                # Per-(Key, Model) state machine, no ambiguous 429 escalation, compound delay, unlockKey/unlockAllKeys
│   ├── gemini/
│   │   ├── geminiErrorClassifier.ts        # Compound duration parser (12h5m53s) + recommendedCooldownMs on RPD errors
│   │   ├── geminiKeyScheduler.ts           # Pass options.model into key pool checks & cooldown inspection
│   │   └── geminiClient.ts                 # Propagate active modelName into KeyHealthOptions
│   ├── translation/
│   │   └── rawTranslation.ts               # Safe GĐ1 minor paragraph-count variance guard to cut redundant splits
│   └── __tests__/                          # Unit tests for tracker, classifier, client, scheduler, raw split guard
├── hooks/
│   └── useModelObservability.ts            # Accept selectedModel + expose unlockKey / unlockAllKeys actions
└── components/
    ├── ApiSettings.tsx                     # Pass selectedModel into useModelObservability
    ├── QuotaPanel.tsx                      # Model-aware limit fallbacks, accurate availability badge, Unlock All button
    ├── quota-panel/
    │   ├── KeyCardItem.tsx                 # Explicit lock-reason callout, per-key Unlock button, per-model status badge
    │   └── CustomLimitsPanel.tsx           # Show selectedModel reference defaults when uncustomized
    └── __tests__/                          # QuotaPanelMetrics / QuotaPanelHealthBadges tests
```

**Structure Decision**: Single pure client-side React + TypeScript SPA layout matching the existing MVC directory structure (`src/services/`, `src/utils/`, `src/hooks/`, `src/components/`).

## Complexity Tracking

> No Constitution violations; no complexity exceptions required.
