# Implementation Plan: Chờ Phục Hồi Hạn Mức Tạm Thời (RPM Cooldown) & Tự Động Tiếp Tục Khi Quét Thuật Ngữ / Xử Lý Hàng Loạt

**Branch**: `168-rate-limit-cooldown-wait-recovery` | **Date**: 2026-11-27 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/168-rate-limit-cooldown-wait-recovery/spec.md)

**Input**: Feature specification from `/specs/168-rate-limit-cooldown-wait-recovery/spec.md`

## Summary

Khắc phục triệt để lỗi hệ thống đánh dấu khóa cứng và bỏ qua hàng loạt chương còn lại khi chạm giới hạn tốc độ gói miễn phí (15 RPM, `429 RESOURCE_EXHAUSTED`, `Please retry in 36.58s`):
1. Nâng cấp bộ phân loại lỗi `geminiErrorClassifier.ts` để tách rạch ròi lỗi quá tải theo phút (RPM) khỏi hết hạn mức ngày (RPD) ngay cả trên thông báo lỗi Free Tier của Google có chữ `"exceeded your current quota"`, đồng thời trích xuất chính xác `retryDelay` từ `RetryInfo` hoặc thông báo lỗi (+1,5s đệm an toàn).
2. Cập nhật `localQuotaTracker.ts`, `geminiKeyScheduler.ts` và `geminiClient.ts` để tôn trọng thời gian cooldown động thực tế, cung cấp hàm phân tích hồi phục của pool khóa (`getPoolCooldownAnalysis`), và gắn `retryAfterMs` + `category: 'RATE_LIMIT_RPM'` lên lỗi khi toàn pool chỉ tạm nghỉ ngắn hạn có thể hồi phục.
3. Nâng cấp `useGlossaryScan.ts` với cơ chế chờ cooldown lắng nghe `AbortSignal` (`waitForCooldownWithAbort`), thử lại đúng chương đang dở (tối đa 2 lần chờ/chương), giãn nhịp chủ động theo số lượng khóa khả dụng để tránh chạm trần 15 RPM, và dừng ngay lập tức khi hết hạn mức thực sự (bảo toàn toàn bộ chương chưa quét vào `failedIds` và không báo "HOÀN TẤT THÀNH CÔNG" sai).

## Technical Context

**Language/Version**: TypeScript `~5.8.2`, React `^19.0.1`  
**Primary Dependencies**: Vite `^6.4.6`, Vitest `^4.1.12` (không thêm dependency mới)  
**Storage**: IndexedDB & `sessionStorage` (`LocalQuotaTracker`) — giữ nguyên schema `src/types.ts` và DB hiện có  
**Testing**: Vitest `^4.1.12` + `jsdom` `29.1.1` (`npm test`)  
**Target Platform**: Trình duyệt web (Pure Client-Side SPA)  
**Project Type**: Single Page Web Application (Client-side MVC)  
**Performance Goals**: Giải phóng bộ đếm chờ ngay trong < 500ms khi người dùng hủy (`AbortSignal`); tránh spam request vượt trần RPM  
**Constraints**: Tuân thủ Constitution Principle III (MVC: hooks không import component, service thuần TS), Principle IV (không thay đổi `src/types.ts` hoặc IndexedDB schema), giữ nguyên toàn bộ test hiện hữu  
**Scale/Scope**: ~6 module nguồn và ~5 tệp unit test liên quan (`constants.ts`, `gemini/types.ts`, `geminiErrorClassifier.ts`, `localQuotaTracker.ts`, `geminiKeyScheduler.ts`, `geminiClient.ts`, `useGlossaryScan.ts`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Strict Quality Gates & Verification (PASS)**: Toàn bộ hành vi mới có unit test mô phỏng với fake timers / mock fetch (không phụ thuộc mạng thật) và kiểm chứng đủ `npm run lint`, `npm test`, `npm run build`.
- **II. Dependency Minimization & Existing Library Reuse (PASS)**: Không cài package mới; tái sử dụng `getDynamicPacingInterval`, `localQuotaTracker`, `classifyGeminiError`.
- **III. Strict Concern Separation & MVC Domain Boundary Preservation (PASS)**: Logic phân loại lỗi, cooldown và phân tích pool nằm hoàn toàn trong `src/services/`; điều phối vòng quét nằm trong `src/hooks/useGlossaryScan.ts`; không tạo phụ thuộc chéo lên component.
- **IV. Immutable Core Schemas & Storage Stability (PASS)**: Không sửa `src/types.ts` và IndexedDB schema; tái sử dụng `glossaryScanQueueState.failedIds` có sẵn.
- **V. Atomic Commits & Documentation Synchronization (PASS)**: Phạm vi khu trú chặt vào pipeline xử lý RPM cooldown và quét thuật ngữ hàng loạt.

*Post-Design Re-Check*: Toàn bộ thiết kế đạt 5/5 cổng Hiến pháp, không có ngoại lệ.

## Project Structure

### Documentation (this feature)

```text
specs/168-rate-limit-cooldown-wait-recovery/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── rate-limit-recovery-contracts.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── config/
│   └── constants.ts                              # Thêm RATE_LIMIT_RECOVERY_CONFIG (max wait 120s, max waits/chapter = 2, buffer 1.5s)
├── services/
│   ├── localQuotaTracker.ts                      # Dùng recommendedCooldownMs động + getPoolCooldownAnalysis
│   ├── gemini/
│   │   ├── types.ts                              # Thêm retryAfterMs? trên GeminiRequestError
│   │   ├── geminiErrorClassifier.ts              # Thêm extractRetryDelayMs + tách RPM vs RPD chính xác cho Free Tier 429
│   │   ├── geminiKeyScheduler.ts                 # Ném lỗi có retryAfterMs/category chuẩn theo PoolCooldownAnalysis
│   │   ├── geminiClient.ts                       # Dùng phân tích pool cooldown khi 429 hết vòng key
│   │   └── __tests__/
│   │       ├── geminiErrorClassifier.test.ts     # Test Free Tier 15 RPM + 36.58s retryDelay
│   │       ├── geminiKeyScheduler.test.ts        # Test PoolCooldownAnalysis & recoverable vs permanent error
│   │       └── geminiClient.test.ts              # Test rotate / recoverable RATE_LIMIT_RPM retryAfterMs
│   └── __tests__/
│       └── localQuotaTracker.test.ts             # Test dynamic cooldownUntil & getPoolCooldownAnalysis
└── hooks/
    ├── useGlossaryScan.ts                        # Sửa check code ALL_KEYS_EXHAUSTED, chờ cooldown có AbortSignal, retry đúng chương, dừng sạch & pacing
    └── __tests__/
        └── useGlossaryScan.test.ts               # Test thực thi hook: chờ 36.58s tiếp tục chương 47, dừng ngay khi RPD exhausted, abort tức thì khi dừng
```

**Structure Decision**: Duy trì cấu trúc MVC hiện có, sửa trực tiếp vào các điểm nghẽn đã định vị trong `src/services/gemini/`, `src/services/localQuotaTracker.ts` và `src/hooks/useGlossaryScan.ts`.

## Complexity Tracking

Không có vi phạm Constitution nào cần giải trình.
