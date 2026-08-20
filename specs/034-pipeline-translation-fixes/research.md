# Phase 0: Technical Research & Architecture Decisions (BUG 1 & BUG 2)

**Feature**: Pipeline Translation Hardening - Chapter Title Preservation & Untranslated Chinese Auto-Retry  
**Spec**: `specs/034-pipeline-translation-fixes/spec.md`  
**Date**: 2026-08-20

---

## 1. Research Topic 1: Chapter Title Preservation & Restoration Mechanism

### Problem Analysis
In Phase 2 (`polishController.ts`), the prompt strongly commands the model to "rewrite the text into poetic literary Vietnamese", causing Gemini to often merge the chapter title into the first paragraph or drop it entirely. Furthermore, `separateChapterTitleAndBody()` (from `specs/002-preserve-paragraph-formatting`) only splits titles concatenated on the same line (`Chương 1: ABC. Nội dung`), but cannot restore a title that was completely dropped by the model.

### Decision
Implement deterministic chapter title detection and restoration helper in `server/utils/text.ts`:
```typescript
export function isChapterTitleLine(line: string): boolean {
  if (!line || typeof line !== 'string') return false;
  const trimmed = line.trim();
  const titleRegex = /^(?:Chương|Chapter|Hồi|Quyển|Tập|Thứ\s+\d+\s*chương|第\s*[\d零一二三四五六七八九十百千万]+\s*[章节回卷])\s*(?:\d+|[IVXLCDM]+|[a-zA-ZÀ-ỹ0-9零一二三四五六七八九十百千万]+)?\s*(?:[:.\-—]\s*.+)?$/iu;
  return titleRegex.test(trimmed);
}

export function extractChapterTitle(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 0 && isChapterTitleLine(lines[0])) {
    return lines[0];
  }
  return null;
}

export function ensureChapterTitlePreserved(rawText: string, polishedText: string): string {
  if (!rawText || !polishedText) return polishedText || "";
  const rawTitle = extractChapterTitle(rawText);
  if (!rawTitle) {
    return separateChapterTitleAndBody(polishedText);
  }

  const polishedTitle = extractChapterTitle(polishedText);
  if (!polishedTitle) {
    // Phase 2 dropped the title -> restore it from Phase 1
    return [rawTitle, "", separateChapterTitleAndBody(polishedText).trim()].join('\n');
  }

  return separateChapterTitleAndBody(polishedText);
}
```

### Prompt Hardening in `polishController.ts`:
Add explicit separate formatting instruction in `polishController.ts`:
```text
- TIÊU ĐỀ CHƯƠNG LÀ BẤT BIẾN: Nếu dòng đầu tiên của bản dịch thô là tiêu đề chương (ví dụ: "Chương 1: ..."), bạn BẮT BUỘC phải giữ lại nguyên vẹn tiêu đề này trên dòng đầu tiên của bản chuốt, ngăn cách với thân bài bằng dòng trống. TUYỆT ĐỐI KHÔNG xóa, không gộp tiêu đề chương vào đoạn văn mở đầu.
```

---

## 2. Research Topic 2: Chinese Character Leftover Detection (Zero Dependencies)

### Problem Analysis
When the input prompt is long or complex, Gemini sometimes echoes back the raw Chinese text with glossary brackets (`[Tên_Việt]`) instead of translating. The current controllers only check for empty strings (`!finalRawTranslation || finalRawTranslation.trim() === ""`).

### Decision
Reuse existing Unicode Han character regex in `server/utils/text.ts` (`/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g`):
```typescript
export const CHINESE_CHAR_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g;

export function countChineseCharacters(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  const matches = text.match(CHINESE_CHAR_REGEX);
  return matches ? matches.length : 0;
}

export function calculateChineseCharRatio(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  const nonWhitespace = text.replace(/\s+/g, '');
  if (nonWhitespace.length === 0) return 0;
  const zhCount = countChineseCharacters(nonWhitespace);
  return zhCount / nonWhitespace.length;
}

export function validateTranslationOutput(text: string, minLength = 50, maxRatio = 0.10): void {
  if (!text || typeof text !== 'string') {
    throw new Error("Không nhận được phản hồi dịch từ AI (kết quả trả về trống).");
  }
  const ratio = calculateChineseCharRatio(text);
  if (text.length >= minLength && ratio > maxRatio) {
    throw new Error(`UNTRANSLATED_CHINESE_LEFTOVER: Bản dịch chứa tỉ lệ chữ Hán bất thường (${(ratio * 100).toFixed(1)}% > ${(maxRatio * 100)}%).`);
  }
}
```

---

## 3. Research Topic 3: Error Classification & Adaptive Split Retry

### Decision
Integrate `UNTRANSLATED_CHINESE_LEFTOVER` into `isSafetyOrEmptyError` in `server/services/geminiService.ts`:
```typescript
export function isSafetyOrEmptyError(error: any): boolean {
  if (!error) return false;
  const errStr = String(error.message || error).toUpperCase();
  return (
    errStr.includes("SAFETY") ||
    errStr.includes("BLOCKED") ||
    errStr.includes("TRỐNG RỖNG") ||
    errStr.includes("EMPTY") ||
    errStr.includes("UNTRANSLATED_CHINESE_LEFTOVER") ||
    errStr.includes("TỈ LỆ CHỮ HÁN") ||
    errStr.includes("KẾT QUẢ TRẢ VỀ TRỐNG")
  );
}
```

### Rationale:
When `callRawTranslationDirect` or `callPolishDirect` throws `UNTRANSLATED_CHINESE_LEFTOVER`, `translateRawWithContentSplit` or `polishWithContentSplit` catches it and immediately divides the content into smaller chunks (`splitTextAdaptively`), triggering focused sub-translations where the model no longer overflows context.

---

## 4. Summary of Architecture Decisions

| Component | Choice | Rationale | Alternatives Evaluated |
| :--- | :--- | :--- | :--- |
| **Title Restoration** | `ensureChapterTitlePreserved` in `text.ts` | 100% deterministic safety net | Schema change (would break DB/API types) |
| **Chinese Detection** | Native Unicode Han regex (`text.ts`) | Zero new dependencies (Principle II) | External language-detect packages |
| **Error Handling** | Throws `UNTRANSLATED_CHINESE_LEFTOVER` | Automatically activates Adaptive Split | Silent fallback (returns broken text) |
| **Divide & Conquer** | Chunk 0 title only | Avoids duplicate headers on merge | Independent chunk headers (causes duplicates) |
