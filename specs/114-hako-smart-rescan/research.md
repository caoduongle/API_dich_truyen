# Phase 0 Research: Rà Soát Lại Có Ghi Nhớ Quyết Định Kiểm Định (Smart Re-audit)

## 1. Cơ Chế Nhận Diện & Định Danh Lỗi (Issue Fingerprinting)

### Decision
Sử dụng hàm băm/chuẩn hóa composite signature:
`generateIssueFingerprint(chapterId: string, category: QualityIssueCategory, snippet: string): string`
- Chuẩn hóa `snippet`: Loại bỏ dấu chấm lửng cuối (`...`), co cụm khoảng trắng (`\s+` -> ` `), chuyển chữ thường (`toLowerCase()`), trích xuất token cốt lõi (ví dụ các ký tự Hán tự đối với lỗi `raw_leak`).
- Định danh duy nhất: `${chapterId}::${category}::${normalizedSnippet}`.

### Rationale
- Đảm bảo tính ổn định cao khi người dùng chỉnh sửa văn bản ở các đoạn khác trong chương (không bị lệch dòng hay sai lệch vị trí như dùng line number hoặc offset).
- Phân biệt rõ các lỗi thuộc danh mục khác nhau xảy ra trên cùng một đoạn văn.
- Cho phép so khớp chính xác giữa lỗi cũ trong `session.issues` và lỗi mới được phát hiện bởi Heuristic / AI scan.

### Alternatives Considered
- **Sử dụng Paragraph Index / Line Number**: Bị bác bỏ vì khi người dùng thêm hoặc xóa 1 đoạn văn trong Bàn Dịch, toàn bộ index các đoạn phía sau sẽ bị trôi, dẫn đến so khớp sai lệch hoàn toàn.
- **Dùng AI để so khớp ngữ nghĩa**: Bị bác bỏ vì tốn kém token API Gemini, tăng độ trễ (latency) không cần thiết, và vi phạm nguyên tắc xử lý nhanh tức thì trên client-side cho các thao tác Heuristic.

---

## 2. Thuật Toán Hòa Giải Quyết Định Kiểm Định (Reconciliation Algorithm)

### Decision
Xây dựng hàm xử lý thuần túy (pure domain function) `reconcileIssuesWithDecisions`:
```typescript
export interface IssueReconciliationResult {
  reconciledIssues: QualityIssue[];
  diffSummary: {
    resolvedCount: number;
    unresolvedCount: number;
    dismissedCount: number;
    newCount: number;
  };
}

export function reconcileIssuesWithDecisions(
  previousIssues: QualityIssue[],
  scannedIssues: QualityIssue[],
  scannedChapterIds: string[]
): IssueReconciliationResult
```

**Quy tắc chuyển dịch trạng thái**:
1. **Lỗi cũ đã `dismissed` (Bác bỏ)**:
   - Nếu lần quét mới vẫn phát hiện: Giữ nguyên `decision: 'dismissed'`, tái sử dụng `id`, không tạo cảnh báo mới.
   - Nếu lần quét mới không còn phát hiện: Giữ lại trong danh sách với trạng thái `dismissed` (hoặc chuyển `resolved`).
2. **Lỗi cũ đã `confirmed` (Xác nhận lỗi)**:
   - Nếu lần quét mới **vẫn phát hiện** vi phạm: Giữ nguyên `decision: 'confirmed'`, bảo toàn `moderatorNote` cũ, tính vào `unresolvedCount`.
   - Nếu lần quét mới **không còn phát hiện** vi phạm: Chuyển sang `decision: 'resolved'`, cập nhật thông điệp thành công, tính vào `resolvedCount`.
3. **Lỗi cũ đã `review_needed` (Cần xem lại)**:
   - Nếu lần quét mới vẫn phát hiện: Giữ nguyên `decision: 'review_needed'`, bảo toàn `moderatorNote`.
   - Nếu lần quét mới không còn phát hiện: Chuyển sang `decision: 'resolved'`.
4. **Lỗi chưa có trong danh sách cũ (New Issue)**:
   - Khởi tạo với `decision: 'pending'`, gán cờ `isNew: true`, tính vào `newCount`.
5. **Lỗi cũ đang `pending` (Chờ duyệt)**:
   - Nếu vẫn còn phát hiện: Giữ `pending`.
   - Nếu không còn trong bản dịch mới: Loại bỏ tự nhiên vì chưa từng được người dùng xác nhận hay ghi chú.

### Rationale
- Đảm bảo tính bất biến (idempotent) và minh bạch: Người dùng thấy rõ quyết định của mình được hệ thống tôn trọng 100%.
- Thỏa mãn hoàn toàn yêu cầu người dùng: Bấm bác bỏ thì không bị nhắc lại; sửa xong thì được công nhận là đã giải quyết; chưa sửa thì vẫn cảnh báo xác nhận.

### Alternatives Considered
- **Xóa sạch và quét lại từ đầu (Hiện trạng)**: Gây ức chế vì toàn bộ công sức duyệt lỗi của moderator bị mất trắng.
- **Không cập nhật lỗi đã sửa (chỉ lọc bỏ)**: Khiến người dùng không biết lỗi mình vừa sửa trong Bàn Dịch có thực sự đạt chuẩn kiểm duyệt hay chưa.

---

## 3. Mở Rộng Kiểu Dữ Liệu `QualityIssueDecision`

### Decision
Thêm `'resolved'` vào tập hợp giá trị hợp lệ của `QualityIssueDecision` trong `src/types/hakoChecker.ts`:
```typescript
export type QualityIssueDecision =
  | 'pending'
  | 'confirmed'
  | 'review_needed'
  | 'dismissed'
  | 'resolved';
```
Bổ sung `isNew?: boolean` vào interface `QualityIssue` để hiển thị nhãn "Mới" cho các lỗi mới phát hiện sau khi rà soát.

### Rationale
- Hoàn toàn tương thích ngược (backward compatible).
- Tích hợp mượt mà vào hệ thống lọc hiện có của `HakoIssueReviewPanel.tsx` mà không làm thay đổi cấu trúc bảng IndexedDB.

### Alternatives Considered
- **Thêm trường `status: 'active' | 'resolved'` độc lập**: Làm phân mảnh logic lọc (`decision` vs `status`), khiến UI phải có 2 tầng dropdown lọc phức tạp.

---

## 4. Trải Nghiệm Người Dùng & Phản Hồi Trực Quan (UI/UX Feedback)

### Decision
1. **Thẻ lỗi (`HakoIssueCard.tsx`)**:
   - Khi `decision === 'resolved'`: Hiển thị viền xanh lá ngọc (`border-emerald-500/50`, `bg-emerald-950/20`), huy hiệu "✓ Đã khắc phục sau khi sửa bản dịch".
   - Cho phép người kiểm định có thể chuyển đổi lại nếu muốn xem xét lại.
   - Khi `isNew === true`: Hiển thị huy hiệu xanh lơ "Mới" để thu hút sự chú ý của người duyệt.
2. **Bộ lọc & Thống kê (`HakoIssueReviewPanel.tsx`)**:
   - Thêm nút lọc `Đã giải quyết` (`resolved`).
   - Thêm huy hiệu thống kê `Đã khắc phục: X` trong thanh tổng quan.
   - Hiển thị banner tổng kết biến động sau khi hoàn tất rà soát lại:
     *"Rà soát hoàn tất: Đã khắc phục 3 lỗi, còn 2 lỗi cần sửa, phát hiện 1 lỗi mới."*

### Rationale
- Tuân thủ thiết kế Design System của dự án (`.agents/rules/design-system.md`): Màu sắc trang nhã (emerald, parchment, seal), typography cổ điển, không phá vỡ layout.

