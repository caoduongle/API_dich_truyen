# Research: Định Vị & Bôi Đen Đoạn Lỗi Khi Bấm "Mở Trong Bàn Dịch Để Sửa"

**Feature**: `135-open-translator-highlight`  
**Date**: 2026-09-14  
**Status**: Completed  

---

## 1. Vấn Đề Nghiên Cứu & Nguyên Nhân Gốc (Root Cause Analysis)

### 1.1 Hiện tượng
Người dùng bấm nút "Mở trong Bàn Dịch để sửa" từ thẻ lỗi (`HakoIssueCard`) trong tab Kiểm Định Hako. Ứng dụng chuyển sang tab Bàn Dịch, nhưng:
- Khung soạn thảo không tự động cuộn đến vị trí câu lỗi.
- Câu lỗi không được bôi đen (native selection highlight).
- Người dùng thường gặp thông báo toast: *"Không tìm thấy đoạn văn vi phạm trong bản dịch hiện tại, có thể nội dung đã được sửa."* hoặc không có phản hồi gì.

### 1.2 Phân tích luồng thực thi hiện tại (Race Condition & Lifecycle Breakdown)

1. **Khởi phát từ HakoIssueCard**:
   - Khi bấm nút, `handleOpenInTranslatorClick` gọi `onOpenInTranslator(issue.chapterId, { snippet: issue.vietnameseSnippet, issueId: issue.id })`.
   - `App.tsx` nhận tín hiệu trong `handleOpenChapterFromHakoChecker`:
     ```typescript
     const chapter = await getChapterFromDB(chapterId);
     setPendingHighlightSnippet(options?.snippet || null);
     handleGoToTranslate(chapter); // setLoadedChapter(chapter); switchTab('translate');
     ```

2. **Xung đột thời gian giữa state `loadedChapter` và `BilingualEditor` effect**:
   - `TabContent.tsx` truyền `loadedChapter` và `pendingHighlightSnippet` (dưới tên `initialHighlightSnippet`) vào `TranslatorWorkspace`.
   - `useWorkspaceState` nhận `loadedChapter` và sử dụng `useEffect` để nạp nội dung:
     ```typescript
     useEffect(() => {
       if (loadedChapter) {
         setRawTranslation(loadedChapter.rawTranslation || '');
         setPolishedTranslation(loadedChapter.polishedTranslation || '');
         onClearLoadedChapter?.();
       }
     }, [loadedChapter]);
     ```
   - **ĐIỂM NGHẼN CỐT LÕI**: Trong React 19, `useEffect` của component con (`BilingualEditor`) chạy trước hoặc cùng đợt commit với effect của custom hook cha.
   - Tại lần render đầu tiên khi `initialHighlightSnippet` xuất hiện:
     - `polishedTranslation` và `rawTranslation` bên trong `BilingualEditor` **vẫn đang giữ giá trị cũ** (của chương đã mở trước đó, hoặc chuỗi rỗng `""` nếu chưa mở chương nào).
     - `useEffect` xử lý highlight trong `BilingualEditor` chạy ngay lập tức:
       - `findSnippetLocationInText(polishedTranslation, initialHighlightSnippet)` -> trả về `null` vì đang tìm trên văn bản cũ!
       - `findSnippetLocationInText(rawTranslation, initialHighlightSnippet)` -> trả về `null`.
       - Vì không tìm thấy trên cả hai, `targetStage` giữ nguyên là `activeStage` (`polished`).
       - `targetStage !== activeStage` là `false`.
       - `snippetHandledRef.current = initialHighlightSnippet` được gán ngay lập tức (đánh dấu đã xử lý xong!).
       - `setTimeout(..., 100)` được lên lịch.
     - Sau đó, effect của `useWorkspaceState` mới kích hoạt, nạp nội dung chương mới vào `polishedTranslation`. Component re-render với nội dung chương mới.
     - Nhưng vì `snippetHandledRef.current === initialHighlightSnippet` đã là `true`, effect highlight bị bỏ qua hoàn toàn!
     - Khi timer 100ms bắn ra, `scrollAndSelectInTextarea` tìm kiếm thất bại, hiện toast cảnh báo không tìm thấy và gọi `onClearHighlightSnippet()`.
     - Toàn bộ cơ chế bôi đen bị "cháy" ngay trước khi dữ liệu chương mới kịp render!

3. **Chưa có ràng buộc định danh chương (`chapterId`) trong yêu cầu Highlight**:
   - `pendingHighlightSnippet` hiện chỉ là một chuỗi văn bản (`string | null`), hoàn toàn không biết nó thuộc về chương nào (`chapterId`).
   - Nếu không có `targetChapterId`, `BilingualEditor` không thể biết được nội dung trong editor hiện tại đã khớp với chương của trích đoạn lỗi hay chưa.

4. **DOM Unmount / Remount khi chuyển phân vùng (`activeStage`)**:
   - `BilingualEditor` sử dụng điều kiện:
     `activeStage === 'raw' ? (<textarea id="textarea-raw".../>) : (<textarea id="textarea-polished".../>)`
   - Khi chuyển `activeStage` từ `raw` sang `polished` (hoặc ngược lại), textarea cũ bị gỡ bỏ khỏi DOM và textarea mới được gắn vào. Thao tác `focus()` và `setSelectionRange()` nếu gọi trước khi textarea mới hoàn tất reflow sẽ bị rơi rụng.

---

## 2. Các Quyết Định Thiết Kế (Design Decisions)

### Quyết định 1: Đóng gói yêu cầu bôi đen thành đối tượng `HighlightIntent`
- **Lựa chọn**: Thay vì truyền chuỗi rời rạc `pendingHighlightSnippet: string | null`, chuẩn hóa thành đối tượng:
  ```typescript
  export interface HighlightIntent {
    chapterId: string;
    snippet: string;
    issueId?: string;
    timestamp: number;
  }
  ```
- **Lý do**:
  1. `chapterId`: Giúp `BilingualEditor` kiểm tra điều kiện tiên quyết: `currentChapterId === intent.chapterId`. Nếu chương chưa nạp xong, hoãn việc tìm kiếm bôi đen cho đến khi văn bản của đúng chương đó sẵn sàng.
  2. `timestamp`: Đảm bảo mỗi lần bấm "Mở trong Bàn Dịch" đều là một yêu cầu mới, kể cả khi bấm lại cùng một đoạn snippet trên cùng một chương.
  3. `issueId`: Cho phép truyền xuống `UnifiedAuditPanel` để tự động cuộn đến và làm nổi bật thẻ lỗi tương ứng ở sidebar bên phải.

### Quyết định 2: Đồng bộ hóa chu trình bôi đen dựa trên trạng thái văn bản sẵn sàng (Readiness State Machine)
- **Lựa chọn**: Chỉ thực thi bôi đen khi đồng thời thỏa mãn:
  1. `highlightIntent` tồn tại và khớp với `currentChapterId`.
  2. Văn bản của phân vùng mục tiêu (`polishedTranslation` hoặc `rawTranslation`) có chứa đoạn trích (thông qua `findSnippetLocationInText`).
  3. Phân vùng hiển thị (`activeStage`) đã khớp với phân vùng chứa đoạn trích.
  4. Phần tử `HTMLTextAreaElement` đã được mount và có giá trị trong DOM.
- **Nếu chưa thỏa mãn**: Chờ render tiếp theo của React (thay vì vội vàng đánh dấu `snippetHandledRef` và hủy bỏ).

### Quyết định 3: Nâng cấp thuật toán so khớp trích đoạn thông minh
- **Lựa chọn**: Trong `findSnippetLocationInText`:
  1. **Exact match**: So khớp chính xác chuỗi.
  2. **Trimmed quotes & ellipsis**: Lược bỏ dấu ngoặc kép (`"`, `'`, `“`, `”`, `«`, `»`) và dấu ba chấm (`...`, `…`) bao quanh.
  3. **Normalized whitespace search**: Chuẩn hóa các khoảng trắng liên tiếp (`\s+`) thành một khoảng trắng duy nhất giữa snippet và fullText khi tìm kiếm.
  4. **Head & Tail fuzzy chunking**: Nếu đoạn trích dài (> 20 ký tự), so khớp 30 ký tự đầu để định vị vị trí bắt đầu và tính chiều dài phù hợp.
- **Lý do**: Trích đoạn AI QA Critique hoặc Hako Heuristic đôi khi có thể ngắt dòng hoặc thừa khoảng trắng so với bản gốc trong textarea.

### Quyết định 4: Đảm bảo cuộn mượt và khoảng đệm an toàn (Buffer Offset)
- **Lựa chọn**: Khi tính toán `scrollTop` trong `scrollAndSelectInTextarea`:
  - Lấy vị trí dòng của đoạn khớp (`lineCount`).
  - Áp dụng trừ khoảng đệm 3 dòng (`Math.max(0, (lineCount - 3) * lineHeight)`).
  - Đặt `textareaEl.focus()` và `textareaEl.setSelectionRange(start, end)`.

---

## 3. Các Phương Án Đã Cân Nhắc & Bị Loại Bỏ (Alternatives Considered)

1. **Phương án tăng thời gian timeout từ 100ms lên 500ms**:
   - *Bị loại bỏ*: Đây là anti-pattern "đoán mò thời gian". Trên máy chậm hoặc khi IndexedDB mất nhiều thời gian nạp, 500ms vẫn có thể thất bại. Ngược lại trên máy nhanh, 500ms tạo cảm giác lag và giật giao diện.
2. **Phương án bôi đen bằng thẻ HTML `<span>` hoặc lớp phủ overlay**:
   - *Bị loại bỏ*: Khung soạn thảo của ứng dụng là thẻ `<textarea>` nguyên bản (để người dùng gõ phím trực tiếp và tích hợp CRDT). Sử dụng vùng chọn tự nhiên (`setSelectionRange`) là giải pháp chuẩn web, cho phép người dùng gõ phím hoặc bấm Backspace/Delete để sửa ngay lập tức.
