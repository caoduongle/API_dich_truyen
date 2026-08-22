# Contract: Google Credential Services & Modal UI State

## 1. Module Definitions
- **Services**: `src/services/googleAuthService.ts`, `src/services/googlePickerService.ts`
- **UI Component**: `src/components/google-sync/GoogleSyncModal.tsx`

---

## 2. Interface Signatures

```typescript
// src/services/googleAuthService.ts
export class GoogleAuthService {
  public getCustomClientId(): string;
  public getClientId(): string;
  public setClientId(clientId: string): void;
}

// src/services/googlePickerService.ts
export class GooglePickerService {
  public getCustomPickerApiKey(): string;
  public getPickerApiKey(): string;
  public setPickerApiKey(apiKey: string): void;
}
```

---

## 3. UI Presentation & Behavior Guarantees

1. **Empty Default Inputs**:
   - `clientIdInput` MUST initialize to `getCustomClientId()`, evaluating to `""` when no custom key exists.
   - `pickerKeyInput` MUST initialize to `getCustomPickerApiKey()`, evaluating to `""` when no custom key exists.
2. **Placeholders**:
   - Client ID input MUST display `placeholder="Để trống để dùng Client ID mặc định của hệ thống..."`.
   - Picker Key input MUST display `placeholder="Để trống để dùng Picker API Key mặc định của hệ thống..."`.
3. **Reset Behavior**:
   - Calling `handleResetClientId` MUST clear `localStorage` and set `clientIdInput` to `""`.
   - Calling `handleResetPickerKey` MUST clear `localStorage` and set `pickerKeyInput` to `""`.
4. **Runtime Fallback**:
   - All background login/picker actions MUST use effective credentials via `getClientId()` and `getPickerApiKey()`.
