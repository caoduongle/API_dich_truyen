# Implementation Plan: Fix CSP Gemini Model Discovery & Pacing Interval Delay

**Branch**: `083-fix-csp-pacing-delay` | **Date**: 2026-08-28 | **Spec**: [`specs/083-fix-csp-pacing-delay/spec.md`](./spec.md)

---

## 1. Summary

Khắc phục đồng thời 2 vấn đề kỹ thuật:
1. **Lỗi chặn kết nối do Content Security Policy (CSP)**: Bổ sung `https://generativelanguage.googleapis.com` và `https://*.googleapis.com` vào chỉ thị `connect-src` trong cấu hình Helmet CSP (`server.ts`), đồng thời cập nhật bộ kiểm thử bảo mật `server/__tests__/securityHeaders.test.ts`.
2. **Lỗi logic điều phối nhịp độ hiển thị giá trị âm (`-4445ms/call`)**: Chuẩn hóa logic render trong `GroupQuotaCard.tsx` bằng `Math.max(0, ...)` và hiển thị trạng thái `"Sẵn sàng"` khi độ trễ $\le 0$.
3. **Cải thiện thông báo lỗi khi Kiểm tra Model (Client-Side)**: Tối ưu khối `try/catch` trong `directGeminiClient.ts` và `useModelDiscovery.ts` để hiển thị thông báo rõ ràng khi gặp sự cố mạng hoặc chính sách CSP.

---

## 2. Technical Context

- **Language/Version**: TypeScript 5.8+, Node.js 20+, React 19
- **Primary Dependencies**: Express 4.x, Helmet 8.x, Tailwind CSS v4, Lucide React, Vite 6.x
- **Storage**: Client-side IndexedDB & localStorage
- **Testing**: Vitest (`server/__tests__/securityHeaders.test.ts`, `src/hooks/__tests__/useModelDiscovery.test.ts`, `src/components/__tests__/ApiSettingsModelFlow.test.ts`)
- **Target Platform**: Node.js Express server + Single Page React Application
- **Project Type**: Full-stack Web Application
- **Performance Goals**: Không gây thêm độ trễ khi nạp header; hiển thị nhịp độ tức thì; phản hồi kiểm tra model nhanh chóng.
- **Constraints**:
  - Không phá vỡ kiến trúc dịch Client-Direct và Zero-Knowledge.
  - Không thêm dependency mới ngoài các thư viện đã cài đặt.
  - Đảm bảo 100% test cases pass và TypeScript check sạch sẽ.

---

## 3. Constitution Check

| Nguyên tắc | Đánh giá | Trạng thái |
|---|---|---|
| **I. Strict Quality Gates** | `npm run lint` (`tsc --noEmit`), `npm test` (`vitest run`), `npm run build` phải pass 100%. | ✅ PASS |
| **II. Dependency Minimization** | Không cài thêm package mới nào. | ✅ PASS |
| **III. Concern Separation** | Thay đổi chia tách rõ ràng: CSP header ở `server.ts`, UI render ở `GroupQuotaCard.tsx`, error handling ở `directGeminiClient.ts`/`useModelDiscovery.ts`. Không sửa logic dịch trong translation pipeline. | ✅ PASS |
| **IV. Immutable Core Schemas** | Không sửa đổi các interface cốt lõi trong `src/types.ts` hoặc IndexedDB schema. Giữ nguyên toàn bộ nhãn tiếng Việt tiêu chuẩn. | ✅ PASS |
| **V. Atomic Commits** | Phạm vi thay đổi tập trung chính xác vào 2 lỗi được báo cáo. | ✅ PASS |

---

## 4. Project Structure

### Documentation (this feature)

```text
specs/083-fix-csp-pacing-delay/
├── plan.md              # Implementation Plan (Tài liệu này)
├── research.md          # Phase 0 Research & Decisions
├── data-model.md        # Phase 1 Data Model & Configuration
├── quickstart.md        # Phase 1 Quickstart Validation Guide
├── contracts/           # Phase 1 Contracts
│   ├── csp-header.contract.md
│   └── pacing-display.contract.md
└── checklists/          # Feature Checklists
    └── requirements.md
```

### Source Code Modifications

```text
server/
├── server.ts                                    # [MODIFY] Thêm generativelanguage.googleapis.com vào connectSrc
└── __tests__/
    └── securityHeaders.test.ts                  # [MODIFY] Cập nhật assertion kiểm tra connectSrc CSP

src/
├── components/
│   ├── quota-panel/
│   │   └── GroupQuotaCard.tsx                   # [MODIFY] Chuẩn hóa pacing delay >= 0, hiển thị "Sẵn sàng"
│   └── api-settings/
│       └── KeyListSection.tsx                   # [MODIFY] Cải thiện hiển thị trạng thái và thông báo lỗi
├── services/
│   └── directGeminiClient.ts                    # [MODIFY] Bắt lỗi Failed to fetch / CSP và trả về thông điệp thân thiện
└── hooks/
    └── useModelDiscovery.ts                     # [MODIFY] Xử lý thông báo lỗi kết nối Gemini API
```

---

## 5. Implementation Phases

### Phase 1: Security Headers & CSP Allowlist
- Cập nhật `server.ts`: thêm `https://generativelanguage.googleapis.com` và `https://*.googleapis.com` vào `connectSrc`.
- Cập nhật `server/__tests__/securityHeaders.test.ts` để đồng bộ assert `connect-src`.
- Chạy `npx vitest run server/__tests__/securityHeaders.test.ts` để xác minh.

### Phase 2: Pacing Interval & Delay Clamping
- Cập nhật `src/components/quota-panel/GroupQuotaCard.tsx`:
  - Lấy `pacingDelayMs` hoặc `schedulingHint.effectiveIntervalMs`.
  - Bọc `Math.max(0, ...)` cho giá trị delay.
  - Hiển thị `"Sẵn sàng"` khi delay $\le 0$ và `"~Xms/call"` khi delay $> 0$.

### Phase 3: Client-Direct Gemini Error Handling
- Cập nhật `src/services/directGeminiClient.ts`:
  - Trong `listModelsDirect`, `callGeminiDirect`, `verifyModelDirect`: bắt lỗi `TypeError: Failed to fetch` hoặc `SecurityError` và chuyển thành `"Không thể kết nối đến Gemini API (Vui lòng kiểm tra mạng hoặc chính sách CSP)"`.
- Cập nhật `src/hooks/useModelDiscovery.ts`:
  - Phân loại lỗi mạng / CSP khi gọi API hoặc refresh model list.

### Phase 4: Verification & Quality Gates
- Chạy `npx tsc --noEmit`
- Chạy `npx vitest run`
- Chạy `npm run build`
