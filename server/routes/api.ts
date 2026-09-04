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
import { botProtection } from "../middleware/botProtection";
import { idempotencyMiddleware } from "../middleware/idempotencyMiddleware";
import { sessionStore } from "../services/sessionStore";
import { ALLOWED_MODEL_IDS, MAX_API_KEYS_PER_REQUEST } from "../constants/models";
import { metricsService } from "../services/metricsService";
import { modelInfoService } from "../services/modelInfoService";
import { redisManager } from "../services/redisService";
import { generateWsTicket } from "../services/wsTicketService";
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
router.post("/auth/login", authLoginRateLimiter, botProtection, loginHandler);
router.post("/auth/logout", logoutHandler);

// --- WebSocket Ticket Endpoint (Server-Signed Ticket chống BOLA/IDOR) ---
router.post("/ws-ticket", (req: Request, res: Response) => {
  const { projectId, chapterId, userEmail, role } = req.body || {};
  if (!projectId || typeof projectId !== "string" || !chapterId || typeof chapterId !== "string") {
    res.status(400).json({ error: "Yêu cầu cung cấp đầy đủ projectId và chapterId." });
    return;
  }
  const email = typeof userEmail === "string" && userEmail.trim().length > 0
    ? userEmail.trim()
    : "user@local";

  const ticket = generateWsTicket({
    projectId: projectId.trim(),
    chapterId: chapterId.trim(),
    userEmail: email,
    role: typeof role === "string" ? role : "editor",
  });

  res.status(200).json({
    success: true,
    ticket,
    expiresInSeconds: 60,
  });
});

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

// --- MIDDLEWARE: Chỉ nhận API Keys trong Request Body dùng tạm thời cho đúng lượt gọi hiện tại ---
// TODO(zero-knowledge-session): port sang client-direct, xem specs/060-zero-knowledge-session-sync
export function requireEphemeralApiKeys(req: Request, res: Response, next: NextFunction): void {
  const { apiKeys } = req.body || {};

  if (!Array.isArray(apiKeys) || apiKeys.length === 0) {
    res.status(400).json({
      error: "Vui lòng cấu hình API key cá nhân của bạn trong phần 'Cấu hình AI' trước khi sử dụng. Máy chủ không lưu trữ key của bạn.",
      code: "NO_PERSONAL_API_KEY_CONFIGURED",
    });
    return;
  }

  if (apiKeys.length > MAX_API_KEYS_PER_REQUEST) {
    res.status(400).json({
      error: `Quá nhiều API key trong một yêu cầu (tối đa ${MAX_API_KEYS_PER_REQUEST}).`,
    });
    return;
  }

  const cleanKeys = apiKeys
    .map((k: string) => (typeof k === "string" ? k.trim() : ""))
    .filter(Boolean);

  if (cleanKeys.length === 0) {
    res.status(400).json({
      error: "API key cung cấp không hợp lệ.",
      code: "INVALID_API_KEY",
    });
    return;
  }

  req.body.apiKeys = cleanKeys;
  next();
}

// --- Session Management Endpoints ---
router.post("/session-keys", createSessionHandler);
router.get("/session-keys/status", getSessionStatusHandler);
router.delete("/session-keys", deleteSessionHandler);

// --- Routes for Glossary & Guidelines Analysis (Ephemeral in-memory processing) ---
router.post("/analyze-glossary", extractCustomRpmMiddleware, requireEphemeralApiKeys, validateModelMiddleware, analyzeGlossary);
router.post("/analyze-guidelines", extractCustomRpmMiddleware, requireEphemeralApiKeys, validateModelMiddleware, analyzeGuidelines);
router.post("/extract-glossary", extractCustomRpmMiddleware, requireEphemeralApiKeys, validateModelMiddleware, extractGlossary);
router.post("/quick-translate-term", (_req: Request, res: Response) => {
  res.status(410).json({
    error: "Endpoint đã chuyển sang chế độ gọi trực tiếp phía Client (Client-Direct) để bảo mật API key cá nhân.",
    code: "ENDPOINT_MIGRATED_CLIENT_DIRECT",
  });
});

// --- Routes for Translation Tasks ---
router.post("/translate-raw", idempotencyMiddleware, extractCustomRpmMiddleware, requireEphemeralApiKeys, validateModelMiddleware, translateRaw);
router.post("/polish-translation", idempotencyMiddleware, extractCustomRpmMiddleware, requireEphemeralApiKeys, validateModelMiddleware, polishTranslation);
router.post("/qa-critique", idempotencyMiddleware, extractCustomRpmMiddleware, requireEphemeralApiKeys, validateModelMiddleware, qaCritique);

// --- Routes for Bilingual alignment ---
router.post("/align-chapter", extractCustomRpmMiddleware, requireEphemeralApiKeys, validateModelMiddleware, alignChapter);

// --- Routes for Quota & Usage Tracking & Model Verification ---
router.post("/quota-status", getQuotaStatusHandler);
router.post("/quota-groups/configure", configureQuotaGroupsHandler);
router.post("/models-for-key", (_req: Request, res: Response) => {
  res.status(410).json({
    error: "Endpoint đã chuyển sang chế độ gọi trực tiếp phía Client (Client-Direct) để bảo mật API key cá nhân.",
    code: "ENDPOINT_MIGRATED_CLIENT_DIRECT",
  });
});
router.post("/verify-model", (_req: Request, res: Response) => {
  res.status(410).json({
    error: "Endpoint đã chuyển sang chế độ gọi trực tiếp phía Client (Client-Direct) để bảo mật API key cá nhân.",
    code: "ENDPOINT_MIGRATED_CLIENT_DIRECT",
  });
});


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
