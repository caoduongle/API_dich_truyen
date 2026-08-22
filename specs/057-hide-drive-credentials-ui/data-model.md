# Data Model & Component State: Hide Google Drive Credentials

## 1. Credential State Resolution Model

```typescript
type CredentialOrigin = 'default' | 'custom' | 'missing';

interface CredentialStatus {
  origin: CredentialOrigin;
  isAvailable: boolean;
  isCustom: boolean;
  displayLabel: string;
}
```

### Resolution Logic:
```text
                  ┌────────────────────────────────────────┐
                  │ Does localStorage have custom value?   │
                  └──────────────────┬─────────────────────┘
                                     │
                     ┌───────────────┴───────────────┐
                    YES                              NO
                     │                               │
           [origin: 'custom']         ┌──────────────────────────────┐
           Badge: 'Tùy chỉnh riêng'   │ Does import.meta.env have    │
           Tone: 'polish'             │ build-time default value?    │
                                      └──────────────┬───────────────┘
                                                     │
                                     ┌───────────────┴───────────────┐
                                    YES                              NO
                                     │                               │
                           [origin: 'default']             [origin: 'missing']
                           Badge: 'Đã cấu hình sẵn'        Badge: 'Chưa cấu hình'
                           Tone: 'neutral'                 Tone: 'warning'
```

---

## 2. Modal Local UI State

```typescript
interface GoogleSyncModalUIState {
  // Advanced configuration drawer
  showAdvancedSettings: boolean;
  
  // Masking toggles for input fields
  revealClientId: boolean;
  revealPickerKey: boolean;
  
  // Controlled input values for custom overrides
  clientIdInput: string;
  pickerKeyInput: string;
}
```

---

## 3. Component Interaction Flow

```text
Default Modal Open (when default credentials exist)
  │
  ├──► Shows "Đã cấu hình sẵn" status badge
  │    (Raw strings completely hidden)
  │
  └──► User clicks "Tùy chỉnh nâng cao" (Chevron toggle)
         │
         ▼
       Expands Collapsible Section
         ├── Masked Client ID input [••••••••••••••••] + [Eye icon]
         ├── Masked Picker Key input [••••••••••••••••] + [Eye icon]
         └── Action buttons: [Lưu cấu hình] / [Khôi phục mặc định]
```
