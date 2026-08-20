# Data Model & Pipeline Functions: Translation Hardening (BUG 1 & BUG 2)

**Feature**: Pipeline Translation Hardening - Chapter Title Preservation & Untranslated Chinese Auto-Retry  
**Spec**: `specs/034-pipeline-translation-fixes/spec.md`  
**Date**: 2026-08-20

---

## 1. Helper Function Signatures (`server/utils/text.ts`)

```typescript
/**
 * Kiểm tra xem một dòng văn bản có phải là tiêu đề chương hợp lệ hay không
 */
export function isChapterTitleLine(line: string): boolean;

/**
 * Trích xuất tiêu đề chương từ văn bản (nếu dòng đầu tiên là tiêu đề)
 */
export function extractChapterTitle(text: string): string | null;

/**
 * Bảo toàn tiêu đề chương từ bản dịch thô sang bản chuốt văn
 * Nếu bản chuốt vô tình bị model lược bỏ tiêu đề, tự động khôi phục tiêu đề từ bản thô
 */
export function ensureChapterTitlePreserved(rawText: string, polishedText: string): string;

/**
 * Đếm số lượng ký tự Hán trong văn bản bằng Unicode Han Regex
 */
export function countChineseCharacters(text: string): number;

/**
 * Tính tỉ lệ ký tự Hán trên tổng số ký tự không khoảng trắng (0.0 đến 1.0)
 */
export function calculateChineseCharRatio(text: string): number;

/**
 * Xác thực văn bản dịch thuật, ném lỗi UNTRANSLATED_CHINESE_LEFTOVER nếu tỉ lệ vượt ngưỡng
 */
export function validateTranslationOutput(text: string, minLength?: number, maxRatio?: number): void;
```

---

## 2. Pipeline State & Decision Flow

```text
[Phase 1: Dịch thô (rawController.ts)]
        │
        ▼
   Raw Translation Generated
        │
        ├── Validate: validateTranslationOutput(rawTranslation, 50, 0.10)
        │   ├── Exceeds 10% Hanzi ─► Throws UNTRANSLATED_CHINESE_LEFTOVER ─► Trigger Divide & Conquer Split
        │   └── Passes Validation ─► Apply separateChapterTitleAndBody()
        │
        ▼
[Phase 2: Biên tập / Chuốt văn (polishController.ts)]
        │
        ▼
   Polished Translation Generated
        │
        ├── Validate: validateTranslationOutput(polishedTranslation, 50, 0.10)
        │   ├── Exceeds 10% Hanzi ─► Throws UNTRANSLATED_CHINESE_LEFTOVER ─► Trigger Divide & Conquer Polish
        │   └── Passes Validation ─► Apply ensureChapterTitlePreserved(rawTranslation, polishedTranslation)
        │
        ▼
[Final Output: Guaranteed Chapter Title + 100% Vietnamese Text]
```
