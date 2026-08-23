# Research & Technical Decisions: Google Picker App ID Binding & 404 Fix

**Feature**: `070-fix-picker-app-id-404`
**Date**: 2026-08-23

---

## 1. Google Picker `setAppId` Requirement for `drive.file` Scope

### Context & Root Cause
When an application uses the minimal OAuth scope `https://www.googleapis.com/auth/drive.file`, Google Drive requires associating the client token with the Google Cloud project that owns the application. In Google Picker API, this association is established by calling `.setAppId(appId)` on `PickerBuilder`, where `appId` is the **Google Cloud Project Number** (a numeric string, e.g. `104829104829`).

Without `.setAppId(appId)`:
- The Picker UI displays files and lets the user select them.
- However, Google Picker does NOT grant the per-file `drive.file` OAuth permission to the access token.
- Subsequent `files.get` / `files.download` requests via Google Drive API immediately return `HTTP 404 (File not found)` because the token has no authorized view of the file.

### Decision
- Update both `openFolderPicker` and `openFilePicker` in `src/services/googlePickerService.ts` to call `.setAppId(appId)` on their `PickerBuilder` before `.build()`.
- Obtain `appId` via `this.getAppId()` which checks:
  1. LocalStorage (`ai_dich_truyen_google_app_id`)
  2. Environment variable (`import.meta.env.VITE_GOOGLE_APP_ID`)
- If `appId` is missing/empty, fail fast with a friendly Vietnamese error message immediately before creating the Picker.

### Rationale
- Fixes the exact root cause of the HTTP 404 error without expanding OAuth scopes to broad/risky scopes like `drive` or `drive.readonly`.
- Maintains 100% adherence to Google's principle of least privilege.

---

## 2. Pre-Download Permission Validation in `importProjectFromSharedFolder`

### Context & Problem
In `importProjectFromSharedFolder` (`driveGranularSync.ts`), if a user forgets to select `project.json` or certain chapter files in the multi-select Picker, the system previously:
1. Attempted fallback searches via `files.list` (which might find file IDs from metadata without read permissions).
2. Attempted downloads one by one, throwing cryptic 404 errors during loop execution.

### Decision
Implement a fast pre-download validation pass in `importProjectFromSharedFolder`:
1. Check `project.json`: Must be present in `selectedFiles`. If not, record as missing.
2. Download `manifest.json`.
3. For each chapter in `manifest.chapters`: Check if `chapter_${chapMeta.id}.json` is present in `selectedFiles`. If not, collect its name in `missingFiles`.
4. If `missingFiles.length > 0`: Stop immediately and throw a single comprehensive Vietnamese error:
   *"Chưa cấp quyền cho các tệp: [danh sách tệp]. Vui lòng mở lại và chọn TẤT CẢ tệp trong hộp thoại Google Picker (Ctrl+A / Cmd+A)."*

### Rationale
- Prevents partial or corrupt imports.
- Gives the user clear, actionable guidance on how to fix the issue on the next attempt.

---

## 3. Configuration Management & UI Integration

### Decision
- **Environment Variable**: `VITE_GOOGLE_APP_ID` (Project Number).
- **LocalStorage Key**: `ai_dich_truyen_google_app_id`.
- **UI Control**: Add an "App ID (Project Number)" field in `GoogleSyncAdvancedConfig.tsx` alongside OAuth Client ID and Google Picker API Key.
- **Documentation**: Update `.env.example` and `README.md` explaining how to find the numeric Project Number on Google Cloud Console (IAM & Admin -> Settings -> Project number).

---

## 4. Alternatives Considered

| Alternative | Evaluation | Result |
|---|---|---|
| **Expand scope to `drive.readonly`** | Would avoid per-file picker grants, but triggers CASA tier 2/3 verification, unverified app warnings, and breaks privacy commitments | **Rejected** |
| **Backend proxy token exchange** | Violates the 100% client-side serverless sync architectural principle | **Rejected** |
| **Silent partial download ignoring missing files** | Leaves the imported project incomplete without notifying the user | **Rejected** |
