import crypto from "crypto";
import type Redis from "ioredis";
import { redisManager } from "./redisService";

export interface SessionData {
  encryptedKeys: string;
  createdAt: number;
  lastAccessedAt: number;
  expiresAt: number;
}

export interface SessionInfo {
  valid: boolean;
  keyCount: number;
  expiresAt?: string;
}

export interface DecryptedKeysResult {
  keys: string[];
  isMigrated: boolean;
  sourceFormat: 'v1_gcm' | 'v0_gcm' | 'legacy_plaintext';
}

export class SessionDecryptionError extends Error {
  readonly isDecryptionError = true;
  constructor(message: string = 'Không thể giải mã dữ liệu khóa phiên: tính toàn vẹn bị vi phạm hoặc sai khóa bảo mật.') {
    super(message);
    this.name = 'SessionDecryptionError';
  }
}

export const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ
const SESSION_PREFIX = "session_keys:";
const ENCRYPTION_SALT = "api_dich_truyen_session_salt_2026";

/**
 * Lấy khóa mã hóa 32 bytes từ biến môi trường ENCRYPTION_MASTER_KEY hoặc SESSION_SECRET
 */
export function getEncryptionKey(overrideSecret?: string): Buffer {
  const rawMaster = overrideSecret || process.env.ENCRYPTION_MASTER_KEY || process.env.SESSION_SECRET || "default_dev_master_key_for_session_encryption_only";
  return crypto.scryptSync(rawMaster, ENCRYPTION_SALT, 32);
}

/**
 * Mã hóa danh sách API keys thành chuỗi định dạng AES-256-GCM v1: enc:v1:iv_hex:authTag_hex:ciphertext_hex
 */
export function encryptApiKeys(apiKeys: string[], masterKeyBuffer?: Buffer): string {
  const iv = crypto.randomBytes(12); // 12 bytes IV chuẩn cho GCM
  const key = masterKeyBuffer || getEncryptionKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const cleanKeys = Array.isArray(apiKeys)
    ? apiKeys.map((k) => (typeof k === "string" ? k.trim() : "")).filter(Boolean)
    : [];
  const plaintext = JSON.stringify(cleanKeys);
  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `enc:v1:${iv.toString("hex")}:${authTag}:${ciphertext}`;
}

/**
 * Giải mã chuỗi phong bì bản mã thành danh sách API keys kèm cờ trạng thái di trú
 */
export function decryptApiKeysWithStatus(
  encryptedPayload: string,
  masterKeyBuffer?: Buffer
): DecryptedKeysResult {
  if (!encryptedPayload || typeof encryptedPayload !== "string") {
    return { keys: [], isMigrated: false, sourceFormat: 'v1_gcm' };
  }

  const trimmed = encryptedPayload.trim();

  // Định dạng chuẩn v1: enc:v1:<iv>:<authTag>:<ciphertext>
  if (trimmed.startsWith("enc:v1:")) {
    const parts = trimmed.split(":");
    if (parts.length !== 5) {
      throw new SessionDecryptionError("Dữ liệu khóa phiên bị sai định dạng phong bì bản mã v1.");
    }
    const [, , ivHex, authTagHex, ciphertextHex] = parts;
    try {
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");
      const key = masterKeyBuffer || getEncryptionKey();
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
      decrypted += decipher.final("utf8");
      const parsed = JSON.parse(decrypted);
      return {
        keys: Array.isArray(parsed) ? parsed : [],
        isMigrated: false,
        sourceFormat: 'v1_gcm',
      };
    } catch (err: any) {
      throw new SessionDecryptionError();
    }
  }

  // Định dạng v0 cũ: <iv>:<authTag>:<ciphertext> (không có tiền tố enc:v1:)
  const v0Parts = trimmed.split(":");
  if (v0Parts.length === 3 && v0Parts[0].length === 24 && v0Parts[1].length === 32) {
    const [ivHex, authTagHex, ciphertextHex] = v0Parts;
    try {
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");
      const key = masterKeyBuffer || getEncryptionKey();
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
      decrypted += decipher.final("utf8");
      const parsed = JSON.parse(decrypted);
      return {
        keys: Array.isArray(parsed) ? parsed : [],
        isMigrated: true,
        sourceFormat: 'v0_gcm',
      };
    } catch (err: any) {
      throw new SessionDecryptionError();
    }
  }

  // Định dạng legacy plaintext (mảng JSON thuần hoặc chuỗi key trực tiếp)
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return {
        keys: parsed.map((k) => String(k).trim()).filter(Boolean),
        isMigrated: true,
        sourceFormat: 'legacy_plaintext',
      };
    }
  } catch {}

  if (trimmed.startsWith("AIzaSy") || trimmed.includes("AIza")) {
    return {
      keys: [trimmed],
      isMigrated: true,
      sourceFormat: 'legacy_plaintext',
    };
  }

  throw new SessionDecryptionError("Dữ liệu khóa phiên không nhận dạng được hoặc bị can thiệp trái phép.");
}

/**
 * Giải mã chuỗi AES-256-GCM thành danh sách API keys
 */
export function decryptApiKeys(
  encryptedPayload: string,
  masterKeyBuffer?: Buffer
): string[] {
  return decryptApiKeysWithStatus(encryptedPayload, masterKeyBuffer).keys;
}

class SessionStore {
  private memorySessions = new Map<string, SessionData>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private _customRedisClient: Redis | null = null;

  private get redisClient(): Redis | null {
    return this._customRedisClient ?? redisManager.getClient();
  }

  private set redisClient(client: Redis | null) {
    this._customRedisClient = client;
  }

  constructor() {
    // In-memory cleanup interval
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [token, data] of this.memorySessions) {
        if (now > data.expiresAt) {
          this.memorySessions.delete(token);
        }
      }
    }, 10 * 60 * 1000);

    if (this.cleanupInterval && typeof this.cleanupInterval.unref === "function") {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Dừng timer dọn dẹp bộ nhớ định kỳ (dùng khi shutdown máy chủ hoặc teardown tests)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Đếm số lượng session đang hoạt động
   */
  async getActiveSessionCount(): Promise<number> {
    if (this.redisClient) {
      try {
        let cursor = "0";
        let count = 0;
        do {
          const [nextCursor, keys] = await this.redisClient.scan(
            cursor,
            "MATCH",
            `${SESSION_PREFIX}*`,
            "COUNT",
            100
          );
          cursor = nextCursor;
          count += keys.length;
        } while (cursor !== "0");
        return count;
      } catch (_) {
        return 0;
      }
    }
    const now = Date.now();
    let count = 0;
    for (const [, data] of this.memorySessions) {
      if (now <= data.expiresAt) {
        count++;
      }
    }
    return count;
  }

  /**
   * Tạo phiên làm việc mới lưu danh sách API keys đã mã hóa v1 và trả về session token.
   */
  async createSession(
    apiKeys: string[],
    ttlMs: number = DEFAULT_SESSION_TTL_MS
  ): Promise<{ sessionToken: string; keyCount: number; expiresAt: string }> {
    const sessionToken = `session_${crypto.randomUUID()}`;
    const cleanKeys = Array.isArray(apiKeys)
      ? apiKeys.map((k) => (typeof k === "string" ? k.trim() : "")).filter(Boolean)
      : [];

    const now = Date.now();
    const expiresAt = now + ttlMs;

    const encryptedKeys = encryptApiKeys(cleanKeys);
    const sessionData: SessionData = {
      encryptedKeys,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt,
    };

    if (this.redisClient) {
      try {
        await this.redisClient.set(
          `${SESSION_PREFIX}${sessionToken}`,
          JSON.stringify(sessionData),
          "PX",
          ttlMs
        );
      } catch (err) {
        console.error("[SessionStore] Error saving session to Redis, fallback to memory:", err);
        this.memorySessions.set(sessionToken, sessionData);
      }
    } else {
      this.memorySessions.set(sessionToken, sessionData);
    }

    return {
      sessionToken,
      keyCount: cleanKeys.length,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  /**
   * Lấy danh sách API keys từ session token, tự động di trú định dạng cũ và gia hạn thời gian sống.
   */
  async getSessionKeys(sessionToken: string, slidingWindowMs: number = DEFAULT_SESSION_TTL_MS): Promise<string[] | null> {
    if (!sessionToken || typeof sessionToken !== "string") {
      return null;
    }

    const now = Date.now();

    if (this.redisClient) {
      try {
        const raw = await this.redisClient.get(`${SESSION_PREFIX}${sessionToken}`);
        if (!raw) return null;

        let data: SessionData;
        try {
          data = JSON.parse(raw);
        } catch {
          data = {
            encryptedKeys: raw,
            createdAt: now,
            lastAccessedAt: now,
            expiresAt: now + slidingWindowMs,
          };
        }

        const { keys, isMigrated } = decryptApiKeysWithStatus(data.encryptedKeys);
        data.lastAccessedAt = now;
        data.expiresAt = now + slidingWindowMs;

        // Nếu phát hiện định dạng cũ -> tự động nâng cấp sang enc:v1: và lưu đè vào Redis
        if (isMigrated) {
          data.encryptedKeys = encryptApiKeys(keys);
        }

        await this.redisClient.set(
          `${SESSION_PREFIX}${sessionToken}`,
          JSON.stringify(data),
          "PX",
          slidingWindowMs
        );

        return keys;
      } catch (err) {
        console.error("[SessionStore] Redis get/decryption error, checking memory:", err);
      }
    }

    const data = this.memorySessions.get(sessionToken);
    if (!data) return null;

    if (now > data.expiresAt) {
      this.memorySessions.delete(sessionToken);
      return null;
    }

    try {
      const { keys, isMigrated } = decryptApiKeysWithStatus(data.encryptedKeys);
      data.lastAccessedAt = now;
      data.expiresAt = now + slidingWindowMs;
      if (isMigrated) {
        data.encryptedKeys = encryptApiKeys(keys);
      }
      return keys;
    } catch (err) {
      console.error("[SessionStore] Memory session decryption error:", err);
      return null;
    }
  }

  /**
   * Kiểm tra thông tin trạng thái session token mà không lộ keys.
   */
  async getSessionInfo(sessionToken: string): Promise<SessionInfo> {
    const keys = await this.getSessionKeys(sessionToken);
    if (!keys) {
      return { valid: false, keyCount: 0 };
    }

    const now = Date.now();
    let expiresAtTime = now + DEFAULT_SESSION_TTL_MS;

    if (this.redisClient) {
      try {
        const ttl = await this.redisClient.pttl(`${SESSION_PREFIX}${sessionToken}`);
        if (ttl > 0) {
          expiresAtTime = now + ttl;
        }
      } catch {
        // Use default
      }
    } else {
      const data = this.memorySessions.get(sessionToken);
      if (data) {
        expiresAtTime = data.expiresAt;
      }
    }

    return {
      valid: true,
      keyCount: keys.length,
      expiresAt: new Date(expiresAtTime).toISOString(),
    };
  }

  /**
   * Xóa phiên làm việc khi người dùng đăng xuất hoặc gỡ keys.
   */
  async deleteSession(sessionToken: string): Promise<boolean> {
    if (!sessionToken || typeof sessionToken !== "string") {
      return false;
    }

    let deleted = false;
    if (this.redisClient) {
      try {
        const res = await this.redisClient.del(`${SESSION_PREFIX}${sessionToken}`);
        deleted = res > 0;
      } catch (err) {
        console.error("[SessionStore] Redis del error:", err);
      }
    }

    if (this.memorySessions.has(sessionToken)) {
      this.memorySessions.delete(sessionToken);
      deleted = true;
    }

    return deleted;
  }

  /**
   * Xóa toàn bộ bộ nhớ (chỉ dùng cho testing).
   */
  clearAllForTesting(): void {
    this.memorySessions.clear();
  }
}

export const sessionStore = new SessionStore();
