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
  configureQuotaGroupsHandler,
  getModelsForKeyHandler,
  verifyModelHandler
} from "../controllers/quotaController";
import { authMiddleware } from "../middleware/authMiddleware";
import { createRateLimiter } from "../middleware/rateLimiter";
import { idempotencyMiddleware } from "../middleware/idempotencyMiddleware";
import { sessionStore } from "../services/sessionStore";
import { ALLOWED_MODEL_IDS, MAX_API_KEYS_PER_REQUEST } from "../constants/models";
import { metricsService } from "../services/metricsService";
import { modelInfoService } from "../services/modelInfoService";
import { redisManager } from "../services/redisService";
import { SERVER_CONFIG } from "@shared/constants";

const router = Router();


// --- Dedicated Auth Rate Limiter cho đăng nhập ---
const authLoginRateLimiter = createRateLimiter({
  endpointType: 'auth',
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

// --- MIDDLEWARE: Kiểm tra model hợp lệ & đã xác minh ---
// Đảm bảo model có định dạng an toàn và đã được xác minh hỗ trợ dịch thuật (generateContent).
export async function validateModelMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { model } = req.body || {};
  // Cho phép bỏ trống (backend sẽ dùng DEFAULT_MODEL_ID)
  if (model !== undefined && model !== null && model !== '') {
    if (!isValidModelId(model)) {
      res.status(400).json({
        error: `Mô hình AI "${model}" không hợp lệ. Định dạng ID model chỉ được chứa chữ cái, số, gạch ngang, gạch dưới, dấu chấm hoặc dấu gạch chéo (tối đa 128 ký tự).`
      });
      return;
    }

    const isVerified = modelInfoService.isModelVerifiedCached(model);
    if (!isVerified) {
      res.status(400).json({
        error: `Mô hình AI "${model}" chưa được xác minh hoặc không tương thích với quy trình dịch thuật. Vui lòng kiểm tra và xác minh mô hình trong Cấu hình AI.`,
        code: 'MODEL_UNVERIFIED',
        model,
      });
      return;
    }
  }
  next();
}

// --- MIDDLEWARE: Trích xuất custom RPM nếu có ---
export function extractCustomRpmMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const headerRpm = req.headers["x-custom-rpm"];
  if (headerRpm && typeof headerRpm === "string") {
    const parsed = parseInt(headerRpm, 10);
    if (!isNaN(parsed) && parsed > 0) {
      req.body = req.body || {};
      if (!req.body.customRpm) {
        req.body.customRpm = parsed;
      }
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
router.post("/analyze-glossary", extractCustomRpmMiddleware, resolveApiKeysMiddleware, validateModelMiddleware, analyzeGlossary);
router.post("/analyze-guidelines", extractCustomRpmMiddleware, resolveApiKeysMiddleware, validateModelMiddleware, analyzeGuidelines);
router.post("/extract-glossary", extractCustomRpmMiddleware, resolveApiKeysMiddleware, validateModelMiddleware, extractGlossary);
router.post("/quick-translate-term", extractCustomRpmMiddleware, resolveApiKeysMiddleware, validateModelMiddleware, quickTranslateTerm);

// --- Routes for Translation Tasks ---
router.post("/translate-raw", idempotencyMiddleware, extractCustomRpmMiddleware, resolveApiKeysMiddleware, validateModelMiddleware, translateRaw);
router.post("/polish-translation", idempotencyMiddleware, extractCustomRpmMiddleware, resolveApiKeysMiddleware, validateModelMiddleware, polishTranslation);
router.post("/qa-critique", idempotencyMiddleware, extractCustomRpmMiddleware, resolveApiKeysMiddleware, validateModelMiddleware, qaCritique);

// --- Routes for Bilingual alignment ---
router.post("/align-chapter", extractCustomRpmMiddleware, resolveApiKeysMiddleware, validateModelMiddleware, alignChapter);

// --- Routes for Quota & Usage Tracking & Model Verification ---
router.post("/quota-status", resolveApiKeysMiddleware, getQuotaStatusHandler);
router.post("/quota-groups/configure", configureQuotaGroupsHandler);
router.post("/models-for-key", resolveApiKeysMiddleware, getModelsForKeyHandler);
router.post("/verify-model", resolveApiKeysMiddleware, verifyModelHandler);


// --- Liveness Probe Endpoint ---
router.get("/live", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "alive",
    timestamp: new Date().toISOString(),
    uptimeSeconds: metricsService.getUptimeSeconds(),
  });
});

// --- Readiness Probe Endpoint ---
router.get("/ready", (_req: Request, res: Response) => {
  const redisStatus = redisManager.getStatus();
  const hasRedis = !!process.env.REDIS_URL || redisStatus === 'connected' || redisStatus === 'degraded';

  if (redisStatus === 'closed') {
    res.status(503).json({
      status: "unavailable",
      ready: false,
      timestamp: new Date().toISOString(),
      dependencies: {
        redis: "closed",
        memory: "ok",
      },
    });
    return;
  }

  if (hasRedis && redisStatus === 'degraded') {
    res.status(200).json({
      status: "degraded",
      ready: true,
      timestamp: new Date().toISOString(),
      dependencies: {
        redis: "degraded",
        memory: "ok",
      },
      note: "Redis is experiencing connectivity issues; in-memory fallback active.",
    });
    return;
  }

  res.status(200).json({
    status: "healthy",
    ready: true,
    timestamp: new Date().toISOString(),
    dependencies: {
      redis: hasRedis ? redisStatus : "standalone-in-memory",
      memory: "ok",
    },
  });
});

// --- Health Check & System Diagnostics Endpoint ---
router.get("/health", async (_req: Request, res: Response) => {
  const activeSessions = await sessionStore.getActiveSessionCount();
  const redisStatus = redisManager.getStatus();
  const hasRedis = !!process.env.REDIS_URL || redisStatus === 'connected' || redisStatus === 'degraded';

  let overallStatus: 'healthy' | 'degraded' | 'unavailable' = 'healthy';
  let redisMode: 'redis' | 'in-memory-fallback' | 'standalone-in-memory' = 'standalone-in-memory';

  if (redisStatus === 'closed') {
    overallStatus = 'unavailable';
    redisMode = 'in-memory-fallback';
  } else if (hasRedis) {
    if (redisStatus === 'connected') {
      overallStatus = 'healthy';
      redisMode = 'redis';
    } else {
      overallStatus = 'degraded';
      redisMode = 'in-memory-fallback';
    }
  }

  const statusCode = overallStatus === 'unavailable' ? 503 : 200;

  res.status(statusCode).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: metricsService.getFormattedUptime(),
    uptimeSeconds: metricsService.getUptimeSeconds(),
    environment: process.env.NODE_ENV || "development",
    memory: metricsService.getMemoryUsage(),
    redis: {
      enabled: hasRedis,
      status: redisStatus,
      mode: redisMode,
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
