# Data Model: Web Chapter Export Formatting

## 1. Export Types & Formats

```typescript
export type ExportMode = 'web' | 'audio' | 'align_jsonl';

export interface FormattedChapterInput {
  index: number;
  chapterTitle: string;
  sourceText?: string;
  translatedText: string;
}

export interface WebExportResult {
  formattedTitle: string;      // e.g. "Chương 1: Khởi đầu mới"
  cleanBody: string;           // Clean multiline chapter content
  fullOutput: string;          // "*** Chương 1: Khởi đầu mới\n[Clean Body]"
}
```

## 2. Validation & Formatting Rules

1. **Title Resolution**:
   - Ưu tiên: Tiêu đề rõ ràng bắt đầu bằng `Chương/Chapter/Hồi/Quyển/Tập` trong `translatedText` (3 dòng đầu) hoặc `chapterTitle`.
   - Chuẩn hóa: Loại bỏ tiền tố `*`, `#`, dấu phân đoạn trùng lặp.
2. **Body Cleaning**:
   - Loại bỏ dòng tiêu đề lặp lại ở đầu văn bản.
   - Loại bỏ các ký tự phân cách rác (`***`, `---`) trong thân chương.
   - Chuẩn hóa khoảng cách dòng: không để nhiều hơn 1 dòng trống liên tiếp trong một chương.
3. **Combination**:
   - Ghép các chương với `\n\n`.
