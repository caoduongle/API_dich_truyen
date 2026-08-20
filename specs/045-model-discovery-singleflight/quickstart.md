# Quickstart & Verification Guide: Model Discovery SingleFlight

**Feature**: `045-model-discovery-singleflight`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Mục Đích
Kiểm định 6 kịch bản bắt buộc của TASK 08 — Đảm bảo 20 concurrent requests khi cache miss chỉ tạo duy nhất 1 HTTP request lên Google upstream, short failure cache hoạt động và tự động khôi phục an toàn.

---

## 2. Các Bài Kiểm Thử Cốt Lõi (`modelDiscoverySingleflight.test.ts`)

```typescript
describe('Model Discovery SingleFlight & Dual-Tier Cache (TASK 08)', () => {
  // Test 1: single request
  it('single request: executes 1 upstream call on cache miss and populates success cache', async () => {
    // 1 request -> 1 fetch call, cache created
  });

  // Test 2: 20 concurrent cache miss
  it('20 concurrent cache miss: coalesces 20 concurrent requests into exactly 1 upstream call', async () => {
    // 20 concurrent calls -> mockFetch called 1 time, all 20 resolve with same data
  });

  // Test 3: cache hit
  it('cache hit: subsequent requests return instantly from memory with 0 upstream calls', async () => {
    // Next call -> 0 fetch calls
  });

  // Test 4: failure
  it('failure: safely propagates upstream errors to all concurrent waiters and caches error for 30s', async () => {
    // Upstream 500 -> all 20 reject safely, inFlight map empty, failure cache populated
  });

  // Test 5: timeout
  it('timeout: aborts and cleans in-flight map when upstream call exceeds 15s timeout', async () => {
    // Upstream hangs -> throws timeout error, inFlight map empty
  });

  // Test 6: recovery
  it('recovery: allows new upstream requests to succeed after failure cache expiry or force refresh', async () => {
    // After failure TTL -> new request calls upstream and succeeds
  });
});
```

---

## 3. Lệnh Chạy Kiểm Thử & Kiểm Định

```bash
# 1. Chạy bài test chuyên biệt cho SingleFlight
npx vitest run server/services/__tests__/modelDiscoverySingleflight.test.ts

# 2. Chạy toàn bộ test suite
npm test

# 3. Kiểm tra Type Safety
npm run lint

# 4. Kiểm tra Build Production
npm run build
```
