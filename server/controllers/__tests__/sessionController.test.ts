import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import {
  createSessionHandler,
  getSessionStatusHandler,
  deleteSessionHandler,
} from "../sessionController";
import { sessionStore } from "../../services/sessionStore";

const HASH_1 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const HASH_2 = "f2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2";
const HASH_3 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

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
    it("should reject non-array keyHashes with 400", async () => {
      req.body = { keyHashes: "invalid" };
      await createSessionHandler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("phải là một mảng") })
      );
    });

    it("should reject empty keyHashes array with 400", async () => {
      req.body = { keyHashes: [] };
      await createSessionHandler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("không được để trống") })
      );
    });

    it("should reject invalid hex hash entries with 400", async () => {
      req.body = { keyHashes: ["AIzaSyInvalidPlaintext", "not_a_valid_hash"] };
      await createSessionHandler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("không hợp lệ") })
      );
    });

    it("should reject exceeding MAX_API_KEYS_PER_REQUEST with 400", async () => {
      req.body = { keyHashes: Array(25).fill(HASH_1) };
      await createSessionHandler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("Quá nhiều mã băm API key") })
      );
    });

    it("should create session successfully and return sessionToken and keyCount", async () => {
      req.body = { keyHashes: [HASH_1, HASH_2, `  ${HASH_3}  `] };
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
      const storedHashes = await sessionStore.getSessionKeyHashes(token);
      expect(storedHashes).toEqual([HASH_1, HASH_2, HASH_3]);
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
      const session = await sessionStore.createSession([HASH_1, HASH_2]);
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
      const session = await sessionStore.createSession([HASH_1]);
      req.headers = { "x-session-token": session.sessionToken };

      await deleteSessionHandler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );

      const keysAfter = await sessionStore.getSessionKeyHashes(session.sessionToken);
      expect(keysAfter).toBeNull();
    });
  });

  describe("getActiveSessionCount", () => {
    it("should count active sessions accurately in memory mode", async () => {
      expect(await sessionStore.getActiveSessionCount()).toBe(0);
      await sessionStore.createSession([HASH_1]);
      await sessionStore.createSession([HASH_2, HASH_3]);
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
