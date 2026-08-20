# Implementation Plan: Model Discovery Header Auth (Không Gửi API Key Trong URL)

**Feature**: `044-model-discovery-header-auth`  
**Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/044-model-discovery-header-auth/spec.md) | **Checklist**: [requirements.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/044-model-discovery-header-auth/checklists/requirements.md)  
**Status**: Ready for Task Breakdown

---

## User Review Required

> [!IMPORTANT]
> **Zero URL Key Invariant**:
> Toàn bộ các cuộc gọi HTTP ra ngoài Google Generative Language API PHẢI sử dụng header `x-goog-api-key: <API_KEY>`.
> Tuyệt đối cấm sử dụng `?key=<API_KEY>` trong URL.

---

## Proposed Changes

### Layer 1: Outbound HTTP Requests Update (`server/services/modelInfoService.ts`)
- Thay đổi `fetchModelsFromGoogle` chuyển URL từ `.../models?key=...` thành `.../models` và thêm header `'x-goog-api-key': trimmedKey`.
- Thay đổi `fetchSingleModelFromGoogle` chuyển URL từ `.../models/{id}?key=...` thành `.../models/{id}` và thêm header `'x-goog-api-key': trimmedKey`.
- Thay đổi `probeModelGeneration` chuyển URL từ `.../models/{id}:generateContent?key=...` thành `.../models/{id}:generateContent` và thêm header `'x-goog-api-key': apiKey.trim()`.

### Layer 2: Test Suite & Mocks Harmonization (`server/services/__tests__/modelInfoService.test.ts`, `server/services/__tests__/modelVerification.test.ts`, `server/services/__tests__/modelDiscoveryHeaderAuth.test.ts`)
- Cập nhật các mock fetch trong unit tests để kiểm tra chính xác URL sạch và header `x-goog-api-key`.
- Viết mới `server/services/__tests__/modelDiscoveryHeaderAuth.test.ts` kiểm thử 3 kịch bản bắt buộc (`URL does not contain key`, `header contains key`, `logs do not contain key`).

### Layer 3: Documentation & Quality Gates
- Cập nhật tài liệu kiến trúc bảo mật trong `docs/quota-and-scheduling.md` (mục Header-Based Authentication).
- Vượt qua toàn diện Quality Gates (`npm run lint`, `npm test`, `npm run build`).

---

## Verification Plan

### Automated Tests
- `npx vitest run server/services/__tests__/modelDiscoveryHeaderAuth.test.ts`
- `npm run lint` (`tsc --noEmit`)
- `npm test` (`vitest run`)
- `npm run build`

### Manual Verification
- Kiểm tra outbound network logs $\to$ URL sạch hoàn toàn không chứa `?key=`.
