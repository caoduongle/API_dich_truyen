import crypto from "crypto";

export const TEST_MASTER_KEY = "test_super_secret_encryption_master_key_123456";
export const TEST_API_KEYS = [
  "AIzaSyDemoKey1111111111111111111111111",
  "AIzaSyDemoKey2222222222222222222222222",
];

export function createTamperedEncryptedPayload(validPayload: string): string {
  const parts = validPayload.split(":");
  if (parts.length === 5 && parts[0] === "enc" && parts[1] === "v1") {
    const cipherHex = parts[4];
    const tamperedCiphertext = cipherHex.slice(0, -2) + (cipherHex.slice(-2) === "00" ? "ff" : "00");
    return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:${tamperedCiphertext}`;
  }
  if (parts.length === 3) {
    const tamperedCiphertext = parts[2].slice(0, -2) + (parts[2].slice(-2) === "00" ? "ff" : "00");
    return `${parts[0]}:${parts[1]}:${tamperedCiphertext}`;
  }
  return "invalid:tampered:payload";
}
