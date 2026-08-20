import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRateLimiter } from "../rateLimiter";
import { Request, Response } from "express";

let mockEval = vi.fn();

vi.mock("ioredis", () => {
  return {
    default: class MockRedis {
      eval = mockEval;
    }
  };
});

describe("Rate Limiter Middleware", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("In-Memory Mode (no REDIS_URL)", () => {
    it("should allow up to 60 requests per minute and then block", () => {
      delete process.env.REDIS_URL;
      const rateLimiter = createRateLimiter();

      const req = { ip: "1.2.3.4", socket: {} } as unknown as Request;
      const resJson = vi.fn();
      const resStatus = vi.fn().mockReturnValue({ json: resJson });
      const res = { status: resStatus } as unknown as Response;
      const next = vi.fn();

      // First 60 requests should pass
      for (let i = 0; i < 60; i++) {
        rateLimiter(req, res, next);
      }
      expect(next).toHaveBeenCalledTimes(60);
      expect(resStatus).not.toHaveBeenCalled();

      // 61st request should be blocked with 429
      rateLimiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(60); // Still 60
      expect(resStatus).toHaveBeenCalledWith(429);
      expect(resJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("Quá nhiều yêu cầu"),
        })
      );
    });

    it("should limit requests per IP independently", () => {
      delete process.env.REDIS_URL;
      const rateLimiter = createRateLimiter();

      const reqIP1 = { ip: "1.1.1.1", socket: {} } as unknown as Request;
      const reqIP2 = { ip: "2.2.2.2", socket: {} } as unknown as Request;
      const res = { status: vi.fn().mockReturnValue({ json: vi.fn() }) } as unknown as Response;
      const next = vi.fn();

      // IP 1 makes 60 requests
      for (let i = 0; i < 60; i++) {
        rateLimiter(reqIP1, res, next);
      }
      // IP 2 makes 1 request
      rateLimiter(reqIP2, res, next);

      expect(next).toHaveBeenCalledTimes(61);
    });
  });

  describe("Redis Mode (with REDIS_URL)", () => {
    it("should delegate to Redis eval and pass if under limit", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const rateLimiter = createRateLimiter();

      const req = { ip: "5.6.7.8", socket: {} } as unknown as Request;
      const res = { status: vi.fn().mockReturnValue({ json: vi.fn() }) } as unknown as Response;
      const next = vi.fn();

      // Mock redis eval returning [count, pttl]
      mockEval.mockResolvedValue([5, 50000]);

      await rateLimiter(req, res, next);

      expect(mockEval).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it("should block request with 429 if count exceeds limit", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const rateLimiter = createRateLimiter();

      const req = { ip: "5.6.7.8", socket: {} } as unknown as Request;
      const resJson = vi.fn();
      const resStatus = vi.fn().mockReturnValue({ json: resJson });
      const res = { status: resStatus } as unknown as Response;
      const next = vi.fn();

      // Mock redis eval returning [61, 45000] (over the limit of 60)
      mockEval.mockResolvedValue([61, 45000]);

      await rateLimiter(req, res, next);

      expect(mockEval).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
      expect(resStatus).toHaveBeenCalledWith(429);
      expect(resJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Quá nhiều yêu cầu. Vui lòng chờ 45 giây rồi thử lại.",
        })
      );
    });

    it("should gracefully fallback to in-memory limiting if Redis throws an error", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const rateLimiter = createRateLimiter();

      const req = { ip: "5.6.7.8", socket: {} } as unknown as Request;
      const res = { status: vi.fn().mockReturnValue({ json: vi.fn() }) } as unknown as Response;
      const next = vi.fn();

      mockEval.mockRejectedValue(new Error("Redis connection lost"));

      await rateLimiter(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("Custom Options & Dedicated Auth Rate Limiting", () => {
    it("should enforce custom maxRequests and windowMs in in-memory mode", () => {
      delete process.env.REDIS_URL;
      const authLimiter = createRateLimiter({
        windowMs: 15 * 60 * 1000,
        maxRequests: 10,
        keyPrefix: "ratelimit:login:",
        message: "Quá nhiều lần thử đăng nhập."
      });

      const req = { ip: "9.9.9.9", socket: {} } as unknown as Request;
      const resJson = vi.fn();
      const resStatus = vi.fn().mockReturnValue({ json: resJson });
      const res = { status: resStatus } as unknown as Response;
      const next = vi.fn();

      // First 10 requests should pass
      for (let i = 0; i < 10; i++) {
        authLimiter(req, res, next);
      }
      expect(next).toHaveBeenCalledTimes(10);

      // 11th request should be blocked with 429
      authLimiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(10);
      expect(resStatus).toHaveBeenCalledWith(429);
      expect(resJson).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Quá nhiều lần thử đăng nhập." })
      );

    });

    it("should use custom keyPrefix and windowMs in Redis mode", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const authLimiter = createRateLimiter({
        windowMs: 900000,
        maxRequests: 10,
        keyPrefix: "ratelimit:login:"
      });

      const req = { ip: "9.9.9.9", socket: {} } as unknown as Request;
      const res = { status: vi.fn().mockReturnValue({ json: vi.fn() }) } as unknown as Response;
      const next = vi.fn();

      mockEval.mockResolvedValue([1, 900000]);

      await authLimiter(req, res, next);

      expect(mockEval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        "ratelimit:login:9.9.9.9",
        900000
      );
      expect(next).toHaveBeenCalled();
    });
  });
});

