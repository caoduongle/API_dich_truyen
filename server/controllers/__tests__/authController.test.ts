import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { authStore } from "../../services/authStore";
import {
  getAuthStatusHandler,
  loginHandler,
  logoutHandler,
} from "../authController";
import { authMiddleware } from "../../middleware/authMiddleware";

describe("Auth Module: authStore, authController, and authMiddleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let nextMock: NextFunction;
  let jsonMock: any;
  let statusMock: any;
  const originalEnv = process.env.ACCESS_PASSWORD;

  beforeEach(() => {
    authStore.clearAllForTesting();
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    nextMock = vi.fn();
    req = {
      body: {},
      headers: {},
      query: {},
      path: "/translate-raw",
    };
    res = {
      status: statusMock,
      json: jsonMock,
    };
  });

  afterEach(() => {
    process.env.ACCESS_PASSWORD = originalEnv;
  });

  describe("authStore", () => {
    it("should return isAuthRequired = false when ACCESS_PASSWORD is unset or empty", () => {
      delete process.env.ACCESS_PASSWORD;
      expect(authStore.isAuthRequired()).toBe(false);

      process.env.ACCESS_PASSWORD = "   ";
      expect(authStore.isAuthRequired()).toBe(false);
    });

    it("should return isAuthRequired = true when ACCESS_PASSWORD is set", () => {
      process.env.ACCESS_PASSWORD = "MySecretPassword123";
      expect(authStore.isAuthRequired()).toBe(true);
    });

    it("should validate correct password and reject incorrect password", () => {
      process.env.ACCESS_PASSWORD = "MySecretPassword123";
      expect(authStore.validatePassword("MySecretPassword123")).toBe(true);
      expect(authStore.validatePassword("wrongpassword")).toBe(false);
      expect(authStore.validatePassword("")).toBe(false);
    });

    it("should create, validate, and revoke auth tokens", async () => {
      process.env.ACCESS_PASSWORD = "MySecretPassword123";
      const { authToken, expiresAt } = await authStore.createAuthToken();
      expect(authToken).toBeDefined();
      expect(expiresAt).toBeDefined();

      const isValid = await authStore.validateAuthToken(authToken);
      expect(isValid).toBe(true);

      await authStore.revokeAuthToken(authToken);
      const isStillValid = await authStore.validateAuthToken(authToken);
      expect(isStillValid).toBe(false);
    });
  });

  describe("authController", () => {
    it("getAuthStatusHandler should report authRequired = false when no password is set", async () => {
      delete process.env.ACCESS_PASSWORD;
      await getAuthStatusHandler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ authRequired: false, authenticated: true });
    });

    it("getAuthStatusHandler should report authRequired = true and authenticated status", async () => {
      process.env.ACCESS_PASSWORD = "SecretPassword";
      const { authToken } = await authStore.createAuthToken();

      req.headers = { "x-auth-token": authToken };
      await getAuthStatusHandler(req as Request, res as Response);
      expect(jsonMock).toHaveBeenCalledWith({ authRequired: true, authenticated: true });

      req.headers = { "x-auth-token": "invalid-token" };
      await getAuthStatusHandler(req as Request, res as Response);
      expect(jsonMock).toHaveBeenCalledWith({ authRequired: true, authenticated: false });
    });

    it("loginHandler should reject incorrect password with 401", async () => {
      process.env.ACCESS_PASSWORD = "CorrectPassword";
      req.body = { password: "WrongPassword" };

      await loginHandler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("không chính xác") })
      );
    });

    it("loginHandler should grant authToken on correct password", async () => {
      process.env.ACCESS_PASSWORD = "CorrectPassword";
      req.body = { password: "CorrectPassword" };

      await loginHandler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          authToken: expect.any(String),
          expiresAt: expect.any(String),
        })
      );
    });

    it("logoutHandler should revoke token", async () => {
      process.env.ACCESS_PASSWORD = "CorrectPassword";
      const { authToken } = await authStore.createAuthToken();
      req.headers = { "x-auth-token": authToken };

      await logoutHandler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ success: true }));

      const isValid = await authStore.validateAuthToken(authToken);
      expect(isValid).toBe(false);
    });
  });

  describe("authMiddleware", () => {
    it("should call next() when auth is not required", async () => {
      delete process.env.ACCESS_PASSWORD;
      await authMiddleware(req as Request, res as Response, nextMock);
      expect(nextMock).toHaveBeenCalledTimes(1);
    });

    it("should allow all legitimate exact public routes in PUBLIC_API_PATHS without token", async () => {
      process.env.ACCESS_PASSWORD = "SecretPassword";
      const validPublicPaths = [
        "/auth/login",
        "/auth/status",
        "/health",
        "/api/auth/login",
        "/api/auth/status",
        "/api/health",
      ];

      for (let i = 0; i < validPublicPaths.length; i++) {
        const p = validPublicPaths[i];
        const loopNext = vi.fn();
        const loopReq = { path: p, headers: {}, body: {}, query: {} };
        await authMiddleware(loopReq as Request, res as Response, loopNext);
        expect(loopNext).toHaveBeenCalledTimes(1);
      }
    });

    /**
     * Context Engineering Principle #9: Test mục đích an toàn.
     * TẠI SAO hành vi này quan trọng:
     * Việc dùng so khớp hậu tố (endsWith) cho phép bất kỳ route mới nào trong tương lai
     * nếu có đuôi là /health, /auth/login hoặc /auth/status (ví dụ: /api/fake/health, /admin/auth/status)
     * bị bypass xác thực ngoài ý muốn, tạo lỗ hổng Path Confusion và vượt rào mật khẩu máy chủ.
     * Vì vậy, middleware bắt buộc PHẢI so khớp chính xác (exact match) với whitelist PUBLIC_API_PATHS.
     */
    it("should reject pseudo-public routes ending with /health, /auth/login, or /auth/status to prevent path confusion attacks (Principle #9)", async () => {
      process.env.ACCESS_PASSWORD = "SecretPassword";
      const spoofedRoutes = [
        "/api/fake/health",
        "/x/auth/login",
        "/something/auth/status",
        "/api/admin/health",
        "/service/v1/auth/login",
        "/api/nested/route/auth/status",
      ];

      for (const route of spoofedRoutes) {
        const loopNext = vi.fn();
        const loopJson = vi.fn();
        const loopStatus = vi.fn().mockReturnValue({ json: loopJson });
        const loopRes = { status: loopStatus, json: loopJson };
        const loopReq = { path: route, headers: {}, body: {}, query: {} };

        await authMiddleware(loopReq as Request, loopRes as unknown as Response, loopNext);

        expect(loopNext).not.toHaveBeenCalled();
        expect(loopStatus).toHaveBeenCalledWith(401);
        expect(loopJson).toHaveBeenCalledWith(
          expect.objectContaining({ authRequired: true })
        );
      }
    });

    it("should block protected route with 401 when no token is provided", async () => {
      process.env.ACCESS_PASSWORD = "SecretPassword";
      (req as any).path = "/translate-raw";
      await authMiddleware(req as Request, res as Response, nextMock);

      expect(nextMock).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ authRequired: true })
      );
    });

    it("should allow protected route when valid Bearer token is provided", async () => {
      process.env.ACCESS_PASSWORD = "SecretPassword";
      const { authToken } = await authStore.createAuthToken();
      (req as any).path = "/translate-raw";
      req.headers = { authorization: `Bearer ${authToken}` };

      await authMiddleware(req as Request, res as Response, nextMock);
      expect(nextMock).toHaveBeenCalledTimes(1);
    });
  });
});
