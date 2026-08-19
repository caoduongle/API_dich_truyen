import { Request, Response, NextFunction } from 'express';

interface InFlightEntry {
  status: 'pending' | 'completed' | 'failed';
  createdAt: number;
  statusCode?: number;
  responseBody?: any;
  listeners: Array<(result: { statusCode: number; body: any }) => void>;
}

const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000; // 5 phút
const idempotencyStore = new Map<string, InFlightEntry>();

// Dọn dẹp cache định kỳ
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of idempotencyStore) {
    if (now - entry.createdAt > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(key);
    }
  }
}, 60 * 1000);

if (cleanupInterval && typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref();
}

/**
 * Xóa cache idempotency (dùng cho testing)
 */
export function clearIdempotencyStore(): void {
  idempotencyStore.clear();
}

export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  if (!headerKey || typeof headerKey !== 'string') {
    next();
    return;
  }

  const key = headerKey.trim();
  if (!key) {
    next();
    return;
  }

  const existing = idempotencyStore.get(key);
  const now = Date.now();

  // 1. Đã hoàn thành trước đó -> Replay ngay lập tức
  if (existing && existing.status === 'completed' && now - existing.createdAt < IDEMPOTENCY_TTL_MS) {
    res.setHeader('x-idempotent-replay', 'true');
    res.status(existing.statusCode || 200).json(existing.responseBody);
    return;
  }

  // 2. Đang trong quá trình xử lý (In-Flight Request) -> Chờ kết quả của request đầu tiên
  if (existing && existing.status === 'pending') {
    existing.listeners.push(({ statusCode, body }) => {
      res.setHeader('x-idempotent-replay', 'true');
      res.status(statusCode).json(body);
    });
    return;
  }

  // 3. Request mới -> Khởi tạo trạng thái pending
  const entry: InFlightEntry = {
    status: 'pending',
    createdAt: now,
    listeners: [],
  };
  idempotencyStore.set(key, entry);

  // Hook vào res.json và res.status để lưu đệm kết quả trả về
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
      entry.status = 'failed';
    }

    // Thông báo cho tất cả request đang chờ
    for (const listener of entry.listeners) {
      listener({ statusCode: capturedStatusCode, body });
    }
    entry.listeners = [];

    return originalJson(body);
  };

  next();
}
