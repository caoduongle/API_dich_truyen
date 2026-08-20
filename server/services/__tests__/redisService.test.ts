import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { redisManager } from "../redisService";
import { authStore } from "../authStore";
import { sessionStore } from "../sessionStore";

let mockEventHandlers: Record<string, Function[]> = {};
let mockQuit = vi.fn();

vi.mock("ioredis", () => {
  return {
    default: class MockRedis {
      eval = vi.fn();
      quit = mockQuit;
      disconnect = vi.fn();
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

describe("Shared Redis Connection Manager (redisManager)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockEventHandlers = {};
    redisManager.resetForTesting();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    redisManager.resetForTesting();
  });

  describe("User Story 1: Connection Singleton & Store Reuse", () => {
    it("should return null when REDIS_URL is not set", () => {
      delete process.env.REDIS_URL;
      const client = redisManager.getClient();
      expect(client).toBeNull();
      expect(redisManager.getStatus()).toBe("disconnected");
    });

    it("should return the exact same singleton instance across multiple getClient calls", () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const client1 = redisManager.getClient();
      const client2 = redisManager.getClient();

      expect(client1).not.toBeNull();
      expect(client1).toBe(client2);
    });

    it("should share the exact same Redis instance between authStore and sessionStore", () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      const sharedClient = redisManager.getClient();

      const authClient = (authStore as any).redisClient;
      const sessionClient = (sessionStore as any).redisClient;

      expect(authClient).toBe(sharedClient);
      expect(sessionClient).toBe(sharedClient);
    });

    it("should broadcast status changes to registered listeners on connection error", () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      redisManager.getClient();

      const statusListener = vi.fn();
      const unsubscribe = redisManager.onStatusChange(statusListener);

      // Trigger error event
      const errorHandlers = mockEventHandlers["error"] || [];
      for (const h of errorHandlers) {
        h(new Error("Connection reset by peer"));
      }

      expect(redisManager.getStatus()).toBe("degraded");
      expect(statusListener).toHaveBeenCalledWith("degraded");

      unsubscribe();
    });

    it("should broadcast connected status when ready event fires", () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      redisManager.getClient();

      const statusListener = vi.fn();
      redisManager.onStatusChange(statusListener);

      // Trigger ready event
      const readyHandlers = mockEventHandlers["ready"] || [];
      for (const h of readyHandlers) {
        h();
      }

      expect(redisManager.getStatus()).toBe("connected");
      expect(statusListener).toHaveBeenCalledWith("connected");
    });
  });

  describe("User Story 2: Graceful Shutdown", () => {
    it("should cleanly quit client and transition status to closed upon close()", async () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      redisManager.getClient();

      mockQuit.mockResolvedValue("OK");

      await redisManager.close();

      expect(mockQuit).toHaveBeenCalledTimes(1);
      expect(redisManager.getStatus()).toBe("closed");
    });
  });

  describe("User Story 3: Test Isolation & Mocking Support", () => {
    it("should allow injecting mock Redis client via setMockClient", () => {
      const customMock = { ping: vi.fn(), quit: vi.fn() } as any;
      redisManager.setMockClient(customMock);

      expect(redisManager.getClient()).toBe(customMock);
      expect(redisManager.getStatus()).toBe("connected");
    });

    it("should reset mock state and listeners upon resetForTesting()", () => {
      const customMock = { ping: vi.fn() } as any;
      redisManager.setMockClient(customMock);
      expect(redisManager.getClient()).toBe(customMock);

      redisManager.resetForTesting();
      delete process.env.REDIS_URL;
      expect(redisManager.getClient()).toBeNull();
      expect(redisManager.getStatus()).toBe("disconnected");
    });
  });
});
