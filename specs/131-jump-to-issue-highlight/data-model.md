# Data Model: Định Vị & Làm Nổi Bật Đoạn Lỗi Khi Mở Bàn Dịch

**Feature**: `131-jump-to-issue-highlight`  
**Date**: 2026-09-13

---

## 1. Cấu Trúc Dữ Liệu & Thực Thể (Data Structures)

### 1.1 `DeepLinkHighlightTarget`
Mô tả gói dữ liệu truyền từ tab Kiểm Định Hako sang tab Bàn Dịch khi người dùng nhấn mở sửa:

```typescript
export interface DeepLinkHighlightTarget {
  /** ID định danh của chương */
  chapterId: string;
  /** Đoạn trích bản dịch vi phạm cần tìm kiếm và bôi chọn */
  snippet?: string;
  /** ID của lỗi kiểm định (tùy chọn) */
  issueId?: string;
  /** Giai đoạn dịch ưu tiên ('raw' | 'polished') nếu đã biết trước */
  preferredStage?: 'raw' | 'polished';
}
```

### 1.2 `SnippetMatchResult`
Kết quả tính toán vị trí bôi chọn trong khung soạn thảo:

```typescript
export interface SnippetMatchResult {
  /** Vị trí ký tự bắt đầu trong textarea (0-based) */
  startIndex: number;
  /** Vị trí ký tự kết thúc trong textarea */
  endIndex: number;
  /** Phương pháp so khớp đã tìm ra kết quả ('exact' | 'quote_trimmed' | 'whitespace_normalized') */
  matchMethod: 'exact' | 'quote_trimmed' | 'whitespace_normalized';
}
```

---

## 2. Vòng Đời & Máy Trạng Thái (Lifecycle & State Transitions)

```text
               [Người dùng bấm "Mở trong Bàn Dịch để sửa"]
                                   │
                                   ▼
                      ┌─────────────────────────┐
                      │    PENDING_HIGHLIGHT    │
                      │ (Lưu pendingSnippet vào │
                      │  App state & nạp chaps) │
                      └────────────┬────────────┘
                                   │
                                   ▼
                      ┌─────────────────────────┐
                      │     STAGE_SELECTION     │
                      │  (Tự chọn polished/raw  │
                      │   dựa trên vị trí khớp) │
                      └────────────┬────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
            [Tìm thấy đoạn lỗi]          [Không tìm thấy lỗi]
                    │                             │
                    ▼                             ▼
       ┌────────────────────────┐    ┌────────────────────────┐
       │     LOCATE_SUCCESS     │    │     LOCATE_FAILED      │
       │ - Cuộn mượt với buffer │    │ - Giữ nguyên đầu trang │
       │ - setSelectionRange    │    │ - Toast thông báo nhẹ  │
       │ - Toast hướng dẫn sửa  │    └────────────┬───────────┘
       └────────────┬───────────┘                 │
                    │                             │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                      ┌─────────────────────────┐
                      │    TARGET_CONSUMED      │
                      │  (Clear pendingSnippet  │
                      │   để tránh re-trigger)  │
                      └─────────────────────────┘
```

---

## 3. Quy Tắc Chuẩn Hóa Văn Bản (Snippet Normalization Rules)

| Thứ tự ưu tiên | Phương pháp so khớp | Mô tả xử lý |
| :--- | :--- | :--- |
| **1. Cấp 1** | Exact Match | `content.indexOf(snippet)` |
| **2. Cấp 2** | Quote & Punctuation Trim | Loại bỏ dấu ngoặc `"`, `'`, `“`, `”`, `«`, `»`, dấu ba chấm cuối câu `...`, `…`, khoảng trắng đầu/cuối: `cleaned = snippet.replace(/^["'“”„«]+|["'“”»]+$/g, '').trim()` |
| **3. Cấp 3** | Whitespace Normalization | Co cụm mọi chuỗi ký tự xuống dòng và khoảng trắng liên tiếp thành 1 dấu cách duy nhất `\s+` -> ` ` để so khớp ngữ nghĩa. |
