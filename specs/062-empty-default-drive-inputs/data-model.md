# Data Model & State Transitions: Empty Default Google Drive Inputs

## 1. Service Resolution Dual Model

```typescript
// Separation of UI display state vs Runtime effective resolution
interface GoogleCredentialResolvers {
  // UI Display (Only custom override from localStorage, never fallback to .env)
  getCustomClientId(): string;       // Returns '' if not set in localStorage
  getCustomPickerApiKey(): string;   // Returns '' if not set in localStorage

  // Runtime Execution (Fallback to import.meta.env when no custom override)
  getClientId(): string;             // Returns custom || VITE_GOOGLE_CLIENT_ID || ''
  getPickerApiKey(): string;         // Returns custom || VITE_GOOGLE_PICKER_API_KEY || ''
}
```

---

## 2. Modal Input Lifecycle & State Flow

```text
Modal Opens
  │
  ├──► clientIdInput = googleAuthService.getCustomClientId()  (Empty '' by default)
  └──► pickerKeyInput = googlePickerService.getCustomPickerApiKey() (Empty '' by default)

Status Badge Evaluation:
  isCustomClientId = Boolean(localStorage.getItem('ai_dich_truyen_google_client_id'))
  hasClientId = Boolean(clientIdInput.trim() || googleAuthService.getClientId())

  - hasClientId === true && isCustomClientId === false  ──► Badge: "Đã cấu hình sẵn" (neutral)
  - hasClientId === true && isCustomClientId === true   ──► Badge: "Tùy chỉnh riêng" (polish)
  - hasClientId === false                               ──► Badge: "Chưa cấu hình" (warning)

User Types Custom Key & Clicks "Lưu":
  │
  ├──► googleAuthService.setClientId(inputVal)
  ├──► localStorage.setItem('ai_dich_truyen_google_client_id', inputVal)
  └──► Badge updates to "Tùy chỉnh riêng"

User Clicks "Mặc định" (Reset):
  │
  ├──► googleAuthService.setClientId('')
  ├──► localStorage.removeItem('ai_dich_truyen_google_client_id')
  ├──► setClientIdInput('')  (Empty input restored)
  └──► Badge reverts to "Đã cấu hình sẵn"
```
