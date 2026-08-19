import { describe, it, expect, beforeEach, vi } from 'vitest';
import { idempotencyMiddleware, clearIdempotencyStore } from '../idempotencyMiddleware';
import { Request, Response } from 'express';

describe('Translation Idempotency Middleware', () => {
  beforeEach(() => {
    clearIdempotencyStore();
  });

  it('should call next immediately if no idempotency key is provided', () => {
    const req = { headers: {} } as Request;
    const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() } as unknown as Response;
    const next = vi.fn();

    idempotencyMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should cache successful response and replay for duplicate requests with same key', async () => {
    const req1 = { headers: { 'idempotency-key': 'idemp_key_123' } } as unknown as Request;
    let originalJson1: any;
    const res1 = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn((body) => { originalJson1 = body; }),
    } as unknown as Response;
    const next1 = vi.fn();

    // 1st request
    idempotencyMiddleware(req1, res1, next1);
    expect(next1).toHaveBeenCalled();

    // Simulate controller completion
    res1.status(200).json({ rawTranslation: 'Bản dịch chương 1 thành công' });
    expect(originalJson1).toEqual({ rawTranslation: 'Bản dịch chương 1 thành công' });

    // 2nd request with same idempotency key
    const req2 = { headers: { 'idempotency-key': 'idemp_key_123' } } as unknown as Request;
    const resJson2 = vi.fn();
    const resStatus2 = vi.fn().mockReturnValue({ json: resJson2 });
    const resHeader2 = vi.fn();
    const res2 = {
      setHeader: resHeader2,
      status: resStatus2,
      json: resJson2,
    } as unknown as Response;
    const next2 = vi.fn();

    idempotencyMiddleware(req2, res2, next2);

    // Should NOT call controller (next2 not called)
    expect(next2).not.toHaveBeenCalled();
    expect(resHeader2).toHaveBeenCalledWith('x-idempotent-replay', 'true');
    expect(resStatus2).toHaveBeenCalledWith(200);
    expect(resJson2).toHaveBeenCalledWith({ rawTranslation: 'Bản dịch chương 1 thành công' });
  });
});
