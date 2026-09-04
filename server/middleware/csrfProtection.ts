import { Request, Response, NextFunction } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Middleware bảo vệ chống tấn công CSRF (Cross-Site Request Forgery)
 * Áp dụng cho các phương thức thay đổi trạng thái (POST, PUT, DELETE, PATCH):
 * Yêu cầu:
 * 1. Định dạng Content-Type là application/json hoặc
 * 2. Có ít nhất một Custom Header hợp lệ (X-Requested-With, X-Auth-Token, Authorization).
 * Trình duyệt cấm các form cross-origin tự động gửi các custom header này nếu không có CORS preflight chấp thuận.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  // Bỏ qua các endpoint probes
  const path = req.path || req.originalUrl || "";
  if (path === "/health" || path === "/live" || path === "/ready") {
    next();
    return;
  }

  const hasCustomHeader =
    !!req.headers["x-requested-with"] ||
    !!req.headers["x-auth-token"] ||
    !!req.headers["authorization"] ||
    !!req.headers["x-custom-rpm"];

  const contentType = (req.headers["content-type"] || "").toLowerCase();
  const isJsonBody = contentType.includes("application/json");

  if (!hasCustomHeader && !isJsonBody) {
    res.status(403).json({
      error: "Yêu cầu bị từ chối: Thiếu custom header hoặc định dạng JSON hợp lệ (Chính sách chống CSRF).",
      code: "CSRF_DETECTED",
    });
    return;
  }

  next();
}
