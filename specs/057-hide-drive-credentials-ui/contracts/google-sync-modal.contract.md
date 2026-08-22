# Contract: GoogleSyncModal Component UI & Props

## 1. Module Definition
- **File**: `src/components/google-sync/GoogleSyncModal.tsx`
- **Component**: `GoogleSyncModal`

---

## 2. Props Signature

```typescript
export interface GoogleSyncModalProps {
  /** Controls modal visibility */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback triggered when remote projects/chapters are loaded or updated */
  onDataChanged?: () => void;
}
```

---

## 3. UI Presentation Guarantees

1. **Default Credential Privacy**:
   - The modal MUST NOT render the raw strings of `VITE_GOOGLE_CLIENT_ID` or `VITE_GOOGLE_PICKER_API_KEY` when in the default closed/collapsed state.
   - When credentials exist, the status header MUST render a `Badge` indicating `"Đã cấu hình sẵn"` (`tone="neutral"`) or `"Tùy chỉnh riêng"` (`tone="polish"`).
2. **Advanced Settings Drawer**:
   - The drawer MUST toggle between expanded and collapsed when the user clicks the advanced settings trigger.
   - All input fields inside the drawer MUST default to `type="password"` with an `Eye` / `EyeOff` visibility toggle button.
3. **Storage & Reversion**:
   - Saving a non-empty string MUST write to `localStorage` (`ai_dich_truyen_google_client_id` / `ai_dich_truyen_google_picker_key`).
   - Clicking "Khôi phục mặc định" MUST remove the corresponding key from `localStorage` and revert inputs to the build-time environment variable values.
4. **Design System**:
   - All UI elements MUST adhere to the "Mực & Chu Sa" tokens (`bg-ink`, `bg-parchment`, `border-parchment-2`, `Badge`, `Button`, `rounded-[2px]`).
