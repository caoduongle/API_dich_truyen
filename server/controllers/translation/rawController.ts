import { Request, Response } from "express";
import { Type } from "@google/genai";
import { generateWithRotation, sleep, isOverloadError, isSafetyOrEmptyError } from "../../services/geminiService";
import { normalizeUpstreamError } from "../../utils/errorClassifier";
import { AIErrorCode } from "../../constants/errors";
import { safeParseJson, splitTextAdaptively, estimateTokenCount, getGenreStyleGuide, escapeRegex, LITERARY_TRANSLATION_FRAMING, separateChapterTitleAndBody, sanitizePromptInput, validateTranslationOutput } from "../../utils/text";
import { translationChunkCache } from "../../utils/chunkCache";
import { validateAndSnapBackEntities, findCanonicalSubstring } from "@shared/sinoNormalize";
import { validateTranslateRawBody } from "../../utils/validation";
import { Logger } from "../../utils/logger";

const logger = new Logger("RawTranslation");

/**
 * Gọi trực tiếp tác vụ dịch thô Giai đoạn 1 từ Gemini API
 */
export async function callRawTranslationDirect(
    text: string,
    genre: string,
    tone: string,
    glossary: any[],
    apiKeys: string[] | undefined,
    model: string | undefined,
    startKeyIndex: number = 0,
    description?: string,
    customRpm?: number,
    requestId?: string
): Promise<{ rawTranslation: string; discoveredEntities: any[]; successKeyIndex: number }> {
  let glossaryStr = "";
  if (Array.isArray(glossary) && glossary.length > 0) {
    glossaryStr = glossary
        .map((g: any) => `- Trung: [${g.chinese}${g.variants?.length ? ' / ' + g.variants.join(' / ') : ''}] -> Hán Việt: [${g.pinyin}] -> Việt: [${g.vietnamese}] (Loại: ${g.type}, Ghi chú: ${g.note})`)
        .join("\n");
  } else {
    glossaryStr = "(Không có từ điển tùy chọn, dịch tự động dựa trên âm Hán-Việt phổ thông và ngữ cảnh)";
  }

  // Pre-substitution: thay thế cứng từ điển vào source text trước khi dịch
  let substitutedText = sanitizePromptInput(text);
  if (Array.isArray(glossary) && glossary.length > 0) {
    const glossaryMap = new Map<string, string>();
    const terms: string[] = [];

    const sortedGlossary = [...glossary].sort((a, b) => (b.chinese || "").length - (a.chinese || "").length);
    for (const item of sortedGlossary) {
      if (!item.chinese?.trim() || !item.vietnamese?.trim()) continue;
      const mainZh = item.chinese.trim();
      const vi = item.vietnamese.trim();
      if (!glossaryMap.has(mainZh)) {
        glossaryMap.set(mainZh, vi);
        terms.push(mainZh);
      }
      if (Array.isArray(item.variants) && item.variants.length > 0) {
        for (const variant of item.variants) {
          if (!variant?.trim()) continue;
          const varZh = variant.trim();
          if (!glossaryMap.has(varZh)) {
            glossaryMap.set(varZh, vi);
            terms.push(varZh);
          }
        }
      }
    }

    terms.sort((a, b) => b.length - a.length);

    if (terms.length > 0) {
      const escapedTerms = terms.map(t => escapeRegex(t));
      const pattern = new RegExp(escapedTerms.join('|'), 'g');
      substitutedText = substitutedText.replace(pattern, (match) => `[${glossaryMap.get(match) || match}]`);
    }

    // Dò các biến thể Hán tự phồn thể / giản thể qua canonical mapping
    for (const item of sortedGlossary) {
      if (!item.chinese?.trim() || !item.vietnamese?.trim()) continue;
      const canonicalSub = findCanonicalSubstring(substitutedText, item.chinese);
      if (canonicalSub && !canonicalSub.startsWith('[')) {
        const escCanon = escapeRegex(canonicalSub);
        const regexCanon = new RegExp(escCanon, 'g');
        substitutedText = substitutedText.replace(regexCanon, `[${item.vietnamese}]`);
      }
    }
  }

  const systemInstruction =
      LITERARY_TRANSLATION_FRAMING +
      "Bạn là hệ thống dịch thuật AI cao cấp chuyên dịch truyện chữ Trung Quốc sang tiếng Việt.\n" +
      "Nhiệm vụ của bạn là thực hiện dịch thô Giai đoạn 1 (Translation Draft 1) từ đoạn văn bản tiếng Trung được cung cấp.\n" +
      "YÊU CẦU QUAN TRỌNG NHẤT:\n" +
      "1. BẮT BUỘC BẢO TỒN NGUYÊN VẸN 100% CẤU TRÚC PHÂN ĐOẠN (PARAGRAPH BREAKS): Mỗi đoạn văn của nguyên tác tiếng Trung PHẢI tương ứng với một đoạn văn trong bản dịch tiếng Việt, ngăn cách nhau bằng dòng trống (\\n\\n). TUYỆT ĐỐI KHÔNG nén các đoạn văn lại thành một khối văn bản duy nhất. Tiêu đề chương PHẢI đứng riêng biệt trên dòng đầu tiên, cách đoạn văn mở đầu ít nhất 1 dòng trống.\n" +
      "2. Tôn trọng Tuyệt đối các từ khóa, thực thể và đại từ trong bảng Từ điển (Glossary) được cung cấp. Nếu một từ Trung Quốc xuất hiện trong Glossary, bạn PHẢI dịch chính xác bằng từ tiếng Việt tương ứng.\n" +
      "3. Dịch chính xác nghĩa đơn và bối cảnh câu chữ. Phân biệt rõ ràng người nam là 'hắn/y/chàng', người nữ là 'nàng/cô/y', người già là 'lão', v.v. dựa trên giới tính quy định.\n" +
      "4. Bản dịch thô này cần đủ sát nghĩa gốc chữ Trung, cấu trúc dễ hiểu, không bỏ sót bất kỳ chi tiết hay câu văn nào.\n" +
      "5. Trong quá trình đọc hiểu tiếng Trung gốc, hãy tinh mắt phát hiện NGAY các tên nhân vật mới, địa danh mới, chiêu thức võ công/ma thuật/bí kĩ mới xuất hiện mà CHƯA có trong Từ điển (Glossary) được đối chiếu.\n" +
      `\n6. Phong cách phù hợp thể loại: ${getGenreStyleGuide(genre)}`+
      "Trích xuất chúng và điền vào trường 'vietnamese' như sau: NẾU là phiên âm từ tên tiếng Anh/phương Tây (ví dụ: 阿诗娜 = Athena, 盖伊 = Guy), hãy khôi phục TÊN GỐC TIẾNG ANH.\n" +
      "Nếu có kèm danh từ chỉ loại hoặc đồ vật đi liền phía sau (như 茶, 镇, 城, 国), bắt buộc phải dịch danh từ đó sang tiếng Việt và đưa lên đứng trước tên tiếng Anh (ví dụ: 阿帕茶 -> 'Trà Abbacchio' chứ không phải 'Abbacchio Tea', 伦敦城 -> 'Thành London').\n" +
      "NẾU là tên thuần Trung không có gốc tiếng Anh, dùng phiên âm Hán-Việt hoặc nghĩa tiếng Việt mượt mà.\n" +
      "7. ĐẶC BIỆT QUAN TRỌNG về trường 'chinese' trong discoveredEntities: Bạn PHẢI copy CHÍNH XÁC ký tự Hán như chúng xuất hiện trong VĂN BẢN TIẾNG TRUNG GỐC được cung cấp. TUYỆT ĐỐI KHÔNG tự ý chuyển đổi giữa phồn thể và giản thể. Nếu văn bản gốc viết phồn thể thì trả về phồn thể, giản thể thì trả về giản thể." +
      "8. Khi sử dụng thuật ngữ từ ngoặc vuông [Tên_Việt] trong văn bản đánh dấu, hãy viết KHÔNG có ngoặc vuông trong bản dịch cuối cùng. Ví dụ: [Philomena] → viết 'Philomena', KHÔNG viết '[Philomena]'." +
      (description && description.trim() ? `\n9. BẮT BUỘC TUÂN THỦ nguyên tắc xưng hô và phong cách dịch đặc biệt của truyện: ${description.trim()}` : "");

  const prompt = `--- THÔNG TIN TRUYỆN ---
Thể loại: ${genre || "Tiên Hiệp"}
Tông giọng: ${tone || "Trang nghiêm cổ kính"}
${description && description.trim() ? `Nguyên tắc dịch thuật & Quy tắc xưng hô từ cẩm nang:\n${description.trim()}` : ""}

--- TỪ ĐIỂN TÊN NHÂN VẬT & THUẬT NGỮ (ĐÃ CÓ - BẮT BUỘC TUÂN THỦ) ---
${glossaryStr}

--- VĂN BẢN TIẾNG TRUNG GỐC ---
${text}

--- VĂN BẢN TIẾNG TRUNG ĐÃ ĐÁNH DẤU TỪ ĐIỂN ---
(Các tên đã được thay sẵn trong ngoặc vuông [Tên_Việt]. Bắt buộc dùng đúng tên này khi dịch)
${substitutedText}`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      rawTranslation: {
        type: Type.STRING,
        description: "Bản dịch tiếng Việt thô sát nghĩa gốc, cấu trúc trôi chảy dễ hiểu, giữ nguyên 100% các đoạn văn ngăn cách bằng dòng trống (\\n\\n), tiêu đề chương ở dòng riêng biệt, không bỏ sót bất cứ câu thơ hay lời thoại nào."
      },
      discoveredEntities: {
        type: Type.ARRAY,
        description: "Danh sách các tên riêng nhân vật mới, địa danh mới, chiêu thức võ học/phép thuật mới chưa hề có trong bảng từ điển được cung cấp.",
        items: {
          type: Type.OBJECT,
          properties: {
            chinese: { type: Type.STRING, description: "Từ chữ Trung gốc, ví dụ: '楚风' hoặc '裁决之刃'" },
            pinyin: { type: Type.STRING, description: "Phiên âm Hán-Việt chuẩn của từ đó, ví dụ: 'Sở Phong' hoặc 'Tài Quyết Chi Nhận'" },
            vietnamese: {
              type: Type.STRING,
              description: "Tên gốc tiếng Anh nếu là từ phiên âm ngoại quốc, kèm dịch nghĩa danh từ chỉ loại lên trước nếu có hậu tố chỉ đồ vật/địa danh (ví dụ: 阿帕茶 -> 'Trà Abbacchio' thay vì 'Abbacchio Tea'). Nếu thuần Trung, dùng Hán-Việt."
            },
            type: {
              type: Type.STRING,
              enum: ["character", "location", "term", "phrase", "other"],
              description: "Phân loại: nhân vật (character), địa danh (location), chiêu thức/ma thuật/vũ khí/bí kíp (term), thành ngữ (phrase), khác (other)."
            },
            note: { type: Type.STRING, description: "Dự đoán mô tả vai trò/giới tính dựa theo ngữ cảnh truyện, ví dụ: 'Ma pháp sư trẻ tuổi' hoặc 'Thần thú thời cổ đại' hoặc 'Chiêu thức của mục thiên tông'" }
          },
          required: ["chinese", "pinyin", "vietnamese", "type", "note"]
        }
      }
    },
    required: ["rawTranslation", "discoveredEntities"]
  };

  const rotationResult = await generateWithRotation(
      apiKeys,
      model,
      systemInstruction,
      prompt,
      schema,
      0.3,
      startKeyIndex,
      customRpm,
      undefined,
      requestId
  );
  const resultText = rotationResult.text;
  if (!resultText) {
    throw new Error("Không nhận được phản hồi dịch từ AI (kết quả trả về trống).");
  }

  let parsed: any;
  try {
    parsed = safeParseJson(resultText);
  } catch (err) {
    logger.error("[JSON Extract Failure] Nội dung lỗi thô:", resultText);
    throw new Error(`Mô hình trả về văn bản không thể giải mã JSON: ${resultText.substring(0, 100)}`);
  }

  let finalRawTranslation = parsed?.rawTranslation || "";
  let finalDiscoveredEntities = Array.isArray(parsed?.discoveredEntities) ? parsed.discoveredEntities : [];
  finalDiscoveredEntities = validateAndSnapBackEntities(finalDiscoveredEntities, text);

  // Cơ chế khôi phục key dành cho Gemma
  if (!finalRawTranslation || finalRawTranslation.trim() === "") {
    const altKey = parsed?.translation || parsed?.text || parsed?.vietnamese || parsed?.output || parsed?.raw_translation;
    if (altKey && altKey.trim() !== "") {
      finalRawTranslation = altKey;
    }
    else if (resultText && resultText.trim().length > 30) {
      if (!resultText.includes('"rawTranslation"') && !resultText.includes('"translation"')) {
        finalRawTranslation = resultText;
      }
    }
  }

  // Tự động phân tách tiêu đề và thân chương nếu bị dính dòng
  finalRawTranslation = separateChapterTitleAndBody(finalRawTranslation);

  // Xác thực bản dịch không rỗng và không sót tỉ lệ chữ Hán bất thường (> 10%)
  validateTranslationOutput(finalRawTranslation);

  return {
    rawTranslation: finalRawTranslation || "",
    discoveredEntities: finalDiscoveredEntities,
    successKeyIndex: rotationResult.successKeyIndex
  };
}

export async function translateRawWithContentSplit(
    text: string,
    genre: string,
    tone: string,
    glossary: any[],
    apiKeys: string[] | undefined,
    model: string | undefined,
    depth = 0,
    startKeyIndex: number = 0,
    description?: string,
    enableSegmentTranslation?: boolean,
    customRpm?: number,
    requestId?: string
): Promise<{ rawTranslation: string; discoveredEntities: any[]; successKeyIndex: number; isPartial?: boolean }> {
  const glossaryFingerprint = Array.isArray(glossary)
    ? glossary.map(g => `${g.chinese || ''}:${g.vietnamese || ''}`).join('|')
    : '';
  const cacheKey = translationChunkCache.generateKey("raw", text, {
    genre,
    tone,
    model,
    extra: `${description || ''}____${glossaryFingerprint}`
  });
  const cached = translationChunkCache.get(cacheKey);
  if (cached && cached.text) {
    logger.info(`[Cache Hit - Phase 1] Tận dụng bản dịch lưu đệm (${cached.text.length} ký tự)`);
    return {
      rawTranslation: cached.text,
      discoveredEntities: cached.discoveredEntities || [],
      successKeyIndex: startKeyIndex,
    };
  }

  if (enableSegmentTranslation) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const translatedParagraphs: string[] = [];
    let currentKeyIdx = startKeyIndex;
    const discoveredEntitiesAll: any[] = [];

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      if (!line) continue;
      const res = await callRawTranslationDirect(
        line,
        genre,
        tone,
        glossary,
        apiKeys,
        model,
        currentKeyIdx,
        description,
        customRpm,
        requestId
      );
      translatedParagraphs.push(res.rawTranslation);
      currentKeyIdx = res.successKeyIndex;
      if (Array.isArray(res.discoveredEntities)) {
        discoveredEntitiesAll.push(...res.discoveredEntities);
      }
    }
    const combinedTranslation = translatedParagraphs.join("\n\n");
    translationChunkCache.set(cacheKey, { text: combinedTranslation, discoveredEntities: discoveredEntitiesAll });
    return {
      rawTranslation: combinedTranslation,
      discoveredEntities: discoveredEntitiesAll,
      successKeyIndex: currentKeyIdx
    };
  }

  if (estimateTokenCount(text) < 90 || depth > 4) {
    try {
      const directRes = await callRawTranslationDirect(text, genre, tone, glossary, apiKeys, model, startKeyIndex, description, customRpm, requestId);
      if (directRes.rawTranslation) {
        translationChunkCache.set(cacheKey, { text: directRes.rawTranslation, discoveredEntities: directRes.discoveredEntities });
      }
      return directRes;
    } catch (leafErr: any) {
      if (depth > 0) {
        logger.warn(`[Raw Translation Leaf Fallback] Đoạn lá (depth ${depth}, ~${text.length} ký tự) bị lỗi/chặn bộ lọc. Kích hoạt cứu nguy:`, leafErr.message);
        return {
          rawTranslation: `[Chưa dịch được đoạn này do bộ lọc an toàn: ${text.substring(0, 40)}...]`,
          discoveredEntities: [],
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
    const result = await callRawTranslationDirect(text, genre, tone, glossary, apiKeys, model, startKeyIndex, description, customRpm, requestId);

    if (!result.rawTranslation || result.rawTranslation.trim().length === 0) {
      if (model && model.toLowerCase().includes('gemma')) {
        logger.warn("[Gemma Fallback] Phát hiện Gemma lỗi cấu trúc JSON. Kích hoạt cuộc gọi cứu nguy Plain-Text...");

        const plainResult = await generateWithRotation(
            apiKeys,
            model,
            `Bạn là dịch giả truyện chuyên nghiệp. Hãy dịch đoạn văn sau sang tiếng Việt theo thể loại ${genre} với tông giọng ${tone}. Tuyệt đối KHÔNG trả về định dạng JSON, không giải thích, chỉ trả ra văn bản dịch thuần túy.`,
            text,
            undefined,
            0.3,
            startKeyIndex,
            customRpm,
            undefined,
            requestId
        );

        if (plainResult.text && plainResult.text.trim().length > 0) {
          const plainText = plainResult.text.trim();
          translationChunkCache.set(cacheKey, { text: plainText, discoveredEntities: [] });
          return {
            rawTranslation: plainText,
            discoveredEntities: [],
            successKeyIndex: plainResult.successKeyIndex
          };
        }
      }

      throw new Error("Bản dịch thu được bị trống rỗng (nghi ngờ vi phạm bộ lọc an toàn ngầm của Google).");
    }

    translationChunkCache.set(cacheKey, { text: result.rawTranslation, discoveredEntities: result.discoveredEntities });
    return result;
  } catch (error: any) {
    if (error.message && error.message.startsWith("ALL_KEYS_EXHAUSTED")) {
      if (!isSafetyOrEmptyError(error)) {
        throw error;
      }
    }

    if (isSafetyOrEmptyError(error)) {
      const partsCount = depth >= 2 ? 3 : 2;
      logger.warn(`[Divide & Conquer Adaptive Split] Phát hiện vi phạm bộ lọc / lỗi rỗng tại Độ sâu ${depth}. Tiến hành chia ${partsCount} phần (văn bản dài ${text.length} ký tự)...`);

      await sleep((depth + 1) * 750);

      const parts = splitTextAdaptively(text, partsCount);

      if (parts.length <= 1) {
        if (depth > 0) {
          logger.warn(`[Divide & Conquer Raw Fallback] Không thể chia nhỏ hơn tại depth ${depth}. Kích hoạt cứu nguy đoạn này.`);
          return {
            rawTranslation: `[Chưa dịch được đoạn này do bộ lọc an toàn: ${text.substring(0, 40)}...]`,
            discoveredEntities: [],
            successKeyIndex: startKeyIndex,
            isPartial: true
          };
        }
        throw error;
      }

      logger.info(`[Divide & Conquer Adaptive Split] Chia thành ${parts.length} phần: ${parts.map((p, idx) => `P${idx + 1}(${p.length} ký tự)`).join(' & ')}`);
      const results = await Promise.all(
        parts.map(async (part, index) => {
          const staggeredKeyIndex = Array.isArray(apiKeys) && apiKeys.length > 0
            ? (startKeyIndex + index) % apiKeys.length
            : startKeyIndex;
          try {
            return await translateRawWithContentSplit(
              part,
              genre,
              tone,
              glossary,
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
            logger.warn(`[Divide & Conquer Fallback] Đoạn (${part.length} ký tự) bị lỗi sau khi chia nhỏ:`, partErr.message);
            return {
              rawTranslation: `[Chưa dịch được đoạn này do bộ lọc an toàn: ${part.substring(0, 40)}...]`,
              discoveredEntities: [],
              successKeyIndex: startKeyIndex,
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

      const mergedTranslation = results.map(r => r.rawTranslation).join("\n\n").trim();
      const mergedEntities = results.flatMap(r => r.discoveredEntities || []);
      const lastSuccessKey = results.findLast((r: any) => !r.isPartial)?.successKeyIndex ?? results[results.length - 1].successKeyIndex;

      if (!hasPartial) {
        translationChunkCache.set(cacheKey, { text: mergedTranslation, discoveredEntities: mergedEntities });
      }

      return {
        rawTranslation: mergedTranslation,
        discoveredEntities: mergedEntities,
        successKeyIndex: lastSuccessKey,
        isPartial: hasPartial
      };
    }
    throw error;
  }
}

/**
 * POST /api/translate-raw
 * API dịch thô Giai đoạn 1 bảo lưu đồng bộ danh xưng
 */
export async function translateRaw(req: Request, res: Response): Promise<void> {
  try {
    const validation = validateTranslateRawBody(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error, requestId: req.id });
      return;
    }

    const { text, genre, tone, description, glossary, apiKeys, model, startKeyIndex = 0, chapterId, sourceChapterId, enableSegmentTranslation, customRpm } = req.body;

    const { rawTranslation, discoveredEntities, successKeyIndex, isPartial } = await translateRawWithContentSplit(
        text,
        genre,
        tone,
        glossary,
        apiKeys,
        model,
        0,
        startKeyIndex,
        description,
        enableSegmentTranslation,
        customRpm,
        req.id
    );

    const resolvedChapterId = sourceChapterId || chapterId;
    const finalEntities = resolvedChapterId
      ? (Array.isArray(discoveredEntities) ? discoveredEntities : []).map(ent => ({ ...ent, sourceChapterId: resolvedChapterId }))
      : (Array.isArray(discoveredEntities) ? discoveredEntities : []);

    res.json({
      rawTranslation: rawTranslation || "",
      discoveredEntities: finalEntities,
      successKeyIndex,
      isPartial: Boolean(isPartial),
      requestId: req.id
    });
  } catch (error: any) {
    logger.error("Lỗi dịch thô:", error);
    const normalized = normalizeUpstreamError(error);
    res.status(normalized.httpStatus).json({
      error: normalized.message || "Đã xảy ra lỗi khi thực hiện dịch thô.",
      code: normalized.code,
      isRetryable: normalized.isRetryable,
      requestId: req.id,
      ...(normalized.retryAfterSec ? { retryAfterSec: normalized.retryAfterSec } : {}),
      ...(normalized.code === AIErrorCode.OVERLOADED ? { errorType: 'overload' } : {})
    });
  }
}
