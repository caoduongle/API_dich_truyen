import { Request, Response } from "express";
import { Type } from "@google/genai";
import { generateWithRotation, sleep, isOverloadError, isSafetyOrEmptyError } from "../../services/geminiService";
import { normalizeUpstreamError } from "../../utils/errorClassifier";
import { AIErrorCode } from "../../constants/errors";
import { safeParseJson, splitTextAdaptively, estimateTokenCount, getGenreStyleGuide, escapeRegex, LITERARY_TRANSLATION_FRAMING, separateChapterTitleAndBody, sanitizePromptInput, ensureChapterTitlePreserved, validateTranslationOutput } from "../../utils/text";
import { translationChunkCache } from "../../utils/chunkCache";
import { checkLeftoverGlossary } from "../glossaryController";
import { isHanEquivalent } from "@shared/sinoNormalize";
import { buildPolishTranslationPayload } from "@shared/prompts";
import { validatePolishBody } from "../../utils/validation";
import { Logger } from "../../utils/logger";

const logger = new Logger("PolishTranslation");

/**
 * Gọi trực tiếp tác vụ chuốt văn phong văn học Giai đoạn 2
 */
export async function callPolishDirect(
    sourceText: string,
    rawTranslation: string,
    genre: string,
    tone: string,
    glossary: any[],
    additionalInstructions: string,
    apiKeys: string[] | undefined,
    model: string | undefined,
    startKeyIndex: number = 0,
    description?: string,
    customRpm?: number,
    requestId?: string
): Promise<{ polishedTranslation: string; successKeyIndex: number }> {
  const { systemInstruction, prompt, schema } = buildPolishTranslationPayload({
    sourceText,
    rawTranslation,
    genre,
    tone,
    description,
    glossary,
    additionalInstructions,
    isExtractionEnabled: false,
  });

  const rotationResult = await generateWithRotation(
      apiKeys,
      model,
      systemInstruction,
      prompt,
      schema,
      0.45,
      startKeyIndex,
      customRpm,
      undefined,
      requestId
  );
  const resultText = rotationResult.text;
  if (!resultText) {
    throw new Error("Không nhận được phản hồi chuốt văn từ AI (kết quả trả về trống).");
  }

  let parsed: any;
  try {
    parsed = safeParseJson(resultText);
  } catch (err) {
    logger.error("[JSON Extract Failure - Polish] Nội dung lỗi thô:", resultText);
    throw new Error(`Mô hình trả về văn bản không thể giải mã JSON: ${resultText.substring(0, 100)}`);
  }

  let finalPolishedTranslation = parsed?.polishedTranslation || "";

  // Cơ chế khôi phục key dành cho Gemma
  if (!finalPolishedTranslation || finalPolishedTranslation.trim() === "") {
    const altKey = parsed?.translation || parsed?.text || parsed?.vietnamese || parsed?.output || parsed?.raw_translation || parsed?.polished_translation;
    if (altKey && altKey.trim() !== "") {
      finalPolishedTranslation = altKey;
    }
    else if (resultText && resultText.trim().length > 30) {
      if (!resultText.includes('"polishedTranslation"') && !resultText.includes('"translation"')) {
        finalPolishedTranslation = resultText;
      }
    }
  }

  // Tự động bảo toàn và khôi phục tiêu đề chương nếu bị AI Phase 2 lược bỏ
  finalPolishedTranslation = ensureChapterTitlePreserved(rawTranslation, finalPolishedTranslation);

  // Xác thực bản dịch chuốt không rỗng và không sót tỉ lệ chữ Hán bất thường (> 10%)
  validateTranslationOutput(finalPolishedTranslation);

  return {
    polishedTranslation: finalPolishedTranslation || "",
    successKeyIndex: rotationResult.successKeyIndex
  };
}

export async function polishWithContentSplit(
    sourceText: string,
    rawTranslation: string,
    genre: string,
    tone: string,
    glossary: any[],
    additionalInstructions: string,
    apiKeys: string[] | undefined,
    model: string | undefined,
    depth = 0,
    startKeyIndex: number = 0,
    description?: string,
    enableSegmentTranslation?: boolean,
    customRpm?: number,
    requestId?: string
): Promise<{ polishedTranslation: string; successKeyIndex: number; isPartial?: boolean }> {
  const glossaryFingerprint = Array.isArray(glossary)
    ? glossary.map(g => `${g.chinese || ''}:${g.vietnamese || ''}`).join('|')
    : '';
  const cacheKey = translationChunkCache.generateKey(
    "polish",
    `${sourceText}____SPLIT____${rawTranslation}`,
    { genre, tone, model, extra: `${additionalInstructions}____${description}____${glossaryFingerprint}` }
  );
  const cached = translationChunkCache.get(cacheKey);
  if (cached && cached.text) {
    logger.info(`[Cache Hit - Phase 2] Tận dụng bản dịch chuốt lưu đệm (${cached.text.length} ký tự)`);
    return {
      polishedTranslation: cached.text,
      successKeyIndex: startKeyIndex
    };
  }

  if (enableSegmentTranslation) {
    const sourceLines = sourceText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const rawLines = rawTranslation.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const lineCount = Math.max(sourceLines.length, rawLines.length);

    const polishedParagraphs: string[] = [];
    let currentKeyIdx = startKeyIndex;

    for (let idx = 0; idx < lineCount; idx++) {
      const srcLine = sourceLines[idx] || "";
      const rLine = rawLines[idx] || "";
      if (!srcLine && !rLine) continue;

      const res = await callPolishDirect(
        srcLine,
        rLine,
        genre,
        tone,
        glossary,
        additionalInstructions,
        apiKeys,
        model,
        currentKeyIdx,
        description,
        customRpm,
        requestId
      );
      polishedParagraphs.push(res.polishedTranslation);
      currentKeyIdx = res.successKeyIndex;
    }
    let combinedTranslation = polishedParagraphs.join("\n\n");
    combinedTranslation = ensureChapterTitlePreserved(rawTranslation, combinedTranslation);
    translationChunkCache.set(cacheKey, { text: combinedTranslation });
    return {
      polishedTranslation: combinedTranslation,
      successKeyIndex: currentKeyIdx
    };
  }

  if (estimateTokenCount(sourceText) < 90 || depth > 4) {
    try {
      const directRes = await callPolishDirect(
        sourceText,
        rawTranslation,
        genre,
        tone,
        glossary,
        additionalInstructions,
        apiKeys,
        model,
        startKeyIndex,
        description,
        customRpm,
        requestId
      );
      if (directRes.polishedTranslation) {
        translationChunkCache.set(cacheKey, { text: directRes.polishedTranslation });
      }
      return directRes;
    } catch (leafErr: any) {
      if (depth > 0) {
        logger.warn(`[Polish Leaf Fallback] Đoạn lá (${sourceText.length} ký tự) bị lỗi/chặn bộ lọc. Dùng bản thô thay thế:`, leafErr.message);
        return {
          polishedTranslation: rawTranslation || `[Chưa chuốt văn được đoạn này: ${sourceText.substring(0, 40)}...]`,
          successKeyIndex: startKeyIndex,
          isPartial: true
        };
      }
      throw leafErr;
    }
  }

  // Sleep Backoff: Tránh gửi dồn dập các nhánh đệ quy song song cùng lúc
  if (depth > 0) {
    await sleep(depth * 600);
  }

  try {
    const result = await callPolishDirect(
      sourceText,
      rawTranslation,
      genre,
      tone,
      glossary,
      additionalInstructions,
      apiKeys,
      model,
      startKeyIndex,
      description,
      customRpm,
      requestId
    );

    if (!result.polishedTranslation || result.polishedTranslation.trim().length === 0) {
      if (model && model.toLowerCase().includes('gemma')) {
        logger.warn("[Gemma Fallback - Polish] Phát hiện Gemma lỗi JSON chuốt văn. Kích hoạt cuộc gọi cứu nguy Plain-Text...");

        const plainResult = await generateWithRotation(
            apiKeys,
            model,
            `Bạn là biên tập viên văn học truyện chữ chuyên nghiệp. Hãy chuốt lại đoạn văn dịch sau sang tiếng Việt tự nhiên, mượt mà theo thể loại ${genre} với tông giọng ${tone}. Tuyệt đối KHÔNG trả về định dạng JSON, không giải thích, chỉ trả ra văn bản chuốt thuần túy.`,
            `[BẢN GỐC TIẾNG TRUNG]\n${sourceText}\n\n[BẢN DỊCH THÔ CẦN CHUỐT]\n${rawTranslation}`,
            undefined,
            0.45,
            startKeyIndex,
            customRpm,
            undefined,
            requestId
        );

        if (plainResult.text && plainResult.text.trim().length > 0) {
          const plainText = plainResult.text.trim();
          translationChunkCache.set(cacheKey, { text: plainText });
          return {
            polishedTranslation: plainText,
            successKeyIndex: plainResult.successKeyIndex
          };
        }
      }

      throw new Error("Bản dịch chuốt văn bị rỗng (nghi ngờ vi phạm bộ lọc an toàn ngầm của Google).");
    }

    translationChunkCache.set(cacheKey, { text: result.polishedTranslation });
    return result;
  } catch (error: any) {
    if (error.message && error.message.startsWith("ALL_KEYS_EXHAUSTED")) {
      if (!isSafetyOrEmptyError(error)) {
        throw error;
      }
    }

    if (isSafetyOrEmptyError(error)) {
      const partsCount = depth >= 2 ? 3 : 2;
      logger.warn(`[Divide & Conquer Adaptive Polish] Vi phạm bộ lọc tại Độ sâu ${depth}. Chia thành ${partsCount} phần (Gốc ${sourceText.length} ký tự, Thô ${rawTranslation.length} ký tự)...`);

      await sleep((depth + 1) * 750);

      const sourceParts = splitTextAdaptively(sourceText, partsCount);
      const rawParts = splitTextAdaptively(rawTranslation, sourceParts.length);

      if (sourceParts.length <= 1) {
        if (depth > 0) {
          logger.warn(`[Divide & Conquer Polish Fallback] Không thể chia nhỏ hơn tại depth ${depth}. Dùng bản thô thay thế.`);
          return {
            polishedTranslation: rawTranslation || `[Lỗi chuốt văn đoạn: ${sourceText.substring(0, 40)}...]`,
            successKeyIndex: startKeyIndex,
            isPartial: true
          };
        }
        throw error;
      }

      logger.info(`[Divide & Conquer Adaptive Polish] Chia thành ${sourceParts.length} phần đối chiếu song song.`);
      const results = await Promise.all(
        sourceParts.map(async (srcPart, index) => {
          const matchingRawPart = rawParts[index] || rawParts[rawParts.length - 1] || "";
          const staggeredKeyIndex = Array.isArray(apiKeys) && apiKeys.length > 0
            ? (startKeyIndex + index) % apiKeys.length
            : startKeyIndex;
          try {
            return await polishWithContentSplit(
              srcPart,
              matchingRawPart,
              genre,
              tone,
              glossary,
              additionalInstructions,
              apiKeys,
              model,
              depth + 1,
              staggeredKeyIndex,
              description,
              false,
              customRpm,
              requestId
            );
          } catch (partErr: any) {
            logger.warn(`[Divide & Conquer Fallback Polish] Đoạn (${srcPart.length} ký tự) bị lỗi sau khi chia nhỏ:`, partErr.message);
            return {
              polishedTranslation: matchingRawPart || `[Lỗi chuốt văn đoạn: ${srcPart.substring(0, 40)}...]`,
              successKeyIndex: staggeredKeyIndex,
              isPartial: true
            };
          }
        })
      );

      const hasPartial = results.some(r => r.isPartial);
      const allFailed = results.every(r => r.isPartial);

      if (allFailed && depth === 0) {
        throw error;
      }

      let combinedPolished = results.map(r => r.polishedTranslation).join("\n\n").trim();
      if (depth === 0) {
        combinedPolished = ensureChapterTitlePreserved(rawTranslation, combinedPolished);
      }
      const lastSuccessKey = results.findLast((r: any) => !r.isPartial)?.successKeyIndex ?? results[results.length - 1].successKeyIndex;

      if (!hasPartial) {
        translationChunkCache.set(cacheKey, { text: combinedPolished });
      }

      return {
        polishedTranslation: combinedPolished,
        successKeyIndex: lastSuccessKey,
        isPartial: hasPartial
      };
    }
    throw error;
  }
}

/**
 * POST /api/polish-translation
 * API thực hiện biên tập văn phong mượt mà Giai đoạn 2
 */
export async function polishTranslation(req: Request, res: Response): Promise<void> {
  try {
    const validation = validatePolishBody(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error, requestId: req.id });
      return;
    }

    const { sourceText, rawTranslation, genre, tone, description, glossary, additionalInstructions, apiKeys, model, startKeyIndex = 0, isExtractionEnabled, chapterId, sourceChapterId, enableSegmentTranslation, customRpm } = req.body;

    let newlyDiscoveredDuringPolish: any[] = [];
    let keyIndexAfterCheck = startKeyIndex;

    if (isExtractionEnabled) {
      logger.info("[Polish API] Tiến hành kích hoạt rà soát bổ sung thuật ngữ bị sót...");
      const checkResults = await checkLeftoverGlossary(sourceText, glossary || [], apiKeys, model, startKeyIndex, customRpm);
      keyIndexAfterCheck = checkResults.successKeyIndex;
      if (Array.isArray(checkResults.items) && checkResults.items.length > 0) {
        const resolvedChapterId = sourceChapterId || chapterId;
        newlyDiscoveredDuringPolish = resolvedChapterId
          ? checkResults.items.map((item: any) => ({ ...item, sourceChapterId: resolvedChapterId }))
          : checkResults.items;
        logger.info(`[Polish API] Phát hiện thêm ${newlyDiscoveredDuringPolish.length} thuật ngữ bị bỏ sót during rà soát!`);
      }
    }

    const activeGlossary = [...(glossary || [])];
    if (newlyDiscoveredDuringPolish.length > 0) {
      newlyDiscoveredDuringPolish.forEach((item: any) => {
        const ext = activeGlossary.some((gItem: any) => isHanEquivalent(gItem.chinese, item.chinese));
        if (!ext) {
          activeGlossary.push({
            id: 'glo_polish_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            chinese: item.chinese.trim(),
            pinyin: item.pinyin.trim(),
            vietnamese: item.vietnamese.trim(),
            type: item.type,
            note: item.note.trim()
          });
        }
      });
    }

    const { polishedTranslation, successKeyIndex, isPartial } = await polishWithContentSplit(
        sourceText,
        rawTranslation,
        genre,
        tone,
        activeGlossary,
        additionalInstructions,
        apiKeys,
        model,
        0,
        keyIndexAfterCheck,
        description,
        enableSegmentTranslation,
        customRpm,
        req.id
    );

    res.json({
      polishedTranslation: polishedTranslation || "",
      newlyDiscoveredDuringPolish,
      successKeyIndex,
      isPartial: Boolean(isPartial),
      requestId: req.id
    });
  } catch (error: any) {
    logger.error("Lỗi tối ưu văn phong:", error);
    const normalized = normalizeUpstreamError(error);
    res.status(normalized.httpStatus).json({
      error: normalized.message || "Đã xảy ra lỗi khi tối ưu biên tập.",
      code: normalized.code,
      isRetryable: normalized.isRetryable,
      requestId: req.id,
      ...(normalized.retryAfterSec ? { retryAfterSec: normalized.retryAfterSec } : {}),
      ...(normalized.code === AIErrorCode.OVERLOADED ? { errorType: 'overload' } : {})
    });
  }
}
