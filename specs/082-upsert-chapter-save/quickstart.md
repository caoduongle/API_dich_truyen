# Quickstart & Validation Guide: Upsert Chapter Save in Translator Workspace

**Feature**: `082-upsert-chapter-save`
**Date**: 2026-08-27

## Prerequisites

- Local development environment configured with Node.js and dependencies installed (`npm install`).
- Application server running (`npm run dev`).

## Verification Scenarios

### Scenario 1: Update Existing Chapter In-Place
1. Navigate to the **Lịch Sử Chương Dịch** (Chapter History) tab.
2. Select any previously translated chapter and click **"Mở chỉnh sửa lại"**.
3. Verify that the app switches to **Mặt Trận Dịch Thuật** and loads the chapter content.
4. Modify the chapter title and edit the polished translation text.
5. Click **"Lưu chương dịch"** (or press `Ctrl+S`).
6. Verify a toast appears: `Đã cập nhật thành công chương: "<updated-title>"`.
7. Switch back to **Lịch Sử Chương Dịch**:
   - Verify that the total chapter count has **not** increased.
   - Verify that there is **no duplicate chapter** created.
   - Verify that the existing chapter reflects the edited title and updated content.

### Scenario 2: Save New Chapter with Double Save (Ctrl+S twice)
1. Open a project and ensure you are on a fresh draft in **Mặt Trận Dịch Thuật** (no chapter loaded).
2. Enter Chinese source text and click **Dịch thô** / **Dịch chuốt**.
3. Click **"Lưu chương dịch"** (first save):
   - Verify toast appears: `Đã lưu trữ thành công chương: "..." vào bộ nhớ lưu trữ lịch sử dịch.`.
4. Without leaving the page or clearing the editor, immediately press `Ctrl+S` again (second save):
   - Verify toast appears: `Đã cập nhật thành công chương: "..."`.
5. Switch to **Lịch Sử Chương Dịch**:
   - Verify that only **1** new chapter was created, not 2.

### Scenario 3: Project Switch ID Reset
1. Open Project A, edit an existing chapter (`currentChapterId` is set).
2. Switch to Project B via **Quản Lý Truyện**.
3. In **Mặt Trận Dịch Thuật**, input fresh text and click **"Lưu chương dịch"**.
4. Verify that the new text is saved as a new chapter in Project B, and does not overwrite any chapter in Project A.

## Automated Verification Commands

Run the full verification suite before completing the feature:

```bash
# Type check
npm run lint

# Test suite
npm test

# Build bundle verification
npm run build
```
