import { describe, it, expect } from 'vitest';
import { isValidModelId, validateModelMiddleware } from '../../routes/api';
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID } from '../../constants/models';

describe('Server-Side Canonical Model Validation', () => {
  it('should accept all canonical preset models', () => {
    for (const model of AVAILABLE_MODELS) {
      expect(isValidModelId(model.id)).toBe(true);
    }
  });

  it('should accept valid discovered and custom model IDs', () => {
    expect(isValidModelId('gemini-2.5-flash')).toBe(true);
    expect(isValidModelId('models/gemini-2.5-flash')).toBe(true);
    expect(isValidModelId('custom-fine-tuned-model_v1.0')).toBe(true);
    expect(isValidModelId('gemma-4-31b-it')).toBe(true);
  });

  it('should reject invalid, dangerous, or malformed model IDs', () => {
    expect(isValidModelId('')).toBe(false);
    expect(isValidModelId(null)).toBe(false);
    expect(isValidModelId(undefined)).toBe(false);
    expect(isValidModelId(12345)).toBe(false);
    // Path traversal prevention
    expect(isValidModelId('../secret/model')).toBe(false);
    expect(isValidModelId('models/../../traversal')).toBe(false);
    // Control characters & dangerous injection characters
    expect(isValidModelId('gemini\x00flash')).toBe(false);
    expect(isValidModelId('gemini; rm -rf /')).toBe(false);
    expect(isValidModelId('gemini<script>alert(1)</script>')).toBe(false);
    // Too long (>128 chars)
    expect(isValidModelId('a'.repeat(129))).toBe(false);
  });

  it('middleware should allow valid models or default if empty', () => {
    let nextCalled = false;
    const req: any = { body: { model: 'gemini-2.5-flash' } };
    const res: any = {
      status: (code: number) => ({
        json: (data: any) => ({ code, data }),
      }),
    };
    const next = () => { nextCalled = true; };

    validateModelMiddleware(req, res, next);
    expect(nextCalled).toBe(true);
  });

  it('middleware should reject invalid model IDs with 400', () => {
    let statusCode = 0;
    let jsonResult: any = null;
    const req: any = { body: { model: 'malicious/../model' } };
    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => { jsonResult = data; },
        };
      },
    };
    const next = () => {};

    validateModelMiddleware(req, res, next);
    expect(statusCode).toBe(400);
    expect(jsonResult?.error).toBeDefined();
  });
});
