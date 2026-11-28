/**
 * Types for AI Provider Selection & OpenAI-Compatible Adapter (/v1/chat/completions)
 * (Isolated from src/types.ts to preserve core IndexedDB schemas)
 */

export type AIProviderMode = 'gemini' | 'openai-compatible';

export type OpenAICompatiblePresetId =
  | 'deepseek'
  | 'qwen'
  | 'groq'
  | 'nvidia-nim'
  | 'ollama'
  | 'lm-studio'
  | 'custom';

export type OpenAIResponseFormatTier = 'json_schema' | 'json_object' | 'prompt_only';

export interface OpenAICompatiblePreset {
  id: OpenAICompatiblePresetId;
  label: string;
  baseUrl: string;
  defaultModel: string;
  suggestedModels: string[];
  isLocal: boolean;
  requiresApiKey: boolean;
  corsHint?: string;
}

export interface OpenAICompatibleConfig {
  presetId: OpenAICompatiblePresetId;
  baseUrl: string;
  model: string;
}

export interface AIProviderConfig extends OpenAICompatibleConfig {
  providerMode: AIProviderMode;
}
