# Quickstart & Verification Guide: Empty Default Google Drive Inputs

## 1. Prerequisites
- Dev server running via `npm run dev`

---

## 2. Automated Quality Verification

```bash
# 1. Typecheck
npm run lint

# 2. Unit tests
npm test

# 3. Production build
npm run build
```

---

## 3. Targeted Unit Test Execution

```bash
npx vitest run src/components/google-sync/__tests__/GoogleSyncModal.test.ts
```

---

## 4. Manual Browser Verification Scenarios

### Scenario A: Empty Inputs on Default State
1. Clear any custom credentials in browser `localStorage`.
2. Open the Google Drive Sync modal and click "Tùy chỉnh".
3. **Expected**:
   - Both input fields are completely empty (no characters, no masked dots).
   - Both placeholders display `"Để trống để dùng ... mặc định của hệ thống..."`.
   - The status badge shows `"Đã cấu hình sẵn"` (tone neutral).

### Scenario B: Custom Key Persistence
1. Type a custom client ID into the input field and click "Lưu".
2. **Expected**:
   - Status badge changes to `"Tùy chỉnh riêng"`.
   - Close modal, re-open, click "Tùy chỉnh": the custom key remains in the input field.

### Scenario C: Reset Back to Default
1. Click the "Mặc định" button next to OAuth Client ID.
2. **Expected**:
   - The input field immediately becomes empty `""`.
   - Status badge reverts to `"Đã cấu hình sẵn"`.
   - The custom key is deleted from `localStorage`.
