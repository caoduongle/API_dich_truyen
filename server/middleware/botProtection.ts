import { Request, Response, NextFunction } from "express";

export interface BotProtectionOptions {
  honeypotField?: string;
  minSubmissionTimeMs?: number;
}

const DEFAULT_HONEYPOT_FIELD = "hp_username";
const DEFAULT_MIN_SUBMISSION_TIME_MS = 500; // Tối thiểu 500ms giữa thời điểm mở form và submit

/**
 * Middleware phòng chống bot tự động hóa (Tiêu chuẩn 12)
 * Kiểm tra trường Honeypot ẩn (người dùng thật sẽ không nhập, bot tự động sẽ điền)
 * và kiểm tra thời gian gửi form nếu có truyền timestamp khởi tạo.
 */
export function createBotProtection(options?: BotProtectionOptions) {
  const honeypotField = options?.honeypotField || DEFAULT_HONEYPOT_FIELD;
  const minTimeMs = options?.minSubmissionTimeMs || DEFAULT_MIN_SUBMISSION_TIME_MS;

  return function botProtectionMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!req.body || typeof req.body !== "object") {
      next();
      return;
    }

    // 1. Kiểm tra trường ẩn Honeypot
    const honeypotValue = req.body[honeypotField];
    if (typeof honeypotValue === "string" && honeypotValue.trim().length > 0) {
      res.status(400).json({
        error: "Yêu cầu bị từ chối do phát hiện dấu hiệu tự động hóa (Bot Protection).",
        code: "BOT_DETECTED",
      });
      return;
    }

    // 2. Kiểm tra tốc độ gửi form (chống script spam tức thì < 500ms)
    const hpTime = req.body.hp_time;
    if (hpTime !== undefined && hpTime !== null && hpTime !== "") {
      const formOpenedAt = Number(hpTime);
      if (!Number.isNaN(formOpenedAt)) {
        const elapsed = Date.now() - formOpenedAt;
        if (elapsed > 0 && elapsed < minTimeMs) {
          res.status(400).json({
            error: "Yêu cầu được gửi quá nhanh. Vui lòng thử lại sau giây lát.",
            code: "SUBMISSION_TOO_FAST",
          });
          return;
        }
      }
    }

    // 3. Làm sạch trường honeypot khỏi req.body để không ảnh hưởng tầng xử lý tiếp theo
    if (honeypotField in req.body) {
      delete req.body[honeypotField];
    }
    if ("hp_time" in req.body) {
      delete req.body.hp_time;
    }

    next();
  };
}

export const botProtection = createBotProtection();
