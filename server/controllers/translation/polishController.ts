import { Request, Response } from "express";
import { Type } from "@google/genai";
import { generateWithRotation, sleep, isOverloadError, isSafetyOrEmptyError } from "../../services/geminiService";
import { safeParseJson, splitTextAdaptively, estimateTokenCount, getGenreStyleGuide, escapeRegex, LITERARY_TRANSLATION_FRAMING, separateChapterTitleAndBody } from "../../utils/text";
import { translationChunkCache } from "../../utils/chunkCache";
import { checkLeftoverGlossary } from "../glossaryController";
import { isHanEquivalent } from "@shared/sinoNormalize";

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
    description?: string
): Promise<{ polishedTranslation: string; successKeyIndex: number }> {
  let glossaryStr = "";
  if (Array.isArray(glossary) && glossary.length > 0) {
    glossaryStr = glossary
        .map((g: any) => `- Trung: [${g.chinese}${g.variants?.length ? ' / ' + g.variants.join(' / ') : ''}] -> Dịch: [${g.vietnamese}] (${g.note})`)
        .join("\n");
  }

  let substitutedSourceText = sourceText || "";
  const matchedTermsList: string[] = [];
  let totalMatchOccurrences = 0;
  if (Array.isArray(glossary) && glossary.length > 0) {
    const glossaryMap = new Map<string, string>();
    const terms: string[] = [];

    const sortedGlossary = [...glossary].sort((a, b) => {
      const lenA = (a.chinese || "").length;
      const lenB = (b.chinese || "").length;
      return lenB - lenA;
    });

    for (const item of sortedGlossary) {
      if (!item.chinese || !item.chinese.trim()) continue;
      const mainZh = item.chinese.trim();
      const vi = (item.vietnamese || '').trim();
      if (!glossaryMap.has(mainZh)) {
        glossaryMap.set(mainZh, vi);
        terms.push(mainZh);
      }
      if (Array.isArray(item.variants) && item.variants.length > 0) {
        for (const variant of item.variants) {
          if (!variant || !variant.trim()) continue;
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
      const matchCounts = new Map<string, number>();
      const escapedTerms = terms.map(t => escapeRegex(t));
      const pattern = new RegExp(escapedTerms.join('|'), 'g');
      substitutedSourceText = substitutedSourceText.replace(pattern, (match) => {
        const count = (matchCounts.get(match) || 0) + 1;
        matchCounts.set(match, count);
        totalMatchOccurrences++;
        return `[${glossaryMap.get(match) || match}]`;
      });

      matchCounts.forEach((count, term) => {
        matchedTermsList.push(`${term} -> [${glossaryMap.get(term) || term}] (${count} lần)`);
      });
    }
  }

  let matchedSummarySection = "";
  if (totalMatchOccurrences > 0) {
    matchedSummarySection =
        `\n\n--- DANH SÁCH ${totalMatchOccurrences} THUẬT NGỮ ĐÃ ĐƯỢC ĐÁNH DẤU TRỰC TIẾP TRONG VĂN BẢN TRUNG GỐC (BẮT BUỘC KHÔNG BỊ BIẾN DẠNG KHI CHUỐT VĂN) ---\n` +
        matchedTermsList.join("\n");
  }

  const systemInstruction =
      LITERARY_TRANSLATION_FRAMING +
      "Bạn là một dịch giả kiêm nhà biên tập văn học và tác giả tiểu thuyết dịch thuật hàng đầu Việt Nam.\n" +
      "Nhiệm vụ của bạn là thực hiện Giai đoạn 2 (Literary Polishing): Chuốt mịn, nhuận sắc, nâng cao chất lượng văn phong từ bản dịch thô được cung cấp, đối chiếu chặt chẽ với văn bản tiếng Trung gốc.\n\n" +
      "QUY TẮC BẮT BUỘC ĐỂ ĐẠT CHẤT LƯỢNG CAO NHẤT:\n" +
      "1. BẮT BUỘC BẢO TỒN NGUYÊN VẸN 100% CẤU TRÚC PHÂN ĐOẠN (PARAGRAPH BREAKS): Mỗi đoạn văn của nguyên tác tiếng Trung PHẢI tương ứng với một đoạn văn trong bản dịch tiếng Việt, ngăn cách nhau bằng dòng trống (\\n\\n). TUYỆT ĐỐI KHÔNG nén các đoạn văn lại thành một khối văn bản duy nhất. Tiêu đề chương PHẢI đứng riêng biệt trên dòng đầu tiên, cách đoạn văn mở đầu ít nhất 1 dòng trống.\n" +
      "2. Tuyệt đối TÔN TRỌNG và ĐỒNG BỘ 100% các từ khóa, thực thể, tên nhân vật, địa danh, tuyệt kỹ trong bảng Từ điển (Glossary) được cung cấp. BẮT BUỘC dùng đúng tên dịch tiếng Việt đã chỉ định.\n" +
      "3. Khắc phục triệt để giọng văn 'dịch máy gượng gạo' (hạn chế lạm dụng từ 'của', các cấu trúc bị động 'bị/được' vô nghĩa, lặp từ nhiều lần). Sử dụng câu từ tiếng Việt linh hoạt, biến hoá, biểu cảm nhưng tự nhiên, giàu hình ảnh.\n" +
      "4. Chuyển tải chính xác âm hưởng, cảm xúc, không khí của cảnh (chiến đấu hào hùng, bi tráng; đối thoại sâu sắc, sắc sảo; miêu tả tâm trạng tinh tế).\n" +
      "5. TUYỆT ĐỐI KHÔNG được phép tự ý tóm tắt, cắt bỏ hoặc thêm thắt các sự kiện, tình tiết không có trong bản gốc tiếng Trung. Mỗi câu, mỗi ý của nguyên tác đều phải được thể hiện trọn vẹn.\n" +
      `6. Phong cách phù hợp thể loại: ${getGenreStyleGuide(genre)}\n` +
      "7. Khi thấy các tên nhân vật hoặc thuật ngữ được bọc trong ngoặc vuông [Tên_Việt] ở văn bản Trung, hãy dùng đúng tên đó và BỎ NGOẶC VUÔNG trong bản dịch cuối (ví dụ: [Philomena] → Philomena, KHÔNG viết '[Philomena]').\n" +
      (description && description.trim() ? `8. BẮT BUỘC TUÂN THỦ nguyên tắc xưng hô và phong cách dịch đặc biệt của truyện: ${description.trim()}\n` : "") +
      (additionalInstructions && additionalInstructions.trim() ? `9. LƯU Ý BỔ SUNG TỪ NGƯỜI DÙNG: ${additionalInstructions.trim()}` : "");

  let prompt = `--- THÔNG TIN TRUYỆN ---
Thể loại: ${genre || "Tiên Hiệp"}
Tông giọng: ${tone || "Trang nghiêm cổ kính"}
${description && description.trim() ? `Nguyên tắc dịch thuật & Quy tắc xưng hô từ cẩm nang:\n${description.trim()}` : ""}
${additionalInstructions && additionalInstructions.trim() ? `Yêu cầu bổ sung:\n${additionalInstructions.trim()}` : ""}

--- TỪ ĐIỂN TÊN NHÂN VẬT & THUẬT NGỮ (ĐÃ CÓ - BẮT BUỘC TUÂN THỦ) ---
${glossaryStr || "(Không có từ điển tùy chọn, dịch tự động dựa trên âm Hán-Việt phổ thông và ngữ cảnh)"}
${matchedSummarySection}

--- VĂN BẢN TIẾNG TRUNG ĐÃ ĐÁNH DẤU TỪ ĐIỂN ---
(Các tên đã được thay sẵn trong ngoặc vuông [Tên_Việt]. Bắt buộc dùng đúng tên này khi dịch)
${substitutedSourceText}

--- BẢN DỊCH THÔ GIAI ĐOẠN 1 (ĐỂ BIÊN TẬP VÀ CHUỐT MỊN) ---
${rawTranslation}`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      polishedTranslation: {
        type: Type.STRING,
        description: "Toàn bộ nội dung bản dịch tiếng Việt sau khi đã được chuốt mịn văn phong văn học đỉnh cao, giữ nguyên 100% các đoạn văn ngăn cách bằng dòng trống (\\n\\n), tiêu đề chương ở dòng riêng biệt, lời thoại tự nhiên, không bỏ sót bất kỳ chi tiết nào."
      }
    },
    required: ["polishedTranslation"]
  };

  const rotationResult = await generateWithRotation(
      apiKeys,
      model,
      systemInstruction,
      prompt,
      schema,
      0.45,
      startKeyIndex
  );
  const resultText = rotationResult.text;
  if (!resultText) {
    throw new Error("Không nhận được phản hồi chuốt văn từ AI (kết quả trả về trống).");
  }

  let parsed: any;
  try {
    parsed = safeParseJson(resultText);
  } catch (err) {
    console.error("[JSON Extract Failure - Polish] Nội dung lỗi thô:", resultText);
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

  // Tự động phân tách tiêu đề và thân chương nếu bị dính dòng
  finalPolishedTranslation = separateChapterTitleAndBody(finalPolishedTranslation);

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
    enableSegmentTranslation?: boolean
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
    console.log(`[Cache Hit - Phase 2] Tận dụng bản dịch chuốt lưu đệm (${cached.text.length} ký tự)`);
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
        description
      );
      polishedParagraphs.push(res.polishedTranslation);
      currentKeyIdx = res.successKeyIndex;
    }
    const combinedTranslation = polishedParagraphs.join("\n\n");
    translationChunkCache.set(cacheKey, { text: combinedTranslation });
    return {
      polishedTranslation: combinedTranslation,
      successKeyIndex: currentKeyIdx
    };
  }

  if (estimateTokenCount(sourceText) < 90 || depth > 4) {
    try {
      const directRes = await callPolishDirect(sourceText, rawTranslation, genre, tone, glossary, additionalInstructions, apiKeys, model, startKeyIndex, description);
      if (directRes.polishedTranslation) {
        translationChunkCache.set(cacheKey, { text: directRes.polishedTranslation });
      }
      return directRes;
    } catch (leafErr: any) {
      if (depth > 0) {
        console.warn(`[Polish Leaf Fallback] Đoạn lá (depth ${depth}, ~${sourceText.length} ký tự) bị lỗi/chặn bộ lọc. Sử dụng bản dịch thô thay thế:`, leafErr.message);
        return {
          polishedTranslation: rawTranslation || `[Lỗi chuốt văn đoạn: ${sourceText.substring(0, 40)}...]`,
          successKeyIndex: startKeyIndex,
          isPartial: true
        };
      }
      throw leafErr;
    }
  }

  if (depth > 0) {
    await sleep(depth * 600);
  }

  try {
    const result = await callPolishDirect(sourceText, rawTranslation, genre, tone, glossary, additionalInstructions, apiKeys, model, startKeyIndex, description);

    if (!result.polishedTranslation || result.polishedTranslation.trim().length === 0) {
      if (model && model.toLowerCase().includes('gemma')) {
        console.warn("[Gemma Fallback - Polish] Kích hoạt cứu nguy Plain-Text chuốt văn...");

        const plainResult = await generateWithRotation(
            apiKeys,
            model,
            `Bạn là biên tập viên văn học. Hãy chuốt mượt đoạn văn dịch sau sang tiếng Việt tự nhiên theo thể loại ${genre} với tông giọng ${tone}. Tuyệt đối KHÔNG trả về định dạng JSON, chỉ trả ra văn bản chuốt hoàn chỉnh.`,
            `Bản thô:\n${rawTranslation}\n\nBản gốc Trung:\n${sourceText}`,
            undefined,
            0.4,
            startKeyIndex
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
      console.warn(`[Divide & Conquer Adaptive Polish] Vi phạm bộ lọc tại Độ sâu ${depth}. Chia thành ${partsCount} phần (Gốc ${sourceText.length} ký tự, Thô ${rawTranslation.length} ký tự)...`);

      await sleep((depth + 1) * 750);

      const sourceParts = splitTextAdaptively(sourceText, partsCount);
      const rawParts = splitTextAdaptively(rawTranslation, sourceParts.length);

      if (sourceParts.length <= 1) {
        if (depth > 0) {
          console.warn(`[Divide & Conquer Polish Fallback] Không thể chia nhỏ hơn tại depth ${depth}. Dùng bản thô thay thế.`);
          return {
            polishedTranslation: rawTranslation || `[Lỗi chuốt văn đoạn: ${sourceText.substring(0, 40)}...]`,
            successKeyIndex: startKeyIndex,
            isPartial: true
          };
        }
        throw error;
      }

      console.log(`[Divide & Conquer Adaptive Polish] Chia thành ${sourceParts.length} phần đối chiếu song song.`);
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
              description
            );
          } catch (partErr: any) {
            console.warn(`[Divide & Conquer Fallback Polish] Đoạn (${srcPart.length} ký tự) bị lỗi sau khi chia nhỏ:`, partErr.message);
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

      const combinedPolished = results.map(r => r.polishedTranslation).join("\n\n").trim();
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
    const { sourceText, rawTranslation, genre, tone, description, glossary, additionalInstructions, apiKeys, model, startKeyIndex = 0, isExtractionEnabled, chapterId, sourceChapterId, enableSegmentTranslation } = req.body;
    if (!rawTranslation || typeof rawTranslation !== "string") {
      res.status(400).json({ error: "Bản dịch thô không hợp lệ." });
      return;
    }

    let newlyDiscoveredDuringPolish: any[] = [];
    let keyIndexAfterCheck = startKeyIndex;

    if (sourceText && isExtractionEnabled !== false) {
      console.log("[Polish API] Tiến hành kích hoạt rà soát bổ sung thuật ngữ bị sót...");
      const checkResults = await checkLeftoverGlossary(sourceText, glossary || [], apiKeys, model, startKeyIndex);
      keyIndexAfterCheck = checkResults.successKeyIndex;
      if (Array.isArray(checkResults.items) && checkResults.items.length > 0) {
        const resolvedChapterId = sourceChapterId || chapterId;
        newlyDiscoveredDuringPolish = resolvedChapterId
          ? checkResults.items.map((item: any) => ({ ...item, sourceChapterId: resolvedChapterId }))
          : checkResults.items;
        console.log(`[Polish API] Phát hiện thêm ${newlyDiscoveredDuringPolish.length} thuật ngữ bị bỏ sót during rà soát!`);
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
        enableSegmentTranslation
    );

    res.json({
      polishedTranslation: polishedTranslation || "",
      newlyDiscoveredDuringPolish,
      successKeyIndex,
      isPartial: Boolean(isPartial)
    });
  } catch (error: any) {
    console.error("Lỗi tối ưu văn phong:", error);
    res.status(500).json({ error: error.message || "Đã xảy ra lỗi khi tối ưu biên tập.", ...(isOverloadError(error) ? { errorType: 'overload' } : {}) });
  }
}
