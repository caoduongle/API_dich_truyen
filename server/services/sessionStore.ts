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

export const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ
const SESSION_PREFIX = "session_keys:";
const ENCRYPTION_SALT = "api_dich_truyen_session_salt_2026";

/**
 * Lấy khóa mã hóa 32 bytes từ biến môi trường ENCRYPTION_MASTER_KEY
 */
export function getEncryptionKey(): Buffer {
  const rawMaster = process.env.ENCRYPTION_MASTER_KEY || "default_dev_master_key_for_session_encryption_only";
  return crypto.scryptSync(rawMaster, ENCRYPTION_SALT, 32);
}

/**
 * Mã hóa danh sách API keys thành chuỗi định dạng AES-256-GCM: iv_hex:authTag_hex:ciphertext_hex
 */
export function encryptApiKeys(apiKeys: string[]): string {
  const iv = crypto.randomBytes(12); // 12 bytes IV cho GCM
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(apiKeys);
  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${ciphertext}`;
}

/**
 * Giải mã chuỗi AES-256-GCM thành danh sách API keys
 */
export function decryptApiKeys(encryptedPayload: string): string[] {
  if (!encryptedPayload || typeof encryptedPayload !== "string") return [];
  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    // Hỗ trợ tương thích ngược nếu lưu mảng JSON thô
    try {
      const parsed = JSON.parse(encryptedPayload);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    throw new Error("Dữ liệu khóa phiên bị sai định dạng hoặc bị can thiệp trái phép.");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  const parsed = JSON.parse(decrypted);
  return Array.isArray(parsed) ? parsed : [];
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
   * Tạo phiên làm việc mới lưu danh sách API keys đã mã hóa và trả về session token.
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
   * Lấy danh sách API keys từ session token và gia hạn thời gian sống.
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

        const data: SessionData = JSON.parse(raw);
        data.lastAccessedAt = now;
        data.expiresAt = now + slidingWindowMs;

        // Cập nhật sliding window
        await this.redisClient.set(
          `${SESSION_PREFIX}${sessionToken}`,
          JSON.stringify(data),
          "PX",
          slidingWindowMs
        );

        return decryptApiKeys(data.encryptedKeys);
      } catch (err) {
        console.error("[SessionStore] Redis get error, checking memory:", err);
      }
    }

    const data = this.memorySessions.get(sessionToken);
    if (!data) return null;

    if (now > data.expiresAt) {
      this.memorySessions.delete(sessionToken);
      return null;
    }

    data.lastAccessedAt = now;
    data.expiresAt = now + slidingWindowMs;
    return decryptApiKeys(data.encryptedKeys);
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
