import { Request, Response } from "express";
import { Type } from "@google/genai";
import { generateWithRotation } from "../services/geminiService.ts";
import { safeParseJson } from "../utils/text.ts";
import { parseGlossaryFromMd } from "../utils/parser.ts";
import { validateAndSnapBackEntities, isHanEquivalent } from "../../shared/sinoNormalize.ts";
import { buildEntityExtractionInstruction, buildEntitySchema } from "../utils/glossaryPrompts.ts";

// --- GIỚI HẠN CẮT VĂN BẢN ĐẦU VÀO ---
// Giới hạn ký tự gửi đến Gemini để tiết kiệm token/chi phí API.
// analyzeGlossary cần nhiều ngữ cảnh hơn (trích xuất nhân vật/địa danh),
// analyzeGuidelines chỉ cần phần hướng dẫn phong cách (thường ở đầu file).
const MAX_CHARS_FOR_GLOSSARY_ANALYSIS = 8000;
const MAX_CHARS_FOR_GUIDELINES_ANALYSIS = 4000;

// Rà soát thuật ngữ sót sau giai đoạn dịch thô
export async function checkLeftoverGlossary(
    sourceText: string,
    glossary: any[],
    apiKeys: string[] | undefined,
    modelName: string | undefined,
    startKeyIndex: number = 0
): Promise<{ items: any[]; successKeyIndex: number }> {
  try {
    let glossaryStr = "";
    if (Array.isArray(glossary) && glossary.length > 0) {
      glossaryStr = glossary.map((g: any) => `- Trung: [${g.chinese}${g.variants?.length ? ' / ' + g.variants.join(' / ') : ''}] -> Việt: [${g.vietnamese}]`).join("\n");
    } else {
      glossaryStr = "(Trống)";
    }

    const systemInstruction =
        "Bạn là trợ lý rà soát thuật ngữ dịch thuật chuyên nghiệp Trung - Việt.\n" +
        "Nhiệm vụ của bạn là rà soát văn bản gốc tiếng Trung để tìm xem còn nhân vật, địa danh, chiêu thức bối cảnh nào bị bỏ sót hay chưa được cấu hình trong bảng từ điển được cung cấp không.\n" +
        "Lưu ý: Chỉ trích xuất từ bị sót CHƯA CÓ trong bảng từ điển được cung cấp. Nếu không bị sót từ nào, hãy trả về danh sách trống.\n" +
        buildEntityExtractionInstruction('checkLeftover');

    const prompt = `--- TỪ ĐIỂN ĐÃ CÓ (ĐÃ ĐƯỢC THIẾT LẬP) ---
${glossaryStr}

--- VĂN BẢN TIẾNG TRUNG GỐC CẦN RÀ SOÁT ---
${sourceText}

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
        startKeyIndex
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
    console.error("[checkLeftoverGlossary Error] Thất bại rà soát từ sót:", error);
  }
  return { items: [], successKeyIndex: startKeyIndex };
}

const MAX_CHUNKS_TO_ANALYZE = 5; // Tối đa 5 phân đoạn (~40,000 ký tự) để tránh quá tải API

/**
 * Phân tách đoạn văn bản dài thành các phần nhỏ hơn có độ dài tối đa maxChunkSize.
 * Ưu tiên ngắt tại ký tự xuống dòng (\n) để không cắt đôi từ/câu.
 */
function splitTextIntoChunks(text: string, maxChunkSize: number): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = "";

  for (const line of lines) {
    // Nếu thêm dòng này vào chunk hiện tại vượt quá maxChunkSize
    if (currentChunk.length + (currentChunk ? 1 : 0) + line.length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      // Nếu bản thân một dòng dài hơn maxChunkSize, phải cắt cứng theo ký tự
      if (line.length > maxChunkSize) {
        let remainingLine = line;
        while (remainingLine.length > maxChunkSize) {
          chunks.push(remainingLine.slice(0, maxChunkSize));
          remainingLine = remainingLine.slice(maxChunkSize);
        }
        currentChunk = remainingLine;
      } else {
        currentChunk = line;
      }
    } else {
      if (currentChunk) {
        currentChunk += "\n" + line;
      } else {
        currentChunk = line;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

// 1. API: Phân tích trích xuất gợi ý thuật ngữ từ văn bản thô
export async function analyzeGlossary(req: Request, res: Response): Promise<void> {
  try {
    const { text, apiKeys, model, startKeyIndex = 0, chapterId, sourceChapterId } = req.body;
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Văn bản tiếng Trung không hợp lệ." });
      return;
    }

    const chunks = splitTextIntoChunks(text, MAX_CHARS_FOR_GLOSSARY_ANALYSIS);
    const chunksToProcess = chunks.slice(0, MAX_CHUNKS_TO_ANALYZE);
    const hasTruncatedChunks = chunks.length > MAX_CHUNKS_TO_ANALYZE;
    const totalAnalyzedLength = chunksToProcess.reduce((sum, chunk) => sum + chunk.length, 0);

    const systemInstruction =
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

    let currentKeyIndex = startKeyIndex;
    const allSuggestions: any[] = [];

    for (let i = 0; i < chunksToProcess.length; i++) {
      const chunk = chunksToProcess[i];
      const prompt = `Phân tích đoạn truyện chữ sau và trích xuất danh sách thực thể${
        chunksToProcess.length > 1 ? ` (Phần ${i + 1}/${chunksToProcess.length})` : ""
      }:\n\n${chunk}`;

      const rotationResult = await generateWithRotation(
          apiKeys,
          model,
          systemInstruction,
          prompt,
          schema,
          0.2,
          currentKeyIndex
      );

      currentKeyIndex = rotationResult.successKeyIndex;
      const resultText = rotationResult.text;
      if (!resultText) {
        throw new Error(`Không nhận được kết quả phân tích từ AI ở phần ${i + 1}.`);
      }

      const parsedResult = safeParseJson(resultText);
      if (parsedResult && Array.isArray(parsedResult.suggestions)) {
        const validated = validateAndSnapBackEntities(parsedResult.suggestions, text);
        allSuggestions.push(...validated);
      }
    }

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

    const resolvedChapterId = sourceChapterId || chapterId;
    let finalSuggestions = uniqueSuggestions;
    if (resolvedChapterId) {
      finalSuggestions = uniqueSuggestions.map((s: any) => ({
        ...s,
        sourceChapterId: resolvedChapterId
      }));
    }

    res.json({
      suggestions: finalSuggestions,
      successKeyIndex: currentKeyIndex,
      ...(hasTruncatedChunks ? { truncated: true, originalLength: text.length, analyzedLength: totalAnalyzedLength } : {})
    });
  } catch (error: any) {
    console.error("Lỗi phân tích Glossary:", error);
    res.status(500).json({ error: error.message || "Đã xảy ra lỗi khi phân tích thuật ngữ." });
  }
}

// API: Phân tích cẩm nang Markdown (.md) để cập nhật bối cảnh truyện
export async function analyzeGuidelines(req: Request, res: Response): Promise<void> {
  try {
    const { text, apiKeys, model, startKeyIndex = 0 } = req.body;
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Văn bản hướng dẫn không hợp lệ." });
      return;
    }

    const parsedGlossary = parseGlossaryFromMd(text);
    console.log(`[analyze-guidelines] Regex parse: ${parsedGlossary.length} thuật ngữ.`);

    const guidelinesSection = text.slice(0, MAX_CHARS_FOR_GUIDELINES_ANALYSIS);
    const isGuidelinesTruncated = text.length > MAX_CHARS_FOR_GUIDELINES_ANALYSIS;

    const systemInstruction =
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
    console.error("Lỗi phân tích cẩm nang hướng dẫn dịch thuật .md:", error);
    res.status(500).json({ error: error.message || "Đã xảy ra lỗi khi phân tích cẩm nang hướng dẫn." });
  }
}

// API: Trích xuất nhanh thuật ngữ (Tương thích với AutoTranslator)
export async function extractGlossary(req: Request, res: Response): Promise<void> {
  try {
    const { text, apiKeys, model, startKeyIndex = 0, chapterId, sourceChapterId } = req.body;
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Văn bản không hợp lệ." });
      return;
    }

    const systemInstruction =
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
    if (!resultText) throw new Error("Không nhận được kết quả từ AI.");

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
    console.error("Lỗi extract-glossary:", error);
    res.status(500).json({ error: error.message || "Đã xảy ra lỗi khi trích xuất thuật ngữ." });
  }
}
