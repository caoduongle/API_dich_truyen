import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sanitizeSecretString, sanitizeValue } from "../logger";

describe("Logger Secret Redaction Suite (Tiêu chuẩn 1 & 17)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should redact Google Gemini API keys", () => {
    const raw = "Error calling API with key AIzaSyD3xAmP1eKey9876543210AbCdEfGhIjKlMnOp";
    const sanitized = sanitizeSecretString(raw);
    expect(sanitized).not.toContain("AIzaSyD3xAmP1eKey9876543210AbCdEfGhIjKlMnOp");
    expect(sanitized).toContain("AIza***[REDACTED]");
  });

  it("should redact OpenAI and Anthropic API keys", () => {
    const rawOpenAI = "Using key sk-1234567890abcdef1234567890abcdef";
    const rawAnthropic = "Using key sk-ant-api03-abcdef1234567890abcdef1234567890";

    expect(sanitizeSecretString(rawOpenAI)).toContain("sk-***[REDACTED]");
    expect(sanitizeSecretString(rawAnthropic)).toContain("sk-ant-***[REDACTED]");
  });

  it("should redact Bearer authorization tokens", () => {
    const raw = "Authorization: Bearer ya29.a0AfH6SMD_test_token_123456";
    expect(sanitizeSecretString(raw)).toBe("Authorization: Bearer [REDACTED]");
  });

  it("should redact database connection strings containing passwords", () => {
    const raw = "Connecting to postgresql://admin:SuperSecretPass123@db.supabase.co:5432/main";
    expect(sanitizeSecretString(raw)).toBe("Connecting to postgresql://admin:***[REDACTED]@db.supabase.co:5432/main");
  });

  it("should redact auth_token in cookies", () => {
    const raw = "Cookie: session=xyz; auth_token=1234567890abcdef; theme=dark";
    expect(sanitizeSecretString(raw)).toBe("Cookie: session=xyz; auth_token=***[REDACTED]; theme=dark");
  });

  it("should sanitize Error objects and strip stack trace in production", () => {
    process.env.NODE_ENV = "production";
    const err = new Error("Failed to connect with AIzaSyD3xAmP1eKey9876543210AbCdEfGhIjKlMnOp");
    const sanitizedObj = sanitizeValue(err);

    expect(sanitizedObj.message).toContain("AIza***[REDACTED]");
    expect(sanitizedObj.stack).toBeUndefined(); // Stripped in production
  });

  it("should preserve sanitized stack trace in development", () => {
    process.env.NODE_ENV = "development";
    const err = new Error("Dev error");
    const sanitizedObj = sanitizeValue(err);

    expect(sanitizedObj.message).toBe("Dev error");
    expect(sanitizedObj.stack).toBeDefined();
  });
});
