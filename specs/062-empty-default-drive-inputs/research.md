# Research & Architecture Decisions: Empty Default Google Drive Inputs

## 1. Context & UX Problem

### Current Issue
In `src/components/google-sync/GoogleSyncModal.tsx`:
```tsx
const [clientIdInput, setClientIdInput] = useState<string>(googleAuthService.getClientId());
const [pickerKeyInput, setPickerKeyInput] = useState<string>(googlePickerService.getPickerApiKey());
```
Because `getClientId()` and `getPickerApiKey()` fall back to `.env` variables (`VITE_GOOGLE_CLIENT_ID` / `VITE_GOOGLE_PICKER_API_KEY`) when `localStorage` has no custom key:
1. When a user expands the "Tùy chỉnh" (Advanced Settings) section, the inputs are pre-filled with the default system keys.
2. The user has to manually select all characters, delete the default value, and then type their own custom key.
3. If they accidentally save, they might inadvertently freeze the default key into `localStorage` as a custom key.
4. It exposes the raw value in the input state (even if masked as password, inspecting or revealing displays the system default string).

---

## 2. Technical Decisions

### Decision 1: Add Dedicated `getCustomClientId()` and `getCustomPickerApiKey()` Methods
- **Decision**: In `src/services/googleAuthService.ts` and `src/services/googlePickerService.ts`, add:
  ```typescript
  // In googleAuthService.ts
  public getCustomClientId(): string {
    if (typeof window === 'undefined') return '';
    const stored = localStorage.getItem(CUSTOM_CLIENT_ID_KEY);
    return (stored && stored.trim()) || '';
  }

  // In googlePickerService.ts
  public getCustomPickerApiKey(): string {
    if (typeof window === 'undefined') return '';
    const stored = localStorage.getItem(CUSTOM_PICKER_KEY);
    return (stored && stored.trim()) || '';
  }
  ```
- **Rationale**: Clean separation between **displaying user-configured custom inputs** (read from `localStorage` only, default `""`) and **effective runtime resolution** (`getClientId()` / `getPickerApiKey()`, which fallback to `.env`).

### Decision 2: Update Input State Initialization and Reset Handlers in `GoogleSyncModal.tsx`
- **Decision**:
  - Initialize state with `googleAuthService.getCustomClientId()` and `googlePickerService.getCustomPickerApiKey()`.
  - In `handleResetClientId()` and `handleResetPickerKey()`, set input value to `''` after calling `setClientId('')` / `setPickerApiKey('')`.
  - Update placeholders to explicitly guide the user:
    - `"Để trống để dùng Client ID mặc định của hệ thống..."`
    - `"Để trống để dùng Picker API Key mặc định của hệ thống..."`
- **Rationale**: Guarantees that inputs remain completely blank unless the user has actively entered a custom key, while preserving status badges and background runtime defaults.

---

## 3. Compatibility & Non-Regression Analysis

| Flow / Subsystem | Impact | Verification |
|---|---|---|
| **Google Login (`initiateLogin`)** | `handleLogin` continues resolving `googleAuthService.getClientId()`, using `.env` fallback when input is empty. | Unit test verifying effective client ID resolution. |
| **Google Picker (`openFolderPicker`)** | `handleOpenSharedProjectPicker` uses effective Picker API key fallback. | Unit test verifying effective picker key resolution. |
| **Status Badge (`Đã cấu hình sẵn`)** | `hasClientId` continues using `clientIdInput.trim() || googleAuthService.getClientId()`. When input is empty and `.env` has key, badge correctly shows "Đã cấu hình sẵn" (neutral tone). | Unit test on badge resolution logic. |
