import { Request, Response } from "express";
import { sessionStore } from "../services/sessionStore";
import { MAX_API_KEYS_PER_REQUEST } from "../constants/models";

/**
 * POST /api/session-keys
 * Tạo hoặc cập nhật phiên làm việc lưu trữ danh sách API keys.
 */
export async function createSessionHandler(req: Request, res: Response): Promise<void> {
  try {
    const { apiKeys } = req.body;

    if (!Array.isArray(apiKeys)) {
      res.status(400).json({
        error: "Trường 'apiKeys' phải là một mảng chuỗi.",
      });
      return;
    }

    if (apiKeys.length > MAX_API_KEYS_PER_REQUEST) {
      res.status(400).json({
        error: `Quá nhiều API key trong một phiên (tối đa ${MAX_API_KEYS_PER_REQUEST}).`,
      });
      return;
    }

    const cleanKeys = apiKeys
      .filter((k): k is string => typeof k === "string")
      .map((k) => k.trim())
      .filter(Boolean);

    if (cleanKeys.length === 0) {
      res.status(400).json({
        error: "Danh sách API keys không được để trống.",
      });
      return;
    }

    const result = await sessionStore.createSession(cleanKeys);
    res.status(200).json({
      sessionToken: result.sessionToken,
      keyCount: result.keyCount,
      expiresAt: result.expiresAt,
      message: "Đã tạo phiên làm việc bảo mật thành công.",
    });
  } catch (error: any) {
    console.error("[SessionController] Error creating session:", error);
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
    console.error("[SessionController] Error checking session status:", error);
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
    console.error("[SessionController] Error deleting session:", error);
    res.status(500).json({
      error: "Không thể thu hồi phiên làm việc.",
    });
  }
}
