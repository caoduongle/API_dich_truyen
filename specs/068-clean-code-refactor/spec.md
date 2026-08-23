# Clean Code & Refactor dự án để dễ bảo trì

**Feature**: Tái cấu trúc (refactor) các module lớn trong dự án để giảm độ phức tạp, tách trách nhiệm rõ ràng, và tăng khả năng bảo trì dài hạn — mà không thay đổi hành vi hiện tại (zero functional change).

**Status**: Draft
**Created**: 2026-08-23

---

## Problem Statement

Dự án đã phát triển qua nhiều vòng tính năng liên tiếp, dẫn đến một số module tích lũy quá nhiều trách nhiệm trong cùng một file:

**Backend**:
- `server/services/quotaService.ts` (1.904 dòng, 64.7 KB) — file lớn nhất dự án, gộp chung logic lập lịch key, circuit breaker, kiểm tra giới hạn RPM/RPD/TPM, và telemetry vào một class duy nhất.

**Frontend Services**:
- `src/services/googleDriveSyncService.ts` (1.010 dòng, 32.4 KB) — gộp chung transport layer (raw `fetch` + auth header) với business logic sync manifest/chapter/CRDT.

**Frontend Components**:
- `src/components/QuotaPanel.tsx` (950 dòng) — chứa 3 inline subcomponents (`CountdownBadge`, `ModelLimitsEditor`, `GroupQuotaCard`) lẫn trong file chính.
- `src/components/TranslatorWorkspace.tsx` (956 dòng) — quản lý >30 useState hooks, trộn lẫn state management với rendering logic.
- `src/components/ApiSettings.tsx` (747 dòng) — chứa inline `ModelSummaryCard`, model testing, và key list management.
- `src/components/GlossaryManager.tsx` (710 dòng) — orchestrator lớn có thể tách sub-panels.

**Không nhất quán kiến trúc**:
- `GoogleSyncModal.tsx` (573 dòng) tự triển khai modal overlay riêng thay vì dùng `src/components/ui/Modal.tsx` đã có sẵn.
- Một số file được đặt tên `*Modal` nhưng thực chất là inline panel/form (ví dụ: `ProjectFormModal.tsx`, `ImportChaptersModal.tsx`).

Việc refactor sẽ tuân thủ nguyên tắc **"mỗi lần chỉ sửa 1–2 module"** (theo AGENTS.md), chia thành các đợt (batch) độc lập.

## Actors

| Actor | Description |
|-------|-------------|
| Nhà phát triển | Người bảo trì codebase, đọc / sửa / review code hàng ngày |
| Người dùng cuối | Không bị ảnh hưởng — refactor không thay đổi hành vi ứng dụng |
| CI/CD Pipeline | Chạy lint, test, build để đảm bảo refactor không gây regression |

## Functional Requirements

### FR-1: Tách `quotaService.ts` thành các sub-module

- File `server/services/quotaService.ts` (1.904 dòng) được tách thành các file nhỏ hơn với trách nhiệm rõ ràng:
  - **Lập lịch & chọn key** (key selection, lease scheduling)
  - **Circuit breaker** (health tracking, cooldown, provider outage)
  - **Rate limit checking** (RPM/RPD/TPM token bucket window)
  - **Telemetry & metrics** (request logging, quota metrics)
- File gốc `quotaService.ts` trở thành facade mỏng re-export hoặc orchestrate các sub-module.
- Không thay đổi public API (các hàm/class mà `server/controllers/` và `server/routes/api.ts` import).

### FR-2: Tách `googleDriveSyncService.ts` thành transport + business logic

- File `src/services/googleDriveSyncService.ts` (1.010 dòng) được tách thành:
  - **Google Drive REST client** (transport layer: unified `fetch` wrapper với auth header injection, error normalization, retry)
  - **Sync engine** (business logic: manifest management, chapter push/pull, CRDT snapshot, conflict resolution)
- Public API từ `googleDriveSyncService` (các phương thức mà components import) không thay đổi.

### FR-3: Extract inline subcomponents từ các file component lớn

- `QuotaPanel.tsx` (950 dòng): Extract `CountdownBadge`, `ModelLimitsEditor`, `GroupQuotaCard` thành các file riêng trong `src/components/quota-panel/`.
- `ApiSettings.tsx` (747 dòng): Extract `ModelSummaryCard`, `KeyListEditor` thành các file riêng trong `src/components/api-settings/`.
- `TranslatorWorkspace.tsx` (956 dòng): Extract các nhóm state liên quan thành custom hooks (ví dụ: `useWorkspaceState`) và tách rendering logic thành sub-components trong `src/components/translator-workspace/`.
- `GlossaryManager.tsx` (710 dòng): Extract orchestrator logic thành hook và tách sub-panels thành files riêng trong `src/components/glossary-manager/`.

### FR-4: Chuẩn hoá modal pattern — Migrate `GoogleSyncModal.tsx` sang `ui/Modal`

- `GoogleSyncModal.tsx` hiện tự triển khai backdrop overlay (`fixed inset-0 z-50 flex items-center...`). Chuyển sang sử dụng `src/components/ui/Modal.tsx` đã có sẵn trong design system.
- Giữ nguyên toàn bộ nội dung bên trong modal (form, state, logic đồng bộ).

### FR-5: Đảm bảo zero functional change

- Mọi refactor phải là **pure structural change** — không thêm, bớt, hay đổi hành vi bất kỳ tính năng nào.
- Toàn bộ test hiện có phải tiếp tục pass mà không cần sửa (trừ khi test đang import trực tiếp internal function bị di chuyển — trong trường hợp đó chỉ sửa import path).
- Không thay đổi nội dung text tiếng Việt hiển thị cho người dùng.

## Non-Functional Requirements

### NFR-1: Giảm kích thước file

- Sau refactor, không file nào trong phạm vi sửa đổi vượt quá 400 dòng (trừ file facade re-export).

### NFR-2: Giữ nguyên convention hiện tại

- Sử dụng cùng coding style, naming convention, và import pattern hiện tại của dự án.
- Không thêm barrel files (`index.ts`) — dự án hiện dùng direct file imports.
- Không thêm dependency NPM mới.

### NFR-3: Khả năng review từng phần

- Mỗi batch (đợt refactor) phải có thể review, test, và merge độc lập mà không phụ thuộc vào batch khác.

## User Scenarios & Testing

### Scenario 1: Refactor quotaService.ts (Batch 1 — Backend)
1. Tách `quotaService.ts` thành 4–5 file con trong `server/services/quota/`.
2. Chạy `npm run lint`, `npm test`, `npm run build` — tất cả pass.
3. Các controller (`quotaController.ts`, `rawController.ts`, `polishController.ts`) tiếp tục import và sử dụng quota service bình thường.

### Scenario 2: Tách googleDriveSyncService.ts (Batch 2 — Frontend Service)
1. Tách thành `googleDriveClient.ts` + `googleDriveSyncEngine.ts`.
2. Chạy `npm run lint`, `npm test`, `npm run build` — tất cả pass.
3. `GoogleSyncModal.tsx` và các component khác tiếp tục sử dụng sync service bình thường.

### Scenario 3: Extract subcomponents từ QuotaPanel & ApiSettings (Batch 3 — Frontend Components)
1. Extract inline components thành files riêng.
2. File gốc chỉ còn lại phần orchestration và layout.
3. Chạy `npm run lint`, `npm test`, `npm run build` — tất cả pass.

### Scenario 4: Extract subcomponents từ TranslatorWorkspace & GlossaryManager (Batch 4 — Frontend Components)
1. Tạo custom hooks cho state management.
2. Extract rendering sub-sections.
3. Chạy `npm run lint`, `npm test`, `npm run build` — tất cả pass.

### Scenario 5: Migrate GoogleSyncModal sang ui/Modal (Batch 5 — UI Consistency)
1. Thay thế custom overlay bằng `<Modal>` component.
2. Kiểm tra visual không đổi.
3. Chạy `npm run lint`, `npm test`, `npm run build` — tất cả pass.

## Assumptions

- Các inline subcomponents (ví dụ `CountdownBadge` trong `QuotaPanel.tsx`) không được import/sử dụng ở bất kỳ nơi nào khác ngoài file gốc — nếu có, sẽ cần sửa import path.
- Convention đặt tên thư mục con theo kebab-case (`quota-panel/`, `api-settings/`) giống pattern hiện tại (`auto-translator/`, `google-sync/`, `translator-workspace/`).
- Các test hiện có đủ coverage để phát hiện regression nếu refactor sai.

## Dependencies

- Không phụ thuộc tính năng mới hay thay đổi cấu trúc DB/schema.
- Phụ thuộc vào bộ test hiện tại (601 tests) để xác nhận zero regression.

## Scope Boundaries

### Trong phạm vi

- Tách file lớn thành file nhỏ hơn (move code, không sửa logic).
- Tạo custom hooks để gom nhóm state liên quan.
- Migrate modal overlay sang design system primitive (`ui/Modal`).
- Sửa import paths khi cần thiết sau khi di chuyển code.

### Ngoài phạm vi

- Không sửa logic dịch / gọi API Gemini.
- Không đổi schema IndexedDB (`src/services/db.ts`) hoặc cấu trúc `types.ts`.
- Không đổi nội dung text tiếng Việt hiển thị cho người dùng.
- Không thêm barrel files (`index.ts`).
- Không thêm dependency NPM mới.
- Không sửa lỗi TODO (6 TODOs liên quan `zero-knowledge-session` — nằm ngoài phạm vi refactor).
- Không rename `ProjectFormModal` hay `ImportChaptersModal` — chỉ note lại cho tương lai.

## Success Criteria

- Không file nào trong phạm vi sửa đổi vượt quá 400 dòng (trừ facade).
- 100% test hiện có pass mà không cần sửa logic test.
- `npm run lint`, `npm test`, `npm run build` đều sạch.
- Mỗi batch có thể review và merge độc lập.
- Hành vi ứng dụng hoàn toàn không thay đổi (zero functional change).
