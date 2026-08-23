# Contract: Google Picker App ID Binding

**Module**: `src/services/googlePickerService.ts`
**Feature**: `070-fix-picker-app-id-404`

---

## 1. Interface & Method Extensions

```typescript
export interface GooglePickerServiceContracts {
  getAppId(): string;
  setAppId(appId: string): void;
  getCustomAppId(): string;
}
```

---

## 2. Behavior Invariants

1. **Mandatory `.setAppId()`**: Both `openFolderPicker` and `openFilePicker` must invoke `.setAppId(appId)` on their `PickerBuilder` before `.build()`.
2. **Missing `appId` Guard**: If `getAppId()` returns empty, `openFolderPicker` and `openFilePicker` MUST throw:
   ```text
   Chưa cấu hình Google Cloud App ID (Project Number). Vui lòng nhập Project Number trong phần Cài đặt Đồng bộ.
   ```
3. **Storage Precedence**: `getAppId()` returns `localStorage.getItem('ai_dich_truyen_google_app_id')` if non-empty, otherwise falls back to `import.meta.env.VITE_GOOGLE_APP_ID`.
