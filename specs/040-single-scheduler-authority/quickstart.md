# Quickstart & Verification Guide: Single Scheduler Authority

**Feature**: `040-single-scheduler-authority`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Mục Đích
Hướng dẫn kiểm định 5 kịch bản bắt buộc của TASK 03 — Đảm bảo duy nhất một cơ quan điều phối (`quotaService`) quyết định thời điểm thực thi và triệt tiêu 100% hiện tượng double-sleep.

---

## 2. Các Bài Kiểm Thử Cốt Lõi (`quotaScheduler.test.ts`)

```typescript
describe('Single Scheduler Authority & Pacing Isolation (TASK 03)', () => {
  // Test 1: group pacing
  it('group pacing: paces sequential requests strictly according to group scheduling hint', () => {
    // Gửi 2 request tuần tự vào group 15 RPM (interval ~4445ms)
    // Request 1: delayMs === 0
    // Request 2: delayMs === 4445
  });

  // Test 2: multiple keys same group
  it('multiple keys same group: shares single group pacing clock across multiple keys', () => {
    // 2 keys trong cùng group_1
    // Request với key 1: delayMs === 0, nextAllowed = T + 4445
    // Request tiếp theo với key 2: delayMs === 4445
  });

  // Test 3: multiple groups
  it('multiple groups: executes independent groups concurrently with zero delay', () => {
    // Group A và Group B
    // Request vào Group A: delayMs === 0
    // Request vào Group B: delayMs === 0 (chạy song song)
  });

  // Test 4: parallel requests
  it('parallel requests: atomically schedules concurrent requests with incremental delays', () => {
    // 5 request đồng thời vào Group A
    // Lease 1: 0ms, Lease 2: 4445ms, Lease 3: 8890ms, Lease 4: 13335ms, Lease 5: 17780ms
  });

  // Test 5: no double sleep
  it('no double sleep: ensures geminiService sleeps exactly once per lease decision', async () => {
    // Spy on sleep / timer -> verify exactly 1 sleep call with lease.delayMs
  });
});
```

---

## 3. Lệnh Chạy Kiểm Thử & Kiểm Định

```bash
# 1. Chạy các bài test chuyên biệt cho Single Scheduler Authority
npx vitest run server/services/__tests__/quotaScheduler.test.ts

# 2. Chạy toàn bộ test suite
npm test

# 3. Kiểm tra Type Safety
npm run lint

# 4. Kiểm tra Build Production
npm run build
```
