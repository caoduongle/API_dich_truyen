# Contract: Pre-Download Permission Validation

**Module**: `src/services/google-drive/driveGranularSync.ts`
**Feature**: `070-fix-picker-app-id-404`

---

## 1. Function Specification

### `validateSelectedFilesForImport(selectedFiles: { id: string; name: string }[] | undefined, manifest: SharedProjectManifest | null): { isValid: boolean; missingFiles: string[]; errorMessage?: string }`

#### Inputs
- `selectedFiles`: List of files authorized by the user via Google Picker.
- `manifest`: Parsed `manifest.json` containing the expected list of chapter items.

#### Rules
1. If `selectedFiles` is provided:
   - Check presence of `project.json`. If missing, add to `missingFiles`.
   - If `manifest` exists: for each chapter `chapMeta` in `manifest.chapters`, check if `chapter_${chapMeta.id}.json` is present in `selectedFiles`. If missing, add to `missingFiles`.
2. If `missingFiles.length > 0`:
   - `isValid`: `false`
   - `errorMessage`: `"Chưa cấp quyền cho các tệp: ${missingFiles.join(', ')}. Vui lòng mở lại và chọn TẤT CẢ tệp trong hộp thoại Google Picker (Ctrl+A / Cmd+A)."`
3. If no missing files:
   - `isValid`: `true`
   - `missingFiles`: `[]`

---

## 2. Invariants

- Must execute before initiating individual chapter downloads.
- Prevents unhandled 404 HTTP errors.
- Never mutates existing local data when validation fails.
