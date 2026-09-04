import { Request, Response, NextFunction } from "express";
import { sanitizeSecretString } from "../utils/logger";

/**
 * Global Error Handling Middleware (Express 4-parameter error handler)
 * Đảm bảo:
 * 1. Triệt tiêu 100% stack trace và đường dẫn nội bộ máy chủ ở môi trường Production.
 * 2. Làm sạch thông báo lỗi qua hàm sanitizeSecretString trước khi log hoặc phản hồi.
 * 3. Chuẩn hóa format phản hồi JSON thống nhất.
 */
export function globalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isProduction = process.env.NODE_ENV === "production";
  const statusCode = typeof err.status === "number" && err.status >= 400 && err.status < 600
    ? err.status
    : typeof err.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 600
    ? err.statusCode
    : 500;

  const rawMessage = err?.message || "Internal Server Error";
  const sanitizedMessage = sanitizeSecretString(String(rawMessage));

  // Ghi log lỗi có cấu trúc trên server console
  console.error(`[GlobalErrorHandler] ${req.method} ${req.originalUrl || req.url} - Status ${statusCode}:`, {
    message: sanitizedMessage,
    code: err.code,
    ...(isProduction ? {} : { stack: sanitizeSecretString(err.stack || "") }),
  });

  if (res.headersSent) {
    return;
  }

  // Trên Production, che giấu chi tiết lỗi 5xx hệ thống để tránh lộ thông tin nội bộ
  const clientMessage = isProduction && statusCode >= 500
    ? "Lỗi máy chủ nội bộ. Vui lòng thử lại sau."
    : sanitizedMessage;

  res.status(statusCode).json({
    error: clientMessage,
    code: err.code || (statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "BAD_REQUEST"),
    ...(isProduction ? {} : { stack: sanitizeSecretString(err.stack || "") }),
  });
}
