import { Request } from "express";

/**
 * Phân tích an toàn chuỗi Cookie từ Request Header mà không cần thư viện ngoài (Dependency Minimization).
 */
export function parseCookies(req: Request): Record<string, string> {
  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader || typeof cookieHeader !== "string") {
    return {};
  }

  const cookies: Record<string, string> = {};
  const pairs = cookieHeader.split(";");

  for (const pair of pairs) {
    const equalIdx = pair.indexOf("=");
    if (equalIdx > 0) {
      const key = pair.substring(0, equalIdx).trim();
      const val = pair.substring(equalIdx + 1).trim();
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }

  return cookies;
}
