import { Request, Response, NextFunction } from "express";

/**
 * Middleware bắt buộc chuyển hướng toàn bộ kết nối sang HTTPS khi vận hành ở môi trường Production.
 * Kiểm tra header `x-forwarded-proto` từ reverse proxy (Cloud Run, Render, Nginx, ALB) hoặc `req.secure`.
 */
export function httpsRedirect(req: Request, res: Response, next: NextFunction): void {
  // Chỉ kích hoạt bắt buộc chuyển hướng ở production
  if (process.env.NODE_ENV !== "production") {
    next();
    return;
  }

  // Bỏ qua các endpoint probes của container orchestrator nếu truy cập trực tiếp nội bộ qua HTTP
  const path = req.path || req.originalUrl || "";
  if (path === "/health" || path === "/live" || path === "/ready") {
    next();
    return;
  }

  const forwardedProto = req.headers["x-forwarded-proto"];
  const isHttps = req.secure || forwardedProto === "https";

  if (!isHttps) {
    const host = req.headers.host || "localhost";
    const redirectUrl = `https://${host}${req.originalUrl || req.url}`;
    res.redirect(301, redirectUrl);
    return;
  }

  next();
}
