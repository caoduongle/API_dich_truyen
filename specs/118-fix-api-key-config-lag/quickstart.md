# Quickstart Validation Guide: AI Configuration & Key Lifecycle

**Feature**: `118-fix-api-key-config-lag`  
**Date**: 2026-09-12  

---

## Prerequisites

- Node.js 18+ and npm installed
- Web browser with developer tools

---

## Validation Scenario 1: Zero-Lag Key Typing

1. Start development server:
   ```bash
   npm run dev
   ```
2. Open the application in the browser.
3. Click the AI model/settings icon in the top header to open **"Cấu hình AI & Bản Thảo"**.
4. Click **"Thêm key mới"**.
5. Type an API key rapidly into the input field:
   - **Expected**: Every keystroke appears instantly at 60 FPS without stutter, freezing, or dropped letters.
   - **Expected**: Check DevTools Network tab: No network requests to `generativelanguage.googleapis.com` are dispatched during intermediate typing.

---

## Validation Scenario 2: Presets Model Availability & Status

1. In the AI configuration modal, ensure at least one valid key is present.
2. Select **Gemini 2.5 Flash** or **Gemini 3.1 Flash Lite**.
3. Inspect the **"TRẠNG THÁI MÔ HÌNH"** card:
   - **Expected**: The badge displays `Sẵn sàng sử dụng` or `Đã xác minh`.
   - **Expected**: The amber alert banner *"Model đang chọn hiện không có API key nào hỗ trợ."* does NOT appear.

---

## Validation Scenario 3: Instant Key Connection Check

1. In the key list, click the **"Kiểm tra"** button next to the entered key.
2. Observe validation:
   - **Expected**: A spinner shows briefly ("Đang kiểm tra...").
   - **Expected**: A green checkmark or badge appears ("Khóa hợp lệ") upon success.

---

## Validation Scenario 4: Automated Verification Suite

Run full project verification:
```bash
npm run lint
npm test
npm run build
```
All commands must complete with exit code 0 and zero errors.
