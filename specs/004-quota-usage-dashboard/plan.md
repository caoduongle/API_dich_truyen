# Implementation Plan: Quota & Usage Tracking Dashboard

**Branch**: `004-quota-usage-dashboard` | **Date**: 2026-08-19 | **Spec**: [specs/004-quota-usage-dashboard/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/004-quota-usage-dashboard/spec.md)

**Input**: Feature specification from `specs/004-quota-usage-dashboard/spec.md`

## Summary

Áp dụng toàn bộ tính năng **Quota & Usage Tracking Dashboard** vào hệ thống với 4 phân hệ chính:
1. **Backend Quota Tracking & Timezone Normalization (`server/services/quotaService.ts`)**: Quản lý in-memory stats, SHA-256 key hashing, `maskApiKey`, rolling minute bucket, reset RPD theo múi giờ `America/Los_Angeles`.
2. **Upstream Model Discovery & Cache (`server/services/modelInfoService.ts`)**: Truy vấn `models.list` từ Google API, cache 10 phút, timeout 15s qua `AbortController`.
3. **API Endpoints & Integration (`server/controllers/quotaController.ts`, `server/services/geminiService.ts`, `server/routes/api.ts`)**:
   - Ghi nhận `recordUsage` trên mọi nhánh của `geminiService.ts` (`success`, `overloaded`, `quota_exceeded`, `safety`, `error`).
   - Export `getKeyRuntimeStatus(key)` đọc trạng thái circuit breaker/rate limit.
   - Định tuyến `/api/quota-status` và `/api/models-for-key` bọc qua `resolveApiKeysMiddleware`.
4. **Frontend UI & Client Helpers (`src/utils/apiClient.ts`, `src/components/QuotaPanel.tsx`, `src/components/ApiSettings.tsx`)**:
   - Tích hợp `fetchQuotaStatus` và `fetchModelsForKey` trong `apiClient.ts`.
   - Xây dựng component `QuotaPanel.tsx` chuẩn phong cách nhận diện "Mực & Chu Sa" (`bg-ink`, `bg-parchment-2`, `text-polish`, `Seal`, `Badge`).
   - Tích hợp tab switcher trong `ApiSettings.tsx` giữa "Cấu hình" và "Quota & Hạn mức".
5. **Kiểm thử tự động (`server/services/__tests__/quotaService.test.ts`)**: Unit tests toàn diện với Vitest (fake timers, timezone, model metrics).

---

## Technical Context

**Language/Version**: TypeScript 5.8+, Node.js 20+
**Primary Dependencies**: Express 4.21, @google/genai 2.4, React 19, Vite 6.2, Tailwind CSS v4, Lucide React
**Storage**: In-memory Map for runtime usage & cache; localStorage for user custom limits
**Testing**: Vitest 4.1 (`npx vitest run`), TypeScript compiler (`npx tsc --noEmit`)
**Target Platform**: Node.js Backend Server & Modern Web Browsers
**Design System**: "Mực & Chu Sa" (Tokens: `bg-ink`, `bg-parchment`, `bg-parchment-2`, `text-text-main`, `text-text-muted`, `text-polish`, `font-mono`, `rounded-[2px]`)
**Constraints**: Tuân thủ tuyệt đối [`.specify/memory/constitution.md`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/.specify/memory/constitution.md) (Không cài thư viện ngoài thừa thãi, toàn bộ test suite phải pass 100%, không để lộ raw API key).

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Tình trạng | Đánh giá & Tuân thủ |
|---|---|---|
| **I. Strict Quality Gates & Verification** | **PASS** | Bắt buộc chạy `npx tsc --noEmit`, `npx vitest run`, `npm run build` không lỗi, không skip test. |
| **II. Dependency Minimization** | **PASS** | Sử dụng 100% các thư viện có sẵn (Node.js crypto, Intl, Express, React, lucide-react), không thêm package npm mới. |
| **III. Strict Concern Separation** | **PASS** | Phân định rõ ràng: Quota tracking logic ở backend service; UI presentation gói gọn trong `QuotaPanel` và `ApiSettings`. Không can thiệp vào pipeline dịch chính. |
| **IV. Immutable Core Schemas & Storage** | **PASS** | Không thay đổi `src/types.ts` hay schema IndexedDB; không sửa đổi nhãn giao diện tiếng Việt hiện có. |
| **V. Atomic Commits & Docs Sync** | **PASS** | Đồng bộ đầy đủ contracts, data model và kế hoạch thực thi. |

---

## Project Structure

### Documentation (this feature)

```text
specs/004-quota-usage-dashboard/
├── plan.md              # Kế hoạch kiến trúc và thiết kế tổng thể
├── research.md          # Kết quả nghiên cứu Phase 0 cho các lựa chọn kỹ thuật
├── data-model.md        # Mô hình dữ liệu, schema và interface DTOs
├── quickstart.md        # Hướng dẫn kiểm thử tự động và xác minh thực tế
├── contracts/           # Hợp đồng API và đặc tả component
│   ├── quota-tracking-api.contract.md
│   ├── model-discovery-api.contract.md
│   └── quota-ui-components.contract.md
└── checklists/
    └── requirements.md  # Danh mục kiểm tra chất lượng đặc tả
```

### Source Code Impact Areas

```text
server/
├── services/
│   ├── quotaService.ts                       # [NEW] Quota & usage tracking service
│   ├── modelInfoService.ts                   # [NEW] Google models.list query with cache & timeout
│   ├── geminiService.ts                      # [MODIFY] Record usage on attempts & export getKeyRuntimeStatus
│   └── __tests__/
│       └── quotaService.test.ts              # [NEW] Vitest suite for quota tracking
├── controllers/
│   └── quotaController.ts                    # [NEW] Endpoints for quota status & models-for-key
└── routes/
    └── api.ts                                # [MODIFY] Register /api/quota-status & /api/models-for-key

src/
├── utils/
│   └── apiClient.ts                          # [MODIFY] Add fetchQuotaStatus & fetchModelsForKey
└── components/
    ├── QuotaPanel.tsx                        # [NEW] Quota & limits dashboard tab
    └── ApiSettings.tsx                       # [MODIFY] Tab switcher for "Cấu hình" & "Quota & Hạn mức"
```

---

## Complexity Tracking

*No violations. All changes adhere strictly to the project constitution.*
