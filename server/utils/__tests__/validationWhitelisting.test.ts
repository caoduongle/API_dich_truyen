import { describe, it, expect } from "vitest";
import {
  validateTranslateRawBody,
  validatePolishBody,
  validateLoginBody,
  validateSessionKeysBody,
  pickAllowedFields,
} from "../validation";

describe("Input Validation & DTO Whitelisting (Anti-Mass-Assignment)", () => {
  it("should strip injected fields and return only whitelisted fields for translate-raw", () => {
    const maliciousBody = {
      text: "Xin chào thế giới",
      glossary: [{ chinese: "世界", vietnamese: "thế giới" }],
      startKeyIndex: 0,
      model: "gemini-2.5-flash",
      role: "admin",                // INJECTED FIELD
      isOwner: true,                // INJECTED FIELD
      __proto__: { isAdmin: true }, // PROTOTYPE POLLUTION ATTEMPT
      extraConfig: { bypass: true },// INJECTED FIELD
    };

    const result = validateTranslateRawBody(maliciousBody);
    expect(result.valid).toBe(true);
    expect(result.data).toBeDefined();

    // Whitelisted fields present
    expect(result.data?.text).toBe("Xin chào thế giới");
    expect(result.data?.glossary).toHaveLength(1);
    expect(result.data?.startKeyIndex).toBe(0);
    expect(result.data?.model).toBe("gemini-2.5-flash");

    // Injected fields stripped
    expect((result.data as any).role).toBeUndefined();
    expect((result.data as any).isOwner).toBeUndefined();
    expect((result.data as any).extraConfig).toBeUndefined();
  });

  it("should strip injected fields from login body", () => {
    const maliciousBody = {
      password: "secret_password",
      role: "superadmin",
      isAdmin: true,
    };

    const result = validateLoginBody(maliciousBody);
    expect(result.valid).toBe(true);
    expect(result.data?.password).toBe("secret_password");
    expect((result.data as any).role).toBeUndefined();
    expect((result.data as any).isAdmin).toBeUndefined();
  });

  it("should strip injected fields from polish body", () => {
    const maliciousBody = {
      rawTranslation: "Bản dịch thô ban đầu",
      privilege: "escalated",
      model: "gemini-2.5-flash",
    };

    const result = validatePolishBody(maliciousBody);
    expect(result.valid).toBe(true);
    expect(result.data?.rawTranslation).toBe("Bản dịch thô ban đầu");
    expect((result.data as any).privilege).toBeUndefined();
  });

  it("should reject invalid session keys and sanitize valid keys", () => {
    const validHash = "a".repeat(64);
    const body = {
      keyHashes: [validHash, "B".repeat(64)],
      injectedField: "bad",
    };

    const result = validateSessionKeysBody(body);
    expect(result.valid).toBe(true);
    expect(result.data?.keyHashes).toHaveLength(2);
    expect(result.data?.keyHashes[1]).toBe("b".repeat(64)); // Lowercased & sanitized
    expect((result.data as any).injectedField).toBeUndefined();
  });

  it("should pick only allowed fields using pickAllowedFields helper", () => {
    interface AllowedUser {
      name: string;
      email: string;
    }

    const raw = {
      name: "Alice",
      email: "alice@example.com",
      role: "admin",
      passwordHash: "hash123",
    };

    const picked = pickAllowedFields<AllowedUser>(raw, ["name", "email"]);
    expect(picked).toEqual({
      name: "Alice",
      email: "alice@example.com",
    });
    expect((picked as any).role).toBeUndefined();
    expect((picked as any).passwordHash).toBeUndefined();
  });
});
