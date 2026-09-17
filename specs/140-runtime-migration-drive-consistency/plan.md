# Implementation Plan: Kích Hoạt Di Trú Hạn Mức Runtime, Nhất Quán Lưu Trữ Drive & Phân Đoạn Theo Ngân Sách Token (140-runtime-migration-drive-consistency)

**Branch**: `140-runtime-migration-drive-consistency` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/140-runtime-migration-drive-consistency/spec.md`

---

## Summary

Triển khai kế hoạch gia cố toàn diện tính nhất quán runtime và lưu trữ cho ứng dụng dịch thuật:
1. **[P1] Kích hoạt di trú hạn mức runtime**: Tự động kích hoạt `migrateCustomLimits(apiKeys)` ngay khi nạp khóa trong `migrateAndLoadApiKeys()` (`useAIConfig.ts`) và khi khởi tạo điều phối trong `initKeySchedule()` (`geminiKeyScheduler.ts`); mở rộng `getStoredCustomLimits(apiKeys?)` hỗ trợ tự động kích hoạt di trú.
2. **[P2] Hợp nhất tuần tự hóa lưu trữ & Giao dịch nguyên tử cho Drive Sync**: Chuyển `enqueueProjectSave()` (`projectStorageQueue.ts`) thành ủy quyền trực tiếp tới `saveProjectToDB()` (`db.ts`); bổ sung hàm `atomicSaveProjectBundle()` thực thi trên một multi-store transaction duy nhất của IndexedDB cho `pullBundle()` (`driveBundleSync.ts`), loại bỏ hoàn toàn nguy cơ partial-commit.
3. **[P3] Phân đoạn song ngữ theo ngân sách token thực tế**: Cải tiến thuật toán `splitBilingualAdaptively()` trong `bilingualSplit.ts` áp dụng cơ chế gom đoạn lũy kế theo trọng số token (Greedy Accumulative Packing by Token Weight), bảo đảm từng chunk bám sát giới hạn `maxTokensPerChunk` ngay cả khi kích thước các đoạn văn phân bổ lệch nhau.

---

## Technical Context

**Language/Version**: TypeScript 5.8 / Node.js >= 20 / Trình duyệt ES2022  
**Primary Dependencies**: React 19, Vite, `@google/genai`, `clsx`, `tailwind-merge`, `motion`, `lucide-react` (Không thêm dependency mới)  
**Storage**: IndexedDB (cơ sở dữ liệu cục bộ client-side), `sessionStorage` (bộ đệm trạng thái hạn ngạch tạm thời), `localStorage` (cấu hình hạn mức cá nhân)  
**Testing**: Vitest (`npm test`), TypeScript compiler typechecking (`npm run lint`), Vite build bundle (`npm run build`)  
**Target Platform**: Thuần Client-side SPA trên trình duyệt hiện đại (Chrome, Edge, Firefox, Safari)  
**Project Type**: Single Page Web Application (Zero-Backend SPA)  
**Performance Goals**:
- Di trú hạn mức runtime chạy tức thời (< 5ms) trong quá trình nạp khóa hoặc khởi tạo scheduler.
- Thao tác ghi gói nguyên tử `atomicSaveProjectBundle` hoàn tất trong < 100ms cho 100 chương.
- Phân đoạn song ngữ gom lũy kế token xử lý 10,000 từ trong < 15ms trên main thread.
**Constraints**:
- Tuân thủ nghiêm ngặt các nguyên tắc trong Hiến pháp dự án và `AGENTS.md`.
- Tuyệt đối không thay đổi schema IndexedDB của Project/Chapter.
- Giữ nguyên 100% các nhãn giao diện tiếng Việt.
- Không cài đặt thêm bất kỳ thư viện NPM nào mới.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên Tắc Hiến Pháp | Đánh Giá Tuân Thủ | Ghi Chú Chi Tiết |
| :--- | :---: | :--- |
| **I. Strict Quality Gates (NON-NEGOTIABLE)** | **PASS** | Bắt buộc chạy và pass 100% `npm run lint`, `npm test`, `npm run build` trước khi báo cáo hoàn thành. Không xóa/skip test. |
| **II. Dependency Minimization** | **PASS** | Tận dụng Web Crypto API, IDBTransaction đa store chuẩn của trình duyệt; không cài thêm package NPM mới. |
| **III. Strict Concern Separation & MVC** | **PASS** | Giữ đúng ranh giới: Hooks (`src/hooks/`), Services (`src/services/`), Utils (`src/utils/`), Types (`src/types/`). Không để services phụ thuộc vào UI components. |
| **IV. Immutable Core Schemas & Storage Stability** | **PASS** | Không làm biến đổi schema IndexedDB; các store `projects`, `chapters`, `crdt_docs` được bảo toàn nguyên vẹn cấu trúc khóa và index. |
| **V. Atomic Commits & Documentation Sync** | **PASS** | Đồng bộ đầy đủ đặc tả, contracts, quickstart, data model và kế hoạch triển khai. |

---

## Project Structure

### Documentation (this feature)

```text
specs/140-runtime-migration-drive-consistency/
├── spec.md              # Đặc tả yêu cầu người dùng và tiêu chuẩn kiểm thử
├── plan.md              # Kế hoạch triển khai kỹ thuật (tệp hiện tại)
├── research.md          # Nghiên cứu kỹ thuật Phase 0 giải quyết các bài toán thiết kế
├── data-model.md        # Mô hình thực thể và ràng buộc dữ liệu Phase 1
├── quickstart.md        # Hướng dẫn xác thực và chạy kịch bản kiểm thử Phase 1
├── checklists/
│   └── requirements.md  # Bảng kiểm tra chất lượng đặc tả
└── contracts/
    ├── custom-limits-runtime.contract.ts  # Hợp đồng di trú hạn mức runtime
    ├── atomic-bundle-storage.contract.ts  # Hợp đồng giao dịch nguyên tử & hàng đợi ghi
    └── bilingual-token-packing.contract.ts # Hợp đồng phân đoạn song ngữ theo ngân sách token
```

### Source Code (repository root)

```text
src/
├── hooks/
│   ├── useAIConfig.ts                   # [MODIFY] Tự động gọi migrateCustomLimits khi nạp khóa trong migrateAndLoadApiKeys
│   └── __tests__/
│       └── useAIConfig.test.ts          # [NEW/MODIFY] Test kích hoạt di trú khi nạp API keys
├── services/
│   ├── db.ts                            # [MODIFY] Thêm atomicSaveProjectBundle với IDBTransaction đa store
│   ├── projectStorageQueue.ts           # [MODIFY] Hợp nhất hàng đợi: enqueueProjectSave ủy quyền cho saveProjectToDB
│   ├── gemini/
│   │   ├── geminiKeyScheduler.ts        # [MODIFY] Gọi migrateCustomLimits(rawKeys) trước khi đọc getStoredCustomLimits
│   │   └── __tests__/
│   │       └── geminiKeyScheduler.test.ts # [MODIFY] Test scheduler nhận diện hạn mức sau di trú
│   ├── google-drive/
│   │   ├── driveBundleSync.ts           # [MODIFY] Sử dụng atomicSaveProjectBundle trong pullBundle
│   │   └── __tests__/
│   │       └── driveBundleSync.test.ts  # [NEW/MODIFY] Test pullBundle nguyên tử, rollback khi lỗi
│   ├── translation/
│   │   ├── bilingualSplit.ts            # [MODIFY] Cải tiến thuật toán gom đoạn theo trọng số token lũy kế
│   │   └── __tests__/
│   │       └── bilingualSplit.test.ts   # [MODIFY] Bổ sung test gom đoạn thông minh với paragraph dài lệch nhau
│   └── __tests__/
│       ├── db.test.ts                   # [MODIFY] Test atomicSaveProjectBundle multi-store transaction
│       └── projectStorageQueue.test.ts  # [MODIFY] Test hợp nhất hàng đợi ghi FIFO
└── utils/
    ├── customLimitsStorage.ts           # [MODIFY] getStoredCustomLimits(apiKeys?) hỗ trợ auto-migration
    └── __tests__/
        └── customLimitsStorage.test.ts  # [MODIFY] Test getStoredCustomLimits với auto-migration parameter
```

---

## Phases & Implementation Strategy

### Phase 0: Outline & Research
- [x] Nghiên cứu các điểm chốt chặn kích hoạt di trú hạn mức runtime (Defense in depth)
- [x] Nghiên cứu giải pháp hợp nhất hàng đợi và giao dịch đa store nguyên tử IndexedDB
- [x] Nghiên cứu thuật toán gom đoạn song ngữ theo trọng số token lũy kế (Greedy Accumulative Packing)
- [x] Xuất bản `specs/140-runtime-migration-drive-consistency/research.md`

### Phase 1: Design & Contracts
- [x] Xác định mô hình thực thể và luồng dữ liệu trong `data-model.md`
- [x] Thiết lập các hợp đồng giao diện trong thư mục `contracts/`
- [x] Xây dựng tài liệu hướng dẫn kiểm thử xác thực trong `quickstart.md`
- [x] Xuất bản `specs/140-runtime-migration-drive-consistency/plan.md`

### Phase 2: Implementation (Scheduled for `/speckit-tasks` and `/speckit-implement`)
- **Nhóm P1**: Kích hoạt di trú hạn mức runtime (`useAIConfig.ts`, `geminiKeyScheduler.ts`, `customLimitsStorage.ts`) kèm unit tests.
- **Nhóm P2**: Hợp nhất hàng đợi ghi (`projectStorageQueue.ts`) và giao dịch nguyên tử `atomicSaveProjectBundle` (`db.ts`, `driveBundleSync.ts`) kèm unit tests.
- **Nhóm P3**: Thuật toán phân đoạn song ngữ gom lũy kế token (`bilingualSplit.ts`) kèm unit tests.
- **Nhóm P4**: Nghiệm thu toàn diện các cổng chất lượng (`npm run lint`, `npm test`, `npm run build`).
