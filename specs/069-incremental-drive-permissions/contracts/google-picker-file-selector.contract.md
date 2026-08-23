# Contract: Google Picker Multi-File Selector

**Module**: `src/services/googlePickerService.ts`
**Feature**: `069-incremental-drive-permissions`

---

## 1. Interface Definition

```typescript
export interface SelectedDriveFile {
  id: string;
  name: string;
  mimeType?: string;
}

export interface OpenFilePickerOptions {
  accessToken: string;
  pickerApiKey?: string;
  folderId: string;
  title?: string;
  onFilesSelected: (files: SelectedDriveFile[]) => void;
  onCancel?: () => void;
}
```

---

## 2. Method Signatures

### `GooglePickerService.prototype.openFilePicker(options: OpenFilePickerOptions): Promise<void>`

Opens a Google Picker modal configured for:
- View: `google.picker.DocsView(google.picker.ViewId.DOCS)`
- Parent folder: `view.setParent(folderId)`
- Multi-selection: `builder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED)`
- Inclusion: `view.setIncludeFolders(false).setSelectFolderEnabled(false)`

#### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accessToken` | `string` | Yes | Active OAuth 2.0 access token |
| `pickerApiKey` | `string` | No | Optional API key (defaults to stored or environment key) |
| `folderId` | `string` | Yes | Drive folder ID to anchor to |
| `title` | `string` | No | Custom title for the Picker modal |
| `onFilesSelected` | `(files: SelectedDriveFile[]) => void` | Yes | Invoked with array of selected files when user clicks Select |
| `onCancel` | `() => void` | No | Invoked when user cancels or dismisses picker |

#### Throws
- `Error`: If API key is missing or invalid.
- `Error`: If Google Picker script fails to load.

---

## 3. Behavior Invariants

1. **Strict Folder Isolation**: The picker view must not permit navigation to other folders in the user's Google Drive.
2. **Multi-Selection**: Users can select 1, multiple, or all items in the folder.
3. **Idempotence**: Selecting an item that was already authorized does not reset, revoke, or duplicate permissions.
