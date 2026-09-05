import { Request, Response } from "express";
import { Type } from "@google/genai";
import { generateWithRotation, sleep, isOverloadError, isSafetyOrEmptyError, SafetyFilterError } from "../services/geminiService";
import { normalizeUpstreamError } from "../utils/errorClassifier";
import { AIErrorCode } from "../constants/errors";
import { safeParseJson, findSplitPoint, splitTextAdaptively, splitTextIntoChunks, estimateTokenCount, LITERARY_TRANSLATION_FRAMING, sanitizePromptInput } from "../utils/text";
import { translationChunkCache } from "../utils/chunkCache";
import { parseGlossaryFromMd } from "../utils/parser";
import { validateAndSnapBackEntities, isHanEquivalent } from "@shared/sinoNormalize";
import { buildEntityExtractionInstruction, buildEntitySchema } from "../utils/glossaryPrompts";
import { GLOSSARY_LIMITS } from "@shared/constants";
import { validateGlossaryTextBody, validateGuidelinesBody, validateQuickTranslateTermBody } from "../utils/validation";
import { Logger } from "../utils/logger";

const logger = new Logger("Glossary");

const { MAX_CHARS_FOR_GLOSSARY_ANALYSIS, MAX_CHARS_FOR_GUIDELINES_ANALYSIS } = GLOSSARY_LIMITS;

// Rà soát thuật ngữ sót sau giai đoạn dịch thô
export async function checkLeftoverGlossary(
    sourceText: string,
    glossary: any[],
    apiKeys: string[] | undefined,
    modelName: string | undefined,
    startKeyIndex: number = 0,
    customRpm?: number
): Promise<{ items: any[]; successKeyIndex: number }> {
  try {
    let glossaryStr = "";
    if (Array.isArray(glossary) && glossary.length > 0) {
      glossaryStr = glossary.map((g: any) => `- Trung: [${g.chinese}${g.variants?.length ? ' / ' + g.variants.join(' / ') : ''}] -> Việt: [${g.vietnamese}]`).join("\n");
    } else {
      glossaryStr = "(Trống)";
    }

    const systemInstruction =
        LITERARY_TRANSLATION_FRAMING +
        "Bạn là trợ lý rà soát thuật ngữ dịch thuật chuyên nghiệp Trung - Việt.\n" +
        "Nhiệm vụ của bạn là rà soát văn bản gốc tiếng Trung để tìm xem còn nhân vật, địa danh, chiêu thức bối cảnh nào bị bỏ sót hay chưa được cấu hình trong bảng từ điển được cung cấp không.\n" +
        "Lưu ý: Chỉ trích xuất từ bị sót CHƯA CÓ trong bảng từ điển được cung cấp. Nếu không bị sót từ nào, hãy trả về danh sách trống.\n" +
        buildEntityExtractionInstruction('checkLeftover');

    const cleanSourceText = sanitizePromptInput(sourceText);
    const prompt = `--- TỪ ĐIỂN ĐÃ CÓ (ĐÃ ĐƯỢC THIẾT LẬP) ---
${glossaryStr}

--- VĂN BẢN TIẾNG TRUNG GỐC CẦN RÀ SOÁT ---
${cleanSourceText}

Hãy rà soát kỹ văn bản trên, xem còn tên riêng, thuật ngữ nào bị sót không.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        missingEntities: {
          type: Type.ARRAY,
          description: "Danh sách thuật ngữ phát hiện bị bỏ sót trong bảng từ điển.",
          items: buildEntitySchema('checkLeftover')
        }
      },
      required: ["missingEntities"]
    };

    const rotationResult = await generateWithRotation(
        apiKeys,
        modelName,
        systemInstruction,
        prompt,
        schema,
        0.1,
        startKeyIndex,
        customRpm
    );
    const resultText = rotationResult.text;
    if (resultText) {
      const parsed = safeParseJson(resultText);
      const items = Array.isArray(parsed?.missingEntities) ? parsed.missingEntities : [];
      const validatedItems = validateAndSnapBackEntities(items, sourceText);
      return {
        items: validatedItems,
        successKeyIndex: rotationResult.successKeyIndex
      };
    }
  } catch (error) {
    logger.error("[checkLeftoverGlossary Error] Thất bại rà soát từ sót:", error);
  }
  return { items: [], successKeyIndex: startKeyIndex };
}

const MAX_CHUNKS_TO_ANALYZE = 5; // Tối đa 5 phân đoạn (~40,000 ký tự) để tránh quá tải API

async function callGlossaryAnalysisDirect(
    text: string,
    apiKeys: string[] | undefined,
    model: string | undefined,
    startKeyIndex: number,
    systemInstruction: string,
    schema: any
): Promise<{ suggestions: any[]; successKeyIndex: number }> {
  const rotationResult = await generateWithRotation(
      apiKeys,
      model,
      systemInstruction,
      text,
      schema,
      0.2,
      startKeyIndex
  );

  const resultText = rotationResult.text;
  if (!resultText) {
    throw new SafetyFilterError("Kết quả phân tích bị trống rỗng (nghi ngờ vi phạm bộ lọc an toàn).");
  }

  const parsedResult = safeParseJson(resultText);
  const suggestions = parsedResult && Array.isArray(parsedResult.suggestions) ? parsedResult.suggestions : [];
  return {
    suggestions,
    successKeyIndex: rotationResult.successKeyIndex
  };
}

async function analyzeGlossaryWithContentSplit(
    text: string,
    apiKeys: string[] | undefined,
    model: string | undefined,
    systemInstruction: string,
    schema: any,
    depth = 0,
    startKeyIndex = 0
): Promise<{ suggestions: any[]; successKeyIndex: number }> {
  const cacheKey = translationChunkCache.generateKey("glossary", text, { model });
  const cached = translationChunkCache.get(cacheKey);
  if (cached && Array.isArray(cached.suggestions)) {
    logger.info(`[Cache Hit - Glossary] Tận dụng gợi ý thuật ngữ lưu đệm (${cached.suggestions.length} từ)`);
    return {
      suggestions: cached.suggestions,
      successKeyIndex: startKeyIndex,
    };
  }

  if (estimateTokenCount(text) < 180 || depth > 4) {
    try {
      const directRes = await callGlossaryAnalysisDirect(text, apiKeys, model, startKeyIndex, systemInstruction, schema);
      if (directRes.suggestions) {
        translationChunkCache.set(cacheKey, { suggestions: directRes.suggestions });
      }
      return directRes;
    } catch (leafErr: any) {
      if (depth > 0) {
        logger.warn(`[Glossary Split Leaf Fallback] Phân đoạn lá (depth ${depth}, ~${text.length} ký tự) bị lỗi/chặn bộ lọc. Trả về mảng rỗng thay vì crash:`, leafErr.message);
        return {
          suggestions: [],
          successKeyIndex: startKeyIndex
        };
      }
      throw leafErr;
    }
  }

  if (depth > 0) {
    await sleep(depth * 600);
  }

  try {
    const directRes = await callGlossaryAnalysisDirect(text, apiKeys, model, startKeyIndex, systemInstruction, schema);
    if (directRes.suggestions) {
      translationChunkCache.set(cacheKey, { suggestions: directRes.suggestions });
    }
    return directRes;
  } catch (error: any) {
    if (error.message && error.message.startsWith("ALL_KEYS_EXHAUSTED")) {
      if (!isSafetyOrEmptyError(error)) {
        throw error;
      }
    }

    if (isSafetyOrEmptyError(error)) {
      const partsCount = depth >= 2 ? 3 : 2;
      logger.warn(`[Divide & Conquer Adaptive Split Glossary] Phát hiện lỗi ở Độ sâu ${depth}, đang chia ${partsCount} phần (đoạn ${text.length} ký tự)...`);

      await sleep((depth + 1) * 750);

      const parts = splitTextAdaptively(text, partsCount);

      if (parts.length <= 1) {
        if (depth > 0) {
          logger.warn(`[Divide & Conquer Glossary Fallback] Không thể chia nhỏ hơn tại depth ${depth}. Trả về mảng rỗng.`);
          return {
            suggestions: [],
            successKeyIndex: startKeyIndex
          };
        }
        throw error;
      }

      logger.info(`[Divide & Conquer Adaptive Split Glossary] Chia thành ${parts.length} phần: ${parts.map((p, idx) => `P${idx + 1}(${p.length} ký tự)`).join(' & ')}`);
      const results = await Promise.all(
        parts.map(async (part) => {
          try {
            return await analyzeGlossaryWithContentSplit(part, apiKeys, model, systemInstruction, schema, depth + 1, startKeyIndex);
          } catch {
            return {
              suggestions: [],
              successKeyIndex: startKeyIndex
            };
          }
        })
      );

      const combinedSuggestions = results.flatMap(r => r.suggestions || []);
      const lastSuccessKey = results[results.length - 1].successKeyIndex;

      translationChunkCache.set(cacheKey, { suggestions: combinedSuggestions });

      return {
        suggestions: combinedSuggestions,
        successKeyIndex: lastSuccessKey
      };
    }
    throw error;
  }
}

// 1. API: Phân tích trích xuất gợi ý thuật ngữ từ văn bản thô
export async function analyzeGlossary(req: Request, res: Response): Promise<void> {
  try {
    const validation = validateGlossaryTextBody(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const { apiKeys, model, startKeyIndex = 0, chapterId, sourceChapterId } = req.body;
    const text = sanitizePromptInput(req.body.text);

    const chunks = splitTextIntoChunks(text, MAX_CHARS_FOR_GLOSSARY_ANALYSIS);
    const chunksToProcess = chunks.slice(0, MAX_CHUNKS_TO_ANALYZE);
    const hasTruncatedChunks = chunks.length > MAX_CHUNKS_TO_ANALYZE;
    const totalAnalyzedLength = chunksToProcess.reduce((sum, chunk) => sum + chunk.length, 0);

    const systemInstruction =
        LITERARY_TRANSLATION_FRAMING +
        "Bạn là trợ lý phân tích ngôn lý học tiếng Trung chuyên về truyện văn học, kiếm hiệp, thế giới giả tưởng. " +
        "Nhiệm vụ của bạn là đọc kỹ đoạn văn bản tiếng Trung, trích xuất tất cả các tên nhân vật (characters), địa danh quan trọng (locations), bí kíp/vũ khí/thuật ngữ chuyên môn (terms) xuất hiện. " +
        buildEntityExtractionInstruction('analyze');

    const schema = {
      type: Type.OBJECT,
      properties: {
        suggestions: {
          type: Type.ARRAY,
          description: "Danh sách thuật ngữ trích xuất được",
          items: buildEntitySchema('analyze')
        }
      },
      required: ["suggestions"]
    };

    const textToAnalyze = text.substring(0, totalAnalyzedLength);

    let result = { suggestions: [] as any[], successKeyIndex: startKeyIndex };
    try {
      result = await analyzeGlossaryWithContentSplit(
          textToAnalyze,
          apiKeys,
          model,
          systemInstruction,
          schema,
          0,
          startKeyIndex
      );
    } catch (splitError: any) {
      if (isSafetyOrEmptyError(splitError)) {
        logger.warn("[analyzeGlossary Fallback] Đoạn văn bản bị bộ lọc an toàn chặn toàn bộ. Trả về danh sách trống an toàn:", splitError.message);
        result = { suggestions: [], successKeyIndex: startKeyIndex };
      } else {
        throw splitError;
      }
    }

    const allSuggestions = result.suggestions;

    // Loại bỏ trùng lặp dựa trên chữ Hán
    const uniqueSuggestions: any[] = [];
    for (const item of allSuggestions) {
      if (!item || typeof item.chinese !== "string") continue;
      const isDuplicate = uniqueSuggestions.some((existingItem) =>
        isHanEquivalent(existingItem.chinese, item.chinese)
      );
      if (!isDuplicate) {
        uniqueSuggestions.push(item);
      }
    }

    const validatedSuggestions = validateAndSnapBackEntities(uniqueSuggestions, text);

    const resolvedChapterId = sourceChapterId || chapterId;
    let finalSuggestions = validatedSuggestions;
    if (resolvedChapterId) {
      finalSuggestions = validatedSuggestions.map((s: any) => ({
        ...s,
        sourceChapterId: resolvedChapterId
      }));
    }

    res.json({
      suggestions: finalSuggestions,
      successKeyIndex: result.successKeyIndex,
      ...(hasTruncatedChunks ? { truncated: true, originalLength: text.length, analyzedLength: totalAnalyzedLength } : {})
    });
  } catch (error: any) {
    logger.error("Lỗi phân tích Glossary:", error);
    const normalized = normalizeUpstreamError(error);
    res.status(normalized.httpStatus).json({
      error: normalized.message || "Đã xảy ra lỗi khi phân tích thuật ngữ.",
      code: normalized.code,
      isRetryable: normalized.isRetryable,
      ...(normalized.retryAfterSec ? { retryAfterSec: normalized.retryAfterSec } : {}),
      ...(normalized.code === AIErrorCode.OVERLOADED ? { errorType: 'overload' } : {})
    });
  }
}

// API: Phân tích cẩm nang Markdown (.md) để cập nhật bối cảnh truyện
export async function analyzeGuidelines(req: Request, res: Response): Promise<void> {
  try {
    const rawContent = req.body.text || req.body.content;
    if (!rawContent || typeof rawContent !== "string" || rawContent.trim().length === 0) {
      res.status(400).json({ error: "Nội dung cẩm nang không hợp lệ hoặc đang để trống." });
      return;
    }

    const text = sanitizePromptInput(rawContent);
    const { apiKeys, model, startKeyIndex = 0 } = req.body;

    const parsedGlossary = parseGlossaryFromMd(text);
    logger.info(`[analyze-guidelines] Regex parse: ${parsedGlossary.length} thuật ngữ.`);

    const guidelinesSection = text.slice(0, MAX_CHARS_FOR_GUIDELINES_ANALYSIS);
    const isGuidelinesTruncated = text.length > MAX_CHARS_FOR_GUIDELINES_ANALYSIS;

    const systemInstruction =
        LITERARY_TRANSLATION_FRAMING +
        "Bạn là trợ lý dịch thuật AI lão luyện chuyên phân tích cẩm nang dịch thuật.\n" +
        "Nhiệm vụ: Đọc phần hướng dẫn phong cách dịch và xác định:\n" +
        "1. Thể loại truyện (genre)\n" +
        "2. Tông giọng biên dịch (tone)\n" +
        "3. Tóm tắt chi tiết quy tắc xưng hô và phong cách dịch (description)\n" +
        "KHÔNG cần trích xuất bảng thuật ngữ — đã được xử lý riêng bằng parser.";
    const prompt = `Phân tích phần hướng dẫn phong cách dịch thuật sau:\n\n${guidelinesSection}`;
    const schema = {
      type: Type.OBJECT,
      properties: {
        genre: {
          type: Type.STRING,
          description: "Thể loại truyện suy đoán từ cẩm nang dịch thuật",
          enum: ["Tiên Hiệp", "Võ Hiệp", "Ngôn Tình", "Đô Thị", "Huyền Huyễn", "Huyền Huyễn Phương Tây", "Vô Hạn Lưu", "Lịch Sử / Quân Sự", "Khoa Huyễn / Võng Du", "Linh Dị / Thần Quái", "Hệ Thống / Điền Văn", "Khác"],
        },
        tone: {
          type: Type.STRING,
          description: "Tông giọng biên dịch phù hợp nhất",
          enum: ["Dịch thuần Việt mượt mà", "Trang nghiêm cổ phong", "Bình dị dân dã", "Hùng tráng dồn dập", "Trầm hùng dã sử", "Hiện đại công nghệ", "Kịch tính ly kỳ", "Nhẹ nhàng điền văn"],
        },
        description: {
          type: Type.STRING,
          description: "Tóm tắt chi tiết nguyên tắc xưng hô và phong cách dịch từ cẩm nang.",
        },
      },
      required: ["genre", "tone", "description"],
    };
    const rotationResult = await generateWithRotation(
        apiKeys,
        model,
        systemInstruction,
        prompt,
        schema,
        0.1,
        startKeyIndex
    );
    if (!rotationResult.text) {
      throw new Error("Không có phản hồi từ máy chủ trí tuệ nhân tạo.");
    }

    const aiMeta = safeParseJson(rotationResult.text);

    res.json({
      extractedGlossary: parsedGlossary,
      genre: aiMeta.genre,
      tone: aiMeta.tone,
      description: aiMeta.description,
      successKeyIndex: rotationResult.successKeyIndex,
      ...(isGuidelinesTruncated ? { truncated: true, originalLength: text.length, analyzedLength: MAX_CHARS_FOR_GUIDELINES_ANALYSIS } : {})
    });
  } catch (error: any) {
    logger.error("Lỗi phân tích cẩm nang hướng dẫn dịch thuật .md:", error);
    const normalized = normalizeUpstreamError(error);
    res.status(normalized.httpStatus).json({
      error: normalized.message || "Đã xảy ra lỗi khi phân tích cẩm nang hướng dẫn.",
      code: normalized.code,
      isRetryable: normalized.isRetryable,
      ...(normalized.retryAfterSec ? { retryAfterSec: normalized.retryAfterSec } : {}),
      ...(normalized.code === AIErrorCode.OVERLOADED ? { errorType: 'overload' } : {})
    });
  }
}

// API: Trích xuất nhanh thuật ngữ (Tương thích với AutoTranslator)
export async function extractGlossary(req: Request, res: Response): Promise<void> {
  try {
    const validation = validateGlossaryTextBody(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const { apiKeys, model, startKeyIndex = 0, chapterId, sourceChapterId } = req.body;
    const text = sanitizePromptInput(req.body.text);

    const systemInstruction =
        LITERARY_TRANSLATION_FRAMING +
        "Bạn là trợ lý phân tích ngôn lý học tiếng Trung chuyên về truyện văn học, kiếm hiệp, thế giới giả tưởng. " +
        "Nhiệm vụ của bạn là đọc kỹ đoạn văn bản tiếng Trung và trích xuất tất cả tên nhân vật, địa danh, bí kíp/vũ khí/thuật ngữ chuyên môn. " +
        buildEntityExtractionInstruction('extract');

    const schema = {
      type: Type.ARRAY,
      items: buildEntitySchema('extract')
    };

    const prompt = `Phân tích đoạn truyện chữ sau và trích xuất thuật ngữ:\n\n${text}`;
    const rotationResult = await generateWithRotation(
        apiKeys,
        model,
        systemInstruction,
        prompt,
        schema,
        0.2,
        startKeyIndex
    );
    const resultText = rotationResult.text;
    if (!resultText) throw new SafetyFilterError("Không nhận được kết quả từ AI.");

    let parsed: any;
    try {
      parsed = safeParseJson(resultText);
    } catch {
      parsed = [];
    }

    const parsedGlossary = Array.isArray(parsed) ? parsed : (parsed?.suggestions || []);
    let validatedGlossary = validateAndSnapBackEntities(parsedGlossary, text);
    const resolvedChapterId = sourceChapterId || chapterId;
    if (resolvedChapterId) {
      validatedGlossary = validatedGlossary.map((s: any) => ({
        ...s,
        sourceChapterId: resolvedChapterId
      }));
    }
    res.json({ glossary: validatedGlossary, successKeyIndex: rotationResult.successKeyIndex });
  } catch (error: any) {
    if (isSafetyOrEmptyError(error)) {
      logger.warn("[extractGlossary Fallback] Trích xuất nhanh bị chặn bởi bộ lọc. Trả về mảng rỗng.");
      res.json({ glossary: [], successKeyIndex: req.body.startKeyIndex || 0, warning: "Bị chặn bởi bộ lọc an toàn." });
      return;
    }
    logger.error("Lỗi extract-glossary:", error);
    const normalized = normalizeUpstreamError(error);
    res.status(normalized.httpStatus).json({
      error: normalized.message || "Đã xảy ra lỗi khi trích xuất thuật ngữ.",
      code: normalized.code,
      isRetryable: normalized.isRetryable,
      ...(normalized.retryAfterSec ? { retryAfterSec: normalized.retryAfterSec } : {}),
      ...(normalized.code === AIErrorCode.OVERLOADED ? { errorType: 'overload' } : {})
    });
  }
}

// API: Dịch nhanh cụm từ bôi đen với ngữ cảnh
export async function quickTranslateTerm(req: Request, res: Response): Promise<void> {
  try {
    const validation = validateQuickTranslateTermBody(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const { apiKeys, model, startKeyIndex = 0 } = req.body;
    const term = sanitizePromptInput(req.body.term);
    const contextText = sanitizePromptInput(req.body.contextText || "");

    const systemInstruction =
        LITERARY_TRANSLATION_FRAMING +
        "Bạn là trợ lý dịch thuật Trung - Việt lão luyện tinh thông Hán học và văn học mạng (tiên hiệp, võ hiệp, ngôn tình, huyền huyễn, đô thị).\n" +
        "Nhiệm vụ của bạn là phân tích từ hoặc cụm từ tiếng Trung được bôi đen và ngữ cảnh xung quanh của nó (nếu có), từ đó đề xuất định nghĩa từ điển phù hợp gồm:\n" +
        "1. chinese: giữ nguyên từ tiếng Trung gốc.\n" +
        "2. pinyin: phiên âm Hán-Việt chuẩn xác của cụm từ (ví dụ: '萧炎' -> 'Tiêu Viêm', '斗罗大陆' -> 'Đấu La Đại Lục', '斗破苍穹' -> 'Đấu Phá Thương Khung').\n" +
        "3. vietnamese: gợi ý dịch thuần Việt hay hoặc giữ nguyên nghĩa Hán-Việt (ví dụ với nhân vật/địa danh).\n" +
        "4. type: loại thuật ngữ ('character' nếu là tên người/nhân vật, 'location' nếu là địa danh/nơi chốn, 'term' nếu là chiêu thức/bí kíp/vật phẩm, 'phrase' nếu là thành ngữ/cụm từ phổ biến, 'other' cho loại khác).\n" +
        "5. note: giải nghĩa ngắn gọn hoặc ghi chú vai trò của từ này trong ngữ cảnh.";

    const schema = {
      type: Type.OBJECT,
      properties: {
        chinese: { type: Type.STRING },
        pinyin: { type: Type.STRING },
        vietnamese: { type: Type.STRING },
        type: {
          type: Type.STRING,
          enum: ["character", "location", "term", "phrase", "other"]
        },
        note: { type: Type.STRING }
      },
      required: ["chinese", "pinyin", "vietnamese", "type", "note"]
    };

    const prompt = `Cụm từ bôi đen: "${term.trim()}"\n${contextText ? `Ngữ cảnh xung quanh: "... ${contextText.trim()} ..."` : ""}`;

    const rotationResult = await generateWithRotation(
        apiKeys,
        model,
        systemInstruction,
        prompt,
        schema,
        0.1,
        startKeyIndex
    );
    const resultText = rotationResult.text;
    if (!resultText) throw new Error("Không nhận được kết quả từ AI.");

    const parsed = safeParseJson(resultText);
    res.json({ term: parsed, successKeyIndex: rotationResult.successKeyIndex });
  } catch (error: any) {
    logger.error("Lỗi quick-translate-term:", error);
    const normalized = normalizeUpstreamError(error);
    res.status(normalized.httpStatus).json({
      error: normalized.message || "Đã xảy ra lỗi khi phân tích thuật ngữ.",
      code: normalized.code,
      isRetryable: normalized.isRetryable,
      ...(normalized.retryAfterSec ? { retryAfterSec: normalized.retryAfterSec } : {}),
      ...(normalized.code === AIErrorCode.OVERLOADED ? { errorType: 'overload' } : {})
    });
  }
}

