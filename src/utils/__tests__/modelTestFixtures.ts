import type { ModelDefinition, RegisteredModelDef } from '../modelRegistry';

export const mockVerifiedCustomModel: RegisteredModelDef = {
  id: 'tunedModels/my-novel-v1',
  label: 'Mô hình Tiên Hiệp V1',
  source: 'custom',
  status: 'active',
  verified: true,
  verificationState: 'verified',
  lastVerifiedAt: '2026-08-20T06:00:00.000Z',
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
  addedAt: '2026-08-20T06:00:00.000Z',
};

export const mockUnverifiedCustomModel: RegisteredModelDef = {
  id: 'custom-unverified-model',
  label: 'Mô hình chưa xác minh',
  source: 'custom',
  status: 'active',
  verified: false,
  verificationState: 'unverified',
  capabilities: {
    generateContent: false,
  },
  addedAt: '2026-08-20T06:00:00.000Z',
};

export const mockInvalidCustomModel: RegisteredModelDef = {
  id: 'fake-model-xyz',
  label: 'Mô hình không tồn tại',
  source: 'custom',
  status: 'active',
  verified: false,
  verificationState: 'invalid',
  verificationError: 'Mô hình không tồn tại trên Google AI Studio.',
  capabilities: {
    generateContent: false,
  },
  addedAt: '2026-08-20T06:00:00.000Z',
};

export const mockUnsupportedCapabilityModel = {
  name: 'models/text-embedding-004',
  displayName: 'Text Embedding 004',
  supportedGenerationMethods: ['embedContent'],
  inputTokenLimit: 2048,
  outputTokenLimit: 0,
};

export const mockValidGoogleModel = {
  name: 'models/tunedModels/my-novel-v1',
  displayName: 'My Fine-tuned Novel Model',
  description: 'Custom fine-tuned Gemini model for literature',
  supportedGenerationMethods: ['generateContent', 'countTokens'],
  inputTokenLimit: 1048576,
  outputTokenLimit: 8192,
};
