import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { safeParseJson, redactApiKey } from "../utils/text";
import { DEFAULT_MODEL_ID } from "../constants/models";
import { AI_SERVICE_CONFIG } from "@shared/constants";

const {
  MIN_REQUEST_INTERVAL_PER_KEY_MS: MIN_REQUEST_INTERVAL_MS,
  BLACKLIST_COOLDOWN_MS,
  MAX_OVERLOAD_RETRIES,
  CLEANUP_INTERVAL_MS,
  STALE_KEY_THRESHOLD_MS: STALE_THRESHOLD_MS,
} = AI_SERVICE_CONFIG;

const DEFAULT_SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

const blacklistedKeys = new Map<string, number>();

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- RATE LIMITER THEO TỪNG API KEY ---
const nextAllowedTimeByKey = new Map<string, number>();

// --- DỌN DẸP BỘ NHỚ ĐỊNH KỲ CHO CÁC KHÓA HẾT HẠN / HẾT HOẠT ĐỘNG ---
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, expiry] of blacklistedKeys) {
    if (now > expiry) {
      blacklistedKeys.delete(key);
    }
  }
  for (const [key, nextAllowed] of nextAllowedTimeByKey) {
    if (now - nextAllowed > STALE_THRESHOLD_MS) {
      nextAllowedTimeByKey.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

if (cleanupInterval && typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref();
}

/**
 * Dừng timer dọn dẹp bộ nhớ định kỳ (dùng khi shutdown máy chủ hoặc teardown tests)
 */
export function stopGeminiCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
}

// Exported for testing purposes
export const _testMaps = {
  blacklistedKeys,
  nextAllowedTimeByKey,
  stopGeminiCleanup
};

// --- OVERLOAD (503) RETRY & COOLDOWN ---
const OVERLOAD_BASE_DELAY_MS = 3000;

// overloadCooldownUntil TOÀN CỤC (không theo key) vì lỗi 503/overload
// đến từ phía model Google (server-side capacity), không phụ thuộc API key
// cụ thể nào. Khi model quá tải, tất cả key đều bị ảnh hưởng như nhau.
let overloadCooldownUntil = 0;

const MAX_OUTER_OVERLOAD_PASSES = 2;      // tối đa 2 lần quét lại TOÀN BỘ vòng key
const OUTER_PASS_BASE_DELAY_MS = 6000;    // chờ giữa các lần quét toàn vòng
const GLOBAL_OVERLOAD_DEADLINE_MS = 90000; // tổng thời gian chờ tối đa cho 1 request

export class SafetyFilterError extends Error {
  readonly isSafety = true;
  readonly finishReason?: string;
  readonly blockReason?: string;
  readonly safetyRatings?: any[];

  constructor(message: string, details?: { finishReason?: string; blockReason?: string; safetyRatings?: any[] }) {
    super(message);
    this.name = 'SafetyFilterError';
    this.finishReason = details?.finishReason;
    this.blockReason = details?.blockReason;
    this.safetyRatings = details?.safetyRatings;
  }
}

export const isSafetyOrEmptyError = (err: any): boolean => {
  if (!err) return false;
  if (err.isSafety === true || err.name === 'SafetyFilterError') return true;

  const errorMsg = (err.message || String(err)).toLowerCase();
  if (
    errorMsg.includes("safety") ||
    errorMsg.includes("safetyfiltererror") ||
    errorMsg.includes("finishreason") ||
    errorMsg.includes("block") ||
    errorMsg.includes("filter") ||
    errorMsg.includes("prohibited") ||
    errorMsg.includes("recitation") ||
    errorMsg.includes("trống") ||
    errorMsg.includes("empty") ||
    errorMsg.includes("candidate") ||
    errorMsg.includes("không nhận được")
  ) {
    if (
      (errorMsg.includes("429") || errorMsg.includes("rate limit") || errorMsg.includes("quota") || isOverloadError(err)) &&
      !errorMsg.includes("finishreason") &&
      !errorMsg.includes("safetyfiltererror")
    ) {
      return false;
    }
    return true;
  }
  return false;
};

export const isOverloadError = (err: any): boolean => {
  const errStr = (err.message || String(err)).toLowerCase();
  return (
    errStr.includes('503') ||
    errStr.includes('unavailable') ||
    errStr.includes('overloaded') ||
    errStr.includes('high demand')
  );
};

export async function generateWithRotation(
    apiKeys: string[] | undefined,
    modelName: string | undefined,
    systemInstruction: string,
    prompt: string,
    responseSchema?: any,
    temperature?: number,
    startKeyIndex: number = 0
): Promise<{ text: string; successKeyIndex: number }> {
  // --- GIẢM TỐC TOÀN CỤC KHI MODEL QUÁ TẢI (áp dụng trước khi thử bất kỳ key nào) ---
  const nowBeforeKeys = Date.now();
  if (nowBeforeKeys < overloadCooldownUntil) {
    const cooldownDelay = overloadCooldownUntil - nowBeforeKeys;
    console.log(`[Overload Cooldown] Model đang quá tải, hoãn thêm ${cooldownDelay}ms trước khi gửi request...`);
    await sleep(cooldownDelay);
  }

  const keysToTry = (Array.isArray(apiKeys) && apiKeys.length > 0)
      ? apiKeys.map(k => k.trim()).filter(Boolean)
      : [process.env.GEMINI_API_KEY || ""];

  if (keysToTry.length === 0 || (keysToTry.length === 1 && !keysToTry[0])) {
    throw new Error("Không có API Key nào được thiết lập. Hãy thêm khóa trong phần 'Cấu hình AI' hoặc lưu trong file cấu hình máy chủ.");
  }

  let model = modelName || DEFAULT_MODEL_ID;

  // Cơ chế phòng thủ: Ép thêm tiền tố 'models/' đối với các dòng mô hình mở (như gemma)
  // để tránh việc SDK gửi sai cấu trúc endpoint lên Google Upstream Server gây lỗi 500.
  if (!model.startsWith("models/")) {
    model = `models/${model}`;
  }
  let lastError: any = null;
  const safeStart = ((startKeyIndex % keysToTry.length) + keysToTry.length) % keysToTry.length;

  const requestStartTime = Date.now();
  let outerPass = 0;

  while (true) {
    let anyOverloadFailure = false;
    let anyNonOverloadFailure = false;

    for (let offset = 0; offset < keysToTry.length; offset++) {
      const i = (safeStart + offset) % keysToTry.length;
      const key = keysToTry[i];

      // Kiểm tra trạng thái mạch ngắt (Circuit Breaker Check)
      const blacklistExpiry = blacklistedKeys.get(key);
      if (blacklistExpiry && blacklistExpiry > Date.now()) {
        console.log(`[Circuit Breaker] Bỏ qua khóa ${i + 1}/${keysToTry.length} do đang trong thời gian ngắt mạch bảo vệ.`);
        continue;
      }

      // --- RATE LIMITER THEO KEY: mỗi key có mốc thời gian riêng ---
      // Đảm bảo mỗi key riêng lẻ tuân thủ ~13 req/phút, nhưng các key
      // khác nhau có thể gửi request đồng thời mà không chặn lẫn nhau.
      const keyNextAllowed = nextAllowedTimeByKey.get(key) || 0;
      const nowForRate = Date.now();
      let keyDelay = 0;

      if (nowForRate < keyNextAllowed) {
        // Key này chưa tới mốc được phép, tính toán độ trễ cần chờ
        keyDelay = keyNextAllowed - nowForRate;
        // Đẩy mốc thời gian kế tiếp lùi về sau (cơ chế gối đầu)
        nextAllowedTimeByKey.set(key, keyNextAllowed + MIN_REQUEST_INTERVAL_MS);
      } else {
        // Key đang rảnh, đặt mốc cho request tiếp theo tính từ bây giờ
        nextAllowedTimeByKey.set(key, nowForRate + MIN_REQUEST_INTERVAL_MS);
      }

      if (keyDelay > 0) {
        console.log(`[Rate Limit] Key ${i + 1}: Đang hoãn ${keyDelay}ms để đảm bảo tần suất tối đa 13 req/phút cho key này...`);
        await sleep(keyDelay);
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
          safetySettings: DEFAULT_SAFETY_SETTINGS,
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
          delete config.safetySettings;

          if (responseSchema) {
            finalPrompt += `\n\nQUAN TRỌNG: Chỉ trả về cấu trúc JSON thuần túy hợp lệ, TUYỆT ĐỐI KHÔNG gói trong mác \`\`\`json, KHÔNG chứa ký tự markdown #, KHÔNG kèm lời giải thích hay tiêu đề. Chỉ trả ra duy nhất chuỗi JSON bắt đầu bằng { và kết thúc bằng }.`;
          }
        } else {
          // Giữ nguyên logic prompt chuẩn cho các dòng mô hình Gemini
          finalPrompt = prompt;
        }

        // --- VÒNG RETRY NỘI BỘ CHO LỖI OVERLOAD (503) ---
        let overloadAttempt = 0;
        while (true) {
          try {
            const response = await ai.models.generateContent({
              model,
              contents: finalPrompt,
              config
            });

            const candidate = response.candidates?.[0];
            const finishReason = candidate?.finishReason;
            const promptFeedback = response.promptFeedback;

            // 1. Kiểm tra bị chặn từ cấp độ Prompt
            if (promptFeedback?.blockReason && promptFeedback.blockReason !== 'BLOCKED_REASON_UNSPECIFIED') {
              throw new SafetyFilterError(
                `Nội dung bị chặn từ cấp độ prompt bởi bộ lọc an toàn (Lý do: ${promptFeedback.blockReason})`,
                {
                  blockReason: promptFeedback.blockReason,
                  safetyRatings: promptFeedback.safetyRatings,
                }
              );
            }

            // 2. Kiểm tra finishReason của Candidate
            if (
              finishReason === 'SAFETY' ||
              finishReason === 'RECITATION' ||
              finishReason === 'BLOCKLIST' ||
              finishReason === 'PROHIBITED_CONTENT' ||
              finishReason === 'SPII'
            ) {
              throw new SafetyFilterError(
                `Nội dung bị chặn bởi bộ lọc an toàn của Gemini (FinishReason: ${finishReason})`,
                {
                  finishReason,
                  safetyRatings: candidate?.safetyRatings,
                }
              );
            }

            // Thành công → reset cooldown toàn cục (model đã hồi phục)
            overloadCooldownUntil = 0;

            let rawText = response.text ?? "";
            if (!rawText && candidate?.content?.parts?.length) {
              rawText = candidate.content.parts.map((p: any) => p.text || "").join("");
            }

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
          } catch (innerErr: any) {
            if (isOverloadError(innerErr) && overloadAttempt < MAX_OVERLOAD_RETRIES) {
              overloadAttempt++;
              const retryDelay = OVERLOAD_BASE_DELAY_MS * Math.pow(2, overloadAttempt - 1) + Math.floor(Math.random() * 1000);
              console.warn(`[Overload Retry] Model quá tải (503), thử lại key ${i + 1} lần ${overloadAttempt}/${MAX_OVERLOAD_RETRIES} sau ${retryDelay}ms...`);

              // Kích hoạt giảm tốc toàn cục tạm thời (8 giây)
              overloadCooldownUntil = Math.max(overloadCooldownUntil, Date.now() + 8000);

              await sleep(retryDelay);
              continue; // Thử lại CHÍNH KEY ĐÓ
            }
            // Hết retry hoặc không phải overload → ném ra ngoài cho catch block chính xử lý
            throw innerErr;
          }
        }
      } catch (err: any) {
        const errMsg = String(err.message || err);
        const errDetail = err?.cause ? String(err.cause.stack || err.cause.message || err.cause) : String(err.stack || err.message || err);
        console.error(`[Rotation Error] Lỗi khóa ${i + 1}: ${redactApiKey(errMsg, keysToTry)}`);
        console.error(`[Rotation Error] Chi tiết:`, redactApiKey(errDetail, keysToTry));
        lastError = err;

        // Nếu lỗi overload (503) đã hết retry → log rõ, KHÔNG blacklist key
        if (isOverloadError(err)) {
          anyOverloadFailure = true;
          console.warn(`[Overload Exhausted] Key ${i + 1} đã hết ${MAX_OVERLOAD_RETRIES} lần retry overload, chuyển sang key tiếp theo (KHÔNG blacklist).`);
          continue;
        }

        anyNonOverloadFailure = true;
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

    const elapsed = Date.now() - requestStartTime;
    const canRetryOuter =
      anyOverloadFailure &&
      !anyNonOverloadFailure &&            // CHỈ retry ngoài khi lỗi 100% là overload, không lẫn lỗi khác
      outerPass < MAX_OUTER_OVERLOAD_PASSES &&
      elapsed < GLOBAL_OVERLOAD_DEADLINE_MS;

    if (!canRetryOuter) {
      break; // thoát while, rơi xuống throw ALL_KEYS_EXHAUSTED như cũ
    }

    outerPass++;
    const outerDelay = OUTER_PASS_BASE_DELAY_MS * outerPass + Math.floor(Math.random() * 1500);
    console.warn(`[Overload Outer Retry] Toàn bộ ${keysToTry.length} khóa đều quá tải (503). Chờ ${outerDelay}ms rồi quét lại toàn vòng (lần ${outerPass}/${MAX_OUTER_OVERLOAD_PASSES})...`);
    await sleep(outerDelay);
  }

  throw new Error(`ALL_KEYS_EXHAUSTED: Đã thử toàn bộ ${keysToTry.length} khóa API đều thất bại. Lỗi cuối: ${lastError?.message || lastError || "Không xác định"}`);
}
