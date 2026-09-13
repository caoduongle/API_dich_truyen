# Data Model: Hako Review Scope & Decision Sync

**Feature**: `130-hako-review-scope-sync`
**Date**: 2026-09-13
**Status**: Completed

---

## 1. ScopeFilterMode

Xác định chế độ hiển thị phạm vi chương trong bảng duyệt lỗi `HakoIssueReviewPanel`.

```typescript
export type ReviewChapterScope = 
  | 'selected'      // Chỉ hiển thị các chương đang được chọn ở bộ chọn chương phía trên (mặc định)
  | 'all_session'   // Hiển thị toàn bộ các chương đã quét trong phiên làm việc của dự án
  | string;         // chapterId cụ thể nếu người dùng muốn lọc riêng 1 chương
```

### Quy tắc chuyển đổi trạng thái (State Behavior)
- Khi `HakoIssueReviewPanel` mount: `filterChapterId` mặc định là `'selected'`.
- Nếu `session.selectedChapterIds` thay đổi (người dùng tick/bỏ tick chương ở trên), danh sách lỗi hiển thị lập tức lọc lại:
  ```typescript
  const effectiveIssues = useMemo(() => {
    if (filterChapterId === 'selected') {
      const selectedSet = new Set((selectedChapterIds || []).map(String));
      return issues.filter((i) => selectedSet.has(String(i.chapterId)));
    }
    if (filterChapterId === 'all_session' || filterChapterId === 'all') {
      return issues;
    }
    return issues.filter((i) => String(i.chapterId) === filterChapterId);
  }, [issues, filterChapterId, selectedChapterIds]);
  ```

---

## 2. QualityIssue (Mở rộng nghiệp vụ)

Thực thể lỗi kiểm định chất lượng (giữ nguyên schema trong `src/types/hakoChecker.ts`, chuẩn hóa ràng buộc chuyển trạng thái).

### Trường dữ liệu
- `id: string`: Định danh duy nhất của lỗi.
- `chapterId: string`: ID của chương xảy ra lỗi.
- `chapterTitle: string`: Tiêu đề chương.
- `chapterNumber: number`: Số thứ tự chương.
- `category: QualityIssueCategory`: Phân loại lỗi (`mistranslation`, `raw_leak`, `pronoun_gender`, ...).
- `severity: QualityIssueSeverity`: Mức độ (`critical`, `major`, `minor`, `warning`).
- `vietnameseSnippet: string`: Đoạn văn bản tiếng Việt làm bằng chứng.
- `rawChineseSnippet?: string`: Đoạn văn bản raw tiếng Trung đối ứng.
- `explanation: string`: Giải thích chi tiết.
- `suggestion?: string`: Gợi ý khắc phục.
- `decision: QualityIssueDecision`:
  - `pending`: Chờ duyệt (trạng thái ban đầu).
  - `confirmed`: Moderator đã ấn "Xác nhận lỗi".
  - `review_needed`: Moderator đã ấn "Cần xem lại".
  - `dismissed`: Moderator đã ấn "Bác bỏ".
  - `resolved`: Đã khắc phục (chỉ kích hoạt khi văn bản tiếng Việt thực sự không còn chứa đoạn lỗi trong lần quét lại).
- `moderatorNote?: string`: Ghi chú kèm theo.
- `resolvedAt?: string`: Thời điểm ghi nhận đã khắc phục.

### Sơ đồ máy trạng thái (Decision State Machine)

```text
       [Phát hiện lỗi mới]
               │
               ▼
           (pending)
         /     │     \
   Bác bỏ   Xem lại   Xác nhận
       /       │       \
      ▼        ▼        ▼
 (dismissed) (review) (confirmed)
      │        │        │
      │        │        │ [Quét lại + snippet biến mất khỏi text]
      │        │        ▼
      └────────┴──► (resolved)
```

**Ràng buộc then chốt (Guard Condition)**:
- Chuyển trạng thái `confirmed` -> `resolved` **BẮT BUỘC** qua điều kiện kiểm tra:
  `!currentVietnameseText.toLowerCase().includes(normalizedSnippet)`
- Nếu `currentVietnameseText` vẫn còn chứa `normalizedSnippet`, trạng thái `confirmed` **BẮT BUỘC** được bảo lưu.

---

## 3. ReconciliationContext

Cấu trúc ngữ cảnh truyền vào hàm hòa giải lỗi `reconcileIssuesWithDecisions`.

```typescript
export interface IssueReconciliationContext {
  previousIssues: QualityIssue[];
  scannedIssues: QualityIssue[];
  scannedChapterIds: string[];
  chaptersContentMap?: Record<string, string>; // Map chapterId -> nội dung tiếng Việt hiện tại của chương
}
```
