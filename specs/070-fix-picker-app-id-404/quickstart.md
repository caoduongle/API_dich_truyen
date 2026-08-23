# Quickstart & Verification Guide: Google Picker App ID Binding & 404 Fix

**Feature**: `070-fix-picker-app-id-404`
**Date**: 2026-08-23

---

## 1. Prerequisites

- Node.js 18+ and npm
- Google Cloud project with Google Drive API and Google Picker API enabled
- Numeric Google Cloud **Project Number** (obtained from Google Cloud Console -> IAM & Admin -> Settings -> Project number)

---

## 2. Automated Quality Gates

```bash
# Typecheck
npm run lint

# Test suite
npm test

# Production build
npm run build
```

---

## 3. Manual Scenario Walkthrough

### Scenario 1: Collaborator Opens Shared Project (Success Flow)
1. Add `VITE_GOOGLE_APP_ID="<your_project_number>"` to `.env` (or configure via UI Cài đặt Đồng bộ -> Nâng cao).
2. Log in with Collaborator account (User B).
3. Click **"Mở dự án được chia sẻ (Google Picker)"**.
4. Step 1: Select shared folder `AI_Dich_Truyen_Data/proj_xxx`.
5. Step 2: Multi-select picker opens; select all files (Ctrl+A).
6. Verify: `project.json`, `manifest.json`, and all chapters download with HTTP 200 without any 404 errors.

### Scenario 2: Missing App ID Fast-Fail
1. Clear App ID from `.env` and localStorage.
2. Click **"Mở dự án được chia sẻ (Google Picker)"**.
3. Verify: Toast notification alerts: *"Chưa cấu hình Google Cloud App ID (Project Number). Vui lòng nhập Project Number trong phần Cài đặt Đồng bộ."*

### Scenario 3: Omitted File Validation
1. In Step 2 (Multi-select picker), intentionally uncheck one chapter file (e.g. `chapter_chap_2.json`).
2. Verify: Application stops with clear toast: *"Chưa cấp quyền cho các tệp: chapter_chap_2.json. Vui lòng mở lại và chọn TẤT CẢ tệp trong hộp thoại Google Picker (Ctrl+A / Cmd+A)."*
