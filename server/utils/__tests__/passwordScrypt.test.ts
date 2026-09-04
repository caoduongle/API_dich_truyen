import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, isPasswordHashed } from "../password";

describe("passwordScrypt Utility", () => {
  const plainPassword = "SuperSecretPassword123!@#";

  it("should hash password with scrypt and generate valid format", () => {
    const hashed = hashPassword(plainPassword);
    expect(hashed).toMatch(/^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(isPasswordHashed(hashed)).toBe(true);
  });

  it("should produce different hashes for identical passwords due to random salt", () => {
    const hash1 = hashPassword(plainPassword);
    const hash2 = hashPassword(plainPassword);
    expect(hash1).not.toBe(hash2);
    expect(verifyPassword(plainPassword, hash1)).toBe(true);
    expect(verifyPassword(plainPassword, hash2)).toBe(true);
  });

  it("should verify correct password against scrypt hash", () => {
    const hashed = hashPassword(plainPassword);
    expect(verifyPassword(plainPassword, hashed)).toBe(true);
    expect(verifyPassword("WrongPassword", hashed)).toBe(false);
    expect(verifyPassword("", hashed)).toBe(false);
  });

  it("should verify correct password against plain env password via timing-safe SHA256", () => {
    const envPassword = "MyServerAccessPassword2026";
    expect(verifyPassword(envPassword, envPassword)).toBe(true);
    expect(verifyPassword("WrongPassword", envPassword)).toBe(false);
  });

  it("should correctly identify non-hashed strings", () => {
    expect(isPasswordHashed("plainTextPassword")).toBe(false);
    expect(isPasswordHashed("sha256$something")).toBe(false);
    expect(isPasswordHashed("")).toBe(false);
  });

  it("should throw error when hashing empty or invalid input", () => {
    expect(() => hashPassword("")).toThrow();
    expect(() => hashPassword(null as any)).toThrow();
  });
});
