import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRateLimiter, getRateLimiterStatus, resetRateLimiterForTesting } from "../rateLimiter";
import { Request, Response, NextFunction } from "express";

let mockEval = vi.fn();
let mockEventHandlers: Record<string, Function[]> = {};

vi.mock("ioredis", () => {
  return {
    default: class MockRedis {
      eval = mockEval;
      on(event: string, handler: Function) {
        if (!mockEventHandlers[event]) {
          mockEventHandlers[event] = [];
        }
        mockEventHandlers[event].push(handler);
        return this;
      }
    }
  };
});

describe("Redis Graceful Degradation & Differentiated Local Fallback", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockEventHandlers = {};
    resetRateLimiterForTesting();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("User Story 1: Graceful Fallback & Auto-Recovery", () => {
    it("should use Redis distributed limiter when Redis is healthy", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const limiter = createRateLimiter({ endpointType: "translation" });

      const req = { ip: "10.0.0.1", socket: {} } as unknown as Request;
      const res = { status: vi.fn().mockReturnValue({ json: vi.fn() }) } as unknown as Response;
      const next = vi.fn();

      mockEval.mockResolvedValue([1, 60000]);

      await limiter(req, res, next);

      expect(mockEval).toHaveBeenCalledWith(
        expect.any(String),
        2,
        expect.stringContaining("ratelimit:translation:10.0.0.1"),
        expect.stringContaining("ratelimit:translation:10.0.0.1"),
        60000,
        60,
        expect.any(Number)
      );
      expect(next).toHaveBeenCalledTimes(1);

      const status = getRateLimiterStatus();
      expect(status.redisStatus).toBe("connected");
      expect(status.isDegraded).toBe(false);
    });

    it("should gracefully degrade to local in-memory store on Redis query failure without crashing", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const limiter = createRateLimiter({ endpointType: "translation", maxRequests: 3 });

      const req = { ip: "10.0.0.2", socket: {} } as unknown as Request;
      const resJson = vi.fn();
      const resStatus = vi.fn().mockReturnValue({ json: resJson });
      const res = { status: resStatus } as unknown as Response;
      const next = vi.fn();

      // Redis query throws error (e.g. timeout / connection refused)
      mockEval.mockRejectedValue(new Error("Connection refused"));

      // Request 1: should degrade to local memory and pass (count 1 <= 3)
      await limiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Request 2 & 3: should pass locally
      await limiter(req, res, next);
      await limiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(3);

      // Request 4: should be blocked by local in-memory fallback with HTTP 429
      await limiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(3);
      expect(resStatus).toHaveBeenCalledWith(429);
      expect(resJson).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "RATE_LIMITED",
        })
      );

      const status = getRateLimiterStatus();
      expect(status.redisStatus).toBe("degraded");
      expect(status.isDegraded).toBe(true);
      expect(status.degradedFallbackCount).toBeGreaterThanOrEqual(4);
    });

    it("should automatically recover and switch back to Redis when ready event fires", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const limiter = createRateLimiter({ endpointType: "translation" });

      const req = { ip: "10.0.0.3", socket: {} } as unknown as Request;
      const res = { status: vi.fn().mockReturnValue({ json: vi.fn() }) } as unknown as Response;
      const next = vi.fn();

      // Trigger Redis error
      const errorHandlers = mockEventHandlers["error"] || [];
      for (const h of errorHandlers) {
        h(new Error("Redis disconnected"));
      }

      let status = getRateLimiterStatus();
      expect(status.redisStatus).toBe("degraded");

      // Trigger Redis ready event (reconnection)
      const readyHandlers = mockEventHandlers["ready"] || [];
      for (const h of readyHandlers) {
        h();
      }

      status = getRateLimiterStatus();
      expect(status.redisStatus).toBe("connected");
      expect(status.isDegraded).toBe(false);

      // Subsequent request goes to Redis
      mockEval.mockResolvedValue([1, 60000]);
      await limiter(req, res, next);
      expect(mockEval).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe("User Story 2: Differentiated Endpoint Failure Policies", () => {
    it("should enforce strict 5 req/15min policy on auth endpoints during degraded mode", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const authLimiter = createRateLimiter({ endpointType: "auth", maxRequests: 5 });

      const req = { ip: "192.168.1.100", socket: {} } as unknown as Request;
      const resJson = vi.fn();
      const resStatus = vi.fn().mockReturnValue({ json: resJson });
      const res = { status: resStatus } as unknown as Response;
      const next = vi.fn();

      // Mock Redis down
      mockEval.mockRejectedValue(new Error("Redis offline"));

      // 5 requests pass
      for (let i = 0; i < 5; i++) {
        await authLimiter(req, res, next);
      }
      expect(next).toHaveBeenCalledTimes(5);

      // 6th request blocked
      await authLimiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(5);
      expect(resStatus).toHaveBeenCalledWith(429);
      expect(resJson).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "RATE_LIMITED",
          error: expect.stringContaining("15 phút"),
        })
      );
    });

    it("should enforce conservative 60 req/min policy on translation endpoints during degraded mode", async () => {
      delete process.env.REDIS_URL;
      const transLimiter = createRateLimiter({ endpointType: "translation" });

      const req = { ip: "192.168.1.200", socket: {} } as unknown as Request;
      const resJson = vi.fn();
      const resStatus = vi.fn().mockReturnValue({ json: resJson });
      const res = { status: resStatus } as unknown as Response;
      const next = vi.fn();

      // 60 requests pass
      for (let i = 0; i < 60; i++) {
        transLimiter(req, res, next);
      }
      expect(next).toHaveBeenCalledTimes(60);

      // 61st request blocked
      transLimiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(60);
      expect(resStatus).toHaveBeenCalledWith(429);
    });

    it("should enforce relaxed 120 req/min policy on non-critical endpoints", () => {
      delete process.env.REDIS_URL;
      const nonCriticalLimiter = createRateLimiter({ endpointType: "non-critical" });

      const req = { ip: "192.168.1.300", socket: {} } as unknown as Request;
      const res = { status: vi.fn().mockReturnValue({ json: vi.fn() }) } as unknown as Response;
      const next = vi.fn();

      for (let i = 0; i < 100; i++) {
        nonCriticalLimiter(req, res, next);
      }
      expect(next).toHaveBeenCalledTimes(100);
    });
  });

  describe("User Story 3: Throttled Logging & Telemetry", () => {
    it("should throttle error logging to prevent log spam during sustained Redis outages", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const limiter = createRateLimiter({ endpointType: "translation" });
      const req = { ip: "10.0.0.99", socket: {} } as unknown as Request;
      const res = { status: vi.fn().mockReturnValue({ json: vi.fn() }) } as unknown as Response;
      const next = vi.fn();

      mockEval.mockRejectedValue(new Error("Redis socket timeout"));

      // Send 50 rapid requests
      for (let i = 0; i < 50; i++) {
        await limiter(req, res, next);
      }

      // Log warning should be emitted once upon state transition, NOT 50 times
      expect(warnSpy).toHaveBeenCalledTimes(1);

      warnSpy.mockRestore();
    });

    it("should accurately report telemetry statistics in getRateLimiterStatus", async () => {
      delete process.env.REDIS_URL;
      const limiter = createRateLimiter({ endpointType: "translation" });

      const req1 = { ip: "10.1.1.1", socket: {} } as unknown as Request;
      const req2 = { ip: "10.1.1.2", socket: {} } as unknown as Request;
      const res = { status: vi.fn().mockReturnValue({ json: vi.fn() }) } as unknown as Response;
      const next = vi.fn();

      limiter(req1, res, next);
      limiter(req2, res, next);

      const status = getRateLimiterStatus();
      expect(status.redisStatus).toBe("disconnected");
      expect(status.localEntriesCount).toBeGreaterThanOrEqual(2);
      expect(status.degradedFallbackCount).toBeGreaterThanOrEqual(2);
    });
  });
});
