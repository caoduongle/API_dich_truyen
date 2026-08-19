# Tasks: Modal Migration & opencc-js Bundle Configuration

**Feature**: `007-modal-migration-bundle-opt`  
**Spec**: [specs/007-modal-migration-bundle-opt/spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/007-modal-migration-bundle-opt/spec.md)  
**Plan**: [specs/007-modal-migration-bundle-opt/plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/007-modal-migration-bundle-opt/plan.md)  

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Xác thực môi trường kiểm thử và baseline hiện tại

- [x] T001 [P] Verify baseline tests and type check readiness via `npm test` and `npm run lint`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Rà soát props và cấu trúc component `ui/Modal.tsx` trước khi chuyển đổi

- [x] T002 [P] Inspect `src/components/ui/Modal.tsx` props interface and behavior to ensure all target modals have appropriate size & styling mappings

---

## Phase 3: User Story 1 - Chuẩn Hóa Toàn Diện Các Modal Còn Lại Sang `src/components/ui/Modal.tsx` & Chuẩn Hóa Thang Z-Index (Priority: P2) 🎯 MVP

**Goal**: Hợp nhất các modal dialog còn lại (`ImportGuidelinesModal.tsx`, `QuickAddTermModal.tsx`) sang `src/components/ui/Modal.tsx`, chuẩn hóa thang z-index (`LanguageSelector.tsx` sang `z-40`), bảo toàn 100% logic và nhãn tiếng Việt.  
**Independent Test**: Mở modal nhập cẩm nang .md trong GlossaryManager và modal thêm nhanh thuật ngữ trong BilingualEditor, xác nhận hiển thị backdrop mờ, đóng được bằng phím Escape/click backdrop/nút X, và menu LanguageSelector sử dụng đúng `z-40`.

### Implementation for User Story 1
- [x] T003 [P] [US1] Migrate `src/components/glossary-manager/ImportGuidelinesModal.tsx` to `<Modal open={isImporting} onClose={...} size="xl">` with standard header, backdrop, and Escape handling
- [x] T004 [P] [US1] Migrate `src/components/translator-workspace/QuickAddTermModal.tsx` form dialog to `<Modal open={quickAddOpen} onClose={...} size="lg">` while preserving the compact trigger banner when `!quickAddOpen`
- [x] T005 [P] [US1] Standardize `src/components/common/LanguageSelector.tsx` dropdown listbox z-index from `z-50` to `z-40` per design system ladder
- [x] T006 [P] [US1] Audit already-migrated modals (`DiffModal.tsx`, `AuthModal.tsx`, `ProjectMetadataModal.tsx`, `ApiSettings.tsx`, `ReviewQueuePanel.tsx`) to confirm zero residual z-index or backdrop deviations

**Checkpoint**: User Story 1 hoàn thành độc lập. Toàn bộ modal trong hệ thống sử dụng chung `src/components/ui/Modal.tsx` và tuân thủ đúng thang z-index.

---

## Phase 4: User Story 2 - Đánh Giá Khả Năng Lazy-Load & Minh Bạch Hóa Cấu Hình Bundle `opencc-js` trong `vite.config.ts` (Priority: P2) 🎯 MVP

**Goal**: Bổ sung tài liệu và khối chú thích kỹ thuật chi tiết vào `vite.config.ts` giải thích rõ lý do kỹ thuật bắt buộc nạp đồng bộ của `opencc-js`, kiến trúc manualChunking `vendor-opencc`, và lý do duy trì `chunkSizeWarningLimit: 1200`.  
**Independent Test**: Kiểm tra file `vite.config.ts` có đầy đủ chú thích minh bạch, chạy `npm run build` xác nhận xuất ra đúng chunk `vendor-opencc-*.js` độc lập.

### Implementation for User Story 2
- [x] T007 [US2] Update `vite.config.ts` with comprehensive technical documentation comments explaining `vendor-opencc` synchronous requirements, isolated manualChunking, and rationale for `chunkSizeWarningLimit: 1200`

**Checkpoint**: User Story 2 hoàn thành độc lập. Cấu hình build đạt độ minh bạch cao theo đúng quy chuẩn kiến trúc.

---

## Phase 5: Polish & Cross-Cutting Verification

**Purpose**: Chạy toàn bộ các cổng kiểm soát chất lượng (Constitution Quality Gates)

- [x] T008 [P] Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript compilation errors
- [x] T009 Run `npm test` (`vitest run`) to verify 100% pass across all unit and integration test suites
- [x] T010 Run `npm run build` to verify clean frontend (Vite) and backend (esbuild) production bundle generation

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Can start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 - Blocks User Stories.
- **User Story 1 (Phase 3 - P2)**: Depends on Phase 2 - Can execute independently.
- **User Story 2 (Phase 4 - P2)**: Depends on Phase 2 - Can execute independently or in parallel with US1.
- **Polish & Quality Gates (Phase 5)**: Depends on both US1 and US2 completion.

### User Story Dependencies
- **User Story 1 (P2)**: Independent of User Story 2.
- **User Story 2 (P2)**: Independent of User Story 1.

---

## Parallel Execution Examples

### User Story 1 Parallel Stream
```bash
# Migrate ImportGuidelinesModal:
Task T003: "Migrate src/components/glossary-manager/ImportGuidelinesModal.tsx"

# Migrate QuickAddTermModal:
Task T004: "Migrate src/components/translator-workspace/QuickAddTermModal.tsx"

# Standardize LanguageSelector z-index:
Task T005: "Standardize src/components/common/LanguageSelector.tsx z-index"
```

### User Story 2 Stream
```bash
# Document opencc-js in vite.config.ts:
Task T007: "Update vite.config.ts with technical documentation comments"
```

---

## Implementation Strategy

### MVP Scope (User Story 1 + User Story 2)
1. Complete Phase 1 (Setup) & Phase 2 (Foundational).
2. Migrate `ImportGuidelinesModal.tsx` (T003) and verify.
3. Migrate `QuickAddTermModal.tsx` (T004) and verify.
4. Standardize `LanguageSelector.tsx` z-index (T005) & audit existing modals (T006).
5. Document `opencc-js` & chunking in `vite.config.ts` (T007).
6. Execute Phase 5 (Constitution Quality Gates: `npm run lint`, `npm test`, `npm run build`).
