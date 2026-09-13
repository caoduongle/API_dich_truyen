# Phase 0 Research: Hako Review Scope & Decision Sync

**Feature**: `130-hako-review-scope-sync`
**Date**: 2026-09-13
**Status**: Completed

---

## 1. Research Question: Nguyên nhân lệch phạm vi giữa `HakoChapterSelector` và `HakoIssueReviewPanel`

### Finding
- `HakoCheckerWorkspace` nắm giữ `session.selectedChapterIds` (mảng các chapterId mà người dùng đang chọn ở bảng trên) và `session.issues` (toàn bộ các lỗi đã phát hiện trong toàn dự án).
- Khi render `HakoIssueReviewPanel`, workspace truyền `issues={session.issues}`, nhưng **không truyền** `selectedChapterIds`.
- Bên trong `HakoIssueReviewPanel`, state `filterChapterId` được khởi tạo là `'all'`.
- Thuật toán `filteredIssues` chỉ kiểm tra:
  ```typescript
  if (filterChapterId !== 'all' && issue.chapterId !== filterChapterId) return false;
  ```
- Do đó, khi `filterChapterId === 'all'`, toàn bộ lỗi của mọi chương (kể cả Chương 140 mà người dùng đã bỏ chọn) đều được hiển thị đầy đủ.

### Decision
- Truyền `selectedChapterIds={session.selectedChapterIds}` từ `HakoCheckerWorkspace` xuống `HakoIssueReviewPanel`.
- Mở rộng tùy chọn bộ lọc chương (`filterChapterId`) hỗ trợ chế độ `'selected'` (mặc định):
  - Giá trị `'selected'`: Tự động lọc các lỗi có `issue.chapterId` nằm trong `selectedChapterIds`.
  - Giá trị `'all_session'`: Hiển thị toàn bộ lỗi của toàn bộ các chương trong phiên làm việc.
  - Giá trị `chapterId` cụ thể: Chỉ xem lỗi của đúng 1 chương được chọn từ dropdown.
- Khi người dùng chọn/bỏ chọn chương ở `HakoChapterSelector`, danh sách lỗi bên dưới lập tức cập nhật theo thời gian thực (real-time scope reactivity).

### Alternatives Considered
- *Xóa bỏ hoàn toàn lỗi của các chương không được chọn khỏi `session.issues`*: Bị bác bỏ vì vi phạm tính bền vững dữ liệu. Khi người dùng muốn xuất báo cáo kiểm định cho toàn bộ dự án (`HakoReportExportModal`), họ cần giữ lại toàn bộ kết quả đã quét trước đó mà không phải quét lại từ đầu.

---

## 2. Research Question: Vì sao lỗi đã "Xác nhận lỗi" lại tự ý biến thành "Đã giải quyết" (`resolved`)?

### Finding
- Trong `src/services/hakoQualityEngine.ts`, hàm `reconcileIssuesWithDecisions`:
  ```typescript
  for (const prev of activePreviousIssues) {
    if (!matchedPrevIds.has(prev.id)) {
      if (prev.decision === 'confirmed' || prev.decision === 'review_needed') {
        resolvedCount++;
        resolvedIssues.push({
          ...prev,
          decision: 'resolved',
          resolvedAt: new Date().toISOString(),
          isNew: false,
        });
      }
    }
  }
  ```
- Khi quét lại một chương (hoặc quét lại một phần), nếu AI trả về kết quả không bắt trúng lại đoạn vi phạm cũ (hoặc trích dẫn snippet hơi khác), hàm này ngộ nhận rằng dịch giả đã sửa bản dịch làm biến mất lỗi, và tự động nâng cấp trạng thái từ `confirmed` sang `resolved`.
- Trong thực tế, dịch giả chưa hề sửa bản dịch, văn bản tiếng Việt vẫn chứa nguyên vẹn đoạn văn vi phạm ("cộng thêm tên xui xẻo bỏ mạng đầu tiên"), dẫn đến việc người dùng vừa ấn "Xác nhận lỗi", sau đó nhìn lại thấy lỗi đã bị biến thành "Đã giải quyết" / "Đã khắc phục".

### Decision
- Bổ sung tham số `chaptersContentMap?: Map<string, string>` (hoặc record nội dung tiếng Việt hiện tại của các chương được quét) vào `reconcileIssuesWithDecisions`.
- Điều kiện chuyển sang `resolved` phải thỏa mãn cả 2 tiêu chí:
  1. Chương đó nằm trong danh sách chương được quét lại (`scannedChapterIdSet.has(String(prev.chapterId))`).
  2. Đoạn trích vi phạm gốc (`prev.vietnameseSnippet`) **không còn xuất hiện** trong nội dung tiếng Việt hiện tại của chương đó (đã thực sự được sửa hoặc xóa).
- Nếu đoạn trích vẫn còn tồn tại trong văn bản tiếng Việt của chương:
  - Giữ nguyên quyết định `prev.decision` (ví dụ `confirmed` hoặc `review_needed`).
  - Không được tự ý đánh dấu `resolved`.
  - Tăng biến đếm `unresolvedCount`.

### Alternatives Considered
- *Chỉ dựa vào kết quả quét của AI*: Bị bác bỏ vì AI mang tính xác suất (probabilistic). Nếu prompt hoặc model không trả lại lỗi trong lần chạy thứ 2 mà text vẫn nguyên vẹn thì việc tự ý báo "Đã khắc phục" là một lỗi nghiêm trọng (false negative). So khớp trực tiếp snippet với text hiện tại là phương pháp xác định (deterministic) 100% đáng tin cậy.

---

## 3. Research Question: Trải nghiệm công thái học (UX) cho 3 nút "Bác bỏ", "Cần xem lại", "Xác nhận lỗi"

### Finding
- Người dùng cảm thấy "rõ ràng tôi đã ấn xác nhận lỗi mà lỗi vẫn chình ình hiện ra" là vì bộ lọc trạng thái mặc định đang là "Tất cả trạng thái".
- Thao tác ấn nút có lưu vào IndexedDB và cập nhật badge, nhưng không có thông báo hay chuyển động thị giác rõ rệt, và thẻ lỗi không tự rời khỏi khung nhìn nếu người dùng đang ở chế độ xem tất cả.

### Decision
- Bổ sung phản hồi thị giác tức thì (feedback hint/badge): Khi bấm nút, hiển thị trạng thái đã lưu, đổi màu nút sang trạng thái active đậm nét (`confirmed` màu tím, `dismissed` màu xám nhạt, `review_needed` màu amber).
- Thêm thanh chuyển tab lọc trạng thái nhanh (Triage Filter Pills):
  - `Tất cả` (All)
  - `Chờ duyệt` (Pending)
  - `Đã xác nhận` (Confirmed)
  - `Cần xem lại` (Review Needed)
  - `Đã giải quyết` (Resolved)
  - `Đã bỏ qua` (Dismissed)
- Hướng dẫn rõ ràng: Khi chuyển sang tab "Chờ duyệt", mỗi khi bấm "Xác nhận lỗi" hoặc "Bác bỏ", lỗi sẽ lập tức được đánh dấu và tự động rời khỏi hàng đợi chờ duyệt.

---

## Kết Luận Kiến Trúc
Tất cả các câu hỏi kỹ thuật đã được giải quyết triệt để và khả thi 100% mà không cần thêm dependency mới hay thay đổi cấu trúc database.
