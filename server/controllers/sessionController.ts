import { Request, Response } from "express";
import { sessionStore } from "../services/sessionStore";
import { validateSessionKeysBody } from "../utils/validation";
import { Logger } from "../utils/logger";

const logger = new Logger("SessionController");

/**
 * POST /api/session-keys
 * Tạo hoặc cập nhật phiên làm việc lưu trữ danh sách API keys.
 */
export async function createSessionHandler(req: Request, res: Response): Promise<void> {
  try {
    const validation = validateSessionKeysBody(req.body);
    if (!validation.valid) {
      res.status(400).json({
        error: validation.error,
      });
      return;
    }

    const { apiKeys } = req.body;
    const cleanKeys = (apiKeys as string[])
      .map((k) => k.trim())
      .filter(Boolean);

    const result = await sessionStore.createSession(cleanKeys);
    res.status(200).json({
      sessionToken: result.sessionToken,
      keyCount: result.keyCount,
      expiresAt: result.expiresAt,
      message: "Đã tạo phiên làm việc bảo mật thành công.",
    });
  } catch (error: any) {
    logger.error("[SessionController] Error creating session:", error);
    res.status(500).json({
      error: "Không thể tạo phiên làm việc bảo mật trên máy chủ.",
    });
  }
}

/**
 * GET /api/session-keys/status
 * Kiểm tra tính hợp lệ và số lượng keys của session token hiện tại.
 */
export async function getSessionStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const token =
      (req.headers["x-session-token"] as string) ||
      (req.query.token as string) ||
      (req.body?.sessionToken as string);

    if (!token) {
      res.status(200).json({
        valid: false,
        keyCount: 0,
      });
      return;
    }

    const info = await sessionStore.getSessionInfo(token);
    res.status(200).json(info);
  } catch (error: any) {
    logger.error("[SessionController] Error checking session status:", error);
    res.status(500).json({
      error: "Không thể kiểm tra trạng thái phiên làm việc.",
    });
  }
}

/**
 * DELETE /api/session-keys
 * Xóa phiên làm việc khi người dùng đăng xuất hoặc gỡ bỏ keys.
 */
export async function deleteSessionHandler(req: Request, res: Response): Promise<void> {
  try {
    const token =
      (req.headers["x-session-token"] as string) ||
      (req.body?.sessionToken as string) ||
      (req.query.token as string);

    if (token) {
      await sessionStore.deleteSession(token);
    }

    res.status(200).json({
      success: true,
      message: "Đã thu hồi phiên làm việc thành công.",
    });
  } catch (error: any) {
    logger.error("[SessionController] Error deleting session:", error);
    res.status(500).json({
      error: "Không thể thu hồi phiên làm việc.",
    });
  }
}
