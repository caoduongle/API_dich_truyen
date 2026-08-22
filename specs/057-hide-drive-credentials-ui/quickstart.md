# Quickstart & Verification Guide: Hide Google Drive Credentials

## 1. Prerequisites
- Dev server running on `http://localhost:3000` via `npm run dev`

---

## 2. Automated Quality Checks

```bash
# 1. Typecheck
npm run lint

# 2. Unit tests
npm test

# 3. Production build
npm run build
```

---

## 3. Manual Browser Verification Scenarios

### Scenario A: Clean Default Modal Presentation
1. Open `http://localhost:3000/`.
2. Click the "Đồng bộ Drive" button in the top navigation header.
3. Observe the "Đồng Bộ & Cộng Tác Google Drive" modal.
4. **Expected**:
   - The raw Google OAuth Client ID string is **NOT** visible.
   - The raw Google Picker API Key string is **NOT** visible.
   - A clean status badge (e.g. `[✓ Đã cấu hình sẵn]`) is displayed.
   - No prominent red/orange "Thay đổi" buttons cluttering the main screen.

### Scenario B: Advanced Settings Expansion & Masked Input
1. Inside the Google Sync modal, click "Tùy chỉnh nâng cao" (or the chevron toggle).
2. **Expected**:
   - The collapsible settings section expands smoothly.
   - The Client ID input field is masked (`••••••••••••`) by default with an `Eye` icon.
   - The Picker API Key input field is masked (`••••••••••••`) by default with an `Eye` icon.
3. Click the `Eye` icon next to Client ID:
   - **Expected**: Input type changes to text and icon changes to `EyeOff`.
4. Click `EyeOff`:
   - **Expected**: Input type changes back to password.

### Scenario C: Custom Key Override & Revert
1. In the advanced settings, enter a test custom Client ID and click "Lưu Client ID".
2. **Expected**:
   - Status badge changes to "Tùy chỉnh cá nhân".
   - Toast notification confirms "Đã lưu Google Client ID!".
3. Click "Khôi phục mặc định" (Revert to default).
4. **Expected**:
   - Custom key is cleared from localStorage.
   - Status badge returns to "Đã cấu hình sẵn".

### Scenario D: Non-Regression on OAuth Login Trigger
1. Click "Đăng nhập Google" (or verify login button state).
2. **Expected**:
   - The OAuth PKCE authorization popup/redirect initiates normally without missing credential errors.
