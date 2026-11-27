# Quickstart Validation Guide: Feature 168

**Feature**: `specs/168-rate-limit-cooldown-wait-recovery`  
**Date**: 2026-11-27

---

## 1. Baseline Quality Gates

Chạy từ thư mục gốc repository:

```powershell
npm run lint
npm test
npm run build
```

Tất cả 3 lệnh phải trả về exit code `0`.

---

## 2. Targeted Test Suites

```powershell
npx vitest run src/services/gemini/__tests__/geminiErrorClassifier.test.ts
npx vitest run src/services/__tests__/localQuotaTracker.test.ts
npx vitest run src/services/gemini/__tests__/geminiKeyScheduler.test.ts
npx vitest run src/services/gemini/__tests__/geminiClient.test.ts
npx vitest run src/hooks/__tests__/useGlossaryScan.test.ts
```

**Kịch bản kiểm thử tự động bắt buộc**:
1. Payload lỗi thật từ Google Free Tier (`generate_content_free_tier_requests`, `limit: 15`, `"Generate content requests per minute limit exceeded on Free Tier"`, `"Please retry in 36.580235449s."`) được phân loại là `RATE_LIMIT_RPM` với `recommendedCooldownMs` ≈ `38_500ms` (không bị phân loại nhầm thành `QUOTA_EXHAUSTED_RPD`).
2. `localQuotaTracker.recordFailure` ghi nhận đúng `cooldownUntil = now + recommendedCooldownMs`, và `getPoolCooldownAnalysis` trả về `hasRecoverableCooldown = true` với `minCooldownRemainingMs` chính xác.
3. `callGemini` ném `GeminiRequestError` có `category: 'RATE_LIMIT_RPM'`, `isRetryable: true`, `retryAfterMs` khi toàn bộ key tạm nghỉ RPM, và giữ `QUOTA_EXHAUSTED_RPD`, `isRetryable: false` khi hết hạn mức ngày.
4. `useGlossaryScan`:
   - Khi chạm `RATE_LIMIT_RPM` có `retryAfterMs` ở chương giữa danh sách, tiến trình ghi log tạm chờ, đợi hết cooldown và quét tiếp thành công chương đó cùng toàn bộ các chương phía sau (không bỏ qua 28 chương).
   - Khi chạm `ALL_KEYS_EXHAUSTED` vĩnh viễn (`QUOTA_EXHAUSTED_RPD`), tiến trình dừng ngay tại chương lỗi, không gọi tiếp các chương sau, không chạy Vòng 2, lưu danh sách chương còn lại vào `failedIds` và không ghi thông báo hoàn tất thành công giả.
   - Khi người dùng bấm Dừng (abort) trong lúc đang chờ cooldown, tiến trình dừng ngay lập tức không đợi hết đồng hồ.
