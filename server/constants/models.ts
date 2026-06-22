// Danh sách mô hình AI được phép sử dụng (whitelist phía server)
// Đồng bộ với AVAILABLE_MODELS ở frontend (src/constants/models.ts)
export const ALLOWED_MODEL_IDS: string[] = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-3.1-flash-lite',
  'gemma-4-31b-it',
];

// Giá trị mặc định khi client không gửi model, đồng bộ 3 chỗ:
// 1. Backend fallback (geminiService.ts)
// 2. Frontend dropdown mặc định (src/constants/models.ts)
// 3. Frontend localStorage default (useAIConfig.ts)
export const DEFAULT_MODEL_ID = 'gemini-3.1-flash-lite';
