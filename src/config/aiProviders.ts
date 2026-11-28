/**
 * OpenAI-Compatible Provider Presets, Strict Local URL Detection & Security Validation
 */

import type { OpenAICompatiblePreset, OpenAICompatiblePresetId } from '../types/aiProvider';

const LOCAL_CORS_HINT =
  'Máy chủ cục bộ chạy trên máy bạn cần bật CORS để trình duyệt gọi trực tiếp: với Ollama đặt biến môi trường OLLAMA_ORIGINS=* rồi khởi động lại; với LM Studio bật "Enable CORS" trong Server Settings.';

export const OPENAI_COMPATIBLE_PRESETS: Record<OpenAICompatiblePresetId, OpenAICompatiblePreset> = {
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    suggestedModels: ['deepseek-chat', 'deepseek-reasoner'],
    isLocal: false,
    requiresApiKey: true,
  },
  qwen: {
    id: 'qwen',
    label: 'Qwen (DashScope)',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    suggestedModels: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen3-235b-a22b'],
    isLocal: false,
    requiresApiKey: true,
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    suggestedModels: ['llama-3.3-70b-versatile', 'qwen/qwen3-32b', 'moonshotai/kimi-k2-instruct'],
    isLocal: false,
    requiresApiKey: true,
  },
  'nvidia-nim': {
    id: 'nvidia-nim',
    label: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'meta/llama-3.3-70b-instruct',
    suggestedModels: [
      'meta/llama-3.3-70b-instruct',
      'deepseek-ai/deepseek-v3.2',
      'qwen/qwen3-235b-a22b',
    ],
    isLocal: false,
    requiresApiKey: true,
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'qwen2.5:14b',
    suggestedModels: ['qwen2.5:14b', 'qwen3:14b', 'deepseek-r1:14b', 'gemma3:12b'],
    isLocal: true,
    requiresApiKey: false,
    corsHint: LOCAL_CORS_HINT,
  },
  'lm-studio': {
    id: 'lm-studio',
    label: 'LM Studio (Local)',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
    suggestedModels: ['local-model'],
    isLocal: true,
    requiresApiKey: false,
    corsHint: LOCAL_CORS_HINT,
  },
  custom: {
    id: 'custom',
    label: 'Tùy chỉnh (Custom Base URL)',
    baseUrl: '',
    defaultModel: '',
    suggestedModels: [],
    isLocal: false,
    requiresApiKey: true,
    corsHint: LOCAL_CORS_HINT,
  },
};

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * Kiểm tra nghiêm ngặt xem URL có trỏ về loopback local host hay không bằng URL parser
 * (không dùng substring match như .includes('localhost') để tránh bypass kiểu localhost.evil.com).
 */
export function isLocalProviderUrl(rawUrl: string): boolean {
  if (typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    return LOCAL_HOSTNAMES.has(hostname);
  } catch {
    return false;
  }
}

export interface ProviderBaseUrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  isLocal?: boolean;
  error?: string;
}

/**
 * Chuẩn hóa và kiểm tra bảo mật cho Base URL OpenAI-compatible:
 * - Chỉ cho phép https:// hoặc http://
 * - Chặn thông tin xác thực nhúng trong URL (user:pass@host)
 * - Chặn http:// đối với máy chủ từ xa (chỉ cho phép http:// với localhost / 127.0.0.1 / [::1])
 */
export function validateProviderBaseUrl(rawUrl: string): ProviderBaseUrlValidationResult {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return {
      valid: false,
      error: 'Vui lòng nhập địa chỉ gốc (Base URL) cho nhà cung cấp OpenAI-compatible.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return {
      valid: false,
      error: 'Địa chỉ Base URL không hợp lệ. Ví dụ đúng: https://api.deepseek.com/v1 hoặc http://localhost:11434/v1.',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: 'Chỉ hỗ trợ giao thức http:// (nội bộ) hoặc https:// (máy chủ từ xa).',
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      error: 'Không được nhúng thông tin xác thực trực tiếp trong Base URL.',
    };
  }

  const isLocal = LOCAL_HOSTNAMES.has(parsed.hostname.toLowerCase());
  if (parsed.protocol === 'http:' && !isLocal) {
    return {
      valid: false,
      isLocal: false,
      error: 'Máy chủ từ xa bắt buộc dùng HTTPS (http:// chỉ được phép cho localhost hoặc 127.0.0.1).',
    };
  }

  const cleanPathname = parsed.pathname
    .replace(/\/+$/, '')
    .replace(/\/(?:chat\/completions|models)$/i, '');

  const normalizedUrl = `${parsed.protocol}//${parsed.host}${cleanPathname}`;
  return {
    valid: true,
    normalizedUrl,
    isLocal,
  };
}

/**
 * Ghép Base URL với endpoint chuẩn OpenAI (/chat/completions hoặc /models), tránh lặp đường dẫn.
 */
export function buildOpenAICompatibleEndpoint(
  baseUrl: string,
  path: '/chat/completions' | '/models'
): string {
  const validation = validateProviderBaseUrl(baseUrl);
  if (!validation.valid || !validation.normalizedUrl) {
    throw new Error(validation.error || 'Base URL OpenAI-compatible không hợp lệ.');
  }
  return `${validation.normalizedUrl}${path}`;
}
