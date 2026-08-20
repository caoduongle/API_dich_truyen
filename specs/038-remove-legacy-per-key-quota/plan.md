# Implementation Plan: Loại bỏ Legacy Per-Key Quota Ownership & Chuẩn hóa Kiến trúc Quota Group Authority

**Branch**: `038-remove-legacy-per-key-quota` | **Date**: 2026-08-20 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/038-remove-legacy-per-key-quota/spec.md)

**Input**: Feature specification from `/specs/038-remove-legacy-per-key-quota/spec.md`

---

## Summary

Thực thi Task 01: Chuẩn hóa kiến trúc 5 tầng (`Model Registry` → `Admission/Request` → `Quota Group/Project` → `API Key Health Pool` → `Gemini Execution`), tuân thủ 3 quy tắc bất biến (`API key ≠ Quota bucket`, `Provider attempt ≠ Logical request`, `Pacing ≠ HTTP rate limit`). Loại bỏ hoàn toàn các trường dữ liệu và phương thức per-key quota legacy (`keyRpm`, `keyMaxTpm`, `keyMaxRpd`, `perKeyRpm`, `calculateKeyScore()`), chuyển giao quyền sở hữu hạn mức (RPM/TPM/RPD) về `QuotaGroup` và giữ API key thuần túy là tài nguyên sức khỏe (health pool). Di trú cấu hình cũ trên giao diện một cách trong suốt và bảo đảm vượt qua toàn bộ 6 kịch bản kiểm thử bắt buộc.

---

## Technical Context

**Language/Version**: TypeScript 5.7+ / Node.js 20+  
**Primary Dependencies**: React 19, Express 4.x, `@google/genai`, `ioredis`, `vitest`, `clsx`, `tailwind-merge`, `motion`, `lucide-react`  
**Storage**: In-memory Map caches trên Express server (với Redis distributed synchronization), LocalStorage phía Frontend client  
**Testing**: Vitest 3.x (`npx vitest run`)  
**Target Platform**: Node.js Backend Server + Modern Web Browsers (Chrome / Edge / Firefox)  
**Project Type**: Web Application (React Frontend + Express Backend trong cùng monorepo)  
**Performance Goals**: Quota evaluation & key selection latency $< 1\text{ms}$ in-memory; 0 blocking network calls trong scheduling hot path  
**Constraints**: Tuân thủ nghiêm ngặt 5 nguyên tắc Hiến pháp dự án (`constitution.md`), không sửa đổi logic gọi API Gemini hoặc schema DB khi không được yêu cầu  
**Scale/Scope**: Tối đa 20 API keys / request, hỗ trợ hàng chục Quota Groups đồng thời với hàng ngàn requests/ngày  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Strict Quality Gates & Verification**: `tsc --noEmit`, `vitest run`, `vite build` phải chạy sạch 100%. Không xóa, mute hoặc skip bất kỳ bài test nào.
- [x] **II. Dependency Minimization & Existing Library Reuse**: Sử dụng các thư viện đã có (`@google/genai`, `ioredis`, `vitest`, `lucide-react`, `clsx`), không thêm dependencies mới.
- [x] **III. Strict Concern Separation & Domain Boundary Preservation**: Giữ vững ranh giới giữa tầng điều phối Quota và luồng dịch thuật 2 giai đoạn (Raw translation $\to$ Polishing).
- [x] **IV. Immutable Core Schemas & Storage Stability**: Không thay đổi schema IndexedDB trong `src/services/db.ts` và giữ nguyên các nhãn tiếng Việt trên giao diện người dùng.
- [x] **V. Atomic Commits & Documentation Synchronization**: Đảm bảo tài liệu đặc tả, contracts, quickstart và mã nguồn đồng bộ 1:1.

---

## Project Structure

### Documentation (this feature)

```text
specs/038-remove-legacy-per-key-quota/
├── plan.md              # Kế hoạch thực hiện chi tiết (/speckit-plan)
├── research.md          # Nghiên cứu & Quyết định kiến trúc Phase 0 (/speckit-plan)
├── data-model.md        # Mô hình thực thể & State Machine Phase 1 (/speckit-plan)
├── quickstart.md        # Hướng dẫn kiểm định 6 kịch bản bắt buộc Phase 1 (/speckit-plan)
├── checklists/
│   └── requirements.md  # Bảng kiểm định chất lượng yêu cầu
└── contracts/
    └── quota-group-authority.contract.md # Hợp đồng giao diện Quota Service & DTOs
```

### Source Code (repository layout)

```text
shared/
└── models.ts                           # Interface QuotaGroup, ApiKeyEntity, ProviderQuota, ConfiguredQuota

server/
├── services/
│   ├── quotaService.ts                 # Loại bỏ calculateKeyScore(), chuẩn hóa QuotaGroup authority
│   ├── geminiService.ts                # Điều phối vòng lặp gọi API qua QuotaGroup & Key Health
│   └── __tests__/
│       ├── quotaGroup.test.ts          # 6 kịch bản kiểm thử bắt buộc cho Task 01
│       ├── quotaAuthority.test.ts      # Kiểm thử PST Midnight & Sliding window 60s
│       └── keyScheduler.test.ts        # Kiểm thử điều phối xoay vòng QuotaGroup
└── controllers/
    └── quotaController.ts              # API Endpoint /quota/status

src/
├── components/
│   ├── QuotaPanel.tsx                  # Giao diện hiển thị cây phân cấp QuotaGroup -> Member Keys
│   └── __tests__/
│       ├── QuotaPanelHealthBadges.test.ts
│       └── QuotaPanelMetrics.test.ts
└── utils/
    ├── modelRegistry.ts                # Định dạng Pacing Summary theo QuotaGroup
    └── apiClient.ts                    # Snapshot DTOs client-side
```

---

## Plan Breakdown

### Phase 0: Outline & Research *(Completed)*
- Nghiên cứu quyết định loại bỏ legacy per-key quota properties (`keyRpm`, `keyMaxTpm`, `keyMaxRpd`, `perKeyRpm`, `calculateKeyScore()`).
- Xác lập 3 quy tắc bất biến và phân tầng dữ liệu 4 cấp độ.
- Kết quả lưu tại `research.md`.

### Phase 1: Design & Contracts *(Completed)*
- Xây dựng ERD, State Machine cho `QuotaGroup` và `ApiKeyEntity` tại `data-model.md`.
- Định nghĩa interface hợp đồng dịch vụ `IQuotaService` tại `contracts/quota-group-authority.contract.md`.
- Soạn thảo hướng dẫn kiểm thử tự động 6 kịch bản bắt buộc tại `quickstart.md`.

### Phase 2: Tasks Breakdown *(Ready for `/speckit-tasks`)*
- Tạo `tasks.md` phân rã công việc thực thi theo thứ tự phụ thuộc chặt chẽ:
  1. Dọn dẹp model & interface (`shared/models.ts`).
  2. Tái cấu trúc `server/services/quotaService.ts` (loại bỏ `calculateKeyScore`, chuẩn hóa `evaluateQuotaGroups` & `selectBestKeyInGroup`).
  3. Cập nhật `server/services/geminiService.ts` (điều phối thuần túy theo QuotaGroup & Key Health).
  4. Cập nhật test suites (`keyScheduler.test.ts`, `quotaGroup.test.ts`).
  5. Đồng bộ `QuotaPanel.tsx` và client utils (`modelRegistry.ts`, `apiClient.ts`).
  6. Chạy toàn diện Quality Gates (`npm run lint`, `npm test`, `npm run build`).

---

## Complexity Tracking

*Không có vi phạm nguyên tắc Hiến pháp cần biện minh.*
