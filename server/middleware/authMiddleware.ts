import { Request, Response, NextFunction } from "express";
import { authStore } from "../services/authStore";
import { parseCookies } from "../utils/cookies";

const PUBLIC_API_PATHS = new Set([
  "/auth/login",
  "/auth/status",
  "/health",
  "/live",
  "/ready",
  "/api/auth/login",
  "/api/auth/status",
  "/api/health",
  "/api/live",
  "/api/ready",
]);

/**
 * Middleware kiểm tra quyền truy cập vào toàn bộ các endpoint /api/*.
 * Nếu server không cấu hình ACCESS_PASSWORD, cho phép toàn bộ request đi tiếp.
 * Nếu server có cấu hình, yêu cầu Header X-Auth-Token hoặc Authorization: Bearer <token>.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // 1. Nếu hệ thống không yêu cầu mật khẩu, cho phép đi tiếp
  if (!authStore.isAuthRequired()) {
    next();
    return;
  }

  // 2. Cho phép các route public không cần token (so khớp chính xác theo whitelist)
  const requestPath = req.path || req.originalUrl || "";
  if (PUBLIC_API_PATHS.has(requestPath)) {
    next();
    return;
  }

  // 3. Đọc token từ header
  const authHeader =
    (req.headers["x-auth-token"] as string) ||
    (req.headers["authorization"] as string) ||
    (req.headers["x-access-password"] as string);

  let token = "";
  if (authHeader) {
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    } else {
      token = authHeader.trim();
    }
  }

  // 4. Nếu không có trong header, kiểm tra Cookie HttpOnly
  if (!token) {
    const cookies = parseCookies(req);
    if (cookies["auth_token"]) {
      token = cookies["auth_token"].trim();
    }
  }

  if (!token) {
    res.status(401).json({
      error: "Yêu cầu mật khẩu truy cập máy chủ. Vui lòng đăng nhập.",
      authRequired: true,
    });
    return;
  }

  const isValid = await authStore.validateAuthToken(token);
  if (!isValid) {
    res.status(401).json({
      error: "Phiên đăng nhập máy chủ không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
      authRequired: true,
    });
    return;
  }

  next();
}
