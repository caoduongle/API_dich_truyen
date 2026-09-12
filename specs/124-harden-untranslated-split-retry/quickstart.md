# Quickstart: Kiểm thử & Xác thực Tính năng Gia cố Phân đoạn Cứu nguy cho Flash-Lite

**Feature**: `124-harden-untranslated-split-retry`  
**Date**: 2026-09-12  
**Status**: Ready for Implementation

Tài liệu này hướng dẫn cách chạy và xác thực các kịch bản kiểm thử nhằm bảo đảm cơ chế cứu nguy phân cấp đa tầng hoạt động bền bỉ, không bỏ qua bất kỳ chương nào do lỗi sót chữ Hán khi dùng mô hình Flash-Lite.

---

## 1. Kịch bản Kiểm thử Tự động

### Kịch bản 1: Văn bản dài (> 2000 token) chia nhỏ ban đầu không tiêu hao cấp độ thử lại

- **Mục tiêu**: Chứng minh khi văn bản dài được chia đôi ban đầu do kích thước token, phân đoạn con gặp lỗi `UNTRANSLATED_CHINESE_LEFTOVER` vẫn được cấp đủ 2 cấp thử lại độc lập (`retryDepth = 1`, rồi `retryDepth = 2`).
- **Lệnh thực thi**:
  ```bash
  npm test src/services/__tests__/directTranslationEngine.test.ts
  ```

### Kịch bản 2: Phân đoạn con chạm trần đệ quy tự động kích hoạt cứu nguy dịch từng dòng (Line-by-Line Fallback)

- **Mục tiêu**: Giả lập một phân đoạn con vẫn chứa chữ Hán sau khi chia nhỏ đến cấp 2. Xác minh hệ thống tự động chuyển sang chế độ dịch phân rã từng dòng (`enableSegmentTranslation`), cứu nguy thành công và không ném lỗi làm hỏng toàn bộ chương.
- **Lệnh thực thi**:
  ```bash
  npm test src/services/__tests__/directTranslationEngine.test.ts
  ```

### Kịch bản 3: Tối ưu hóa prompt không nhân đôi văn bản đánh dấu

- **Mục tiêu**: Kiểm tra prompt sinh ra khi nguồn đã có từ điển đánh dấu không bị lặp kép văn bản gốc và văn bản đánh dấu.
- **Lệnh thực thi**:
  ```bash
  npm test src/services/ai/__tests__/prompts.test.ts
  ```

---

## 2. Kiểm soát Chất lượng Toàn hệ thống

```bash
npm run lint    # tsc --noEmit — Phải sạch 0 lỗi type
npm test        # vitest run  — Phải pass 100% test suites
npm run build   # tsc && vite build — Phải build thành công
```
