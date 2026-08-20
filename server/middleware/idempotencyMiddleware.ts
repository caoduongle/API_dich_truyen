import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export type IdempotencyStatus = 'pending' | 'completed' | 'failed';

export interface IdempotencyListenerResult {
  statusCode: number;
  body: any;
}

export interface IdempotencyEntry {
  /**
   * Khóa định danh tổng hợp duy nhất cho request (Identity + Endpoint + ClientKey)
   */
  key: string;

  /**
   * Mã băm SHA-256 (hex) của canonical JSON request body
   */
  fingerprint: string;

  /**
   * Trạng thái vòng đời hiện tại của request
   */
  status: IdempotencyStatus;

  /**
   * Thời điểm khởi tạo request (epoch ms)
   */
  createdAt: number;

  /**
   * Mã trạng thái HTTP khi hoàn thành (e.g. 200)
   */
  statusCode?: number;

  /**
   * Nội dung phản hồi được lưu trữ để replay
   */
  responseBody?: any;

  /**
   * Danh sách listener callbacks chờ kết quả của in-flight request
   */
  listeners: Array<(result: IdempotencyListenerResult) => void>;
}

export interface IdempotencyStore {
  get(key: string): IdempotencyEntry | undefined;
  set(key: string, entry: IdempotencyEntry): void;
  delete(key: string): boolean;
  clear(): void;
  cleanupStale(ttlMs?: number): number;
  size(): number;
}

export const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000; // 5 phút

/**
 * Tạo mã định danh Identity Hash an toàn từ session token, auth token, hoặc IP client
 */
export function extractIdentityScope(req: Request): string {
  const sessionToken = req.headers['x-session-token'] || (typeof req.body?.sessionToken === 'string' ? req.body.sessionToken : undefined);
  if (typeof sessionToken === 'string' && sessionToken.trim()) {
    const hash = crypto.createHash('sha256').update(sessionToken.trim()).digest('hex').slice(0, 16);
    return `session:${hash}`;
  }

  const authToken = req.headers['x-auth-token'];
  if (typeof authToken === 'string' && authToken.trim()) {
    const hash = crypto.createHash('sha256').update(authToken.trim()).digest('hex').slice(0, 16);
    return `auth:${hash}`;
  }

  const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  const ipHash = crypto.createHash('sha256').update(String(clientIp).trim()).digest('hex').slice(0, 16);
  return `ip:${ipHash}`;
}

/**
 * Xây dựng Composite Idempotency Key đa chiều:
 * Format: idemp:{identity}:{endpointPath}:{clientKey}
 */
export function buildCompositeIdempotencyKey(req: Request, clientKey: string): string {
  const identity = extractIdentityScope(req);
  const method = (req.method || 'POST').toUpperCase();
  const path = `${req.baseUrl || ''}${req.path || ''}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  const endpoint = `${method}:${path}`;
  const trimmedKey = clientKey.trim();

  return `idemp:${identity}:${endpoint}:${trimmedKey}`;
}

/**
 * Tính mã băm SHA-256 đại diện cho nội dung request payload (Request Fingerprint)
 * Sắp xếp các trường đối tượng để đảm bảo tính xác định (Canonical JSON).
 */
export function computeRequestFingerprint(body: any): string {
  if (body === null || body === undefined) {
    return crypto.createHash('sha256').update('').digest('hex');
  }

  if (typeof body !== 'object') {
    return crypto.createHash('sha256').update(String(body)).digest('hex');
  }

  try {
    const canonicalString = serializeCanonical(body);
    return crypto.createHash('sha256').update(canonicalString).digest('hex');
  } catch {
    return crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
  }
}

function serializeCanonical(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(serializeCanonical).join(',') + ']';
  }

  const sortedKeys = Object.keys(obj).sort();
  const entries: string[] = [];
  for (const k of sortedKeys) {
    entries.push(JSON.stringify(k) + ':' + serializeCanonical(obj[k]));
  }
  return '{' + entries.join(',') + '}';
}

/**
 * In-Memory Store cho Single-Instance Architecture (với TTL & auto-cleanup)
 */
export class MemoryIdempotencyStore implements IdempotencyStore {
  private store = new Map<string, IdempotencyEntry>();

  get(key: string): IdempotencyEntry | undefined {
    return this.store.get(key);
  }

  set(key: string, entry: IdempotencyEntry): void {
    this.store.set(key, entry);
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  cleanupStale(ttlMs: number = IDEMPOTENCY_TTL_MS): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.store) {
      if (now - entry.createdAt > ttlMs) {
        this.store.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }
}

// Global Store Instance
const defaultStore = new MemoryIdempotencyStore();

// Dọn dẹp cache định kỳ mỗi 60 giây
const cleanupInterval = setInterval(() => {
  defaultStore.cleanupStale();
}, 60 * 1000);

if (cleanupInterval && typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref();
}

/**
 * Xóa cache idempotency (dùng cho testing)
 */
export function clearIdempotencyStore(): void {
  defaultStore.clear();
}

/**
 * Lấy store hiện tại (dùng cho testing / telemetry)
 */
export function getIdempotencyStore(): IdempotencyStore {
  return defaultStore;
}

/**
 * Stop cleanup timer (dùng khi shutdown máy chủ hoặc teardown tests)
 */
export function stopIdempotencyCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
}

/**
 * Middleware bảo vệ Idempotency đa chiều với:
 * 1. Composite Scoping Key: Identity/Session + Endpoint + Client Key
 * 2. Request Fingerprint: Phát hiện và trả về HTTP 409 Conflict nếu cùng key nhưng khác body
 * 3. In-Flight Concurrency Coordination: Không gửi trùng request lên Gemini AI
 * 4. Failure Eviction: Tự động xóa ngay các request thất bại (>=400) để cho phép client thử lại
 */
export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  if (!headerKey || typeof headerKey !== 'string') {
    next();
    return;
  }

  const rawKey = headerKey.trim();
  if (!rawKey) {
    next();
    return;
  }

  const compositeKey = buildCompositeIdempotencyKey(req, rawKey);
  const currentFingerprint = computeRequestFingerprint(req.body);
  const now = Date.now();

  const existing = defaultStore.get(compositeKey);

  // 1. Nếu đã có entry trong store
  if (existing) {
    // 1.1 Kiểm tra TTL: Nếu đã hết hạn -> xóa và xử lý như request mới
    if (now - existing.createdAt >= IDEMPOTENCY_TTL_MS) {
      defaultStore.delete(compositeKey);
    } else {
      // 1.2 Kiểm tra Request Payload Fingerprint: Nếu cùng key nhưng khác body -> REJECT 409 CONFLICT
      if (existing.fingerprint !== currentFingerprint) {
        res.status(409).json({
          error: 'Khóa Idempotency đã được sử dụng với nội dung yêu cầu khác. Vui lòng tạo khóa mới.',
          errorCode: 'IDEMPOTENCY_CONFLICT',
          idempotencyKey: rawKey,
          endpoint: `${req.method} ${req.baseUrl || ''}${req.path}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // 1.3 Đã hoàn thành trước đó -> Replay ngay lập tức
      if (existing.status === 'completed') {
        res.setHeader('x-idempotent-replay', 'true');
        res.status(existing.statusCode || 200).json(existing.responseBody);
        return;
      }

      // 1.4 Đang trong quá trình xử lý (In-Flight Request) -> Xếp hàng chờ kết quả từ request đầu tiên
      if (existing.status === 'pending') {
        existing.listeners.push(({ statusCode, body }) => {
          res.setHeader('x-idempotent-replay', 'true');
          res.status(statusCode).json(body);
        });
        return;
      }
    }
  }

  // 2. Request mới -> Khởi tạo trạng thái pending
  const entry: IdempotencyEntry = {
    key: compositeKey,
    fingerprint: currentFingerprint,
    status: 'pending',
    createdAt: now,
    listeners: [],
  };
  defaultStore.set(compositeKey, entry);

  // Hook vào res.status và res.json để lưu đệm kết quả
  let capturedStatusCode = 200;
  const originalStatus = res.status.bind(res);
  const originalJson = res.json.bind(res);

  res.status = (code: number) => {
    capturedStatusCode = code;
    return originalStatus(code);
  };

  res.json = (body: any) => {
    if (capturedStatusCode >= 200 && capturedStatusCode < 300) {
      entry.status = 'completed';
      entry.statusCode = capturedStatusCode;
      entry.responseBody = body;
    } else {
      // Khi request thất bại (>=400 hoặc lỗi): xóa ngay khỏi store để không cản trở lần thử lại tiếp theo
      entry.status = 'failed';
      defaultStore.delete(compositeKey);
    }

    // Thông báo cho tất cả listeners đang chờ
    const pendingListeners = entry.listeners;
    entry.listeners = [];
    for (const listener of pendingListeners) {
      try {
        listener({ statusCode: capturedStatusCode, body });
      } catch (err) {
        console.error('[idempotencyMiddleware] Error in listener callback:', err);
      }
    }

    return originalJson(body);
  };

  next();
}
