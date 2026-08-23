# Research: Clean Code & Modular Refactoring

**Feature**: 068-clean-code-refactor
**Date**: 2026-08-23

---

## R1: QuotaService Sub-module Boundary Decision

**Decision**: Chia `server/services/quotaService.ts` thành 5 sub-modules chuyên trách trong `server/services/quota/`, kết hợp qua facade `quotaService.ts`.

- **`circuitBreaker.ts`**:
  - Chịu trách nhiệm quản lý `modelCooldowns`, `groupCooldowns`, và `providerOutageStatus`.
  - Các hàm: `triggerModelCooldown`, `getModelCooldownStatus`, `getActiveModelCooldowns`, `recordUpstreamFailureEvent`, `getProviderOutageStatus`, `triggerGroupCooldown`, `getActiveGroupCooldowns`.
- **`groupManager.ts`**:
  - Chịu trách nhiệm quản lý `QuotaGroup` registry, custom quota group config, project verification, và bucket hashing.
  - Các hàm: `registerQuotaGroup`, `verifyGroupProject`, `areKeysInSameVerifiedBucket`, `updateProviderQuota`, `ensureKeyGroup`, `getQuotaGroup`, `getAllQuotaGroups`, `getGroupIdForKey`, `evaluateQuotaGroups`.
- **`keyScheduler.ts`**:
  - Chịu trách nhiệm thuật toán chọn key tối ưu (`selectBestKeyInGroup`), tính toán khoảng cách pacing (`computeGroupInterval`), tạo scheduling hint, và cấp lease (`scheduleAttempt`).
- **`quotaAccountant.ts`**:
  - Chịu trách nhiệm đếm số token (`TokenStats`), cửa sổ RPM/RPD/TPM (`recordGroupUsage`, `recordUsage`), lưu trữ key health state, error classification (`recordCategorizedError`), disabled key state, và snapshot thống kê.
- **`quotaTelemetry.ts`**:
  - Chịu trách nhiệm log request attempts (`recordAttemptTrace`, `getRecentAttempts`), metrics tóm tắt logical request, queue wait telemetry, và canonical metrics.

**Facade `quotaService.ts`**:
- Re-export toàn bộ types, constants (`hashApiKey`, `maskApiKey`, `getDayInLosAngeles`), và class `QuotaService` khởi tạo singleton `quotaService`.
- Giữ nguyên 100% chữ ký method để không một controller hay test case nào bị ảnh hưởng.

---

## R2: GoogleDriveSyncService Decomposition

**Decision**: Tách `src/services/googleDriveSyncService.ts` thành:
- **`src/services/google-drive/driveRestClient.ts`**:
  - Đóng gói toàn bộ raw HTTP REST calls tới Google Drive v3 API (`findOrCreateAppFolder`, `uploadOrUpdateFile`, `downloadFileContent`, `listProjectFolders`, `deleteDriveFile`, `getFileMetadata`).
  - Tự động đính kèm Bearer token, chuẩn hóa lỗi, và parse JSON/ArrayBuffer.
- **`src/services/google-drive/driveProjectSync.ts`**:
  - Chứa logic đồng bộ dự án nguyên khối (monolithic sync): `pushProject`, `pullProject`, `reconcileProjectTimestamps`, `serializeProjectForDrive`, `deserializeProjectFromDrive`.
- **`src/services/google-drive/driveGranularSync.ts`**:
  - Chứa logic đồng bộ dự án phân tán (granular sync): manifest hashing, từng chương riêng biệt (`ChapterManifestItem`), CRDT snapshot reconciliation (`encodeChapterWithCrdt`), `pushSharedProjectGranular`, `pullSharedProjectGranular`, `syncSharedProjectGranular`.
- **`googleDriveSyncService.ts`**:
  - Re-export class và singleton `googleDriveSyncService` làm facade, giữ nguyên API cho frontend.

---

## R3: Component Sub-tree Modularization Strategy

**Decision**:
1. **`QuotaPanel.tsx`**:
   - Chuyển `CountdownBadge` sang `src/components/quota-panel/CountdownBadge.tsx`.
   - Chuyển `ModelLimitsEditor` sang `src/components/quota-panel/ModelLimitsEditor.tsx`.
   - Chuyển `GroupQuotaCard` sang `src/components/quota-panel/GroupQuotaCard.tsx`.
2. **`ApiSettings.tsx`**:
   - Chuyển `ModelSummaryCard` sang `src/components/api-settings/ModelSummaryCard.tsx`.
   - Chuyển tab quản lý key sang `src/components/api-settings/KeyListSection.tsx`.
3. **`GoogleSyncModal.tsx`**:
   - Sử dụng component chuẩn `src/components/ui/Modal.tsx` thay vì thẻ `div` tự chế backdrop overlay.
   - Tách `GoogleSyncAdvancedConfig` sang `src/components/google-sync/GoogleSyncAdvancedConfig.tsx`.
