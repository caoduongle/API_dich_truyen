import crypto from "crypto";
import Redis from "ioredis";

export const DEFAULT_AUTH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày
const AUTH_TOKEN_PREFIX = "auth_token:";

interface TokenData {
  createdAt: number;
  expiresAt: number;
}

class AuthStore {
  private memoryTokens = new Map<string, TokenData>();
  private redisClient: Redis | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.redisClient = new Redis(redisUrl);
        this.redisClient.on("error", (err) => {
          console.error("[AuthStore] Redis connection error:", err);
        });
      } catch (err) {
        console.error("[AuthStore] Failed to initialize Redis client:", err);
        this.redisClient = null;
      }
    }

    // In-memory token cleanup
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [token, data] of this.memoryTokens) {
        if (now > data.expiresAt) {
          this.memoryTokens.delete(token);
        }
      }
    }, 15 * 60 * 1000);

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
   * Kiểm tra xem hệ thống có đang bật chế độ bảo vệ mật khẩu hay không.
   */
  isAuthRequired(): boolean {
    const pwd = process.env.ACCESS_PASSWORD;
    return typeof pwd === "string" && pwd.trim().length > 0;
  }

  /**
   * Lấy mật khẩu máy chủ hiện tại.
   */
  private getAccessPassword(): string | null {
    const pwd = process.env.ACCESS_PASSWORD;
    if (typeof pwd === "string" && pwd.trim().length > 0) {
      return pwd.trim();
    }
    return null;
  }

  /**
   * So sánh an toàn mật khẩu nhập vào với ACCESS_PASSWORD (chống Timing Attack).
   */
  validatePassword(inputPassword: string): boolean {
    const serverPassword = this.getAccessPassword();
    if (!serverPassword) {
      return true; // Không yêu cầu mật khẩu
    }

    if (!inputPassword || typeof inputPassword !== "string") {
      return false;
    }

    const trimmedInput = inputPassword.trim();
    if (trimmedInput.length === 0) {
      return false;
    }

    // Dùng SHA-256 hash trước để đảm bảo độ dài 32 bytes cố định cho timingSafeEqual
    const hashInput = crypto.createHash("sha256").update(trimmedInput).digest();
    const hashServer = crypto.createHash("sha256").update(serverPassword).digest();

    return crypto.timingSafeEqual(hashInput, hashServer);
  }

  /**
   * Tạo Auth Token mới khi đăng nhập thành công.
   */
  async createAuthToken(ttlMs: number = DEFAULT_AUTH_TTL_MS): Promise<{ authToken: string; expiresAt: string }> {
    const authToken = crypto.randomBytes(32).toString("hex");
    const now = Date.now();
    const expiresAt = now + ttlMs;

    const data: TokenData = {
      createdAt: now,
      expiresAt,
    };

    if (this.redisClient) {
      try {
        await this.redisClient.set(
          `${AUTH_TOKEN_PREFIX}${authToken}`,
          JSON.stringify(data),
          "PX",
          ttlMs
        );
      } catch (err) {
        console.error("[AuthStore] Error saving token to Redis, fallback to memory:", err);
        this.memoryTokens.set(authToken, data);
      }
    } else {
      this.memoryTokens.set(authToken, data);
    }

    return {
      authToken,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  /**
   * Xác thực tính hợp lệ của Auth Token.
   */
  async validateAuthToken(authToken: string): Promise<boolean> {
    if (!this.isAuthRequired()) {
      return true;
    }

    if (!authToken || typeof authToken !== "string") {
      return false;
    }

    const cleanToken = authToken.trim();
    const now = Date.now();

    if (this.redisClient) {
      try {
        const raw = await this.redisClient.get(`${AUTH_TOKEN_PREFIX}${cleanToken}`);
        if (!raw) return false;

        const data: TokenData = JSON.parse(raw);
        if (now > data.expiresAt) {
          await this.redisClient.del(`${AUTH_TOKEN_PREFIX}${cleanToken}`);
          return false;
        }
        return true;
      } catch (err) {
        console.error("[AuthStore] Redis validate error, checking memory:", err);
      }
    }

    const data = this.memoryTokens.get(cleanToken);
    if (!data) {
      // Cho phép truyền trực tiếp ACCESS_PASSWORD trong token header
      return this.validatePassword(cleanToken);
    }

    if (now > data.expiresAt) {
      this.memoryTokens.delete(cleanToken);
      return false;
    }

    return true;
  }

  /**
   * Thu hồi / xóa Auth Token khi đăng xuất.
   */
  async revokeAuthToken(authToken: string): Promise<boolean> {
    if (!authToken || typeof authToken !== "string") {
      return false;
    }

    const cleanToken = authToken.trim();
    let deleted = false;

    if (this.redisClient) {
      try {
        const res = await this.redisClient.del(`${AUTH_TOKEN_PREFIX}${cleanToken}`);
        deleted = res > 0;
      } catch (err) {
        console.error("[AuthStore] Redis revoke error:", err);
      }
    }

    if (this.memoryTokens.has(cleanToken)) {
      this.memoryTokens.delete(cleanToken);
      deleted = true;
    }

    return deleted;
  }

  /**
   * Xóa toàn bộ token (chỉ dùng cho testing).
   */
  clearAllForTesting(): void {
    this.memoryTokens.clear();
  }
}

export const authStore = new AuthStore();
