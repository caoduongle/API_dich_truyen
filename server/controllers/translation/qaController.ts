import { Request, Response } from "express";
import { Type } from "@google/genai";
import { generateWithRotation } from "../../services/geminiService";
import { normalizeUpstreamError } from "../../utils/errorClassifier";
import { AIErrorCode } from "../../constants/errors";
import { safeParseJson, LITERARY_TRANSLATION_FRAMING, sanitizePromptInput } from "../../utils/text";
import { buildQaCritiquePayload } from "@shared/prompts";
import { Logger } from "../../utils/logger";

const logger = new Logger("QACritique");

/**
 * POST /api/qa-critique
 * API: AI tự động kiểm duyệt chất lượng bản dịch (Critique Phase)
 */
export async function qaCritique(req: Request, res: Response): Promise<void> {
  try {
    const rawSource = req.body.sourceText || req.body.rawTranslation;
    const rawTranslated = req.body.translatedText || req.body.polishedTranslation;

    if (!rawSource || typeof rawSource !== "string" || rawSource.trim().length === 0) {
      res.status(400).json({ error: "Văn bản gốc không hợp lệ hoặc đang để trống." });
      return;
    }
    if (!rawTranslated || typeof rawTranslated !== "string" || rawTranslated.trim().length === 0) {
      res.status(400).json({ error: "Bản dịch không hợp lệ hoặc đang để trống." });
      return;
    }

    const { apiKeys, model, startKeyIndex = 0, customRpm } = req.body;

    const { systemInstruction, prompt, schema } = buildQaCritiquePayload({
      sourceText: rawSource,
      translatedText: rawTranslated,
    });

    const rotationResult = await generateWithRotation(
        apiKeys,
        model,
        systemInstruction,
        prompt,
        schema,
        0.15,
        startKeyIndex,
        customRpm,
        undefined,
        req.id
    );
    const resultText = rotationResult.text;
    if (resultText) {
      const parsed = safeParseJson(resultText);
      res.json({
        isValid: parsed?.isValid ?? true,
        issues: Array.isArray(parsed?.issues) ? parsed.issues : [],
        successKeyIndex: rotationResult.successKeyIndex,
        requestId: req.id
      });
    } else {
      res.json({ isValid: true, issues: [], successKeyIndex: startKeyIndex, requestId: req.id });
    }
  } catch (error: any) {
    logger.error("[QA Critique Error] Thất bại rà soát kiểm duyệt:", error);
    const normalized = normalizeUpstreamError(error);
    res.status(normalized.httpStatus).json({
      error: normalized.message || "Đã xảy ra lỗi khi chạy kiểm duyệt AI.",
      code: normalized.code,
      isRetryable: normalized.isRetryable,
      requestId: req.id,
      ...(normalized.retryAfterSec ? { retryAfterSec: normalized.retryAfterSec } : {}),
      ...(normalized.code === AIErrorCode.OVERLOADED ? { errorType: 'overload' } : {})
    });
  }
}
