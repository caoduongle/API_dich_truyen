import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import express from "express";
import { Server } from "http";
import apiRouter from "../api";
import { redisManager } from "../../services/redisService";

describe("Health, Liveness & Readiness Probe Endpoints", () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;
  const originalEnv = process.env;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api", apiRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      if (server) server.close(() => resolve());
      else resolve();
    });
  });

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    redisManager.resetForTesting();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    redisManager.resetForTesting();
  });

  describe("User Story 1: Liveness and Readiness Probes", () => {
    it("should respond with 200 alive for /api/live without dependency checks", async () => {
      const res = await fetch(`${baseUrl}/api/live`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          status: "alive",
          uptimeSeconds: expect.any(Number),
          timestamp: expect.any(String),
        })
      );
    });

    it("should respond with 200 healthy for /api/ready when standalone in-memory", async () => {
      delete process.env.REDIS_URL;
      const res = await fetch(`${baseUrl}/api/ready`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          status: "healthy",
          ready: true,
          dependencies: expect.objectContaining({
            redis: "standalone-in-memory",
          }),
        })
      );
    });

    it("should respond with 200 healthy for /api/ready when Redis is connected", async () => {
      const customMock = { ping: vi.fn(), quit: vi.fn() } as any;
      redisManager.setMockClient(customMock);

      const res = await fetch(`${baseUrl}/api/ready`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          status: "healthy",
          ready: true,
          dependencies: expect.objectContaining({
            redis: "connected",
          }),
        })
      );
    });

    it("should respond with 200 degraded for /api/ready when Redis is degraded", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      // Trigger error on redis manager
      (redisManager as any).status = "degraded";

      const res = await fetch(`${baseUrl}/api/ready`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          status: "degraded",
          ready: true,
          dependencies: expect.objectContaining({
            redis: "degraded",
          }),
        })
      );
    });

    it("should respond with 503 unavailable for /api/ready when connection manager is closed", async () => {
      (redisManager as any).status = "closed";

      const res = await fetch(`${baseUrl}/api/ready`);
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body).toEqual(
        expect.objectContaining({
          status: "unavailable",
          ready: false,
        })
      );
    });
  });

  describe("User Story 2: System Health Diagnostics Telemetry", () => {
    it("should report detailed runtime diagnostics in /api/health", async () => {
      delete process.env.REDIS_URL;

      const res = await fetch(`${baseUrl}/api/health`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          status: "healthy",
          timestamp: expect.any(String),
          uptime: expect.any(String),
          uptimeSeconds: expect.any(Number),
          memory: expect.any(Object),
          redis: expect.objectContaining({
            enabled: false,
            mode: "standalone-in-memory",
          }),
          sessions: expect.objectContaining({
            activeCount: expect.any(Number),
          }),
          models: expect.objectContaining({
            supported: expect.any(Array),
          }),
        })
      );
    });

    it("should report degraded status in /api/health when Redis drops", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      (redisManager as any).status = "degraded";

      const res = await fetch(`${baseUrl}/api/health`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe("degraded");
      expect(body.redis.mode).toBe("in-memory-fallback");
    });
  });

  describe("User Story 3: Unauthenticated Access & Zero Gemini Provider Calls", () => {
    it("should allow unauthenticated access to /live, /ready, and /health when ACCESS_PASSWORD is set", async () => {
      process.env.ACCESS_PASSWORD = "SuperSecretPassword123";

      const liveRes = await fetch(`${baseUrl}/api/live`);
      expect(liveRes.status).toBe(200);

      const readyRes = await fetch(`${baseUrl}/api/ready`);
      expect(readyRes.status).toBe(200);

      const healthRes = await fetch(`${baseUrl}/api/health`);
      expect(healthRes.status).toBe(200);
    });
  });
});
