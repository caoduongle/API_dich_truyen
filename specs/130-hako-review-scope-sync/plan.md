# Implementation Plan: Đồng Bộ Phạm Vi Hiển Thị & Cơ Chế Quyết Định Lỗi Kiểm Định Hako (Hako Review Scope & Decision Sync)

**Branch**: `130-hako-review-scope-sync` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/130-hako-review-scope-sync/spec.md`

---

## Summary

Khắc phục triệt để hiện tượng lệch phạm vi giữa bộ chọn chương và bảng duyệt lỗi (người dùng chọn chương khác nhưng lỗi chương cũ vẫn hiển thị), đồng thời siết chặt logic chuyển đổi trạng thái `resolved` trong `hakoQualityEngine.ts` để ngăn chặn việc lỗi đã ấn "Xác nhận lỗi" bị tự ý chuyển thành "Đã giải quyết" khi chưa hề sửa bản dịch.

---

## Technical Context

**Language/Version**: TypeScript 5.7+ / React 19  
**Primary Dependencies**: React, Lucide-react, Tailwind CSS v4, `clsx`, `tailwind-merge`  
**Storage**: IndexedDB (`src/services/db.ts`, `src/services/hakoSessionStore.ts`)  
**Testing**: Vitest (`npm test`)  
**Target Platform**: Pure Client-Side SPA (Web Browser)  
**Project Type**: Web Application (React SPA)  
**Performance Goals**: Phản hồi lọc theo chương < 16ms (60 fps), không giật lag khi chuyển đổi danh sách 12 chương.  
**Constraints**: Không sửa IndexedDB schema; không thêm dependency mới; tuân thủ nghiêm ngặt bảng màu và design system.  
**Scale/Scope**: Tối đa 12 chương mỗi đợt quét, tối đa hàng trăm lỗi trong phiên làm việc.  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Principle I (Strict Quality Gates)**: Tất cả kiểm thử `npm run lint`, `npm test`, `npm run build` phải pass 100%.
- [x] **Principle II (Dependency Minimization)**: Không cài thêm package bên ngoài; sử dụng primitives và icons hiện có.
- [x] **Principle III (MVC Separation)**:
  - View: `HakoCheckerWorkspace.tsx`, `HakoIssueReviewPanel.tsx`, `HakoIssueCard.tsx`.
  - Service/Model: `hakoQualityEngine.ts`.
  - Không vi phạm ranh giới phân tầng.
- [x] **Principle IV (Immutable Schemas)**: Giữ nguyên interface `QualityIssue` và schema cơ sở dữ liệu `hakoSessionStore`.
- [x] **Principle V (Atomic Commits)**: Triển khai tập trung đúng phạm vi mô tả của feature.

---

## Project Structure

### Documentation (this feature)

```text
specs/130-hako-review-scope-sync/
├── spec.md              # Feature specification
├── plan.md              # Implementation Plan
├── research.md          # Phase 0 research findings
├── data-model.md        # Phase 1 data model & state machine
├── quickstart.md        # Validation scenarios guide
├── contracts/
│   └── review-scope-sync.contract.ts
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── components/
│   └── hako-checker/
│       ├── HakoCheckerWorkspace.tsx     # [MODIFY] Truyền selectedChapterIds vào HakoIssueReviewPanel; truyền map text chương vào engine
│       ├── HakoIssueReviewPanel.tsx     # [MODIFY] Hỗ trợ filter 'selected' mặc định & dropdown phạm vi chương linh hoạt
│       └── HakoIssueCard.tsx            # [MODIFY] Tinh chỉnh phản hồi trực quan khi bấm 3 nút quyết định
├── services/
│   └── hakoQualityEngine.ts             # [MODIFY] Siết chặt điều kiện chuyển sang 'resolved' trong reconcileIssuesWithDecisions
└── services/__tests__/
    └── hakoQualityEngine.test.ts        # [MODIFY] Bổ sung unit tests cho điều kiện không tự ý chuyển resolved
```

---

## Phased Execution Strategy

### Phase 0: Research (Completed)
- Xem [research.md](./research.md) cho phân tích gốc rễ 3 vấn đề và phương án kiến trúc.

### Phase 1: Design & Contracts (Completed)
- Xem [data-model.md](./data-model.md) cho mô hình lọc phạm vi và sơ đồ máy trạng thái.
- Xem [contracts/review-scope-sync.contract.ts](./contracts/review-scope-sync.contract.ts) cho hợp đồng tham số props và hàm.
- Xem [quickstart.md](./quickstart.md) cho kịch bản kiểm thử tích hợp.

### Phase 2: Implementation (Scheduled for `/speckit-tasks` & `/speckit-implement`)
1. **Core Service Engine (`src/services/hakoQualityEngine.ts`)**:
   - Cập nhật `reconcileIssuesWithDecisions` nhận thêm bản đồ nội dung tiếng Việt của các chương.
   - Chỉ chuyển sang `resolved` khi đoạn trích vi phạm thực sự biến mất khỏi văn bản tiếng Việt của chương.
   - Viết unit test chứng minh lỗi `confirmed` không bị đổi sang `resolved` nếu text chưa sửa.
2. **Workspace & Review Panel Integration**:
   - Trong `HakoCheckerWorkspace.tsx`: Truyền `selectedChapterIds={session?.selectedChapterIds || []}` vào `HakoIssueReviewPanel`.
   - Trong `HakoIssueReviewPanel.tsx`: Thêm tùy chọn lọc theo `'selected'` (mặc định), tự động đồng bộ khi người dùng tick chọn chương mới.
   - Cung cấp dropdown phạm vi: *"Các chương đang chọn"*, *"Toàn bộ phiên làm việc"*, và từng chương cụ thể.
3. **Card Decision Feedback**:
   - Tăng cường phản hồi thị giác và tooltip cho 3 nút "Bác bỏ", "Cần xem lại", "Xác nhận lỗi".
4. **Verification**:
   - Chạy `npm test`, `npm run lint`, `npm run build`.
