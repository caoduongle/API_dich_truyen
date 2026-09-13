# Phase 0 Research: Định Vị & Làm Nổi Bật Đoạn Lỗi Khi Mở Bàn Dịch

**Feature**: `131-jump-to-issue-highlight`  
**Date**: 2026-09-13

---

## 1. Phân Tích Thực Trạng Kiến Trúc

### Luồng điều hướng hiện tại từ Kiểm Định Hako sang Bàn Dịch:
```text
HakoIssueCard (bấm nút "Mở trong Bàn Dịch để sửa")
  │ onOpenInTranslator(issue.chapterId)
  ▼
HakoIssueReviewPanel
  │ onOpenInTranslator(issue.chapterId)
  ▼
HakoCheckerWorkspace
  │ onOpenInTranslator(chapterId)
  ▼
TabContent (onOpenChapterFromHakoChecker)
  │
  ▼
App.tsx (handleOpenChapterFromHakoChecker)
  │ getChapterFromDB(chapterId) -> handleGoToTranslate(chapter)
  │ setLoadedChapter(chapter) -> switchTab('translate')
  ▼
TranslatorWorkspace -> BilingualEditor (Hiển thị chương ở đầu trang, không scroll, không bôi chọn)
```

### Điểm nghẽn:
1. `onOpenInTranslator` chỉ truyền duy nhất `chapterId: string`. Toàn bộ thông tin quan trọng của lỗi (`issue.vietnameseSnippet`, `issue.id`) bị đánh rơi ngay tại thẻ lỗi.
2. `App.tsx` chỉ thiết lập `setLoadedChapter(chapter)` và `switchTab('translate')`, không có cơ chế lưu giữ mục tiêu highlight (`pendingHighlightSnippet`).
3. `BilingualEditor` có sẵn ref `activeTextareaRef` (`rawTextareaRef` hoặc `polishedTextareaRef`) và tiện ích `scrollAndSelectInTextarea`, nhưng chưa được kết nối với luồng nạp chương từ Hako Checker.
4. Tiện ích `scrollAndSelectInTextarea` trong `src/utils/textareaHighlight.ts` hiện tại chỉ hỗ trợ `indexOf` (so khớp chính xác 100%). Nếu AI trích đoạn lỗi có dấu ngoặc kép thừa hoặc cắt xén dấu chấm lửng, `indexOf` trả về `-1` dẫn tới không tìm thấy đoạn văn.

---

## 2. Các Quyết Định Kỹ Thuật (Decisions & Rationales)

### Quyết định 1: Mở rộng hợp đồng `onOpenInTranslator` linh hoạt
- **Lựa chọn**: Cho phép `onOpenInTranslator` nhận thêm tham số tùy chọn `options?: { snippet?: string; issueId?: string }`:
  ```typescript
  type OpenInTranslatorHandler = (
    chapterId: string,
    options?: { snippet?: string; issueId?: string }
  ) => void;
  ```
- **Lý do**:
  - Giữ tương thích ngược hoàn toàn 100% với các lời gọi cũ chỉ truyền `chapterId` (như nút mở từ danh sách chương `chap.id`).
  - Tại `HakoIssueCard.tsx`, truyền kèm `issue.vietnameseSnippet` và `issue.id`.
- **Phương án thay thế bị bác bỏ**:
  - *Lưu snippet vào LocalStorage/SessionStorage*: Bị từ chối vì dư thừa trạng thái toàn cục, dễ để lại dữ liệu rác nếu người dùng đóng tab giữa chừng.

---

### Quyết định 2: Quản lý trạng thái Highlight theo cơ chế "Dùng 1 lần" (One-Time Consumption)
- **Lựa chọn**: Khai báo trạng thái `pendingHighlightSnippet` tại `App.tsx`, truyền xuống `TabContent` -> `TranslatorWorkspace` -> `BilingualEditor`.
- **Cơ chế**:
  - Khi người dùng bấm từ Hako: `setPendingHighlightSnippet(options?.snippet || null)`.
  - Khi `BilingualEditor` nạp văn bản và thực hiện định vị thành công (hoặc báo thất bại), component gọi `onClearHighlightSnippet()` để reset `pendingHighlightSnippet` về `null`.
- **Lý do**:
  - Đảm bảo việc cuộn và bôi chọn chỉ diễn ra đúng 1 lần khi chuyển tab.
  - Ngăn ngừa hiện tượng người dùng đang gõ phím chỉnh sửa mà textarea lại tự ý cuộn nhảy về vị trí lỗi cũ khi component re-render.

---

### Quyết định 3: Tự động phát hiện phân vùng dịch (`activeStage`: `polished` vs `raw`)
- **Lựa chọn**: Khi có `pendingHighlightSnippet`:
  1. Kiểm tra xem đoạn văn bản tồn tại trong `polishedTranslation` không. Nếu có -> chuyển `activeStage = 'polished'`.
  2. Nếu không có trong `polishedTranslation` nhưng có trong `rawTranslation` -> chuyển `activeStage = 'raw'`.
  3. Nếu không tìm thấy ở cả hai, giữ nguyên stage mặc định của chương (thường là `polished` nếu chương đã chuốt mịn).
- **Lý do**: Giúp người dùng được đưa thẳng tới đúng khung soạn thảo chứa lỗi, không phải tự bấm chuyển đổi qua lại giữa tab Dịch thô và Chuốt mịn.

---

### Quyết định 4: Nâng cấp thuật toán `scrollAndSelectInTextarea` với Smart Fallback
- **Lựa chọn**: Bổ sung hàm bổ trợ `findNormalizedSnippetOffset` trong `src/utils/textareaHighlight.ts`:
  1. **Bước 1 (Exact Match)**: `textarea.value.indexOf(targetText)`.
  2. **Bước 2 (Punctuation & Quote Trim Match)**: Lược bỏ các dấu bao quanh (`"`, `'`, `“`, `”`, `«`, `»`) và dấu ba chấm (`...`, `…`) ở hai đầu snippet. Tìm lại trong văn bản.
  3. **Bước 3 (Normalized Whitespace Match)**: Chuẩn hóa khoảng trắng liên tiếp và ký tự xuống dòng thành khoảng trắng đơn, sau đó tính toán ánh xạ ngược lại vị trí index ban đầu trong textarea.
- **Lý do**: Đảm bảo tỷ lệ định vị thành công đạt > 95% bất chấp sai khác nhỏ về định dạng trích dẫn từ các model AI khác nhau.
