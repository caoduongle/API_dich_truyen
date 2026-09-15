# Implementation Plan: Gia Cố Ngữ Nghĩa Trạng Thái, Chỉ Số Vòng Đời & Toàn Vẹn Lưu Trữ (139-state-semantics-storage-hardening)

**Branch**: `139-state-semantics-storage-hardening` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/139-state-semantics-storage-hardening/spec.md`

---

## Summary

Triển khai kế hoạch gia cố toàn diện về ngữ nghĩa trạng thái (State Semantics) và ranh giới lưu trữ (Storage Boundaries) cho ứng dụng dịch thuật:
1. Sửa lỗi `failedRequestsTotal/Today` bằng cách bổ sung `recordLogicalFailure()` vào `LocalQuotaTracker` và kích hoạt chính xác tại điểm kết thúc thất bại của một yêu cầu logic trong `geminiClient`.
2. Tách bạch bộ đếm thử lại: Loại bỏ việc tự động tăng `retriesTotal` khỏi `recordFailure()`, bổ sung `recordRetry()` và chỉ kích hoạt khi thực sự chuyển khóa hoặc retry gọi lại nhà cung cấp.
3. Đưa ranh giới tuần tự hóa ghi (Write Serialization Queue / Promise Chain) vào trực tiếp bên trong hàm `saveProjectToDB()` tại `src/services/db.ts`, tự động bảo vệ tất cả các caller (UI hooks, Google Drive sync) khỏi xung đột ghi đè Race Condition.
4. Xây dựng hàm di trú tự động (`migrateCustomLimits`) trong `customLimitsStorage.ts` và cơ chế nạp trong `LocalQuotaTracker`, chuyển đổi an toàn các khóa băm 32-bit cũ sang chuẩn SHA-256 mới (64 ký tự hex) mà không làm mất cấu hình `maxRpd` của người dùng.
5. Đồng bộ hóa và xuất khẩu hợp đồng `IBilingualSplitter`, bảo đảm hàm `splitBilingualAdaptively` hỗ trợ hoàn hảo cả cú pháp tham số vị trí và đối tượng `BilingualSplitOptions` với tham số `maxTokensPerChunk`.

---

## Technical Context

**Language/Version**: TypeScript 5.8 / Node.js >= 20 / Trình duyệt ES2022  
**Primary Dependencies**: React 19, Vite, `@google/genai`, `clsx`, `tailwind-merge`, `motion`, `lucide-react` (Không thêm dependency mới)  
**Storage**: IndexedDB (cơ sở dữ liệu cục bộ client-side), `sessionStorage` (bộ đệm trạng thái hạn ngạch tạm thời), `localStorage` (cấu hình hạn mức cá nhân)  
**Testing**: Vitest (`npm test`), TypeScript compiler typechecking (`npm run lint`), Vite build bundle (`npm run build`)  
**Target Platform**: Thuần Client-side SPA trên trình duyệt hiện đại (Chrome, Edge, Firefox, Safari)  
**Project Type**: Single Page Web Application (Zero-Backend SPA)  
**Performance Goals**:
- Thao tác ghi tuần tự hóa `saveProjectToDB` không làm tăng độ trễ giao diện người dùng (< 50ms).
- Thao tác di trú mã băm cấu hình chạy tức thời (< 10ms) khi nạp danh sách keys.
- Phân đoạn song ngữ xử lý văn bản 10,000 từ trong dưới 20ms.
**Constraints**:
- Tuân thủ nghiêm ngặt 5 nguyên tắc cốt lõi trong Hiến pháp dự án (`.specify/memory/constitution.md`).
- Tuyệt đối không thay đổi logic dịch thuật/gọi Gemini ngoài phạm vi kiểm toán.
- Không thêm package NPM mới.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên Tắc Hiến Pháp | Đánh Giá Tuân Thủ | Ghi Chú Chi Tiết |
| :--- | :---: | :--- |
| **I. Strict Quality Gates (NON-NEGOTIABLE)** | **PASS** | Bắt buộc chạy và pass 100% `npm run lint`, `npm test`, `npm run build` trước khi báo cáo hoàn thành. Không xóa/skip test. |
| **II. Dependency Minimization** | **PASS** | Không cài đặt thêm bất kỳ thư viện NPM nào mới; tái sử dụng các module có sẵn (`crypto` chuẩn Web Crypto / Node crypto, Map, Promise chain). |
| **III. Strict Concern Separation & MVC** | **PASS** | Giữ đúng ranh giới: Services (`src/services/`), Utils (`src/utils/`), Hooks (`src/hooks/`), Types (`src/types/`). Không để hooks import components, không để services import hooks. |
| **IV. Immutable Core Schemas & Storage Stability** | **PASS** | Không làm biến đổi schema IndexedDB của Project/Chapter; chỉ tuần tự hóa thao tác ghi để bảo vệ dữ liệu. Giữ nguyên toàn bộ nhãn giao diện tiếng Việt. |
| **V. Atomic Commits & Documentation Sync** | **PASS** | Duy trì tài liệu đặc tả kỹ thuật, contracts, quickstart và mã nguồn đồng bộ 1:1. |

---

## Project Structure

### Documentation (this feature)

```text
specs/139-state-semantics-storage-hardening/
├── spec.md              # Đặc tả yêu cầu người dùng và tiêu chuẩn kiểm thử
├── plan.md              # Kế hoạch triển khai kỹ thuật (tệp hiện tại)
├── research.md          # Nghiên cứu kỹ thuật Phase 0 giải quyết các bài toán thiết kế
├── data-model.md        # Mô hình thực thể và ràng buộc dữ liệu Phase 1
├── quickstart.md        # Hướng dẫn xác thực và chạy kịch bản kiểm thử Phase 1
├── checklists/
│   └── requirements.md  # Bảng kiểm tra chất lượng đặc tả
└── contracts/
    ├── quota-lifecycle.contract.ts          # Hợp đồng vòng đời yêu cầu logic & thử lại
    ├── storage-queue.contract.ts            # Hợp đồng tuần tự hóa ghi cơ sở dữ liệu
    ├── custom-limits-migration.contract.ts  # Hợp đồng di trú mã băm cấu hình cá nhân
    └── bilingual-split.contract.ts          # Hợp đồng phân đoạn song ngữ
```

### Source Code (repository root)

```text
src/
├── services/
│   ├── localQuotaTracker.ts             # [MODIFY] Thêm recordLogicalFailure, recordRetry; bỏ retriesTotal khỏi recordFailure; hỗ trợ migrate hash cũ
│   ├── projectStorageQueue.ts           # [MODIFY] Tích hợp / đồng bộ ranh giới tuần tự hóa
│   ├── db.ts                            # [MODIFY] Đưa hàng đợi Promise Chain vào nội bộ saveProjectToDB
│   ├── gemini/
│   │   ├── geminiClient.ts              # [MODIFY] Gọi recordLogicalFailure khi thất bại và recordRetry khi xoay khóa
│   │   └── __tests__/geminiClient.test.ts # [MODIFY] Thêm tests cho logical failure và retry separation
│   ├── google-drive/
│   │   ├── driveBundleSync.ts           # Được tự động bảo vệ qua saveProjectToDB
│   │   ├── driveProjectSync.ts          # Được tự động bảo vệ qua saveProjectToDB
│   │   └── driveGranularSync.ts         # Được tự động bảo vệ qua saveProjectToDB
│   ├── translation/
│   │   ├── types.ts                     # [MODIFY] Xuất khẩu IBilingualSplitter và BilingualSplitOptions
│   │   ├── bilingualSplit.ts            # [MODIFY] Hoàn thiện maxTokensPerChunk và xuất khẩu implementation IBilingualSplitter
│   │   └── __tests__/bilingualSplit.test.ts # [MODIFY] Thêm test cho maxTokensPerChunk
│   └── __tests__/
│       ├── localQuotaTracker.test.ts    # [MODIFY] Test logical failure, retry separation, hash migration
│       ├── projectStorageQueue.test.ts  # [MODIFY] Test tuần tự hóa đa nguồn gọi
│       └── dbStorageAudit.test.ts       # [MODIFY] Test lưu trữ tuần tự hóa
├── utils/
│   ├── customLimitsStorage.ts           # [MODIFY] Bổ sung migrateCustomLimits và legacyHashApiKey
│   └── __tests__/
│       └── customLimitsStorage.test.ts  # [NEW] Test di trú cấu hình hạn mức từ hash cũ sang SHA-256 mới
└── hooks/
    └── useProjects.ts                   # Đảm bảo đồng bộ với saveProjectToDB
```

---

## Complexity Tracking

*Không có vi phạm Hiến pháp hoặc bổ sung phức tạp không cần thiết.*
Tất cả các thay đổi đều nằm trong phạm vi gia cố logic nội bộ của các service hiện có, tuân thủ nguyên tắc tái sử dụng thư viện và không tạo thêm tầng trừu tượng dư thừa.
