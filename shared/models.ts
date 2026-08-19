export type ModelSource = 'preset' | 'discovered' | 'custom';
export type ModelStatus = 'active' | 'deprecated' | 'shutdown';

export interface ModelCapabilities {
  generateContent: boolean;
  structuredOutput?: boolean;
  vision?: boolean;
  thinking?: boolean;
}

export interface ModelLimits {
  defaultRpm: number;
  defaultTpm: number;
  defaultRpd?: number;
}

export interface ModelDefinition {
  id: string;
  label: string;
  source: ModelSource;
  status: ModelStatus;
  capabilities: ModelCapabilities;
  replacementId?: string;
  limits?: ModelLimits;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  addedAt?: string;
  deprecatedAt?: string;
  shutdownAt?: string;
}

/** Tương thích ngược với định nghĩa ModelDef cũ */
export interface ModelDef {
  id: string;
  label: string;
}

export const AVAILABLE_MODELS: ModelDefinition[] = [
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite (Nhanh / Rẻ)',
    source: 'preset',
    status: 'active',
    capabilities: {
      generateContent: true,
      structuredOutput: true,
      vision: true,
      thinking: false,
    },
    limits: {
      defaultRpm: 15,
      defaultTpm: 1000000,
      defaultRpd: 1500,
    },
    inputTokenLimit: 1048576,
    outputTokenLimit: 8192,
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash (Khuyên dùng)',
    source: 'preset',
    status: 'active',
    capabilities: {
      generateContent: true,
      structuredOutput: true,
      vision: true,
      thinking: true,
    },
    limits: {
      defaultRpm: 15,
      defaultTpm: 1000000,
      defaultRpd: 1500,
    },
    inputTokenLimit: 1048576,
    outputTokenLimit: 8192,
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro (Mạnh nhất)',
    source: 'preset',
    status: 'active',
    capabilities: {
      generateContent: true,
      structuredOutput: true,
      vision: true,
      thinking: true,
    },
    limits: {
      defaultRpm: 10,
      defaultTpm: 1000000,
      defaultRpd: 1000,
    },
    inputTokenLimit: 2097152,
    outputTokenLimit: 8192,
  },
  {
    id: 'gemma-4-31b-it',
    label: 'Gemma 4 31B IT (Local)',
    source: 'preset',
    status: 'active',
    capabilities: {
      generateContent: true,
      structuredOutput: false,
      vision: false,
      thinking: false,
    },
    limits: {
      defaultRpm: 30,
      defaultTpm: 500000,
    },
    inputTokenLimit: 131072,
    outputTokenLimit: 4096,
  },
  // ── DECOMMISSIONED / SHUTDOWN MODELS (Cataloged for lookup & automatic migration) ──
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash (Đã ngừng hoạt động)',
    source: 'preset',
    status: 'shutdown',
    replacementId: 'gemini-2.5-flash',
    deprecatedAt: '2026-02-01',
    shutdownAt: '2026-06-01',
    capabilities: {
      generateContent: true,
      structuredOutput: true,
      vision: true,
      thinking: false,
    },
    limits: {
      defaultRpm: 15,
      defaultTpm: 1000000,
      defaultRpd: 1500,
    },
    inputTokenLimit: 1048576,
    outputTokenLimit: 8192,
  },
  {
    id: 'gemini-2.0-flash-lite',
    label: 'Gemini 2.0 Flash Lite (Đã ngừng hoạt động)',
    source: 'preset',
    status: 'shutdown',
    replacementId: 'gemini-3.1-flash-lite',
    deprecatedAt: '2026-02-01',
    shutdownAt: '2026-06-01',
    capabilities: {
      generateContent: true,
      structuredOutput: true,
      vision: true,
      thinking: false,
    },
    limits: {
      defaultRpm: 15,
      defaultTpm: 1000000,
      defaultRpd: 1500,
    },
    inputTokenLimit: 1048576,
    outputTokenLimit: 8192,
  },
  {
    id: 'gemini-1.5-flash',
    label: 'Gemini 1.5 Flash (Đã ngừng hoạt động)',
    source: 'preset',
    status: 'shutdown',
    replacementId: 'gemini-2.5-flash',
    deprecatedAt: '2025-06-01',
    shutdownAt: '2025-10-01',
    capabilities: {
      generateContent: true,
      structuredOutput: true,
      vision: true,
      thinking: false,
    },
    limits: {
      defaultRpm: 15,
      defaultTpm: 1000000,
      defaultRpd: 1500,
    },
    inputTokenLimit: 1048576,
    outputTokenLimit: 8192,
  },
  {
    id: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro (Đã ngừng hoạt động)',
    source: 'preset',
    status: 'shutdown',
    replacementId: 'gemini-2.5-pro',
    deprecatedAt: '2025-06-01',
    shutdownAt: '2025-10-01',
    capabilities: {
      generateContent: true,
      structuredOutput: true,
      vision: true,
      thinking: false,
    },
    limits: {
      defaultRpm: 10,
      defaultTpm: 1000000,
      defaultRpd: 1000,
    },
    inputTokenLimit: 2097152,
    outputTokenLimit: 8192,
  },
];

export const ALLOWED_MODEL_IDS: string[] = AVAILABLE_MODELS.map(m => m.id);

export const DEFAULT_MODEL_ID = 'gemini-3.1-flash-lite';

export const MAX_API_KEYS_PER_REQUEST = 20;

export const PACING_SAFETY_FLOOR_SERVER_MS = 400;
export const PACING_SAFETY_FLOOR_CLIENT_MS = 500;
