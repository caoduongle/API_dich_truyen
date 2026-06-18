import { GoogleGenAI } from "@google/genai";
import { safeParseJson } from "../utils/text.ts";

const blacklistedKeys = new Map<string, number>();
const BLACKLIST_COOLDOWN_MS = 5 * 60 * 1000; // Thời gian ngắt mạch: 5 phút

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let nextAllowedTime = 0;
const MIN_REQUEST_INTERVAL_MS = 4620;

export async function generateWithRotation(
    apiKeys: string[] | undefined,
    modelName: string | undefined,
    systemInstruction: string,
    prompt: string,
    responseSchema?: any,
    temperature?: number,
    startKeyIndex: number = 0
): Promise<{ text: string; successKeyIndex: number }> {
  // --- THUẬT TOÁN ĐIỀU PHỐI THỜI GIAN (RATE LIMITER) ---
  const now = Date.now();
  let delay = 0;

  if (now < nextAllowedTime) {
    // Nếu thời điểm hiện tại chưa tới mốc được phép, tính toán độ trễ cần chờ
    delay = nextAllowedTime - now;
    // Đẩy mốc thời gian được phép kế tiếp lùi về sau
    nextAllowedTime += MIN_REQUEST_INTERVAL_MS;
  } else {
    // Nếu hệ thống đang rảnh, đặt mốc cho request tiếp theo tính từ bây giờ
    nextAllowedTime = now + MIN_REQUEST_INTERVAL_MS;
  }

  if (delay > 0) {
    console.log(`[Rate Limit] Đang hoãn ${delay}ms để đảm bảo tần suất tối đa 13 req/phút...`);
    await sleep(delay); // Đợi kết thúc khoảng thời gian gối đầu an toàn
  }

  const keysToTry = (Array.isArray(apiKeys) && apiKeys.length > 0)
      ? apiKeys.map(k => k.trim()).filter(Boolean)
      : [process.env.GEMINI_API_KEY || ""];

  if (keysToTry.length === 0 || (keysToTry.length === 1 && !keysToTry[0])) {
    throw new Error("Không có API Key nào được thiết lập. Hãy thêm khóa trong phần 'Cấu hình AI' hoặc lưu trong file cấu hình máy chủ.");
  }

  let model = modelName || "gemini-3.1-flash-lite";

  // Cơ chế phòng thủ: Ép thêm tiền tố 'models/' đối với các dòng mô hình mở (như gemma)
  // để tránh việc SDK gửi sai cấu trúc endpoint lên Google Upstream Server gây lỗi 500.
  if (!model.startsWith("models/")) {
    model = `models/${model}`;
  }
  let lastError: any = null;
  const safeStart = ((startKeyIndex % keysToTry.length) + keysToTry.length) % keysToTry.length;

  for (let offset = 0; offset < keysToTry.length; offset++) {
    const i = (safeStart + offset) % keysToTry.length;
    const key = keysToTry[i];

    // Kiểm tra trạng thái mạch ngắt (Circuit Breaker Check)
    const blacklistExpiry = blacklistedKeys.get(key);
    if (blacklistExpiry && blacklistExpiry > Date.now()) {
      console.log(`[Circuit Breaker] Bỏ qua khóa ${i + 1}/${keysToTry.length} do đang trong thời gian ngắt mạch bảo vệ.`);
      continue;
    }

    try {
      console.log(`[Rotation] Thử khóa ${i + 1}/${keysToTry.length} (bắt đầu từ khóa ${safeStart + 1}) với model "${model}"`);
      const ai = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      const config: any = {
        systemInstruction,
        temperature: temperature !== undefined ? temperature : 0.3,
      };

      const isGemma = model.toLowerCase().includes('gemma');
      if (responseSchema && !isGemma) {
        config.responseMimeType = "application/json";
        config.responseSchema = responseSchema;
      }

      // 💡 CƠ CHẾ ĐÓNG GÓI PROMPT ĐỘC QUYỀN CHO GEMMA
      let finalPrompt = prompt;
      if (isGemma) {
        // Trộn thẳng chỉ thị hệ thống vào prompt vì Gemma không nhận config.systemInstruction
        finalPrompt = `[HƯỚNG DẪN BIÊN DỊCH]\n${systemInstruction}\n\n[VĂN BẢN GỐC CẦN XỬ LÝ]\n${prompt}`;

        // Loại bỏ thuộc tính không hỗ trợ để tránh xung đột endpoint nâng cao
        delete config.systemInstruction;

        if (responseSchema) {
          finalPrompt += `\n\nQUAN TRỌNG: Chỉ trả về cấu trúc JSON thuần túy hợp lệ, TUYỆT ĐỐI KHÔNG gói trong mác \`\`\`json, KHÔNG chứa ký tự markdown #, KHÔNG kèm lời giải thích hay tiêu đề. Chỉ trả ra duy nhất chuỗi JSON bắt đầu bằng { và kết thúc bằng }.`;
        }
      } else {
        // Giữ nguyên logic prompt chuẩn cho các dòng mô hình Gemini
        finalPrompt = prompt;
      }

      const response = await ai.models.generateContent({
        model,
        contents: finalPrompt,
        config
      });

      let rawText = response.text ?? "";
      if (isGemma) {
        rawText = rawText
            .replace(/^```(?:json)?\s*/im, "")
            .replace(/```\s*$/im, "")
            .replace(/^#+\s+[^\n]*\n?/gm, "")  // xóa dòng ### tiêu đề
            .trim();
        // Tìm JSON block đầu tiên nếu vẫn còn text thừa
        const jsonStart = rawText.search(/[\{\[]/);
        if (jsonStart > 0) rawText = rawText.substring(jsonStart);
      }
      return {
        text: rawText,
        successKeyIndex: i
      };
    } catch (err: any) {
      console.error(`[Rotation Error] Lỗi khóa ${i + 1}: ${err.message || err}`);
      console.error(`[Rotation Error] Chi tiết:`, err?.cause ?? err);
      lastError = err;

      // Kích hoạt Circuit Breaker nếu gặp lỗi Rate Limit hoặc Quota Exhausted
      const errStr = (err.message || String(err)).toLowerCase();
      if (
          errStr.includes("429") ||
          errStr.includes("quota") ||
          errStr.includes("rate") ||
          errStr.includes("exhausted") ||
          errStr.includes("limit")
      ) {
        console.warn(`[Circuit Breaker] Phát hiện lỗi giới hạn/cạn kiệt trên khóa ${i + 1}. Kích hoạt ngắt mạch trong 5 phút.`);
        blacklistedKeys.set(key, Date.now() + BLACKLIST_COOLDOWN_MS);
      }
    }
  }

  throw new Error(`ALL_KEYS_EXHAUSTED: Đã thử toàn bộ ${keysToTry.length} khóa API đều thất bại. Lỗi cuối: ${lastError?.message || lastError || "Không xác định"}`);
}
