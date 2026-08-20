# Implementation Plan: Tách Biệt Rõ Ràng Giữa Provider Quota Xác Minh & Gợi Ý Điều Phối (Scheduling Hint / Fallback)

**Branch**: `039-isolate-provider-quota-fallback` | **Date**: 2026-08-20 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/039-isolate-provider-quota-fallback/spec.md)

**Input**: Feature specification from `specs/039-isolate-provider-quota-fallback/spec.md`

---

## Summary

Dọn dẹp triệt để ngữ nghĩa dữ liệu: `ProviderQuota` chỉ tồn tại khi có kết quả xác minh chính thức từ Google Cloud / Google AI Studio (`providerQuota = undefined` khi chưa có dữ liệu, tuyệt đối không gán số giả 15 RPM / 1M TPM / 1500 RPD). Tách riêng `SchedulingHint` thành thực thể điều phối độc lập mang nhãn nguồn gốc `source: "provider" | "configured" | "model-fallback" | "safe-default"`. Bổ sung 5 bài unit test bắt buộc (`provider quota known`, `provider quota unknown`, `configured hint`, `fallback hint`, `verified quota update`).

---

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 18+  
**Primary Dependencies**: React 19, Express, ioredis, Tailwind v4, vitest  
**Storage**: In-memory Quota Service cache, client-side localStorage sync  
**Testing**: `vitest run`  
**Target Platform**: Node.js Express server + Modern Browser Web UI  
**Project Type**: Web service / Fullstack translation tool  
**Performance Goals**: Không tăng thêm độ trễ điều phối request (< 1ms CPU time per admission decision)  
**Constraints**: Tuân thủ 100% 5 nguyên tắc Hiến pháp dự án (`AGENTS.md` & `constitution.md`)  
**Scale/Scope**: Tái cấu trúc schema `shared/models.ts`, service logic trong `server/services/quotaService.ts`, client API DTO trong `src/utils/apiClient.ts`, và QuotaPanel badge UI trong `src/components/QuotaPanel.tsx`.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Gate I (Strict Quality Gates)**: Phải vượt qua `npm run lint` (`tsc --noEmit`), `npm test` (`vitest run`), và `npm run build` không lỗi.
- [x] **Gate II (Dependency Minimization)**: Không cài thêm thư viện mới.
- [x] **Gate III (Strict Concern Separation)**: Không can thiệp vào pipeline dịch 2 pha (raw translation -> polishing).
- [x] **Gate IV (Immutable Core Schemas)**: Không thay đổi IndexedDB schema (`src/services/db.ts`) hay `src/types.ts`.
- [x] **Gate V (Atomic Commits & Documentation Sync)**: Cập nhật tài liệu kỹ thuật và test suite đầy đủ.

---

## Project Structure

### Documentation (this feature)

```text
specs/039-isolate-provider-quota-fallback/
├── spec.md                  # Feature Specification
├── plan.md                  # This file (/speckit-plan command output)
├── research.md              # Phase 0 output (/speckit-plan command)
├── data-model.md            # Phase 1 output (/speckit-plan command)
├── quickstart.md            # Phase 1 output (/speckit-plan command)
├── contracts/               # Phase 1 output (/speckit-plan command)
│   └── quota-semantics.contract.md
├── checklists/
│   └── requirements.md      # Spec quality checklist
└── tasks.md                 # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
shared/
└── models.ts                # Update ProviderQuota, QuotaGroup, SchedulingHint

server/
├── services/
│   ├── quotaService.ts      # Update quota registry, deriveSchedulingHint, evaluateQuotaGroups
│   └── geminiService.ts     # Pacing loop integration
└── services/__tests__/
    └── quotaGroup.test.ts   # 5 mandatory test scenarios

src/
├── utils/
│   └── apiClient.ts         # Update QuotaGroupDisplayItem & DTOs
└── components/
    └── QuotaPanel.tsx       # Update Quota Group unverified vs verified badge display
```

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Không có vi phạm | N/A | N/A |
