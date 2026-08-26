# Quickstart & Validation Guide: Moderator Hako Quality Checker

**Feature**: `075-moderator-quality-checker`
**Date**: 2026-08-27
**Status**: Completed

## 1. Prerequisites

- Node.js 20+ installed.
- Valid API keys configured in AI Settings (`Cấu hình AI`) or local testing environment.
- Server running locally via `npm run dev`.

---

## 2. Validation Scenarios

### Scenario 1: Import Novel Metadata from Hako
1. Navigate to the app at `http://localhost:5173`.
2. Click the new **Kiểm Định Hako** tab in the navigation bar (or press `Alt+6`).
3. Paste a public Hako novel URL into the input field:
   `https://ln.hako.vn/truyen/1234-ten-truyen` (or test URL).
4. Click **Tìm nạp thông tin truyện**.
5. **Expected Outcome**:
   - Title, author, artist, and volume/chapter hierarchy are loaded and displayed accurately.
   - If Hako limits the rate (429/403), an alert explains the rate limit with a countdown.

### Scenario 2: Select Chapters & Run Heuristic + AI Scan
1. Select 3 chapters from the list (confirm selection counter says `3/12`).
2. Optional: Expand Chapter 1 and paste a raw Chinese text paragraph into the raw text input.
3. Click **Bắt đầu kiểm định chất lượng**.
4. **Expected Outcome**:
   - Immediate heuristic scan flags raw leaks / duplicate text.
   - AI critique analyzes character name consistency, pronoun gender continuity, and raw comparison.
   - Issues are presented with severity badges (`Nghiêm trọng`, `Lớn`, `Nhẹ`, `Cảnh báo`), snippets, and explanations.

### Scenario 3: Moderator Decision & Persistence Verification
1. On Issue #1, click **Xác nhận** (Confirm) and type a note: "Cần đổi tên nhân vật về Tiêu Viêm".
2. On Issue #2, click **Bác bỏ** (Dismiss).
3. On Issue #3, click **Yêu cầu xem lại** (Needs Review).
4. Switch to the **Mặt Trận Dịch Thuật** tab (`Alt+1`), then switch back to **Kiểm Định Hako** (`Alt+6`).
5. Reload the page (`F5`).
6. **Expected Outcome**:
   - All 3 decisions, notes, and session state are preserved accurately without data loss.

### Scenario 4: Export & Copy Quality Report
1. Click **Xuất báo cáo kiểm định**.
2. Review the statistics breakdown and formatted Markdown preview.
3. Click **Sao chép vào Clipboard**.
4. **Expected Outcome**:
   - Formatted report is copied to clipboard and a success toast notification is shown.

---

## 3. Automated Test Execution

Run the automated contract and unit tests for the quality checker feature:

```bash
# Run unit & contract tests for Hako fetcher and quality checker
npm test

# Verify type safety
npm run lint

# Verify production bundle build
npm run build
```
