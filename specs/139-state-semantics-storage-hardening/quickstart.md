# Quickstart Validation Guide: Gia Cố Ngữ Nghĩa Trạng Thái, Chỉ Số Vòng Đời & Toàn Vẹn Lưu Trữ

**Feature**: `139-state-semantics-storage-hardening`  
**Date**: 2026-09-15  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md)

---

## Mục Đích
Tài liệu này hướng dẫn cách chạy các kịch bản kiểm thử độc lập nhằm xác nhận 5 nhóm yêu cầu cốt lõi của tính năng 139 đã hoạt động chính xác và đạt chỉ tiêu chất lượng.

---

## 1. Điều Kiện Tiên Quyết
- Node.js >= 20
- Kho mã nguồn đã cài đặt đầy đủ gói phụ thuộc: `npm install`
- Không có lỗi type tồn đọng: `npm run lint`

---

## 2. Kịch Bản Kiểm Thử Chi Tiết

### Kịch Bản 1: Xác thực Vòng Đời Yêu Cầu Logic & Thất Bại Tổng Thể (`failedRequestsTotal/Today`)
**Mục tiêu**: Đảm bảo `failedRequestsTotal/Today` được tăng chính xác khi toàn bộ lượt thử của một logical request thất bại.

**Lệnh chạy kiểm thử**:
```bash
npx vitest run src/services/gemini/__tests__/geminiClient.test.ts src/services/__tests__/localQuotaTracker.test.ts
```

**Kỳ vọng đạt được**:
- Test case kiểm tra logical request thất bại khi toàn bộ keys trả về 429 hoặc lỗi mạng:
  - `logicalRequestsTotal` tăng 1.
  - `providerAttemptsTotal` tăng theo số lượng keys.
  - `failedAttemptsTotal` tăng theo số lượng keys.
  - `failedRequestsTotal` tăng chính xác 1 đơn vị.
- Test case kiểm tra logical request thành công ở lượt thử thứ hai:
  - `logicalRequestsTotal` tăng 1.
  - `successfulRequestsTotal` tăng 1.
  - `failedRequestsTotal` giữ nguyên 0.

---

### Kịch Bản 2: Xác thực Tách Biệt `retriesTotal` Khỏi Lỗi Provider Không Retry
**Mục tiêu**: Đảm bảo `retriesTotal` chỉ tăng khi thực sự xoay tua sang khóa mới hoặc retry, các lỗi 400/401 không làm tăng `retriesTotal`.

**Lệnh chạy kiểm thử**:
```bash
npx vitest run src/services/gemini/__tests__/geminiClient.test.ts src/services/__tests__/localQuotaTracker.test.ts
```

**Kỳ vọng đạt được**:
- Giả lập phản hồi HTTP 401 (Auth Failed): `failedAttemptsTotal` tăng 1, `retriesTotal` KHÔNG tăng.
- Giả lập phản hồi HTTP 429 và xoay tua sang Key tiếp theo: `retriesTotal` tăng đúng 1 lần.
- Lượt thất bại ở key cuối cùng: `retriesTotal` KHÔNG tăng thêm.

---

### Kịch Bản 3: Xác thực Tuần Tự Hóa Lưu Trữ Cho Mọi Caller (`saveProjectToDB`)
**Mục tiêu**: Đảm bảo mọi lời gọi tới `saveProjectToDB()` từ UI (`useProjects`) và Google Drive sync (`driveBundleSync`, `driveProjectSync`, `driveGranularSync`) đều được thực thi tuần tự theo từng `projectId`.

**Lệnh chạy kiểm thử**:
```bash
npx vitest run src/services/__tests__/projectStorageQueue.test.ts src/services/__tests__/dbStorageAudit.test.ts
```

**Kỳ vọng đạt được**:
- Kích hoạt 5 thao tác ghi liên tiếp trên cùng một project với thời gian xử lý I/O ngẫu nhiên (delay giả lập).
- Tất cả 5 thao tác hoàn thành theo đúng thứ tự FIFO (1 -> 2 -> 3 -> 4 -> 5).
- Không có hiện tượng ghi đè snapshot cũ lên snapshot mới.
- Một thao tác ghi gặp lỗi ngoại lệ không làm tắc nghẽn các thao tác ghi tiếp theo trong hàng đợi.

---

### Kịch Bản 4: Xác thực Di Trú Cấu Hình Hạn Mức Tùy Chỉnh (Migration Legacy Hash -> SHA-256)
**Mục tiêu**: Đảm bảo cấu hình `maxRpd` của người dùng tạo trên bản băm 32-bit cũ được tự động di trú an toàn sang mã băm SHA-256 mới.

**Lệnh chạy kiểm thử**:
```bash
npx vitest run src/utils/__tests__/customLimitsStorage.test.ts
```

**Kỳ vọng đạt được**:
- Nạp vào `localStorage` cấu hình với key là mã băm cũ (chuỗi hex 8 ký tự lặp lại).
- Gọi `migrateCustomLimits([testApiKey])`.
- Kết quả trả về `migratedCount: 1`.
- Cấu hình được lưu lại dưới mã băm SHA-256 chuẩn (64 ký tự hex) với đầy đủ giá trị `maxRpd`.
- Mã băm cũ được dọn dẹp sạch sẽ khỏi bộ nhớ.

---

### Kịch Bản 5: Xác thực Hợp Đồng & Runtime Phân Đoạn Song Ngữ
**Mục tiêu**: Đảm bảo `splitBilingualAdaptively` hỗ trợ trọn vẹn cả cú pháp positional và object options với tham số `maxTokensPerChunk`.

**Lệnh chạy kiểm thử**:
```bash
npx vitest run src/services/translation/__tests__/bilingualSplit.test.ts
```

**Kỳ vọng đạt được**:
- Chạy với đối tượng `{ sourceText, rawText, maxTokensPerChunk: 300 }`:
  - Số chunks sinh ra tự động điều chỉnh tăng để đáp ứng giới hạn token.
  - Các khối văn bản giữ nguyên ranh giới đoạn văn hoàn chỉnh.
  - Không có khối nào bị rỗng.
- Chữ ký positional `(sourceText, rawText, targetParts)` tiếp tục hoạt động chính xác 100%.

---

## 3. Lệnh Kiểm Tra Toàn Diện Hệ Thống (Quality Gates)
Trước khi kết thúc, chạy toàn bộ bộ kiểm tra chất lượng bắt buộc:
```bash
npm run lint    # tsc --noEmit
npm test        # vitest run (phải pass toàn bộ)
npm run build   # tsc && vite build
```
