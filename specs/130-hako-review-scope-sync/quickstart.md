# Quickstart: Hako Review Scope & Decision Sync

**Feature**: `130-hako-review-scope-sync`
**Date**: 2026-09-13
**Status**: Ready

---

## Mục Đích
Hướng dẫn nhanh cách xác thực và kiểm thử end-to-end các cải tiến về đồng bộ phạm vi hiển thị chương và cơ chế các nút quyết định lỗi trong tab Kiểm Định Hako.

---

## 1. Xác thực bằng kiểm thử tự động (Automated Verification)

Chạy bộ kiểm thử cho engine kiểm định và component kiểm duyệt:

```bash
# Chạy kiểm thử engine hòa giải quyết định kiểm định
npm test src/services/__tests__/hakoQualityEngine.test.ts

# Chạy kiểm thử giao diện HakoIssueReviewPanel và HakoCheckerWorkspace
npm test src/components/hako-checker/__tests__/HakoIssueReviewPanel.test.tsx
```

---

## 2. Kịch bản kiểm thử thủ công (Manual Verification Scenarios)

### Kịch bản 1: Đồng bộ phạm vi chương (Scope Sync)
1. Mở ứng dụng tại tab **Kiểm Định Hako**.
2. Chọn dự án có nhiều chương đã dịch.
3. Chọn Chương 1 và Chương 2, bấm **Bắt đầu kiểm định** để phát hiện lỗi.
4. Quan sát danh sách lỗi hiển thị bên dưới.
5. Quay lên bộ chọn chương, **bỏ chọn Chương 2**, chỉ giữ lại Chương 1.
6. **Kết quả mong đợi**: Bảng danh sách lỗi bên dưới lập tức chỉ còn hiển thị các lỗi của Chương 1. Toàn bộ lỗi của Chương 2 tự động ẩn đi.
7. Tại bộ lọc chương, chọn *"Toàn bộ phiên làm việc"*: Bảng lỗi hiển thị lại đầy đủ lỗi của cả Chương 1 và Chương 2.

### Kịch bản 2: Bảo toàn trạng thái "Xác nhận lỗi" (Prevent False Resolved)
1. Tại một thẻ lỗi của Chương 1, bấm **Xác nhận lỗi** (`confirmed`). Thẻ chuyển sang viền tím và có huy hiệu "Đã xác nhận lỗi".
2. Bấm nút **Rà soát lại** (chưa sửa đổi văn bản của Chương 1).
3. **Kết quả mong đợi**: Sau khi quét xong, lỗi vẫn giữ nguyên trạng thái **"Đã xác nhận lỗi"**, tuyệt đối **không** bị chuyển thành "Đã giải quyết" / "Đã khắc phục".

### Kịch bản 3: Luồng giải quyết lỗi thực sự (True Resolved)
1. Bấm nút **Mở trong Bàn Dịch để sửa** tại thẻ lỗi đã xác nhận.
2. Xóa hoặc sửa đoạn văn bản tiếng Việt chứa lỗi vi phạm, lưu lại chương.
3. Quay lại tab **Kiểm Định Hako**, bấm **Rà soát lại**.
4. **Kết quả mong đợi**: Hệ thống nhận diện đoạn văn vi phạm đã không còn trong văn bản, chuyển trạng thái lỗi sang **"Đã giải quyết"** kèm huy hiệu xanh lá.
