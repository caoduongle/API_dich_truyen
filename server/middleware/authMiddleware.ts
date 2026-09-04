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
  // 1. Nếu hệ thống không yêu cầu mật khẩu
  if (!authStore.isAuthRequired()) {
    // Trên môi trường production, thiếu ACCESS_PASSWORD là cấu hình không an toàn (Security Misconfiguration)
    if (process.env.NODE_ENV === "production") {
      const requestPath = req.path || req.originalUrl || "";
      if (PUBLIC_API_PATHS.has(requestPath)) {
        next();
        return;
      }
      res.status(503).json({
        error: "Máy chủ đang chạy ở chế độ Production nhưng chưa cấu hình ACCESS_PASSWORD. Truy cập API tạm thời bị khóa vì lý do an toàn.",
        code: "AUTH_NOT_CONFIGURED",
        authRequired: true,
      });
      return;
    }
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

import { verifyGoogleAccessToken } from "../services/websocketRelayService";
import { VerifiedUserContext } from "../types/appsec";

export interface AuthenticatedRequest extends Request {
  verifiedUser?: VerifiedUserContext;
}

/**
 * Middleware bắt buộc phải có thông tin định danh người dùng đã xác minh (User Identity).
 * Trích xuất từ Header Authorization: Bearer <google_access_token> hoặc X-Google-Token.
 */
export async function requireVerifiedUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers["authorization"] || req.headers["x-google-token"];
  if (typeof authHeader !== "string" || !authHeader.trim()) {
    res.status(401).json({
      error: "Yêu cầu đăng nhập và cung cấp Authorization Bearer Token.",
      code: "UNAUTHORIZED",
    });
    return;
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.substring(7).trim()
    : authHeader.trim();

  if (!token) {
    res.status(401).json({
      error: "Token xác thực không được để trống.",
      code: "INVALID_TOKEN",
    });
    return;
  }

  // Xác minh token qua Google OAuth userinfo endpoint (với cache RAM)
  const userInfo = await verifyGoogleAccessToken(token);
  if (!userInfo || !userInfo.email) {
    res.status(401).json({
      error: "Token xác thực người dùng không hợp lệ hoặc đã hết hạn.",
      code: "INVALID_OR_EXPIRED_TOKEN",
    });
    return;
  }

  req.verifiedUser = {
    email: userInfo.email.toLowerCase().trim(),
    name: userInfo.name || userInfo.email,
    picture: userInfo.picture,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };

  next();
}

