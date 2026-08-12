export interface ModelDef { id: string; label: string }

export const AVAILABLE_MODELS: ModelDef[] = [
  { id: 'gemini-2.5-flash',       label: 'Gemini 2.5 Flash (Khuyên dùng)' },
  { id: 'gemini-2.5-pro',         label: 'Gemini 2.5 Pro (Mạnh nhất)' },
  { id: 'gemini-2.0-flash',       label: 'Gemini 2.0 Flash' },
  { id: 'gemini-3.1-flash-lite',  label: 'Gemini 3.1 Flash Lite (Nhanh / Rẻ)' },
  { id: 'gemma-4-31b-it',         label: 'Gemma 4 31B IT (Local)' },
];

export const ALLOWED_MODEL_IDS: string[] = AVAILABLE_MODELS.map(m => m.id);

export const DEFAULT_MODEL_ID = 'gemini-3.1-flash-lite';

export const MAX_API_KEYS_PER_REQUEST = 20;
