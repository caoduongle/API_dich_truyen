# Quickstart Validation Guide: Bảo toàn cấu trúc 1-1 với bản raw

**Feature**: `166-strict-raw-structure-parity` | **Date**: 2026-11-27

## Prerequisites

- Node.js & npm đã cài đặt (`npm ci` nếu cần đồng bộ `node_modules`).
- Chạy hoàn toàn phía client, kiểm thử tự động không cần API key Gemini.

## Automated Quality Gates

```powershell
npm run lint
npm test
npm run build
```

Tất cả unit tests hiện có và bộ test mới `src/services/translation/__tests__/structureParity.test.ts` phải pass 100% không skip/mute.

## End-to-End Validation Scenarios

1. **Khớp chính xác 1-1 xuống dòng (cả chương ngắn < 5 đoạn & chương dài)**:
   - Chuẩn bị đoạn raw 3 dòng thoại ngắn liên tiếp và một chương dài 40 đoạn có dòng thơ + dòng phân cảnh `***`.
   - Chạy Dịch thô (GĐ1) và Chuốt văn (GĐ2, 2 lượt): xác nhận số đoạn ở Bản gốc, Dịch thô và Dịch biên tập bằng nhau tuyệt đối (`N = N = N`), không có dòng thoại bị gộp chung.
2. **Bảo toàn & chuẩn hóa dấu câu 1-1**:
   - Đưa vào đoạn raw có `。`, `，`, `、`, `；`, `：`, `？`, `！`, `……`, `——`, `“...”`, `「...」`, `（...）`, `《...》`.
   - Xác nhận đầu ra 0 ký tự dấu câu toàn giác tiếng Trung còn sót, câu hỏi giữ `?`, cảm thán giữ `!`, bỏ lửng giữ `...`, ngắt nhịp giữ `—`, tên bí tịch giữ `«...»`, và lời thoại giữ nguyên cặp `"..."`.
3. **Bảo toàn cách ngắt câu qua nhiều lượt chuốt văn**:
   - Chuốt văn 2–3 lượt trên đoạn hành động gồm 4 câu ngắn dồn dập: xác nhận không bị gộp thành 1 câu dài; nếu một lượt chuốt làm mất ngoặc thoại hoặc gộp đoạn, hậu kiểm tự động khôi phục bản của lượt trước và ghi log rõ lý do.
4. **Kiểm duyệt & định vị đoạn lệch cấu trúc**:
   - Thử nghiệm bản dịch có đoạn bị mất dấu ngoặc thoại hoặc đổi `?` thành `.`: xác nhận kiểm duyệt hiển thị cảnh báo gắn đúng chỉ số đoạn để người dịch nhảy tới sửa.
