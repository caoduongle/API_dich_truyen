import crypto from "crypto";
import Redis from "ioredis";

export interface SessionData {
  apiKeys: string[];
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

class SessionStore {
  private memorySessions = new Map<string, SessionData>();
  private redisClient: Redis | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.redisClient = new Redis(redisUrl);
        this.redisClient.on("error", (err) => {
          console.error("[SessionStore] Redis connection error:", err);
        });
      } catch (err) {
        console.error("[SessionStore] Failed to initialize Redis client:", err);
        this.redisClient = null;
      }
    }

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
        const keys = await this.redisClient.keys("session:*");
        return keys.length;
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
   * Tạo phiên làm việc mới lưu danh sách API keys và trả về session token.
   */
  async createSession(
    apiKeys: string[],
    ttlMs: number = DEFAULT_SESSION_TTL_MS
  ): Promise<{ sessionToken: string; keyCount: number; expiresAt: string }> {
    const sessionToken = crypto.randomUUID();
    const cleanKeys = Array.isArray(apiKeys)
      ? apiKeys.map((k) => (typeof k === "string" ? k.trim() : "")).filter(Boolean)
      : [];

    const now = Date.now();
    const expiresAt = now + ttlMs;

    const sessionData: SessionData = {
      apiKeys: cleanKeys,
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

        return data.apiKeys;
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
    return data.apiKeys;
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
