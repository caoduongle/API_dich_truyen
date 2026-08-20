# Contract: Translation Error Classification & Adaptive Split Trigger

**Feature**: Pipeline Translation Hardening - Chapter Title Preservation & Untranslated Chinese Auto-Retry  
**Date**: 2026-08-20

---

## 1. Error Identification

Khi `callRawTranslationDirect` hoặc `callPolishDirect` phát hiện bản dịch chưa đạt yêu cầu:
- **Error Message Format**: `UNTRANSLATED_CHINESE_LEFTOVER: Bản dịch chứa tỉ lệ chữ Hán bất thường (XX.X% > YY.Y%).`

---

## 2. Retry Decision Contract

- **Classifier Function**: `isSafetyOrEmptyError(error: any): boolean`
- **Result**:
  - Trả về `true` khi `error.message` chứa `UNTRANSLATED_CHINESE_LEFTOVER` hoặc `TỈ LỆ CHỮ HÁN`.
- **Pipeline Action**:
  - `translateRawWithContentSplit` và `polishWithContentSplit` kích hoạt phân tách thích ứng (`splitTextAdaptively`), chia nhỏ văn bản thành 2-3 phần và dịch lại từng phần độc lập.
