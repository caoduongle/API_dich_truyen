# Data Model & Transformations: Preserve Paragraph Layout

## 1. Text Transformation Pipeline

```text
[Source Text (Tiếng Trung)]
   │ (N đoạn văn phân tách bằng \n hoặc \n\n)
   ▼
[Pre-substitution & Prompt Injection]
   │ (Kèm chỉ thị bảo toàn phân đoạn 1:1)
   ▼
[Gemini AI Response]
   │ (Bản dịch thô / Bản chuốt)
   ▼
[separateChapterTitleAndBody] ───► Tự động tách "Chương X: Tên. Thân" ──► "Chương X: Tên\n\nThân"
   ▼
[IndexedDB / State] (Bảo tồn chuẩn \n\n giữa các đoạn văn)
   ▼
[Export Web / UI Display] (Hiển thị và xuất tệp hoàn hảo)
```

## 2. Transformation Functions

```typescript
export interface ParagraphFormattingRules {
  preserveExactParagraphCount: boolean;
  separateTitleHeader: boolean;
  normalizeConsecutiveBlankLines: boolean;
}
```
