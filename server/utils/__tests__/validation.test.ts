import { describe, it, expect } from "vitest";
import {
  APPSEC_VALIDATION,
  isValidSafeIdentifier,
  isValidSessionToken,
  isValidEmail,
} from "../validation";

describe("APPSEC_VALIDATION Rules & Helpers Suite (Feature 088)", () => {
  describe("UUID Validation", () => {
    it("should accept valid standard UUIDv4 strings", () => {
      const validUuid = "123e4567-e89b-12d3-a456-426614174000";
      expect(APPSEC_VALIDATION.UUID_REGEX.test(validUuid)).toBe(true);
    });

    it("should reject malicious strings attempting SQL or script injection in UUID fields", () => {
      expect(APPSEC_VALIDATION.UUID_REGEX.test("123e4567' OR '1'='1")).toBe(false);
      expect(APPSEC_VALIDATION.UUID_REGEX.test("<script>alert(1)</script>")).toBe(false);
      expect(APPSEC_VALIDATION.UUID_REGEX.test("../../../../etc/passwd")).toBe(false);
    });
  });

  describe("Safe Identifier Validation", () => {
    it("should accept alphanumeric, underscore and dash identifiers up to 64 chars", () => {
      expect(isValidSafeIdentifier("proj_12345")).toBe(true);
      expect(isValidSafeIdentifier("chapter-001")).toBe(true);
      expect(isValidSafeIdentifier("novel_master_2026")).toBe(true);
    });

    it("should reject glob wildcards and injection characters", () => {
      expect(isValidSafeIdentifier("*")).toBe(false);
      expect(isValidSafeIdentifier("proj_*")).toBe(false);
      expect(isValidSafeIdentifier("proj?1")).toBe(false);
      expect(isValidSafeIdentifier("proj[1-2]")).toBe(false);
      expect(isValidSafeIdentifier("proj\r\nSET x 1")).toBe(false);
      expect(isValidSafeIdentifier("")).toBe(false);
      expect(isValidSafeIdentifier(null)).toBe(false);
      expect(isValidSafeIdentifier("a".repeat(65))).toBe(false);
    });
  });

  describe("Session Token Validation", () => {
    it("should accept valid session token with UUID suffix", () => {
      const validToken = "session_123e4567-e89b-12d3-a456-426614174000";
      expect(isValidSessionToken(validToken)).toBe(true);
    });

    it("should reject malformed or injected session tokens", () => {
      expect(isValidSessionToken("session_*")).toBe(false);
      expect(isValidSessionToken("session_123' OR '1'='1")).toBe(false);
      expect(isValidSessionToken("token_123e4567-e89b-12d3-a456-426614174000")).toBe(false);
      expect(isValidSessionToken("")).toBe(false);
    });
  });

  describe("Email Validation", () => {
    it("should accept standard email addresses", () => {
      expect(isValidEmail("editor@example.com")).toBe(true);
      expect(isValidEmail("user.name+tag@sub.domain.org")).toBe(true);
    });

    it("should reject invalid emails and injection payloads", () => {
      expect(isValidEmail("not-an-email")).toBe(false);
      expect(isValidEmail("editor@.com")).toBe(false);
      expect(isValidEmail("@example.com")).toBe(false);
      expect(isValidEmail("user\r\nCc: victim@evil.com")).toBe(false);
    });
  });
});
