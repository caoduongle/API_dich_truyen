import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { httpsRedirect } from "../httpsRedirect";
import { Request, Response, NextFunction } from "express";

describe("httpsRedirect Middleware", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should do nothing and call next() when not in production", () => {
    process.env.NODE_ENV = "development";
    const req = {
      headers: { "x-forwarded-proto": "http", host: "localhost:3000" },
      secure: false,
      originalUrl: "/api/translate-raw",
    } as unknown as Request;

    const res = {
      redirect: vi.fn(),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    httpsRedirect(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it("should redirect with 301 to https when in production and proto is http", () => {
    process.env.NODE_ENV = "production";
    const req = {
      headers: { "x-forwarded-proto": "http", host: "dichtruyen.ai" },
      secure: false,
      originalUrl: "/api/translate-raw?foo=bar",
    } as unknown as Request;

    const res = {
      redirect: vi.fn(),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    httpsRedirect(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(301, "https://dichtruyen.ai/api/translate-raw?foo=bar");
  });

  it("should allow request through if already https", () => {
    process.env.NODE_ENV = "production";
    const req = {
      headers: { "x-forwarded-proto": "https", host: "dichtruyen.ai" },
      secure: true,
      originalUrl: "/api/auth/status",
    } as unknown as Request;

    const res = {
      redirect: vi.fn(),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    httpsRedirect(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it("should bypass health and liveness probe endpoints even over http in production", () => {
    process.env.NODE_ENV = "production";
    for (const path of ["/health", "/live", "/ready"]) {
      const req = {
        headers: { "x-forwarded-proto": "http", host: "localhost:3000" },
        secure: false,
        path,
        originalUrl: path,
      } as unknown as Request;

      const res = {
        redirect: vi.fn(),
      } as unknown as Response;

      const next = vi.fn() as NextFunction;

      httpsRedirect(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.redirect).not.toHaveBeenCalled();
    }
  });
});
