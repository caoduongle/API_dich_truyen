import { Request, Response } from "express";
import { Type } from "@google/genai";
import { generateWithRotation } from "../services/geminiService";
import { safeParseJson, LITERARY_TRANSLATION_FRAMING } from "../utils/text";

// 4. API: Gióng hàng đối sọc dữ liệu song ngữ xuất bản học liệu JSONL Fine-tuning
export async function alignChapter(req: Request, res: Response): Promise<void> {
  try {
    const { sourceText, translatedText, apiKeys, model, startKeyIndex = 0 } = req.body;
    if (!sourceText || typeof sourceText !== "string") {
      res.status(400).json({ error: "Văn bản gốc không hợp lệ." });
      return;
    }
    if (!translatedText || typeof translatedText !== "string") {
      res.status(400).json({ error: "Văn bản dịch không hợp lệ." });
      return;
    }

    const systemInstruction =
        LITERARY_TRANSLATION_FRAMING +
        "Bạn là một chuyên gia đối dịch Trung - Việt nâng cao, chuyên gióng hàng (align) văn bản gốc tiếng Trung and bản dịch tiếng Việt của truyện/tiểu thuyết mạng sao cho ý nghĩa các cặp câu/đoạn khớp nhau hoàn toàn 100%.\n" +
        "Nhiệm vụ:\n" +
        "1. Phân tích văn bản gốc tiếng Trung và bản dịch tiếng Việt của chương truyện.\n" +
        "2. Tiến hành gióng hàng (align) từng câu hoặc nhóm câu/đoạn văn sao cho phần tiếng Trung (input) and phần tiếng Việt dịch tương ứng (output) khớp nhau hoàn hảo về nghĩa.\n" +
        "3. Nếu một câu tiếng Trung được dịch thoát ý thành nhiều câu tiếng Việt (hoặc ngược lại), hãy tự động gộp phần tiếng Trung và tiếng Việt tương ứng lại làm một để các cặp câu khớp nghĩa hoàn toàn.\n" +
        "4. Hãy phủ kín, không được bỏ sót bất kì dòng hay nội dung nào của chương truyện trong quá trình gióng hàng.\n" +
        "5. Chỉ trả về dữ liệu cấu trúc Array theo schema được yêu cầu, không kèm bất kỳ lời giải thích hay markdown code blocks hứa hẹn nào.";

    const prompt = `--- VĂN BẢN TRUNG GỐC ---
${sourceText}

--- VĂN BẢN VIỆT DỊCH THAM KHẢO ---
${translatedText}

Hãy thực hiện gióng hàng tỷ mỷ từ đầu đến cuối chương truyện.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        alignments: {
          type: Type.ARRAY,
          description: "Mảng danh sách các câu/đoạn đã gióng hàng hoàn chỉnh khớp nhau.",
          items: {
            type: Type.OBJECT,
            properties: {
              chinese: { type: Type.STRING, description: "Câu/đoạn văn tiếng Trung đã gióng hàng" },
              vietnamese: { type: Type.STRING, description: "Câu/đoạn văn tiếng Việt tương ứng đã gióng hàng" }
            },
            required: ["chinese", "vietnamese"]
          }
        }
      },
      required: ["alignments"]
    };

    const rotationResult = await generateWithRotation(
        apiKeys,
        model,
        systemInstruction,
        prompt,
        schema,
        0.15,
        startKeyIndex
    );
    const resultText = rotationResult.text;
    if (resultText) {
      const parsed = safeParseJson(resultText);
      const list = Array.isArray(parsed?.alignments) ? parsed.alignments : [];

      const instructionText = "你是一位专业的中文转越南文翻译专家，专注于网络小说翻译。规则：1. 完整翻译所有内容，不得遗漏。2. 保持段落结构，不要合并段落。3. 直接输出翻译结果，放在 <result>...</result> 标签内。";
      const jsonlLines = list.map((item: any) => {
        return JSON.stringify({
          instruction: instructionText,
          input: (item.chinese || "").trim(),
          output: (item.vietnamese || "").trim()
        });
      });
      res.json({ jsonlLines, successKeyIndex: rotationResult.successKeyIndex });
    } else {
      res.json({ jsonlLines: [], successKeyIndex: startKeyIndex });
    }
  } catch (error: any) {
    console.error("[Align Chapter Error] Thất bại gióng hàng:", error);
    res.status(500).json({ error: error.message || "Đã xảy ra lỗi khi gióng hàng chương." });
  }
}
