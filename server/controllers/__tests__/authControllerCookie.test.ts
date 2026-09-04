import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loginHandler, logoutHandler, getAuthStatusHandler } from "../authController";
import { authMiddleware } from "../../middleware/authMiddleware";
import { authStore } from "../../services/authStore";
import { Request, Response, NextFunction } from "express";

describe("Auth Controller & Middleware Cookie Support", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ACCESS_PASSWORD: "CorrectPassword123" };
  });

  afterEach(async () => {
    process.env = originalEnv;
    authStore.stopCleanup();
  });

  it("should set HttpOnly, SameSite=Strict cookie upon successful login", async () => {
    const req = {
      body: { password: "CorrectPassword123" },
    } as Request;

    const cookieMock = vi.fn();
    const jsonMock = vi.fn();
    const res = {
      cookie: cookieMock,
      status: vi.fn().mockReturnValue({ json: jsonMock }),
    } as unknown as Response;

    await loginHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(cookieMock).toHaveBeenCalledWith(
      "auth_token",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "strict",
        path: "/",
      })
    );
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        authToken: expect.any(String),
      })
    );
  });

  it("should verify authentication via cookie in getAuthStatusHandler", async () => {
    const { authToken } = await authStore.createAuthToken();

    const req = {
      headers: {
        cookie: `unrelated=123; auth_token=${authToken}; other=abc`,
      },
    } as unknown as Request;

    const jsonMock = vi.fn();
    const res = {
      status: vi.fn().mockReturnValue({ json: jsonMock }),
    } as unknown as Response;

    await getAuthStatusHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      authRequired: true,
      authenticated: true,
    });
  });

  it("should authenticate via cookie in authMiddleware and pass request through", async () => {
    const { authToken } = await authStore.createAuthToken();

    const req = {
      path: "/api/translate-raw",
      headers: {
        cookie: `auth_token=${authToken}`,
      },
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnValue({ json: vi.fn() }),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should clear cookie and revoke token upon logout", async () => {
    const { authToken } = await authStore.createAuthToken();

    const req = {
      headers: {
        cookie: `auth_token=${authToken}`,
      },
    } as unknown as Request;

    const clearCookieMock = vi.fn();
    const jsonMock = vi.fn();
    const res = {
      clearCookie: clearCookieMock,
      status: vi.fn().mockReturnValue({ json: jsonMock }),
    } as unknown as Response;

    await logoutHandler(req, res);

    expect(clearCookieMock).toHaveBeenCalledWith("auth_token", { path: "/" });
    expect(res.status).toHaveBeenCalledWith(200);

    const isValid = await authStore.validateAuthToken(authToken);
    expect(isValid).toBe(false);
  });
});
