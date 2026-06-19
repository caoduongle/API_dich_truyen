import { Request, Response } from "express";
import { Type } from "@google/genai";
import { generateWithRotation } from "../services/geminiService.ts";
import { safeParseJson } from "../utils/text.ts";
import { parseGlossaryFromMd } from "../utils/parser.ts";
import { validateAndSnapBackEntities } from "../utils/sinoNormalize.ts";

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
      glossaryStr = glossary.map((g: any) => `- Trung: [${g.chinese}] -> Việt: [${g.vietnamese}]`).join("\n");
    } else {
      glossaryStr = "(Trống)";
    }

    const systemInstruction =
        "Bạn là trợ lý rà soát thuật ngữ dịch thuật chuyên nghiệp Trung - Việt.\n" +
        "Nhiệm vụ của bạn là rà soát văn bản gốc tiếng Trung để tìm xem còn nhân vật, địa danh, chiêu thức bối cảnh nào bị bỏ sót hay chưa được cấu hình trong bảng từ điển được cung cấp không.\n" +
        "Lưu ý: Chỉ trích xuất từ bị sót CHƯA CÓ trong bảng từ điển được cung cấp. Nếu không bị sót từ nào, hãy trả về danh sách trống.\n" +
        "QUAN TRỌNG về trường 'vietnamese': Nếu tên nhân vật hoặc địa danh là phiên âm từ tiếng Anh hoặc ngôn ngữ phương Tây (ví dụ: 阿诗娜 = Athena, 盖伊 = Guy), hãy khôi phục và đặt TÊN GỐC TIẾNG ANH vào trường 'vietnamese'.\n" +
        "ĐẶC BIỆT LƯU Ý: Nếu thuật ngữ ngoại quốc có kèm theo danh từ phân loại hoặc đồ vật bằng tiếng Trung ở phía sau (ví dụ: 茶 - trà, 镇 - thị trấn, 河 - sông, 城/市 - thành phố, 🏛️ - điện/tháp...), bạn PHẢI dịch danh từ phân loại đó sang tiếng Việt và ĐẢO LÊN TRƯỚC tên gốc tiếng Anh (Ví dụ: 阿帕茶 phải dịch thành 'Trà Abbacchio' chứ KHÔNG ĐƯỢC để dạng tiếng Anh 'Abbacchio Tea').\n" +
        "Chỉ dùng phiên âm Hán-Việt khi tên/thuật ngữ hoàn toàn gốc Trung Quốc.";

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
          items: {
            type: Type.OBJECT,
            properties: {
              chinese: { type: Type.STRING, description: "Từ chữ Trung bị sót" },
              pinyin: { type: Type.STRING, description: "Phiên âm Hán-Việt chuẩn phù hợp" },
              vietnamese: {
                type: Type.STRING,
                description: "Nếu là phiên âm từ tên tiếng Anh/phương Tây, dùng tên tiếng Anh gốc (ví dụ: 阿诗娜 -> 'Athena'). Nếu đi kèm danh từ chỉ loại, dịch từ chỉ loại đó lên trước tên gốc tiếng Anh (ví dụ: 阿帕茶 -> 'Trà Abbacchio' chứ không phải 'Abbacchio Tea'). Nếu là tên thuần Trung, dùng phiên âm Hán-Việt."
              },
              type: {
                type: Type.STRING,
                enum: ["character", "location", "term", "phrase", "other"],
                description: "Kiểu đối tượng bị sót"
              },
              note: { type: Type.STRING, description: "Mô tả vai trò/ý nghĩa dự kiến của đối tượng theo văn cảnh" }
            },
            required: ["chinese", "pinyin", "vietnamese", "type", "note"]
          }
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

// 1. API: Phân tích trích xuất gợi ý thuật ngữ từ văn bản thô
export async function analyzeGlossary(req: Request, res: Response): Promise<void> {
  try {
    const { text, apiKeys, model, startKeyIndex = 0 } = req.body;
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Văn bản tiếng Trung không hợp lệ." });
      return;
    }

    const truncatedText = text.slice(0, 8000);

    const systemInstruction =
        "Bạn là trợ lý phân tích ngôn lý học tiếng Trung chuyên về truyện văn học, kiếm hiệp, thế giới giả tưởng. " +
        "Nhiệm vụ của bạn là đọc kỹ đoạn văn bản tiếng Trung, trích xuất tất cả các tên nhân vật (characters), địa danh quan trọng (locations), bí kíp/vũ khí/thuật ngữ chuyên môn (terms) xuất hiện. " +
        "QUAN TRỌNG về trường 'vietnamese': Nếu tên nhân vật, địa danh trong văn bản là phiên âm từ tiếng Anh hoặc ngôn ngữ phương Tây (ví dụ: 阿诗娜 = Athena, 盖伊 = Guy), hãy khôi phục TÊN GỐC TIẾNG ANH trong trường 'vietnamese'. " +
        "ĐẶC BIỆT LƯU Ý: Nếu từ ngữ gồm tên phiên âm ngoại quốc đi kèm hậu tố danh từ chỉ loại tiếng Trung (như - trà, 镇 - thị trấn, 河 - sông, 城 - thành), bạn phải dịch danh từ chỉ loại đó sang tiếng Việt và xếp lên trước tên gốc tiếng Anh (Ví dụ: 阿帕茶 dịch thành 'Trà Abbacchio' chứ KHÔNG ĐƯỢC để 'Abbacchio Tea'). " +
        "Chỉ dùng phiên âm Hán-Việt khi tên/thuật ngữ là hoàn toàn gốc Trung Quốc không có tên tiếng Anh tương ứng. " +
        "ĐẶC BIỆT QUAN TRỌNG về trường 'chinese': Bạn PHẢI copy CHÍNH XÁC ký tự Hán như chúng xuất hiện trong văn bản gốc được cung cấp. TUYỆT ĐỐI KHÔNG tự ý chuyển đổi giữa phồn thể (繁體字) và giản thể (簡體字). Nếu văn bản gốc viết '萬劍歸宗' thì trả về đúng '萬劍歸宗', không được đổi thành '万剑归宗' hay bất kỳ biến thể nào khác.";

    const prompt = `Phân tích đoạn truyện chữ sau và trích xuất danh sách thực thể:\n\n${truncatedText}`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        suggestions: {
          type: Type.ARRAY,
          description: "Danh sách thuật ngữ trích xuất được",
          items: {
            type: Type.OBJECT,
            properties: {
              chinese: { type: Type.STRING, description: "Từ tiếng Trung gốc, ví dụ '萧炎' hoặc '乌坦城'" },
              pinyin: { type: Type.STRING, description: "Phiên âm Hán Việt chuẩn, ví dụ 'Tiêu Viêm' hoặc 'Ô Thản Thành'" },
              vietnamese: {
                type: Type.STRING,
                description: "Nếu là phiên âm từ tên ngoại quốc, dùng tên tiếng Anh gốc. Nếu có hậu tố danh từ chỉ loại, dịch từ chỉ loại lên đầu (ví dụ: 阿帕茶 -> 'Trà Abbacchio' thay vì 'Abbacchio Tea'). Nếu thuần Trung, dùng Hán-Việt mượt mà."
              },
              type: {
                type: Type.STRING,
                enum: ["character", "location", "term", "phrase", "other"],
                description: "Phân loại: nhân vật (character), địa danh (location), thuật ngữ khác (term/phrase)"
              },
              note: { type: Type.STRING, description: "Mô tả ngắn, ví dụ: 'Nhân vật nam chính, tư chất phi phàm' hoặc 'Nơi sinh ra của Tiêu Viêm'" }
            },
            required: ["chinese", "pinyin", "vietnamese", "type", "note"]
          }
        }
      },
      required: ["suggestions"]
    };

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
    if (!resultText) {
      throw new Error("Không nhận được kết quả phân tích từ AI.");
    }

    const parsedResult = safeParseJson(resultText);
    if (parsedResult && Array.isArray(parsedResult.suggestions)) {
      parsedResult.suggestions = validateAndSnapBackEntities(parsedResult.suggestions, text);
    }
    res.json({ ...parsedResult, successKeyIndex: rotationResult.successKeyIndex });
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

    const guidelinesSection = text.slice(0, 4000);

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
    });
  } catch (error: any) {
    console.error("Lỗi phân tích cẩm nang hướng dẫn dịch thuật .md:", error);
    res.status(500).json({ error: error.message || "Đã xảy ra lỗi khi phân tích cẩm nang hướng dẫn." });
  }
}

// API: Trích xuất nhanh thuật ngữ (Tương thích với AutoTranslator)
export async function extractGlossary(req: Request, res: Response): Promise<void> {
  try {
    const { text, apiKeys, model, startKeyIndex = 0 } = req.body;
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Văn bản không hợp lệ." });
      return;
    }

    const systemInstruction =
        "Bạn là trợ lý phân tích ngôn lý học tiếng Trung chuyên về truyện văn học, kiếm hiệp, thế giới giả tưởng. " +
        "Nhiệm vụ của bạn là đọc kỹ đoạn văn bản tiếng Trung và trích xuất tất cả tên nhân vật, địa danh, bí kíp/vũ khí/thuật ngữ chuyên môn. " +
        "QUAN TRỌNG về trường 'vietnamese': Nếu tên nhân vật hoặc địa danh là phiên âm từ tiếng Anh hoặc ngôn ngữ phương Tây (ví dụ: 阿诗娜 = Athena, 盖伊 = Guy), hãy khôi phục TÊN GỐC TIÊN ANH trong trường 'vietnamese'. " +
        "ĐẶC BIỆT LƯU Ý: Nếu tên ngoại quốc có danh từ phân loại/đồ vật đi kèm ở hậu tố tiếng Trung (ví dụ: 茶 - trà, 镇 - thị trấn, 城 - thành), hãy dịch danh từ đó sang tiếng Việt rồi đưa lên trước tên tiếng Anh (Ví dụ: 阿帕茶 -> 'Trà Abbacchio' chứ không phải 'Abbacchio Tea').\n" +
        "Chỉ dùng phiên âm Hán-Việt khi tên/thuật ngữ là hoàn toàn gốc Trung Quốc.";

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          chinese: { type: Type.STRING, description: "Từ tiếng Trung gốc" },
          pinyin: { type: Type.STRING, description: "Phiên âm Hán-Việt chuẩn" },
          vietnamese: {
            type: Type.STRING,
            description: "Tên tiếng Anh gốc cho từ phiên âm phương Tây, dịch hậu tố phân loại lên trước nếu có (ví dụ: 阿帕茶 -> 'Trà Abbacchio' chứ không phải 'Abbacchio Tea'). Nếu thuần Trung, dùng Hán-Việt."
          },
          type: {
            type: Type.STRING,
            enum: ["character", "location", "term", "phrase", "other"],
          },
          note: { type: Type.STRING, description: "Mô tả ngắn gọn vai trò/ý nghĩa" }
        },
        required: ["chinese", "pinyin", "vietnamese", "type", "note"]
      }
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
    const validatedGlossary = validateAndSnapBackEntities(parsedGlossary, text);
    res.json({ glossary: validatedGlossary, successKeyIndex: rotationResult.successKeyIndex });
  } catch (error: any) {
    console.error("Lỗi extract-glossary:", error);
    res.status(500).json({ error: error.message || "Đã xảy ra lỗi khi trích xuất thuật ngữ." });
  }
}
