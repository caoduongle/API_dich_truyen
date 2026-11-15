# Quickstart & Validation Guide: Nâng cao chất lượng dịch truyện (163)

**Feature**: `163-translation-quality-uplift`
**Date**: 2026-11-15
**Spec**: [spec.md](./spec.md) | **Data Model**: [data-model.md](./data-model.md) | **Contracts**: [contracts/translation-quality-contracts.md](./contracts/translation-quality-contracts.md)

Hướng dẫn này mô tả cách chạy kiểm chứng toàn diện các cải tiến chất lượng dịch truyện và các cổng chất lượng bắt buộc của dự án.

---

## 1. Điều kiện tiên quyết (Prerequisites)

- Node.js 20+ và `npm` đã cài đặt (`node_modules` đồng bộ với `package-lock.json`).
- Không cần kết nối mạng hay Gemini API key để chạy toàn bộ bộ kiểm thử tự động và bộ đánh giá chất lượng tất định (`US6`).
- Để kiểm chứng trực tiếp trên giao diện trình duyệt với Gemini thật, cần ít nhất 1 Gemini API key cá nhân trong phần **Cấu hình AI**.

---

## 2. Chạy các cổng kiểm tra chất lượng bắt buộc (Quality Gates)

Từ thư mục gốc của repository:

```bash
# 1. Kiểm tra kiểu tĩnh TypeScript
npm run lint

# 2. Chạy toàn bộ kiểm thử đơn vị, tích hợp và bộ mẫu đánh giá chất lượng
npm test

# 3. Kiểm tra đóng gói bản dựng production
npm run build
```

**Kết quả kỳ vọng**: Cả 3 lệnh thoát với mã `0`, không có lỗi kiểu dữ liệu, không có test bị bỏ qua hoặc thất bại (`SC-009`).

---

## 3. Chạy riêng từng kịch bản kiểm chứng theo User Story

### Kịch bản 1 — Từ điển chính xác, không làm vỡ từ ghép & Tiết kiệm prompt (`US1`, `SC-001`, `SC-002`, `SC-005`)

```bash
npx vitest run src/lib/__tests__/glossaryMatch.test.ts src/services/ai/__tests__/prompts.test.ts
```

- **Kiểm chứng**:
  - Mục từ điển 1 ký tự (`林` → `Lâm`) không bị thay cứng vào giữa từ ghép (`森林` giữ nguyên là `森林`, trong khi `林动` được đánh dấu `[Lâm Động]`).
  - Với bảng từ điển $\ge 200$ mục nhưng đoạn văn chỉ chứa 12 mục, chỉ 12 mục đó (cộng các mục ghim `isPinned`) xuất hiện trong prompt của cả 3 giai đoạn (Dịch thô, Chuốt văn, QA).
  - Văn bản nguồn chỉ được gửi đúng 1 lần trong prompt Dịch thô.

### Kịch bản 2 — Hồ sơ nhân vật, Tương thích ngược & Ngữ cảnh liên tục (`US2`, `SC-003`, `SC-010`)

```bash
npx vitest run src/services/__tests__/bundleSyncMerge.test.ts src/services/translation/__tests__/continuityAndProfile.test.ts
```

- **Kiểm chứng**:
  - Dự án/bản sao lưu cũ không có `characterProfile` vẫn nạp bình thường (`FR-008a`).
  - Khi đồng bộ từ gói dữ liệu cũ không có `characterProfile`, hồ sơ nhân vật đã khai báo ở máy local không bị xóa (`FR-008b`, `SC-010`).
  - Khi chương dài bị tách thành nhiều phân đoạn hoặc khi chương liền trước đã dịch xong, phần kết được truyền vào khối ngữ cảnh chỉ-đọc và không bị dịch lặp vào kết quả (`FR-006`, `FR-007`).

### Kịch bản 3 — Chuốt văn trung thành nguyên tác & Chống suy thoái qua nhiều lượt (`US3`, `SC-004`)

```bash
npx vitest run src/services/translation/__tests__/polishFidelity.test.ts
```

- **Kiểm chứng**:
  - Nhiệt độ từng lượt chuốt áp dụng đúng `strategy.temperature` đã khai báo (`FR-012`).
  - Nếu lượt chuốt $K$ làm mất thuật ngữ từ điển hoặc tự bịa thêm cụm tên riêng viết hoa không có trong nguyên tác và bản lượt $K-1$, hệ thống tự động bác bỏ lượt $K$, giữ bản lượt $K-1$ và dừng sớm (`FR-011`).

### Kịch bản 4 — Kiểm duyệt mở rộng & Sửa có mục tiêu theo đoạn (`US4`, `SC-006`, `SC-007`, `SC-011`)

```bash
npx vitest run src/services/translation/__tests__/qaCritique.test.ts src/services/translation/__tests__/targetedRepair.test.ts
```

- **Kiểm chứng**:
  - Kiểm duyệt hỗ trợ đủ 8 loại lỗi (bổ sung `mistranslation`, `pronoun`, `raw_leak`), định vị `paragraphIndex` và khử trùng lặp giữa lỗi tất định và lỗi AI (`FR-013`–`FR-015`).
  - Mặc định `enableAutoTargetedRepair = false`: không phát sinh thêm bất kỳ lời gọi AI nào sau QA (`SC-011`).
  - Khi kích hoạt sửa có mục tiêu trên đoạn văn có lỗi `critical`, chỉ đúng đoạn đó được dịch lại và ghép vào bản dịch; 100% các đoạn khác giữ nguyên từng ký tự; nếu bản sửa tạo lỗi mới hoặc gặp lỗi API/hủy, đoạn cũ được giữ nguyên (`FR-016`–`FR-018`).

### Kịch bản 5 — Bộ mẫu đánh giá chất lượng & So sánh Baseline (`US6`, `FR-020`)

```bash
npx vitest run src/services/translation/__tests__/qualityEvaluation.test.ts
```

- **Kiểm chứng**:
  - Chạy bộ mẫu chuẩn và xuất báo cáo so sánh các chỉ số tất định (`glossaryComplianceRate >= 98%`, `falseSubstitutionCount === 0`, giảm $\ge 50\%$ lỗi xưng hô và tên riêng ngoài nguồn, giảm $\ge 25\%$ độ dài phần từ điển trong prompt với từ điển lớn).
