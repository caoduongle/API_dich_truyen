import { describe, it, expect } from 'vitest';
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID, ModelDefinition } from '@shared/models';
import { AIErrorCode } from '../constants/errors';

describe('Frontend/Backend Contract Verification Tests', () => {
  it('all AVAILABLE_MODELS should strictly conform to canonical ModelDefinition interface', () => {
    expect(AVAILABLE_MODELS.length).toBeGreaterThan(0);

    for (const model of AVAILABLE_MODELS) {
      expect(typeof model.id).toBe('string');
      expect(model.id.length).toBeGreaterThan(0);
      expect(typeof model.label).toBe('string');
      expect(model.label.length).toBeGreaterThan(0);
      expect(['preset', 'discovered', 'custom']).toContain(model.source);
      expect(['active', 'deprecated', 'shutdown']).toContain(model.status);
      expect(typeof model.capabilities).toBe('object');
      expect(typeof model.capabilities.generateContent).toBe('boolean');
      expect(model.capabilities.generateContent).toBe(true);
    }
  });

  it('DEFAULT_MODEL_ID should exist in AVAILABLE_MODELS with active status and generateContent capability', () => {
    const defaultModel = AVAILABLE_MODELS.find(m => m.id === DEFAULT_MODEL_ID);
    expect(defaultModel).toBeDefined();
    expect(defaultModel?.status).toBe('active');
    expect(defaultModel?.capabilities.generateContent).toBe(true);
  });

  it('AIErrorCode enum should match contract specifications', () => {
    const expectedCodes = [
      'RATE_LIMITED',
      'QUOTA_EXCEEDED',
      'AUTH_FAILED',
      'MODEL_NOT_FOUND',
      'MODEL_UNSUPPORTED',
      'INVALID_REQUEST',
      'SAFETY_BLOCKED',
      'SERVER_ERROR',
      'NETWORK_ERROR',
      'TIMEOUT',
    ];

    for (const code of expectedCodes) {
      expect((AIErrorCode as any)[code]).toBe(code);
    }
  });
});
