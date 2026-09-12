# Quickstart: Hako Bulk Raw Hydration

**Branch**: `121-hako-bulk-raw-hydration` | **Spec**: [spec.md](spec.md)

## 1. Automated Verification Commands

Run the full Constitution verification suite:

```bash
# Type check (must pass with 0 errors)
npm run lint

# Unit & component test suite
npm test

# Production build bundle check
npm run build
```

## 2. Manual Verification Workflow

### Test Scenario 1: Automatic Hydration on Project Selection
1. Start development server: `npm run dev`
2. Navigate to tab **"Kiểm Định Hako"**.
3. Select a novel project that has chapters with source text (e.g. "Đài Phát Thanh Kinh Dị" with 139 chapters).
4. **Expected Outcome**:
   - As soon as the chapter list renders, every chapter with `sourceText` displays badge: `Đã có Raw (X ký tự)`.
   - The user does **NOT** need to click "+ Thêm Raw" on each chapter card.
   - Header shows coverage summary: `Đã có Raw: 139/139 chương`.

### Test Scenario 2: One-Click Bulk Raw Button
1. In the chapter selection controls toolbar, locate the button: **"⚡ Nạp Raw toàn bộ"**.
2. Click the button.
3. **Expected Outcome**:
   - The button shows a loading state (e.g. "Đang nạp Raw...").
   - Any chapter that lacked raw text is updated if source text is available in the database.
   - A confirmation feedback/toast appears: "Đã nạp Raw thành công cho 139/139 chương".
