# Quickstart & Verification Guide: Human-Readable Chapter Filenames

**Feature**: `071-drive-chapter-filename-format`
**Date**: 2026-08-23

---

## 1. Automated Verification

```bash
# Typecheck
npm run lint

# Run all test suites
npm test

# Production build
npm run build
```

---

## 2. Manual Verification Scenario

1. Create or open a project with chapters titled "Chương 1: Yểm Ngục" and "Chương 2: Vụ án thuế bạc".
2. Open Share Modal -> Click **"Khởi tạo thư mục & Sẵn sàng chia sẻ"**.
3. In Google Drive or Google Picker (Step 2: multi-select files), observe the file names:
   - `project.json`
   - `manifest.json`
   - `chapter_001_chuong-1-yem-nguc.json`
   - `chapter_002_chuong-2-vu-an-thue-bac.json`
4. Confirm: All chapter files are clearly distinguishable and listed in numerical order.
