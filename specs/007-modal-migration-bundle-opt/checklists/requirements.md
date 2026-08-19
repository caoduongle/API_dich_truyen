# Specification Quality Checklist: Hoàn Thiện Modal Chung & Minh Bạch Cấu Hình Bundle opencc-js

**Purpose**: Validate specification completeness and quality before proceeding to planning  
**Created**: 2026-08-19  
**Feature**: [spec.md](../spec.md)  

## Content Quality

- [x] No excessive implementation leakage in high-level user stories
- [x] Focused on user value, interface consistency, and build configuration clarity
- [x] Written clearly for stakeholder review with explicit user scenarios and acceptance criteria
- [x] All mandatory sections completed (User Scenarios, Acceptance Criteria, Edge Cases, Functional/Non-functional Requirements)

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable, unambiguous, and scoped
- [x] Success criteria are measurable (zero visual regressions, zero lint/type errors, 100% test pass, valid manual chunking)
- [x] All acceptance scenarios are defined in Given-When-Then format
- [x] Edge cases are clearly identified (nested modals, large body scroll, rapid Escape handling, unmount scroll unlock)
- [x] Scope is clearly bounded (UI modal standardization and build documentation; no changes to translation logic, IndexedDB schema, or types.ts)
- [x] Architectural rationale regarding `opencc-js` synchronous requirements and chunking verified

## Feature Readiness

- [x] All functional requirements (FR-001 to FR-006) mapped to acceptance criteria
- [x] User scenarios cover both User Story 1 (Modal migration & z-index ladder) and User Story 2 (opencc-js bundle clarity & vite config)
- [x] Compliant with `.agents/rules/design-system.md` ("Mực & Chu Sa" design system, z-index ladder rules) and `AGENTS.md` (atomic changes, no unnecessary packages)

## Notes

- Đã xác thực kỹ trạng thái thực tế của các component:
  1. `DiffModal.tsx`, `AuthModal.tsx`, `ProjectMetadataModal.tsx`, `ApiSettings.tsx`, `ReviewQueuePanel.tsx` đã dùng `ui/Modal.tsx` -> chỉ cần rà soát props & z-index.
  2. `ImportGuidelinesModal.tsx` cần chuyển sang `ui/Modal.tsx`.
  3. `QuickAddTermModal.tsx` cần chuyển phần form nhập liệu sang `ui/Modal.tsx`.
  4. `ProjectFormModal.tsx` được xác nhận là inline form trong luồng trang `ProjectList.tsx`, không ép thành modal.
  5. `LanguageSelector.tsx` được hạ từ `z-50` về `z-40` theo đúng thang dropdown.
  6. `opencc-js` được phân tích rõ ràng: không thể lazy-load bất đồng bộ vì phục vụ các hàm so sánh Hán-Việt đồng bộ xuyên suốt ứng dụng; cấu hình `vite.config.ts` sẽ được ghi chú giải thích tường minh lý do tách `vendor-opencc` và duy trì `chunkSizeWarningLimit: 1200`.
- Đặc tả đã hoàn thiện và sẵn sàng cho bước lập kế hoạch `/speckit-plan`.
