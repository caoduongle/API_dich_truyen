# Quickstart & Verification Guide: Model Discovery Header Auth

**Feature**: `044-model-discovery-header-auth`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Mục Đích
Kiểm định 3 kịch bản bắt buộc của TASK 07 — Đảm bảo toàn bộ request tới Google Model Discovery & Probe đều dùng header `x-goog-api-key`, URL hoàn toàn sạch và nhật ký không rò rỉ key.

---

## 2. Các Bài Kiểm Thử Cốt Lõi (`modelDiscoveryHeaderAuth.test.ts`)

```typescript
describe('Google Model Discovery Header-Based Auth (TASK 07)', () => {
  // Test 1: URL does not contain key
  it('URL does not contain key: verifies requests to /models, /models/{id}, and :generateContent contain no query parameter keys', async () => {
    // Assert url không có ?key= hoặc &key=
  });

  // Test 2: header contains key
  it('header contains key: verifies x-goog-api-key header is present in all outbound discovery and probe calls', async () => {
    // Assert headers['x-goog-api-key'] === apiKey
  });

  // Test 3: logs do not contain key
  it('logs do not contain key: ensures errors and logs are redacted and do not expose API keys', async () => {
    // Assert log và error messages không chứa plaintext key
  });
});
```

---

## 3. Lệnh Chạy Kiểm Thử & Kiểm Định

```bash
# 1. Chạy bài test chuyên biệt cho Header Auth
npx vitest run server/services/__tests__/modelDiscoveryHeaderAuth.test.ts

# 2. Chạy toàn bộ test suite
npm test

# 3. Kiểm tra Type Safety
npm run lint

# 4. Kiểm tra Build Production
npm run build
```
