# Implementation Plan: Clean Code & Refactor

**Branch**: `068-clean-code-refactor` | **Date**: 2026-08-23 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/068-clean-code-refactor/spec.md)

**Input**: Feature specification from `specs/068-clean-code-refactor/spec.md`

## Summary

Tái cấu trúc các module và components lớn (>500 dòng) trong toàn bộ dự án nhằm giảm độ phức tạp (cyclomatic complexity), phân tách rõ ràng trách nhiệm theo từng domain, và đảm bảo mọi file sau refactor đều dưới 400 dòng mà không làm thay đổi bất kỳ hành vi nào của ứng dụng (zero functional regression).

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Node.js / Express
**Primary Dependencies**: React 19, Lucide React, Tailwind v4, Helmet, ioredis
**Storage**: IndexedDB (db.ts — giữ nguyên không sửa), SessionStorage, LocalStorage
**Testing**: Vitest (`npm test`), Type checking (`npm run lint`), Bundler (`npm run build`)
**Target Platform**: Web SPA + Node backend
**Project Type**: Monorepo
**Performance Goals**: Không suy giảm hiệu năng render hay latency server; giảm memory footprint và bundle parse time nhờ code tách biệt
**Constraints**: Zero functional change, không thêm dependencies mới, không thay đổi core schemas (`src/types.ts`), không sửa logic dịch / prompt AI

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Justification |
|-----------|--------|---------------|
| I. Strict Quality Gates | ✅ PASS | Bắt buộc chạy `npm run lint`, `npm test`, `npm run build` sau mỗi batch |
| II. Dependency Minimization | ✅ PASS | Không cài đặt thêm bất kỳ npm dependency nào |
| III. Concern Separation | ✅ PASS | Tách bạch transport, scheduling, circuit breaker, và UI view components |
| IV. Immutable Core Schemas | ✅ PASS | `src/types.ts` và IndexedDB schemas hoàn toàn giữ nguyên |
| V. Atomic Commits & Docs | ✅ PASS | Phân chia thành 5 batch độc lập, mỗi batch hoàn chỉnh và testable |

**Gate Result**: ✅ ALL PASS — proceed to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/068-clean-code-refactor/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit-tasks)
```

### Source Code Refactoring Layout

#### Batch 1: Backend Quota Service Decomposition
```text
server/services/
├── quota/
│   ├── circuitBreaker.ts       # [NEW] Quản lý model cooldowns, group cooldowns & provider outage
│   ├── groupManager.ts         # [NEW] Quản lý quota group registration, validation & bucket bindings
│   ├── keyScheduler.ts         # [NEW] Lập lịch key, interval pacing & lease scheduling
│   ├── quotaAccountant.ts      # [NEW] Ghi nhận usage, error classification, health & token stats
│   └── quotaTelemetry.ts       # [NEW] Request attempt logging, latency tracking & logical summary
└── quotaService.ts             # [REFACTOR] Facade mỏng kết hợp các sub-modules, giữ nguyên 100% public API
```

#### Batch 2: Google Drive Sync Service Decomposition
```text
src/services/
├── google-drive/
│   ├── driveRestClient.ts      # [NEW] Low-level REST transport wrapper (auth headers, upload/download, error handling)
│   ├── driveProjectSync.ts     # [NEW] Monolithic project push/pull & timestamp reconciliation
│   └── driveGranularSync.ts    # [NEW] Granular chapter & CRDT manifest sync engine
└── googleDriveSyncService.ts   # [REFACTOR] Facade mỏng re-export và ủy quyền, giữ nguyên 100% public API
```

#### Batch 3: QuotaPanel & ApiSettings Subcomponents Extraction
```text
src/components/
├── quota-panel/
│   ├── CountdownBadge.tsx      # [NEW] Extracted standalone countdown timer badge
│   ├── ModelLimitsEditor.tsx   # [NEW] Extracted custom RPM/RPD/TPM limit editor
│   └── GroupQuotaCard.tsx      # [NEW] Extracted quota group card view
├── QuotaPanel.tsx              # [REFACTOR] Giảm từ 950 dòng xuống <300 dòng
├── api-settings/
│   ├── ModelSummaryCard.tsx    # [NEW] Extracted model health & capability summary card
│   ├── KeyListSection.tsx      # [NEW] Extracted API key list management & verification panel
│   └── CustomModelSection.tsx  # [NEW] Extracted custom model addition & test form
└── ApiSettings.tsx             # [REFACTOR] Giảm từ 747 dòng xuống <200 dòng
```

#### Batch 4: TranslatorWorkspace & GlossaryManager Extraction
```text
src/components/
├── translator-workspace/
│   ├── useWorkspaceState.ts    # [NEW] Extracted state management hook for translation workspace
│   └── WorkspaceToolbar.tsx    # [NEW] Extracted top action bar & chapter quick navigation
├── TranslatorWorkspace.tsx     # [REFACTOR] Giảm từ 956 dòng xuống <350 dòng
├── glossary-manager/
│   └── useGlossaryState.ts     # [NEW] Extracted state & filter hook for glossary manager
└── GlossaryManager.tsx         # [REFACTOR] Giảm từ 710 dòng xuống <300 dòng
```

#### Batch 5: GoogleSyncModal Migration to `ui/Modal`
```text
src/components/google-sync/
├── GoogleSyncAdvancedConfig.tsx # [NEW] Extracted advanced Client ID & Picker key configuration form
└── GoogleSyncModal.tsx          # [REFACTOR] Sử dụng ui/Modal, giảm từ 573 dòng xuống <250 dòng
```

## Complexity Tracking

> No constitution violations — table not applicable.
