# Implementation Plan: Rà Soát Lại Có Ghi Nhớ Quyết Định Kiểm Định (Smart Re-audit)

**Branch**: `114-hako-smart-rescan` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/114-hako-smart-rescan/spec.md`

## Summary

Hiện tại, khi người dùng bấm "Rà soát lại" trong tab Kiểm Định Hako, hàm `handleStartAnalysis` khởi tạo lại danh sách lỗi trống (`allDetectedIssues = []`), làm mất trắng toàn bộ quyết định mà người kiểm duyệt đã thực hiện (Bác bỏ, Cần xem lại, Xác nhận lỗi).

Kế hoạch này triển khai cơ chế **Hòa giải Quyết định Kiểm định Thông minh (Decision Reconciliation Engine)**:
1. Tạo chữ ký định danh lỗi duy nhất (`generateIssueFingerprint`) dựa trên `chapterId`, `category` và `snippet`.
2. Triển khai thuật toán thuần túy `reconcileIssuesWithDecisions`:
   - Lỗi đã **Bác bỏ** (`dismissed`): Tiếp tục giữ `dismissed` nếu phát hiện lại, không tạo cảnh báo mới phiền hà.
   - Lỗi đã **Xác nhận** (`confirmed`) hoặc **Cần xem lại** (`review_needed`): Nếu đoạn văn bản đã được dịch giả sửa trong Bàn Dịch (không còn vi phạm), tự động chuyển sang trạng thái **Đã giải quyết** (`resolved`); nếu vi phạm vẫn còn, duy trì trạng thái xác nhận và bảo toàn ghi chú.
   - Lỗi mới phát sinh: Khởi tạo với trạng thái `pending` kèm cờ `isNew: true`.
3. Bổ sung trạng thái `resolved` vào `QualityIssueDecision`, cập nhật bộ lọc, thanh thống kê và hiển thị banner thông báo biến động sau khi hoàn tất rà soát lại.

## Technical Context

**Language/Version**: TypeScript 5.8+, React 19

**Primary Dependencies**: `lucide-react`, `motion`, `clsx`, `tailwind-merge` (Không thêm bất kỳ thư viện ngoài nào)

**Storage**: IndexedDB client-side (`src/services/hakoSessionStore.ts`, `src/services/db.ts`)

**Testing**: Vitest (`npm test`, `npx vitest run`)

**Target Platform**: Trình duyệt Web hiện đại (Desktop SPA)

**Project Type**: Pure Client-Side Single Page Application (SPA)

**Performance Goals**: Quá trình hòa giải lỗi chạy tức thì (< 10ms đối với 100+ lỗi); không làm tăng độ trễ quét quy tắc hoặc gọi API

**Constraints**: Thuần client-side (offline-capable), không gọi API ngoài cho tác vụ so khớp, tuân thủ nghiêm ngặt bảng màu và design system của ứng dụng

**Scale/Scope**: Tối đa 12 chương/lượt rà soát, hàng trăm lỗi kiểm định trong một phiên làm việc

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc Hiến pháp | Đánh giá | Trạng thái |
| :--- | :--- | :--- |
| **I. Strict Quality Gates** | Phải vượt qua `npm run lint`, `npm test`, `npm run build` không lỗi, không skip test. | **PASS** |
| **II. Dependency Minimization** | Tái sử dụng `clsx`, `tailwind-merge`, `lucide-react`, primitives hiện có. Không cài thêm npm package. | **PASS** |
| **III. MVC Domain Boundaries** | Logic hòa giải và băm lỗi thuộc Model/Service (`hakoQualityEngine.ts`); điều phối lưu trữ thuộc Controller/Hook (`useHakoReviewSession.ts`); hiển thị thuộc View (`HakoCheckerWorkspace.tsx`, `HakoIssueReviewPanel.tsx`, `HakoIssueCard.tsx`). | **PASS** |
| **IV. Immutable Core Schemas** | `src/types.ts` và cấu trúc bảng IndexedDB được giữ nguyên 100%. Kiểu union `QualityIssueDecision` trong `src/types/hakoChecker.ts` được mở rộng thêm `'resolved'` hoàn toàn tương thích ngược. | **PASS** |
| **V. Atomic Commits & Docs Sync** | Tạo đầy đủ tài liệu đặc tả, kế hoạch, data model, contracts và quickstart đồng bộ với mã nguồn. | **PASS** |

## Project Structure

### Documentation (this feature)

```text
specs/114-hako-smart-rescan/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (this file)
├── research.md          # Phase 0: Issue Fingerprinting & Reconciliation Algorithm
├── data-model.md        # Phase 1: Entity definitions & State machine
├── quickstart.md        # Phase 1: Verification scenarios & test guide
├── contracts/           # Phase 1: TypeScript interfaces and contracts
│   └── reconciliation.contract.ts
└── checklists/
    └── requirements.md  # Spec quality checklist (16/16 passed)
```

### Source Code (repository root)

```text
src/
├── types/
│   └── hakoChecker.ts                         # [MODIFY] Thêm 'resolved' vào QualityIssueDecision, thêm isNew & resolvedAt vào QualityIssue
├── services/
│   ├── hakoQualityEngine.ts                   # [MODIFY] Thêm generateIssueFingerprint, reconcileIssuesWithDecisions
│   └── __tests__/
│       └── hakoQualityEngine.test.ts          # [MODIFY] Thêm unit tests cho thuật toán hòa giải quyết định
├── hooks/
│   └── useHakoReviewSession.ts                # [MODIFY] Hỗ trợ truyền/lưu trữ diff summary sau rà soát
└── components/
    └── hako-checker/
        ├── HakoIssueCard.tsx                  # [MODIFY] Hiển thị huy hiệu 'resolved' (Đã khắc phục) và 'isNew' (Mới)
        ├── HakoIssueReviewPanel.tsx           # [MODIFY] Thêm filter/stats 'resolved', thanh thông báo biến động rà soát
        ├── HakoCheckerWorkspace.tsx           # [MODIFY] Tích hợp reconcileIssuesWithDecisions khi người dùng bấm 'Rà soát lại'
        └── __tests__/
            └── HakoIssueReviewPanel.test.tsx  # [MODIFY] Cập nhật tests kiểm tra filter và hiển thị badge 'resolved'
```

**Structure Decision**: Áp dụng kiến trúc Single Project SPA hiện có, phân tách rõ rệt tầng Model (`hakoQualityEngine`), Controller (`useHakoReviewSession`), và View (`hako-checker/`).

## Complexity Tracking

*Không có vi phạm Hiến pháp nào cần biện minh.*
