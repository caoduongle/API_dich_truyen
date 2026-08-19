# Specification Quality Checklist: Đo Lường Hạn Ngạch Thời Gian Thực: RPM, TPM & RPD

**Purpose**: Validate specification completeness and quality before proceeding to clarification & planning  
**Created**: 2026-08-19  
**Feature**: [spec.md](../spec.md)  

## Content Quality

- [x] No implementation details in high-level user stories
- [x] Focused on user value, real-time observability, and token metrics accuracy
- [x] Written clearly for stakeholder review
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable and verifiable
- [x] All acceptance scenarios are defined in Given-When-Then format
- [x] Edge cases are identified (failed requests, missing usageMetadata, memory pruning of sliding window, large number formatting)
- [x] Scope is clearly bounded (Sliding Window Log 60s, TPM tracking, usageMetadata extraction, PST rollover, QuotaPanel progress gauges)
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements (FR-001 to FR-005) mapped to acceptance criteria
- [x] User scenarios cover primary flows (Sliding window RPM/TPM, Daily TPD/PST, Custom TPM Limits & UI)
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] Compliant with `.agents/rules/design-system.md` ("Mực & Chu Sa") and `AGENTS.md`

## Notes

- Đặc tả phản ánh 100% các yêu cầu từ tài liệu mô tả:
  1. `server/services/quotaService.ts`: Cập nhật cấu trúc sang Sliding Window Log 60s (`recentCalls: Array<{ timestamp, tokens }>`), thêm `tokensThisMinute`, `tokensToday`, `tokensTotal`, tính toán chính xác và tự động lọc bản ghi cũ.
  2. `server/services/geminiService.ts`: Trích xuất `response.usageMetadata` và truyền `tokenStats` vào `recordAttempt`.
  3. `server/controllers/quotaController.ts` & `src/utils/apiClient.ts`: Cập nhật các types `QuotaKeyStatus`, `QuotaModelUsage`, `KeyQuotaFullSnapshot`, `ModelUsageStats`.
  4. `src/utils/modelRegistry.ts`: Cập nhật `computeModelStatsSummary` và thêm `formatTokenCount`.
  5. `src/components/QuotaPanel.tsx`: Thêm cấu hình `maxTpm` trong `CustomLimits`, hiển thị tile metrics TPM và thanh tiến độ RPM/TPM/RPD.
  6. Unit tests trong `server/services/__tests__/quotaService.test.ts` kiểm thử đầy đủ các kịch bản cửa sổ trượt 60s, token rollover theo ngày PST, và thu dọn bộ nhớ.
