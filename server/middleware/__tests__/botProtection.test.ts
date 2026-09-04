import { describe, it, expect, vi } from "vitest";
import { createBotProtection } from "../botProtection";
import { Request, Response, NextFunction } from "express";

describe("Bot Protection Middleware", () => {
  const botProtection = createBotProtection({
    honeypotField: "hp_username",
    minSubmissionTimeMs: 500,
  });

  it("should allow regular requests without honeypot to pass", () => {
    const req = {
      body: { password: "SecretPassword123" },
    } as Request;

    const res = {
      status: vi.fn().mockReturnValue({ json: vi.fn() }),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    botProtection(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should allow requests with empty honeypot string to pass and delete field", () => {
    const req = {
      body: { password: "SecretPassword123", hp_username: "" },
    } as Request;

    const res = {
      status: vi.fn().mockReturnValue({ json: vi.fn() }),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    botProtection(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body.hp_username).toBeUndefined();
  });

  it("should reject bot requests with non-empty honeypot field", () => {
    const req = {
      body: { password: "SecretPassword123", hp_username: "bot_spammer_val" },
    } as Request;

    const jsonMock = vi.fn();
    const res = {
      status: vi.fn().mockReturnValue({ json: jsonMock }),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    botProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "BOT_DETECTED",
      })
    );
  });

  it("should reject submissions that are too fast (< minSubmissionTimeMs)", () => {
    const now = Date.now();
    const req = {
      body: { password: "SecretPassword123", hp_time: now - 100 }, // only 100ms elapsed
    } as Request;

    const jsonMock = vi.fn();
    const res = {
      status: vi.fn().mockReturnValue({ json: jsonMock }),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    botProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "SUBMISSION_TOO_FAST",
      })
    );
  });

  it("should allow submissions with acceptable elapsed time (> minSubmissionTimeMs)", () => {
    const now = Date.now();
    const req = {
      body: { password: "SecretPassword123", hp_time: now - 1000 }, // 1000ms elapsed
    } as Request;

    const res = {
      status: vi.fn().mockReturnValue({ json: vi.fn() }),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    botProtection(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body.hp_time).toBeUndefined();
  });
});
