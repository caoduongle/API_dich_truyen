# Contract: Translation Output & Chapter Title Validation

**Feature**: Pipeline Translation Hardening - Chapter Title Preservation & Untranslated Chinese Auto-Retry  
**Date**: 2026-08-20

---

## 1. Chapter Title Contract

- **Input**:
  - `rawText`: Bản dịch thô từ Phase 1.
  - `polishedText`: Bản dịch chuốt từ Phase 2.
- **Output**:
  - Chuỗi văn bản tiếng Việt chuốt mượt mà.
  - Nếu `rawText` có dòng đầu tiên là tiêu đề chương (`Chương X: ...`), kết quả đầu ra BẮT BUỘC có dòng đầu tiên là tiêu đề chương đó, theo sau bởi ít nhất 1 dòng trống (`\n\n`), sau đó là thân bài.
  - Nếu `rawText` không có tiêu đề chương, kết quả đầu ra giữ nguyên thân bài đã chuốt.

---

## 2. Chinese Character Threshold Contract

- **Input**: `text` (chuỗi văn bản kết quả dịch từ Gemini API).
- **Default Constraints**:
  - `minLength = 50` ký tự.
  - `maxRatio = 0.10` (tối đa 10% ký tự Hán).
- **Behavior**:
  - Nếu `text.length < minLength`: Chấp nhận (tránh false positive đối với các câu thoại siêu ngắn).
  - Nếu `text.length >= minLength` và `chineseCount / nonWhitespaceCount > maxRatio`: Ném ngoại lệ `UNTRANSLATED_CHINESE_LEFTOVER`.
