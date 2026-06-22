import { Request, Response, NextFunction } from "express";

// --- RATE LIMITER THEO IP (In-memory) ---
// Giới hạn số request mỗi IP trong 1 khoảng thời gian nhất định
// để ngăn chặn lạm dụng API khi không có xác thực.
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 phút
const RATE_LIMIT_MAX_REQUESTS = 60;     // Tối đa 60 requests / phút / IP

// Dọn dẹp bộ nhớ định kỳ mỗi 5 phút (tránh memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of ipRequestCounts) {
    if (now > data.resetTime) {
      ipRequestCounts.delete(ip);
    }
  }
}, 5 * 60 * 1000);

export function rateLimitByIP(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  const existing = ipRequestCounts.get(ip);
  if (!existing || now > existing.resetTime) {
    // Cửa sổ mới: reset bộ đếm
    ipRequestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    next();
    return;
  }

  existing.count++;
  if (existing.count > RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({
      error: `Quá nhiều yêu cầu. Vui lòng chờ ${Math.ceil((existing.resetTime - now) / 1000)} giây rồi thử lại.`
    });
    return;
  }

  next();
}
