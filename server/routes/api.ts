import { Router, Request, Response, NextFunction } from "express";
import {
  analyzeGlossary,
  analyzeGuidelines,
  extractGlossary
} from "../controllers/glossaryController.ts";
import {
  translateRaw,
  polishTranslation
} from "../controllers/translationController.ts";
import {
  alignChapter
} from "../controllers/alignmentController.ts";
import { ALLOWED_MODEL_IDS } from "../constants/models.ts";

const router = Router();

// --- MIDDLEWARE: Kiểm tra model hợp lệ ---
// Chỉ chấp nhận các giá trị model nằm trong whitelist (đồng bộ với AVAILABLE_MODELS frontend)
// để ngăn client gửi tên model tuỳ ý.
function validateModelMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { model } = req.body;
  // Cho phép bỏ trống (backend sẽ dùng DEFAULT_MODEL_ID)
  if (model !== undefined && model !== null && model !== '') {
    if (!ALLOWED_MODEL_IDS.includes(model)) {
      res.status(400).json({
        error: `Mô hình AI "${model}" không được hỗ trợ. Các mô hình hợp lệ: ${ALLOWED_MODEL_IDS.join(', ')}`
      });
      return;
    }
  }
  next();
}

// --- MIDDLEWARE: Chặn fallback dùng key server khi chưa được phép ---
// Khi biến môi trường ALLOW_SERVER_KEY_FALLBACK !== 'true' (mặc định trong production),
// nếu client không gửi apiKeys hợp lệ, trả lỗi 400 thay vì âm thầm dùng key server.
function checkApiKeysFallback(req: Request, res: Response, next: NextFunction): void {
  const { apiKeys } = req.body;
  const hasValidKeys = Array.isArray(apiKeys) && apiKeys.some((k: string) => typeof k === 'string' && k.trim().length > 0);

  if (!hasValidKeys) {
    const allowFallback = process.env.ALLOW_SERVER_KEY_FALLBACK === 'true';
    if (!allowFallback) {
      res.status(400).json({
        error: "Vui lòng cấu hình API key của bạn trong phần 'Cấu hình AI' trước khi sử dụng. Máy chủ đã tắt tính năng tự động dùng key mặc định."
      });
      return;
    }
  }
  next();
}

// Routes for Glossary & Guidelines Analysis
router.post("/analyze-glossary", validateModelMiddleware, checkApiKeysFallback, analyzeGlossary);
router.post("/analyze-guidelines", validateModelMiddleware, checkApiKeysFallback, analyzeGuidelines);
router.post("/extract-glossary", validateModelMiddleware, checkApiKeysFallback, extractGlossary);

// Routes for Translation Tasks
router.post("/translate-raw", validateModelMiddleware, checkApiKeysFallback, translateRaw);
router.post("/polish-translation", validateModelMiddleware, checkApiKeysFallback, polishTranslation);

// Routes for Bilingual alignment
router.post("/align-chapter", validateModelMiddleware, checkApiKeysFallback, alignChapter);

// Health check endpoint
router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;

