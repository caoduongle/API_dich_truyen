import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import {
  createSessionHandler,
  getSessionStatusHandler,
  deleteSessionHandler,
} from "../sessionController";
import { sessionStore } from "../../services/sessionStore";

describe("Session Controller & Session Store", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: any;
  let statusMock: any;

  beforeEach(() => {
    sessionStore.clearAllForTesting();
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    req = {
      body: {},
      headers: {},
      query: {},
    };
    res = {
      status: statusMock,
      json: jsonMock,
    };
  });

  describe("createSessionHandler", () => {
    it("should reject non-array apiKeys with 400", async () => {
      req.body = { apiKeys: "invalid" };
      await createSessionHandler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("phải là một mảng") })
      );
    });

    it("should reject empty apiKeys array with 400", async () => {
      req.body = { apiKeys: [] };
      await createSessionHandler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("không được để trống") })
      );
    });

    it("should reject blank apiKeys entries with 400", async () => {
      req.body = { apiKeys: ["", "   "] };
      await createSessionHandler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("không hợp lệ") })
      );
    });

    it("should reject exceeding MAX_API_KEYS_PER_REQUEST with 400", async () => {
      req.body = { apiKeys: Array(25).fill("AIzaSyTestKey") };
      await createSessionHandler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("Quá nhiều API key") })
      );
    });

    it("should create session successfully and return sessionToken and keyCount", async () => {
      req.body = { apiKeys: ["AIzaSyKey1", "AIzaSyKey2", "  AIzaSyKey3  "] };
      await createSessionHandler(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionToken: expect.any(String),
          keyCount: 3,
          expiresAt: expect.any(String),
        })
      );

      const token = jsonMock.mock.calls[0][0].sessionToken;
      const storedKeys = await sessionStore.getSessionKeys(token);
      expect(storedKeys).toEqual(["AIzaSyKey1", "AIzaSyKey2", "AIzaSyKey3"]);
    });
  });

  describe("getSessionStatusHandler", () => {
    it("should reject query token parameter with 400 Bad Request", async () => {
      req.query = { token: "secret-token-in-url" };
      await getSessionStatusHandler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "DISALLOWED_URL_CREDENTIALS",
        })
      );
    });

    it("should return valid: false when no token provided", async () => {
      await getSessionStatusHandler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ valid: false, keyCount: 0 });
    });

    it("should return valid: false for non-existent token", async () => {
      req.headers = { "x-session-token": "non-existent-token" };
      await getSessionStatusHandler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ valid: false, keyCount: 0 });
    });

    it("should return valid: true and keyCount for active token", async () => {
      const session = await sessionStore.createSession(["KeyA", "KeyB"]);
      req.headers = { "x-session-token": session.sessionToken };

      await getSessionStatusHandler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          valid: true,
          keyCount: 2,
        })
      );
    });
  });

  describe("deleteSessionHandler", () => {
    it("should reject query token parameter with 400 Bad Request", async () => {
      req.query = { token: "secret-token-in-url" };
      await deleteSessionHandler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "DISALLOWED_URL_CREDENTIALS",
        })
      );
    });

    it("should return 401 Unauthorized when no token is provided", async () => {
      await deleteSessionHandler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "MISSING_SESSION_TOKEN",
        })
      );
    });

    it("should delete existing session with header token", async () => {
      const session = await sessionStore.createSession(["KeyA"]);
      req.headers = { "x-session-token": session.sessionToken };

      await deleteSessionHandler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );

      const keysAfter = await sessionStore.getSessionKeys(session.sessionToken);
      expect(keysAfter).toBeNull();
    });
  });

  describe("getActiveSessionCount", () => {
    it("should count active sessions accurately in memory mode", async () => {
      expect(await sessionStore.getActiveSessionCount()).toBe(0);
      await sessionStore.createSession(["KeyA"]);
      await sessionStore.createSession(["KeyB", "KeyC"]);
      expect(await sessionStore.getActiveSessionCount()).toBe(2);
    });

    it("should count active sessions via Redis scan when redisClient is present", async () => {
      const mockScan = vi.fn()
        .mockResolvedValueOnce(["10", ["session_keys:token1", "session_keys:token2"]])
        .mockResolvedValueOnce(["0", ["session_keys:token3"]]);

      (sessionStore as any).redisClient = {
        scan: mockScan,
      };

      const count = await sessionStore.getActiveSessionCount();
      expect(count).toBe(3);
      expect(mockScan).toHaveBeenCalledWith("0", "MATCH", "session_keys:*", "COUNT", 100);
      expect(mockScan).toHaveBeenCalledWith("10", "MATCH", "session_keys:*", "COUNT", 100);

      (sessionStore as any).redisClient = null;
    });
  });
});

