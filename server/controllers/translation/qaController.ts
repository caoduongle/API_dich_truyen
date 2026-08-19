import { Request, Response } from "express";
import { Type } from "@google/genai";
import { generateWithRotation } from "../../services/geminiService";
import { safeParseJson, LITERARY_TRANSLATION_FRAMING, sanitizePromptInput } from "../../utils/text";
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

    const sourceText = sanitizePromptInput(rawSource);
    const translatedText = sanitizePromptInput(rawTranslated);
    const { apiKeys, model, startKeyIndex = 0, customRpm } = req.body;

    const systemInstruction =
        LITERARY_TRANSLATION_FRAMING +
        "Bạn là một chuyên gia kiểm định chất lượng (QA) dịch thuật Trung - Việt chuyên nghiệp.\n" +
        "Nhiệm vụ của bạn là kiểm tra xem bản dịch tiếng Việt có đầy đủ, chính xác so với văn bản gốc tiếng Trung hay không.\n" +
        "Hãy đối chiếu kỹ văn bản gốc tiếng Trung và bản dịch tiếng Việt để phát hiện các lỗi sau:\n" +
        "1. Bỏ sót / cắt xén (Omissions): Những câu, đoạn hoặc chi tiết quan trọng trong bản gốc tiếng Trung bị thiếu trong bản dịch.\n" +
        "2. Thêm thắt / ảo giác (Additions/Hallucinations): Thông tin tự vẽ ra, không hề có trong bản gốc tiếng Trung.\n" +
        "3. Lặp lại nội dung (Repetitions): Câu chữ bị lặp đi lặp lại nhiều lần vô nghĩa trong bản dịch.\n\n" +
        "Bạn PHẢI trả về kết quả dưới định dạng JSON theo schema được yêu cầu, chứa danh sách các lỗi phát hiện được (hoặc mảng trống nếu không có lỗi). Hãy phản hồi cực kỳ nghiêm ngặt và chính xác.";

    const prompt = `--- VĂN BẢN TRUNG GỐC ---
${sourceText}

--- BẢN DỊCH TIẾNG VIỆT ---
${translatedText}

Hãy thực hiện thẩm định kỹ lưỡng từ đầu đến cuối bản dịch.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        isValid: {
          type: Type.BOOLEAN,
          description: "true nếu không phát hiện bất kỳ lỗi nghiêm trọng nào về bỏ sót, thêm thắt hoặc lặp lại. false nếu phát hiện lỗi."
        },
        issues: {
          type: Type.ARRAY,
          description: "Danh sách các vấn đề phát hiện được.",
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                enum: ["omission", "addition", "repetition", "terminology", "other"],
                description: "Loại lỗi phát hiện: omission (bỏ sót), addition (thêm thắt), repetition (lặp lại), terminology (sai từ điển), other (khác)."
              },
              severity: {
                type: Type.STRING,
                enum: ["critical", "warning", "info"],
                description: "Mức độ nghiêm trọng của lỗi."
              },
              description: {
                type: Type.STRING,
                description: "Mô tả chi tiết lỗi phát hiện được, ghi rõ nội dung tiếng Trung bị ảnh hưởng và lỗi tiếng Việt tương ứng."
              }
            },
            required: ["type", "severity", "description"]
          }
        }
      },
      required: ["isValid", "issues"]
    };

    const rotationResult = await generateWithRotation(
        apiKeys,
        model,
        systemInstruction,
        prompt,
        schema,
        0.15,
        startKeyIndex,
        customRpm
    );
    const resultText = rotationResult.text;
    if (resultText) {
      const parsed = safeParseJson(resultText);
      res.json({
        isValid: parsed?.isValid ?? true,
        issues: Array.isArray(parsed?.issues) ? parsed.issues : [],
        successKeyIndex: rotationResult.successKeyIndex
      });
    } else {
      res.json({ isValid: true, issues: [], successKeyIndex: startKeyIndex });
    }
  } catch (error: any) {
    logger.error("[QA Critique Error] Thất bại rà soát kiểm duyệt:", error);
    res.status(500).json({ error: error.message || "Đã xảy ra lỗi khi chạy kiểm duyệt AI." });
  }
}
