# Data Model: Định Vị & Bôi Đen Đoạn Lỗi Khi Mở Bàn Dịch

**Feature**: `135-open-translator-highlight`  
**Date**: 2026-09-14  

---

## 1. Cấu Trúc Dữ Liệu Thực Thể Mới (Entities & Interfaces)

### 1.1 `HighlightIntent` (Yêu cầu định vị & bôi đen)
Đối tượng điều hướng sâu (Deep-link intent) mang ngữ cảnh đầy đủ từ màn hình Kiểm Định Hako sang Bàn Dịch:

```typescript
export interface HighlightIntent {
  /** ID của chương truyện chứa đoạn lỗi cần mở */
  chapterId: string;
  /** Đoạn trích dẫn văn bản tiếng Việt làm bằng chứng vi phạm */
  snippet: string;
  /** ID của thẻ lỗi tương ứng trong bộ kiểm định (nếu có) */
  issueId?: string;
  /** Thời điểm tạo yêu cầu (dùng để phân biệt các lần nhấn mở liên tiếp) */
  timestamp: number;
}
```

### 1.2 Mở rộng `OpenInTranslatorOptions`
Hợp đồng tùy chọn khi gọi callback `onOpenInTranslator`:

```typescript
export interface OpenInTranslatorOptions {
  /** Đoạn trích văn bản tiếng Việt cần bôi đen */
  snippet?: string;
  /** ID của issue để đồng bộ trên UnifiedAuditPanel */
  issueId?: string;
}
```

---

## 2. Máy Trạng Thái Định Vị Văn Bản (Selection Lifecycle State Machine)

```text
[Bấm 'Mở trong Bàn Dịch để sửa']
               │
               ▼
   Tạo HighlightIntent(chapterId, snippet, issueId, timestamp)
   Lưu vào state: pendingHighlightIntent (App.tsx)
   Chuyển tab sang 'translate' & nạp LoadedChapter từ IndexedDB
               │
               ▼
[Bàn Dịch Render lần 1: Đang nạp dữ liệu]
               │
               ├── currentChapterId !== intent.chapterId ──────────► [Chờ nạp xong dữ liệu chương]
               │                                                              │
               ▼                                                              │
[Bàn Dịch Render lần 2: Đã nạp dữ liệu chương mục tiêu] ◄──────────────────────┘
               │
               ▼
   Kiểm tra vị trí snippet trong nội dung:
   findSnippetLocationInText(polishedTranslation, snippet)
     ? Phân vùng mục tiêu = 'polished'
     : findSnippetLocationInText(rawTranslation, snippet)
         ? Phân vùng mục tiêu = 'raw'
         : Không tìm thấy
               │
               ├── Cần đổi phân vùng (activeStage !== targetStage)
               │      └── Gọi setActiveStage(targetStage) và chờ render tiếp theo
               │
               ▼
   Khung soạn thảo mục tiêu (targetTextareaRef) sẵn sàng
               │
               ▼
   scrollAndSelectInTextarea(targetTextareaRef.current, snippet):
   1. Tính toán start, end từ findSnippetLocationInText
   2. focus() ô textarea
   3. setSelectionRange(start, end)
   4. Tính toán dòng và scrollTop với khoảng đệm 3 dòng
   5. Hiển thị Toast thành công: "Đã định vị đoạn lỗi trong bản dịch"
               │
               ▼
   onClearHighlightIntent():
   Giải phóng pendingHighlightIntent thành null (Hoàn tất chu trình)
```

---

## 3. Luồng Dữ Liệu Qua Các Tầng Thành Phần (Component Data Flow)

| Tầng / Component | Dữ liệu đầu vào | Dữ liệu đầu ra / Callback | Vai trò |
|------------------|-----------------|---------------------------|---------|
| `HakoIssueCard.tsx` | `issue: QualityIssue` | `onOpenInTranslator(chapterId, { snippet, issueId })` | View: Phát tín hiệu mở từ thẻ lỗi |
| `HakoCheckerWorkspace.tsx` | N/A | `onOpenInTranslator` chuyển tiếp | View: Chuyển tiếp callback lên AppShell |
| `App.tsx` | `chapterId`, `options` | `pendingHighlightIntent: HighlightIntent \| null` | Controller gốc: Nạp chapter từ DB và khởi tạo intent |
| `TabContent.tsx` | `pendingHighlightIntent` | Chuyển tiếp xuống `TranslatorWorkspace` | Layout: Định tuyến giao diện giữa các phân vùng |
| `TranslatorWorkspace.tsx` | `highlightIntent`, `loadedChapter` | Chuyển tiếp xuống `BilingualEditor` | View / Controller: Điều phối state không gian làm việc |
| `BilingualEditor.tsx` | `highlightIntent`, `activeStage`, translations | `onClearHighlightIntent()` | View: Thực thi cuộn mượt và bôi đen vùng chọn văn bản |
| `UnifiedAuditPanel.tsx` | `activeIssueId` (tùy chọn) | Đổi tab sang 'ai_critique' hoặc 'hako_rule', focus card | View: Làm nổi bật thẻ lỗi tương ứng ở sidebar |
