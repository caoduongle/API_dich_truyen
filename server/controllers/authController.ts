import { Request, Response } from "express";
import { authStore } from "../services/authStore.ts";

/**
 * GET /api/auth/status
 * Kiểm tra xem server có yêu cầu xác thực không và token hiện tại có hợp lệ không.
 */
export async function getAuthStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const authRequired = authStore.isAuthRequired();

    if (!authRequired) {
      res.status(200).json({
        authRequired: false,
        authenticated: true,
      });
      return;
    }

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

    const authenticated = token ? await authStore.validateAuthToken(token) : false;

    res.status(200).json({
      authRequired: true,
      authenticated,
    });
  } catch (error: any) {
    console.error("[AuthController] Error checking auth status:", error);
    res.status(500).json({
      error: "Không thể kiểm tra trạng thái xác thực máy chủ.",
    });
  }
}

/**
 * POST /api/auth/login
 * Đăng nhập bằng mật khẩu máy chủ và nhận Auth Token.
 */
export async function loginHandler(req: Request, res: Response): Promise<void> {
  try {
    const { password } = req.body || {};

    if (!authStore.isAuthRequired()) {
      res.status(200).json({
        success: true,
        authRequired: false,
        message: "Máy chủ đang chạy ở chế độ cá nhân, không yêu cầu mật khẩu.",
      });
      return;
    }

    if (!password || typeof password !== "string") {
      res.status(400).json({
        error: "Vui lòng cung cấp mật khẩu truy cập máy chủ.",
      });
      return;
    }

    const isValid = authStore.validatePassword(password);
    if (!isValid) {
      res.status(401).json({
        error: "Mật khẩu truy cập máy chủ không chính xác.",
      });
      return;
    }

    const result = await authStore.createAuthToken();
    res.status(200).json({
      success: true,
      authToken: result.authToken,
      expiresAt: result.expiresAt,
      message: "Đăng nhập máy chủ thành công.",
    });
  } catch (error: any) {
    console.error("[AuthController] Error during login:", error);
    res.status(500).json({
      error: "Lỗi xử lý xác thực trên máy chủ.",
    });
  }
}

/**
 * POST /api/auth/logout
 * Thu hồi Auth Token khi người dùng đăng xuất.
 */
export async function logoutHandler(req: Request, res: Response): Promise<void> {
  try {
    const authHeader =
      (req.headers["x-auth-token"] as string) ||
      (req.headers["authorization"] as string) ||
      (req.body?.authToken as string);

    let token = "";
    if (authHeader) {
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      } else {
        token = authHeader.trim();
      }
    }

    if (token) {
      await authStore.revokeAuthToken(token);
    }

    res.status(200).json({
      success: true,
      message: "Đã đăng xuất máy chủ thành công.",
    });
  } catch (error: any) {
    console.error("[AuthController] Error during logout:", error);
    res.status(500).json({
      error: "Không thể thu hồi phiên đăng nhập.",
    });
  }
}
