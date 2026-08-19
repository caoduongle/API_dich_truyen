# Quickstart & Verification Guide: Dynamic Quota Pacing & Rate Limiting

**Feature**: `012-dynamic-quota-pacing`  
**Created**: 2026-08-19  

---

## 1. Automated Verification Commands

```bash
# 1. Type Safety Check
npm run lint

# 2. Complete Test Suites
npm test

# 3. Production Build
npm run build
```

---

## 2. Dynamic Pacing Verification Scenarios

### Scenario A: RPM Pacing Adjustment
1. Mở "Cấu hình AI & Bản Thảo", sang tab "Quota & Hạn mức", mở "Ngưỡng cá nhân".
2. Đổi `Max RPM` từ `15` sang `60`.
3. Kiểm tra thông tin nhịp độ: Hiển thị `~52.8 req/phút • ~1.1s/lần gọi`.
4. Gửi request dịch: Server áp dụng cooldown 1.1s thay vì 4.5s.

### Scenario B: TPM Throttling Protection
1. Khi `tokensThisMinute` vượt quá 85% `maxTpm` (ví dụ: 850.000 / 1.000.000 tokens):
2. `useAutoTranslationQueue` tự động nhận diện `isTpmNearLimit = true`.
3. Hiển thị thông báo trạng thái "Đang giãn nhịp để nạp lại hạn mức Token...".
4. Sau khi các request cũ trượt khỏi cửa sổ 60 giây và `tokensThisMinute` giảm xuống dưới 85%, hàng đợi tự động tiếp tục dịch bình thường.
