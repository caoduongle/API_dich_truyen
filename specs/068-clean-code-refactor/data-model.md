# Data Model: Clean Code & Modular Refactoring

**Feature**: 068-clean-code-refactor
**Date**: 2026-08-23

---

## Architecture & Module Interfaces

Tính năng này là **Pure Refactoring (Zero Schema Change)**:
- Không thay đổi bất kỳ entity nào trong `src/types.ts` (`StoryProject`, `Chapter`, `GlossaryItem`, `QuotaGroup`, v.v.).
- Không thay đổi schema IndexedDB trong `src/services/db.ts`.
- Mọi interface và types hiện có được giữ nguyên và re-export từ vị trí ban đầu để bảo đảm tương thích ngược 100%.

### Module Mapping

| Module Cũ | Modules Mới Được Tách |
|-----------|------------------------|
| `server/services/quotaService.ts` | `quota/circuitBreaker.ts`, `quota/groupManager.ts`, `quota/keyScheduler.ts`, `quota/quotaAccountant.ts`, `quota/quotaTelemetry.ts`, `quotaService.ts` (Facade) |
| `src/services/googleDriveSyncService.ts` | `google-drive/driveRestClient.ts`, `google-drive/driveProjectSync.ts`, `google-drive/driveGranularSync.ts`, `googleDriveSyncService.ts` (Facade) |
| `src/components/QuotaPanel.tsx` | `quota-panel/CountdownBadge.tsx`, `quota-panel/ModelLimitsEditor.tsx`, `quota-panel/GroupQuotaCard.tsx`, `QuotaPanel.tsx` |
| `src/components/ApiSettings.tsx` | `api-settings/ModelSummaryCard.tsx`, `api-settings/KeyListSection.tsx`, `ApiSettings.tsx` |
| `src/components/google-sync/GoogleSyncModal.tsx` | `google-sync/GoogleSyncAdvancedConfig.tsx`, `GoogleSyncModal.tsx` (using `ui/Modal`) |
