# Quickstart & Validation Guide: Cải Tiến Chất Lượng Quét Thuật Ngữ Cho Mô Hình Tốc Độ Cao

**Feature**: `170-glossary-scan-quality-upgrade` | **Date**: 2026-11-27

## Prerequisites
- Node.js & npm đã cài đặt sẵn dependencies.
- Đối chiếu tài liệu thiết kế tại:
  - [data-model.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/170-glossary-scan-quality-upgrade/data-model.md)
  - [glossary-scan-quality-contracts.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/170-glossary-scan-quality-upgrade/contracts/glossary-scan-quality-contracts.md)

## Automated Quality Gates (Bắt buộc)

```powershell
npm run lint
npm test
npm run build
```

## Targeted Verification

```powershell
npx vitest run src/lib/__tests__/glossaryScanQuality.test.ts src/lib/__tests__/glossaryMatch.test.ts src/services/ai/__tests__/prompts.test.ts src/hooks/__tests__/useGlossaryScan.test.ts src/components/__tests__/GlossaryManagerUI.test.tsx
```

## End-to-End Validation Scenarios (Dựa trên mẫu lỗi 592 mục thực tế)

1. **Chặn Bính âm & Rò rỉ chữ Hán (`US1`)**:
   - Đưa vào `classifyScannedGlossaryBatch` các mẫu thực tế: `{ chinese: '霍尊', pinyin: 'huò zūn', vietnamese: 'Hoắc Tôn' }`, `{ chinese: '秦局', pinyin: '秦局', vietnamese: 'Cục trưởng Tần' }`, `{ chinese: '方大泽', pinyin: 'Phương Đại Trạch', vietnamese: 'Phương Đại Trạch', note: 'Nhân viên quay phim đi cùng 李倩' }`, `{ chinese: '海', pinyin: 'Hai', vietnamese: 'Hai', type: 'character' }`.
   - Xác nhận mục Bính âm / sót Hán ở `pinyin`/`vietnamese` bị chuyển `reviewItems` với lý do cụ thể; ghi chú lẫn chữ Hán được làm sạch an toàn hoặc chuyển duyệt.
2. **Chặn nhiễu từ phổ thông, câu lệnh, mã ngắn & mảnh cắt trùng lặp (`US2`)**:
   - Đưa vào các mẫu: `电脑`, `步行街`, `我想看鬼`, `A1`, `A2`, `苍一` (khi `钱仓一` đã có và `苍一` chỉ xuất hiện bên trong `钱仓一`), `天马博士` (khi `天马` đã có), `海` (1 chữ Hán).
   - Xác nhận rác rõ rệt (`我想看鬼`, `A1`, `A2`, `电脑`) bị `reject`, từ 1 chữ (`海`) và mảnh cắt trùng (`苍一`, `天马博士`) bị chuyển `reviewItems` thay vì vào thẳng từ điển chính.
3. **Neo ngữ cảnh & từ điển sẵn có ngay từ Vòng 1 (`US3`)**:
   - Gọi `useGlossaryScan` ở `extractionLoops = 1` với dự án có `genre`, `tone`, `description` và từ điển nền (`钱仓一 -> Tiền Thương Nhất`).
   - Xác nhận ngay tại Vòng 1 prompt gửi `analyzeGlossaryDirect` đã chứa `genre`, `tone` và `- [钱仓一] -> [Tiền Thương Nhất]`.
4. **Telemetry & Sức khỏe từ điển phát hiện lỗi cũ (`US4`)**:
   - Xác nhận log kết thúc `useGlossaryScan` hiển thị `[Tổng kết hậu kiểm]` với đủ 3 số liệu (`Đã thêm` / `Chờ duyệt` / `Đã lọc nhiễu`).
   - Mở `GlossaryHealthBar` với bộ từ điển có mục lỗi `pinyin: 'huò zūn'` hoặc `note: 'cùng 李倩'` → kiểm tra badge `"Lỗi phiên âm / ghi chú"` hiện đúng số lượng và lọc 1 chạm.
