# Specification Quality Checklist: Điều Phối Nhịp Độ Gọi API Động

**Purpose**: Validate specification completeness and quality before proceeding to clarification & planning  
**Created**: 2026-08-19  
**Feature**: [spec.md](../spec.md)  

## Content Quality

- [x] No implementation details in high-level user stories
- [x] Focused on user value, adaptive pacing, and TPM protection
- [x] Written clearly for stakeholder review
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable and verifiable
- [x] All acceptance scenarios are defined in Given-When-Then format
- [x] Edge cases are identified (low/invalid RPM fallback, high RPM floor clamp, missing headers)
- [x] Scope is clearly bounded (dynamic interval calculation, server header `x-custom-rpm`, queue pacing & TPM safety check, UI status display)
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements (FR-001 to FR-005) mapped to acceptance criteria
- [x] User scenarios cover primary flows (Dynamic RPM pacing, TPM throttle protection, UI summary)
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] Compliant with `.agents/rules/design-system.md` ("Mực & Chu Sa") and `AGENTS.md`

## Notes

- Đặc tả phản ánh chính xác 100% các yêu cầu từ tài liệu mô tả:
  1. Loại bỏ các hằng số hardcode tĩnh 13 RPM / 4500ms.
  2. Viết helper `getDynamicPacingInterval`, `isTpmNearLimit`, `formatPacingSummary` trong `src/utils/modelRegistry.ts`.
  3. Cập nhật `server/routes/api.ts` & `server/services/geminiService.ts` nhận `x-custom-rpm` và tính toán `keyMinInterval` linh hoạt.
  4. Cập nhật `useAutoTranslationQueue.ts` & `useTranslationProcess.ts` giãn nhịp theo `pacingIntervalMs` và tự động tạm dừng khi chạm ngưỡng 85% TPM.
  5. Cập nhật `ApiSettings.tsx` & `QuotaPanel.tsx` hiển thị thông số nhịp độ trực quan.
  6. Unit tests xác thực các mức RPM (5, 15, 60, 300) và cơ chế TPM throttling.
