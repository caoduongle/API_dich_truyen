import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Request, Response } from "express";
import {
  createRateLimiter,
  calculateSlidingWindowCount,
  resetRateLimiterForTesting,
  getRateLimiterStatus,
} from "../rateLimiter";
import { redisManager } from "../../services/redisService";

let mockEval = vi.fn();

vi.mock("ioredis", () => {
  return {
    default: class MockRedis {
      eval = mockEval;
    },
  };
});

describe("HTTP Rate Limiter Upgrade — Sliding Window Counter (TASK 15)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    redisManager.resetForTesting();
    resetRateLimiterForTesting();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    redisManager.resetForTesting();
    vi.useRealTimers();
  });

  describe("Sliding Window Mathematical Helper", () => {
    it("computes exact weighted count across window boundaries", () => {
      const windowMs = 60000;
      const baseTime = Math.floor(1700000000000 / windowMs) * windowMs; // aligned bucket start

      // 1. At start of window (0s into window): prevWeight = 1.0
      const atStart = calculateSlidingWindowCount(baseTime, windowMs, 10, 50);
      expect(atStart.prevWeight).toBe(1);
      expect(atStart.estimatedCount).toBe(60); // 10 + 50 * 1.0

      // 2. Halfway into window (30s into window): prevWeight = 0.5
      const atHalf = calculateSlidingWindowCount(baseTime + 30000, windowMs, 10, 50);
      expect(atHalf.prevWeight).toBe(0.5);
      expect(atHalf.estimatedCount).toBe(35); // 10 + 50 * 0.5

      // 3. Near end of window (54s into window): prevWeight = 0.1
      const atEnd = calculateSlidingWindowCount(baseTime + 54000, windowMs, 10, 50);
      expect(atEnd.prevWeight).toBeCloseTo(0.1, 5);
      expect(atEnd.estimatedCount).toBe(15); // 10 + 50 * 0.1
    });
  });

  describe("User Story 1: Smooth Boundary Burst Protection", () => {
    it("blocks burst requests crossing the window boundary that exceed 60 RPM", () => {
      delete process.env.REDIS_URL;
      vi.useFakeTimers();
      const windowMs = 60000;
      const startTime = Math.floor(1700000000000 / windowMs) * windowMs;
      vi.setSystemTime(startTime);

      const limiter = createRateLimiter({ windowMs, maxRequests: 60 });
      const req = { ip: "192.168.1.100", socket: {} } as unknown as Request;
      const next = vi.fn();

      const createMockRes = () => {
        const headers: Record<string, any> = {};
        const jsonMock = vi.fn();
        const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
        const res = {
          setHeader: vi.fn((k, v) => {
            headers[k] = v;
          }),
          status: statusMock,
          _headers: headers,
          _json: jsonMock,
        } as unknown as Response;
        return { res, statusMock, jsonMock, headers };
      };

      // Giây thứ 50 của Window 1: Gửi 50 requests
      vi.setSystemTime(startTime + 50000);
      for (let i = 0; i < 50; i++) {
        const { res } = createMockRes();
        limiter(req, res, next);
      }
      expect(next).toHaveBeenCalledTimes(50);

      // Bước sang Giây thứ 10 của Window 2 (10s sau khi reset bucket):
      // prevCount = 50, prevWeight = (60 - 10) / 60 = 5/6 ≈ 0.833 -> weighted previous ≈ 41.67
      vi.setSystemTime(startTime + 70000); // 10s into window 2

      // Gửi tiếp 15 requests (15 + 41.67 = 56.67 <= 60 -> vẫn lọt)
      for (let i = 0; i < 15; i++) {
        const { res } = createMockRes();
        limiter(req, res, next);
      }
      expect(next).toHaveBeenCalledTimes(65);

      // Gửi tiếp 10 requests nữa (sẽ vượt quá 60 và bị block)
      let blockedCount = 0;
      for (let i = 0; i < 10; i++) {
        const { res, statusMock } = createMockRes();
        limiter(req, res, next);
        if (statusMock.mock.calls.length > 0 && statusMock.mock.calls[0][0] === 429) {
          blockedCount++;
        }
      }

      // Đã ngăn chặn thành công 2x burst
      expect(blockedCount).toBeGreaterThan(0);
    });
  });

  describe("User Story 2: Standard HTTP Headers & Precise Retry-After", () => {
    it("attaches X-RateLimit-* headers to allowed requests and Retry-After to 429 responses", () => {
      delete process.env.REDIS_URL;
      const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 5 });
      const req = { ip: "192.168.1.50", socket: {} } as unknown as Request;
      const next = vi.fn();

      const headersMap: Record<string, any> = {};
      const resJson = vi.fn();
      const resStatus = vi.fn().mockReturnValue({ json: resJson });
      const res = {
        setHeader: vi.fn((k, v) => {
          headersMap[k] = v;
        }),
        status: resStatus,
      } as unknown as Response;

      // 1. Allowed request
      limiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(headersMap["X-RateLimit-Limit"]).toBe(5);
      expect(headersMap["X-RateLimit-Remaining"]).toBe(4);
      expect(typeof headersMap["X-RateLimit-Reset"]).toBe("number");

      // 2. Consume remaining quota
      for (let i = 0; i < 4; i++) {
        limiter(req, res, next);
      }
      expect(next).toHaveBeenCalledTimes(5);

      // 3. 6th request triggers 429 & Retry-After
      limiter(req, res, next);
      expect(resStatus).toHaveBeenCalledWith(429);
      expect(headersMap["X-RateLimit-Remaining"]).toBe(0);
      expect(headersMap["Retry-After"]).toBeGreaterThanOrEqual(1);
      expect(resJson).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "RATE_LIMITED",
          retryAfterSec: expect.any(Number),
        })
      );
    });
  });

  describe("User Story 3: High Concurrency Simulation in Redis Lua", () => {
    it("handles Redis Lua responses for allowed and limited requests", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 60 });
      const req = { ip: "172.16.0.1", socket: {} } as unknown as Request;
      const next = vi.fn();

      const headersMap: Record<string, any> = {};
      const resJson = vi.fn();
      const resStatus = vi.fn().mockReturnValue({ json: resJson });
      const res = {
        setHeader: vi.fn((k, v) => {
          headersMap[k] = v;
        }),
        status: resStatus,
      } as unknown as Response;

      // Mock Redis Lua return: [isAllowed=1, remaining=40, resetEpochSec=1700000060, newCount=20]
      mockEval.mockResolvedValue([1, 40, 1700000060, 20]);

      await limiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(headersMap["X-RateLimit-Remaining"]).toBe(40);
      expect(headersMap["X-RateLimit-Reset"]).toBe(1700000060);

      // Mock Redis Lua return when rate limited: [isAllowed=0, estimatedCount=65, retryAfter=18, resetEpochSec=1700000060]
      mockEval.mockResolvedValue([0, 65, 18, 1700000060]);

      await limiter(req, res, next);
      expect(resStatus).toHaveBeenCalledWith(429);
      expect(headersMap["Retry-After"]).toBe(18);
      expect(resJson).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "RATE_LIMITED",
          retryAfterSec: 18,
        })
      );
    });
  });

  describe("User Story 4: Telemetry Status", () => {
    it("reports sliding-window-counter algorithm in rate limiter status", () => {
      const status = getRateLimiterStatus();
      expect(status.algorithm).toBe("sliding-window-counter");
      expect(typeof status.localEntriesCount).toBe("number");
    });
  });
});
