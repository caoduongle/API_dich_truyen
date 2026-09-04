import Redis from "ioredis";

export type RedisConnectionStatus = 'connected' | 'degraded' | 'disconnected' | 'closed';

export interface RedisManagerTelemetry {
  status: RedisConnectionStatus;
  urlConfigured: boolean;
  activeListenersCount: number;
  lastError?: string;
  lastTransitionAt: number;
}

const DEFAULT_REDIS_OPTIONS = {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: (times: number) => Math.min(times * 500, 5000),
};

export class RedisManager {
  private client: Redis | null = null;
  private mockClient: Redis | null = null;
  private isMockMode: boolean = false;
  private status: RedisConnectionStatus = 'disconnected';
  private lastErrorMsg?: string;
  private lastTransitionTimestamp: number = Date.now();
  private listeners = new Set<(status: RedisConnectionStatus) => void>();

  constructor() {
    this.updateInitialStatus();
  }

  private updateInitialStatus(): void {
    if (process.env.REDIS_URL) {
      this.status = 'disconnected';
    } else {
      this.status = 'disconnected';
    }
  }

  private setStatus(newStatus: RedisConnectionStatus, errorMsg?: string): void {
    if (this.status !== newStatus || errorMsg !== this.lastErrorMsg) {
      this.status = newStatus;
      this.lastErrorMsg = errorMsg;
      this.lastTransitionTimestamp = Date.now();
      for (const listener of this.listeners) {
        try {
          listener(newStatus);
        } catch (e) {
          console.error('[RedisManager] Error in status change listener:', e);
        }
      }
    }
  }

  /**
   * Lấy singleton Redis client đã được quản lý tập trung
   */
  getClient(): Redis | null {
    if (this.isMockMode) {
      return this.mockClient;
    }

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.status = 'disconnected';
      return null;
    }

    if (this.client) {
      return this.client;
    }

    try {
      this.client = new Redis(redisUrl, DEFAULT_REDIS_OPTIONS);

      if (typeof this.client.on === 'function') {
        this.client.on('error', (err) => {
          this.setStatus('degraded', err?.message || 'Redis connection error');
        });

        this.client.on('ready', () => {
          this.setStatus('connected');
        });

        this.client.on('connect', () => {
          this.setStatus('connected');
        });

        this.client.on('close', () => {
          if (this.status !== 'closed') {
            this.setStatus('degraded', 'Redis connection closed unexpectedly');
          }
        });
      }

      return this.client;
    } catch (err: any) {
      this.setStatus('degraded', err?.message || 'Failed to initialize Redis client');
      this.client = null;
      return null;
    }
  }

  /**
   * Trạng thái kết nối hiện tại
   */
  getStatus(): RedisConnectionStatus {
    return this.status;
  }

  /**
   * Thông tin telemetry của Redis connection manager
   */
  getTelemetry(): RedisManagerTelemetry {
    return {
      status: this.status,
      urlConfigured: Boolean(process.env.REDIS_URL),
      activeListenersCount: this.listeners.size,
      lastError: this.lastErrorMsg,
      lastTransitionAt: this.lastTransitionTimestamp,
    };
  }

  /**
   * Đăng ký lắng nghe thay đổi trạng thái kết nối
   */
  onStatusChange(listener: (status: RedisConnectionStatus) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Đóng kết nối an toàn (Graceful Shutdown)
   */
  async close(): Promise<void> {
    this.setStatus('closed');
    if (this.client) {
      try {
        await this.client.quit();
      } catch (err) {
        console.warn('[RedisManager] Error closing Redis client cleanly, forcing disconnect:', err);
        try {
          this.client.disconnect();
        } catch {}
      }
      this.client = null;
    }
    if (this.mockClient && typeof (this.mockClient as any).quit === 'function') {
      try {
        await (this.mockClient as any).quit();
      } catch {}
    }
  }

  /**
   * Tiêm mock Redis client phục vụ test isolation
   */
  setMockClient(client: Redis | null): void {
    this.mockClient = client;
    this.isMockMode = true;
    if (client) {
      this.setStatus('connected');
    } else {
      this.setStatus('disconnected');
    }
  }

  /**
   * Reset trạng thái test
   */
  resetForTesting(): void {
    this.mockClient = null;
    this.isMockMode = false;
    this.client = null;
    this.listeners.clear();
    this.lastErrorMsg = undefined;
    this.updateInitialStatus();
  }
}

export const redisManager = new RedisManager();
export const getRedisClient = (): Redis | null => redisManager.getClient();

/**
 * Chuẩn hóa và làm sạch chuỗi cấu thành khóa Redis (Tiêu chuẩn 13: Redis Command Injection Prevention)
 * Loại bỏ ký tự xuống dòng (\r, \n), khoảng trắng và ký tự điều khiển để ngăn chặn Command Injection trong Redis.
 */
export function sanitizeRedisKey(rawKey: string): string {
  if (!rawKey || typeof rawKey !== "string") {
    return "";
  }
  return rawKey.replace(/[\r\n\x00-\x1F\x7F\s]+/g, "_");
}
