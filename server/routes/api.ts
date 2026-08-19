import { Router, Request, Response, NextFunction } from "express";
import {
  analyzeGlossary,
  analyzeGuidelines,
  extractGlossary,
  quickTranslateTerm
} from "../controllers/glossaryController";
import {
  translateRaw,
  polishTranslation,
  qaCritique
} from "../controllers/translationController";
import {
  alignChapter
} from "../controllers/alignmentController";
import {
  createSessionHandler,
  getSessionStatusHandler,
  deleteSessionHandler
} from "../controllers/sessionController";
import {
  getAuthStatusHandler,
  loginHandler,
  logoutHandler
} from "../controllers/authController";
import {
  getQuotaStatusHandler,
  getModelsForKeyHandler
} from "../controllers/quotaController";
import { authMiddleware } from "../middleware/authMiddleware";
import { createRateLimiter } from "../middleware/rateLimiter";
import { sessionStore } from "../services/sessionStore";
import { ALLOWED_MODEL_IDS, MAX_API_KEYS_PER_REQUEST } from "../constants/models";
import { metricsService } from "../services/metricsService";
import { SERVER_CONFIG } from "@shared/constants";

const router = Router();

// --- Dedicated Auth Rate Limiter cho đăng nhập ---
const authLoginRateLimiter = createRateLimiter({
  windowMs: SERVER_CONFIG.AUTH_RATE_LIMIT_WINDOW_MS,
  maxRequests: SERVER_CONFIG.AUTH_RATE_LIMIT_MAX_REQUESTS,
  keyPrefix: "ratelimit:login:",
  message: "Quá nhiều lần thử đăng nhập không thành công. Vui lòng chờ 15 phút rồi thử lại."
});

// --- MIDDLEWARE: Xác thực quyền truy cập API (Authentication) ---
// Nếu máy chủ có cấu hình ACCESS_PASSWORD, yêu cầu X-Auth-Token hợp lệ
router.use(authMiddleware);

// --- Auth Endpoints ---
router.get("/auth/status", getAuthStatusHandler);
router.post("/auth/login", authLoginRateLimiter, loginHandler);
router.post("/auth/logout", logoutHandler);

export const MODEL_ID_REGEX = /^[a-zA-Z0-9_\-\.\/]{1,128}$/;

export function isValidModelId(model: unknown): boolean {
  if (typeof model !== 'string') return false;
  const trimmed = model.trim();
  if (!trimmed || trimmed.length > 128) return false;
  if (trimmed.includes('..')) return false; // Ngăn chặn path traversal
  if (/[\x00-\x1F\x7F]/.test(trimmed)) return false; // Từ chối ký tự điều khiển
  return MODEL_ID_REGEX.test(trimmed);
}

// --- MIDDLEWARE: Kiểm tra model hợp lệ ---
// Chấp nhận các model hợp lệ theo Regex an toàn, ngăn chặn chuỗi độc hại hoặc path traversal.
export function validateModelMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { model } = req.body;
  // Cho phép bỏ trống (backend sẽ dùng DEFAULT_MODEL_ID)
  if (model !== undefined && model !== null && model !== '') {
    if (!isValidModelId(model)) {
      res.status(400).json({
        error: `Mô hình AI "${model}" không hợp lệ. Định dạng ID model chỉ được chứa chữ cái, số, gạch ngang, gạch dưới, dấu chấm hoặc dấu gạch chéo (tối đa 128 ký tự).`
      });
      return;
    }
  }
  next();
}

// --- MIDDLEWARE: Giải mã API Keys từ Session Token hoặc Body ---
// Hỗ trợ cả 2 chế độ:
// 1. Session Token (Bảo mật cao): Đọc qua header X-Session-Token hoặc body sessionToken, lấy keys từ SessionStore.
// 2. Direct Keys (Tương thích ngược): Đọc trực tiếp từ body.apiKeys.
// Nếu không có keys hợp lệ và ALLOW_SERVER_KEY_FALLBACK !== 'true', trả lỗi 400 hoặc 401.
async function resolveApiKeysMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionToken =
    (req.headers["x-session-token"] as string) ||
    (req.body?.sessionToken as string);

  // 1. Nếu client gửi sessionToken
  if (sessionToken) {
    const sessionKeys = await sessionStore.getSessionKeys(sessionToken);
    if (sessionKeys && sessionKeys.length > 0) {
      req.body = req.body || {};
      req.body.apiKeys = sessionKeys;
      next();
      return;
    }

    // Nếu token gửi lên nhưng không tìm thấy trong sessionStore (hết hạn hoặc server restart)
    // Kiểm tra xem client có gửi kèm apiKeys fallback không
    const { apiKeys } = req.body || {};
    const hasValidDirectKeys =
      Array.isArray(apiKeys) &&
      apiKeys.some((k: string) => typeof k === "string" && k.trim().length > 0);

    if (hasValidDirectKeys) {
      req.body.apiKeys = apiKeys.filter((k: string) => typeof k === "string" && k.trim().length > 0);
      next();
      return;
    }

    // Nếu không có direct keys, trả 401 báo session hết hạn để client tự động re-sync
    res.status(401).json({
      error: "Phiên làm việc API key đã hết hạn hoặc không tồn tại. Hệ thống sẽ tự động đồng bộ lại.",
      sessionExpired: true,
    });
    return;
  }

  // 2. Nếu client gửi direct apiKeys
  const { apiKeys } = req.body || {};

  if (Array.isArray(apiKeys) && apiKeys.length > MAX_API_KEYS_PER_REQUEST) {
    res.status(400).json({
      error: `Quá nhiều API key trong một yêu cầu (tối đa ${MAX_API_KEYS_PER_REQUEST}).`
    });
    return;
  }

  const hasValidKeys =
    Array.isArray(apiKeys) &&
    apiKeys.some((k: string) => typeof k === "string" && k.trim().length > 0);

  if (hasValidKeys) {
    req.body.apiKeys = apiKeys.filter((k: string) => typeof k === "string" && k.trim().length > 0);
    next();
    return;
  }

  // 3. Không có sessionToken lẫn direct keys: kiểm tra server fallback
  const allowFallback = process.env.ALLOW_SERVER_KEY_FALLBACK === "true";
  if (!allowFallback) {
    res.status(400).json({
      error: "Vui lòng cấu hình API key của bạn trong phần 'Cấu hình AI' trước khi sử dụng. Máy chủ đã tắt tính năng tự động dùng key mặc định."
    });
    return;
  }

  next();
}

// --- Session Management Endpoints ---
router.post("/session-keys", createSessionHandler);
router.get("/session-keys/status", getSessionStatusHandler);
router.delete("/session-keys", deleteSessionHandler);

// --- Routes for Glossary & Guidelines Analysis ---
router.post("/analyze-glossary", validateModelMiddleware, resolveApiKeysMiddleware, analyzeGlossary);
router.post("/analyze-guidelines", validateModelMiddleware, resolveApiKeysMiddleware, analyzeGuidelines);
router.post("/extract-glossary", validateModelMiddleware, resolveApiKeysMiddleware, extractGlossary);
router.post("/quick-translate-term", validateModelMiddleware, resolveApiKeysMiddleware, quickTranslateTerm);

// --- Routes for Translation Tasks ---
router.post("/translate-raw", validateModelMiddleware, resolveApiKeysMiddleware, translateRaw);
router.post("/polish-translation", validateModelMiddleware, resolveApiKeysMiddleware, polishTranslation);
router.post("/qa-critique", validateModelMiddleware, resolveApiKeysMiddleware, qaCritique);

// --- Routes for Bilingual alignment ---
router.post("/align-chapter", validateModelMiddleware, resolveApiKeysMiddleware, alignChapter);

// --- Routes for Quota & Usage Tracking ---
router.post("/quota-status", resolveApiKeysMiddleware, getQuotaStatusHandler);
router.post("/models-for-key", resolveApiKeysMiddleware, getModelsForKeyHandler);

// --- Health Check & System Diagnostics Endpoint ---
router.get("/health", async (_req: Request, res: Response) => {
  const activeSessions = await sessionStore.getActiveSessionCount();
  const hasRedis = !!process.env.REDIS_URL;

  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: metricsService.getFormattedUptime(),
    uptimeSeconds: metricsService.getUptimeSeconds(),
    environment: process.env.NODE_ENV || "development",
    memory: metricsService.getMemoryUsage(),
    redis: {
      enabled: hasRedis,
      mode: hasRedis ? "redis" : "in-memory",
    },
    sessions: {
      activeCount: activeSessions,
    },
    models: {
      supported: ALLOWED_MODEL_IDS,
    },
  });
});

// --- Performance Metrics Endpoint ---
router.get("/metrics", (_req: Request, res: Response) => {
  res.json(metricsService.getMetrics());
});

export default router;
