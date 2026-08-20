import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  idempotencyMiddleware, 
  clearIdempotencyStore, 
  getIdempotencyStore,
  buildCompositeIdempotencyKey,
  computeRequestFingerprint,
  extractIdentityScope,
  IDEMPOTENCY_TTL_MS
} from '../idempotencyMiddleware';
import { createMockRequest, createMockResponse } from './idempotencyTestUtils';

describe('Scoped Idempotency & Conflict Prevention Middleware (TASK 02)', () => {
  beforeEach(() => {
    clearIdempotencyStore();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── USER STORY 1: COMPOSITE KEY SCOPING & MULTI-TENANT ISOLATION (P1 MVP) ──
  describe('User Story 1: Multi-Dimensional Composite Key Scoping & Tenant Isolation', () => {
    it('bypasses middleware immediately if no idempotency key is provided', () => {
      const req = createMockRequest({ headers: {} });
      const { res } = createMockResponse();
      const next = vi.fn();

      idempotencyMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(getIdempotencyStore().size()).toBe(0);
    });

    it('replays response with x-idempotent-replay header for same user, endpoint, and key', () => {
      const sessionToken = 'user_session_alpha_123';
      const key = 'idemp_key_001';
      const body = { prompt: 'Dịch chương 1', model: 'gemini-2.5-flash' };

      // 1st request
      const req1 = createMockRequest({
        headers: { 'idempotency-key': key, 'x-session-token': sessionToken },
        body,
        path: '/api/translate-raw',
      });
      const resp1 = createMockResponse();
      const next1 = vi.fn().mockImplementation(() => {
        resp1.res.status(200).json({ text: 'Bản dịch chương 1 thành công' });
      });

      idempotencyMiddleware(req1, resp1.res, next1);
      expect(next1).toHaveBeenCalledTimes(1);
      expect(resp1.body).toEqual({ text: 'Bản dịch chương 1 thành công' });
      expect(resp1.headers['x-idempotent-replay']).toBeUndefined();

      // 2nd request with same scope
      const req2 = createMockRequest({
        headers: { 'idempotency-key': key, 'x-session-token': sessionToken },
        body,
        path: '/api/translate-raw',
      });
      const resp2 = createMockResponse();
      const next2 = vi.fn();

      idempotencyMiddleware(req2, resp2.res, next2);
      expect(next2).not.toHaveBeenCalled(); // Replayed from store without calling next()
      expect(resp2.statusCode).toBe(200);
      expect(resp2.body).toEqual({ text: 'Bản dịch chương 1 thành công' });
      expect(resp2.headers['x-idempotent-replay']).toBe('true');
    });

    it('isolates different users sharing the same client idempotency key (Zero cross-user leakage)', () => {
      const key = 'shared_client_idempotency_key_999';
      const body = { prompt: 'Dịch văn bản' };

      // User A
      const reqUserA = createMockRequest({
        headers: { 'idempotency-key': key, 'x-session-token': 'session_user_A' },
        body,
        path: '/api/translate-raw',
      });
      const respA = createMockResponse();
      const nextA = vi.fn().mockImplementation(() => {
        respA.res.status(200).json({ text: 'Kết quả của User A' });
      });

      idempotencyMiddleware(reqUserA, respA.res, nextA);
      expect(nextA).toHaveBeenCalledTimes(1);
      expect(respA.body).toEqual({ text: 'Kết quả của User A' });

      // User B with same idempotency key
      const reqUserB = createMockRequest({
        headers: { 'idempotency-key': key, 'x-session-token': 'session_user_B' },
        body,
        path: '/api/translate-raw',
      });
      const respB = createMockResponse();
      const nextB = vi.fn().mockImplementation(() => {
        respB.res.status(200).json({ text: 'Kết quả của User B' });
      });

      idempotencyMiddleware(reqUserB, respB.res, nextB);
      // User B must execute freshly and NOT receive User A's result!
      expect(nextB).toHaveBeenCalledTimes(1);
      expect(respB.body).toEqual({ text: 'Kết quả của User B' });
      expect(respB.headers['x-idempotent-replay']).toBeUndefined();
    });

    it('isolates different endpoints sharing the same client key (Zero cross-endpoint collision)', () => {
      const sessionToken = 'session_user_single';
      const key = 'batch_operation_part_1';
      const body = { prompt: 'Văn bản cần xử lý' };

      // Request to /api/translate-raw
      const req1 = createMockRequest({
        headers: { 'idempotency-key': key, 'x-session-token': sessionToken },
        body,
        path: '/api/translate-raw',
      });
      const resp1 = createMockResponse();
      const next1 = vi.fn().mockImplementation(() => {
        resp1.res.status(200).json({ result: 'Dịch thô' });
      });

      idempotencyMiddleware(req1, resp1.res, next1);
      expect(next1).toHaveBeenCalledTimes(1);
      expect(resp1.body).toEqual({ result: 'Dịch thô' });

      // Request to /api/polish-translation with same key
      const req2 = createMockRequest({
        headers: { 'idempotency-key': key, 'x-session-token': sessionToken },
        body,
        path: '/api/polish-translation',
      });
      const resp2 = createMockResponse();
      const next2 = vi.fn().mockImplementation(() => {
        resp2.res.status(200).json({ result: 'Chuốt văn' });
      });

      idempotencyMiddleware(req2, resp2.res, next2);
      // Polish endpoint must execute freshly and NOT receive translate-raw result!
      expect(next2).toHaveBeenCalledTimes(1);
      expect(resp2.body).toEqual({ result: 'Chuốt văn' });
    });
  });

  // ── USER STORY 2: REQUEST FINGERPRINTING & 409 CONFLICT REJECTION (P2) ──
  describe('User Story 2: Request Fingerprinting & Payload Conflict Rejection', () => {
    it('rejects with HTTP 409 Conflict when identical key is used with a different request payload', () => {
      const sessionToken = 'session_conflict_user';
      const key = 'idemp_key_conflict_001';

      // 1st request with Body A
      const req1 = createMockRequest({
        headers: { 'idempotency-key': key, 'x-session-token': sessionToken },
        body: { prompt: 'Đoạn văn bản A', temperature: 0.3 },
        path: '/api/translate-raw',
      });
      const resp1 = createMockResponse();
      const next1 = vi.fn().mockImplementation(() => {
        resp1.res.status(200).json({ text: 'Bản dịch A' });
      });

      idempotencyMiddleware(req1, resp1.res, next1);
      expect(resp1.body).toEqual({ text: 'Bản dịch A' });

      // 2nd request with same key but Body B (changed prompt)
      const req2 = createMockRequest({
        headers: { 'idempotency-key': key, 'x-session-token': sessionToken },
        body: { prompt: 'Đoạn văn bản B (đã sửa nội dung)', temperature: 0.3 },
        path: '/api/translate-raw',
      });
      const resp2 = createMockResponse();
      const next2 = vi.fn();

      idempotencyMiddleware(req2, resp2.res, next2);

      // Must be rejected with 409 Conflict immediately without calling next()
      expect(next2).not.toHaveBeenCalled();
      expect(resp2.statusCode).toBe(409);
      expect(resp2.body).toMatchObject({
        errorCode: 'IDEMPOTENCY_CONFLICT',
        idempotencyKey: key,
      });
      expect(resp2.body.error).toContain('Khóa Idempotency đã được sử dụng với nội dung yêu cầu khác');
    });

    it('treats JSON bodies with different key ordering as identical fingerprints (Canonicalization)', () => {
      const hash1 = computeRequestFingerprint({ a: 1, b: 2, c: { x: 10, y: 20 } });
      const hash2 = computeRequestFingerprint({ c: { y: 20, x: 10 }, b: 2, a: 1 });
      expect(hash1).toBe(hash2);
    });
  });

  // ── USER STORY 3: IN-FLIGHT CONCURRENCY COORDINATION & FAILURE EVICTION (P3) ──
  describe('User Story 3: In-Flight Concurrency Coordination & Failure Recovery', () => {
    it('coordinates concurrent duplicate requests so upstream is executed once and all callers receive the response', () => {
      const sessionToken = 'session_concurrent_user';
      const key = 'in_flight_key_100';
      const body = { prompt: 'Chương đồng thời' };

      // 1st request (in-flight pending)
      const req1 = createMockRequest({
        headers: { 'idempotency-key': key, 'x-session-token': sessionToken },
        body,
        path: '/api/translate-raw',
      });
      const resp1 = createMockResponse();
      let completeReq1: () => void = () => {};
      const next1 = vi.fn().mockImplementation(() => {
        // Do not complete immediately; simulate long-running upstream call
        completeReq1 = () => {
          resp1.res.status(200).json({ text: 'Kết quả xử lý đồng thời' });
        };
      });

      idempotencyMiddleware(req1, resp1.res, next1);
      expect(next1).toHaveBeenCalledTimes(1);

      // 2nd request arrives while 1st is still pending
      const req2 = createMockRequest({
        headers: { 'idempotency-key': key, 'x-session-token': sessionToken },
        body,
        path: '/api/translate-raw',
      });
      const resp2 = createMockResponse();
      const next2 = vi.fn();

      idempotencyMiddleware(req2, resp2.res, next2);
      // 2nd request should NOT invoke upstream
      expect(next2).not.toHaveBeenCalled();

      // Now complete the primary request
      completeReq1();

      // Both requests should have received the completed payload
      expect(resp1.body).toEqual({ text: 'Kết quả xử lý đồng thời' });
      expect(resp2.statusCode).toBe(200);
      expect(resp2.body).toEqual({ text: 'Kết quả xử lý đồng thời' });
      expect(resp2.headers['x-idempotent-replay']).toBe('true');
    });

    it('immediately evicts failed requests (status >= 400) from store to allow immediate retries', () => {
      const sessionToken = 'session_failure_user';
      const key = 'failed_retry_key_200';
      const body = { prompt: 'Văn bản gặp sự cố' };

      // 1st attempt fails with 500
      const req1 = createMockRequest({
        headers: { 'idempotency-key': key, 'x-session-token': sessionToken },
        body,
        path: '/api/translate-raw',
      });
      const resp1 = createMockResponse();
      const next1 = vi.fn().mockImplementation(() => {
        resp1.res.status(500).json({ error: 'Upstream Provider Overloaded' });
      });

      idempotencyMiddleware(req1, resp1.res, next1);
      expect(resp1.statusCode).toBe(500);

      // Failed entry must be evicted from the store
      const compositeKey = buildCompositeIdempotencyKey(req1, key);
      expect(getIdempotencyStore().get(compositeKey)).toBeUndefined();

      // 2nd retry attempt arrives with same key
      const req2 = createMockRequest({
        headers: { 'idempotency-key': key, 'x-session-token': sessionToken },
        body,
        path: '/api/translate-raw',
      });
      const resp2 = createMockResponse();
      const next2 = vi.fn().mockImplementation(() => {
        resp2.res.status(200).json({ text: 'Thử lại thành công' });
      });

      idempotencyMiddleware(req2, resp2.res, next2);
      // Must be allowed to execute freshly
      expect(next2).toHaveBeenCalledTimes(1);
      expect(resp2.statusCode).toBe(200);
      expect(resp2.body).toEqual({ text: 'Thử lại thành công' });
    });
  });

  // ── USER STORY 4: STORAGE LIFECYCLE & TTL EXPIRATION (P4) ──
  describe('User Story 4: Storage Lifecycle & TTL Expiration', () => {
    it('evicts expired entries after 5 minutes and processes as fresh request', () => {
      const sessionToken = 'session_ttl_user';
      const key = 'ttl_test_key_300';
      const body = { prompt: 'Văn bản kiểm tra TTL' };

      // 1st request at t0
      const req1 = createMockRequest({
        headers: { 'idempotency-key': key, 'x-session-token': sessionToken },
        body,
        path: '/api/translate-raw',
      });
      const resp1 = createMockResponse();
      const next1 = vi.fn().mockImplementation(() => {
        resp1.res.status(200).json({ text: 'Response 1' });
      });

      idempotencyMiddleware(req1, resp1.res, next1);

      // Manually manipulate createdAt to simulate 6 minutes elapsed (> 5 mins)
      const compositeKey = buildCompositeIdempotencyKey(req1, key);
      const entry = getIdempotencyStore().get(compositeKey)!;
      expect(entry).toBeDefined();
      entry.createdAt = Date.now() - (IDEMPOTENCY_TTL_MS + 60000);

      // 2nd request arrives after expiration
      const req2 = createMockRequest({
        headers: { 'idempotency-key': key, 'x-session-token': sessionToken },
        body,
        path: '/api/translate-raw',
      });
      const resp2 = createMockResponse();
      const next2 = vi.fn().mockImplementation(() => {
        resp2.res.status(200).json({ text: 'Response 2 (Fresh after TTL)' });
      });

      idempotencyMiddleware(req2, resp2.res, next2);
      expect(next2).toHaveBeenCalledTimes(1);
      expect(resp2.body).toEqual({ text: 'Response 2 (Fresh after TTL)' });
    });

    it('cleans up stale entries via cleanupStale method', () => {
      const store = getIdempotencyStore();
      store.set('key1', {
        key: 'key1',
        fingerprint: 'hash1',
        status: 'completed',
        createdAt: Date.now() - 400000, // > 5m
        listeners: [],
      });
      store.set('key2', {
        key: 'key2',
        fingerprint: 'hash2',
        status: 'completed',
        createdAt: Date.now() - 10000, // fresh
        listeners: [],
      });

      expect(store.size()).toBe(2);
      const cleaned = store.cleanupStale();
      expect(cleaned).toBe(1);
      expect(store.size()).toBe(1);
      expect(store.get('key2')).toBeDefined();
    });
  });
});
