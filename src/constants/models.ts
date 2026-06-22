// Danh sách mô hình AI có sẵn — nguồn chân lý duy nhất cho cả
// dropdown ApiSettings.tsx và giá trị mặc định useAIConfig.ts
// Đồng bộ với ALLOWED_MODEL_IDS ở backend (server/constants/models.ts)
export const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash',       label: 'Gemini 2.5 Flash (Khuyên dùng)' },
  { id: 'gemini-2.5-pro',         label: 'Gemini 2.5 Pro (Mạnh nhất)' },
  { id: 'gemini-2.0-flash',       label: 'Gemini 2.0 Flash' },
  { id: 'gemini-3.1-flash-lite',  label: 'Gemini 3.1 Flash Lite (Nhanh / Rẻ)' },
  { id: 'gemma-4-31b-it',         label: 'Gemma 4 31B IT (Local)' },
] as const;

// Giá trị mặc định — đồng bộ với backend (server/constants/models.ts)
export const DEFAULT_MODEL_ID = 'gemini-3.1-flash-lite';
