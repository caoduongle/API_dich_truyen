import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { modelInfoService } from '../modelInfoService';

describe('Model Discovery SWR Cache', () => {
  const fakeKey = 'AIzaSyFakeKeyForTesting123';

  beforeEach(() => {
    modelInfoService.clearCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch and cache models on first call', async () => {
    const mockApiResponse = {
      models: [
        {
          name: 'models/gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          supportedGenerationMethods: ['generateContent'],
          inputTokenLimit: 1048576,
          outputTokenLimit: 8192,
        },
      ],
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }));

    const res1 = await modelInfoService.listModelsForKey(fakeKey);
    expect(res1.cached).toBe(false);
    expect(res1.models).toHaveLength(1);
    expect(res1.models[0].name).toBe('models/gemini-2.5-flash');

    // 2nd call within TTL should return from cache
    const res2 = await modelInfoService.listModelsForKey(fakeKey);
    expect(res2.cached).toBe(true);
    expect(res2.stale).toBe(false);
    expect(res2.models).toHaveLength(1);
  });

  it('should fallback to valid cached models if Google API returns an error during revalidation', async () => {
    // 1. Initial success
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [
          {
            name: 'models/gemini-2.5-flash',
            displayName: 'Gemini 2.5 Flash',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      }),
    }));

    await modelInfoService.listModelsForKey(fakeKey);

    // 2. Force refresh with Google API 500 error
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: { message: 'Google internal error' } }),
    }));

    const fallbackRes = await modelInfoService.listModelsForKey(fakeKey, true);
    expect(fallbackRes.cached).toBe(true);
    expect(fallbackRes.stale).toBe(true);
    expect(fallbackRes.models).toHaveLength(1);
  });
});

describe('Single Model Verification & Verified Cache', () => {
  const fakeKey = 'AIzaSyFakeKeyForTesting123';

  beforeEach(() => {
    modelInfoService.clearCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should immediately return verified: true for active preset models without calling fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const verified = await modelInfoService.verifySingleModel('gemini-2.5-flash');
    expect(verified.verified).toBe(true);
    expect(verified.id).toBe('gemini-2.5-flash');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should verify custom model via Google API when generateContent is supported', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'models/gemini-custom-exp-01',
        displayName: 'Gemini Custom Exp',
        description: 'Experimental model',
        supportedGenerationMethods: ['generateContent', 'countTokens'],
        inputTokenLimit: 1048576,
        outputTokenLimit: 8192,
      }),
    }));

    const verified = await modelInfoService.verifySingleModel('gemini-custom-exp-01', fakeKey, 'Tên Tùy Chỉnh');
    expect(verified.verified).toBe(true);
    expect(verified.id).toBe('gemini-custom-exp-01');
    expect(verified.label).toBe('Tên Tùy Chỉnh');
    expect(verified.capabilities.generateContent).toBe(true);

    // Should now be cached and report verified
    const isVer = await modelInfoService.isModelVerified('gemini-custom-exp-01');
    expect(isVer).toBe(true);
  });

  it('should reject model with error when Google API returns 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ error: { message: 'models/non-existent is not found' } }),
    }));

    await expect(modelInfoService.verifySingleModel('non-existent', fakeKey)).rejects.toThrow('Không tìm thấy mô hình');
  });

  it('should reject non-generative models that lack generateContent support', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'models/text-embedding-004',
        displayName: 'Text Embedding 004',
        supportedGenerationMethods: ['embedContent'],
      }),
    }));

    await expect(modelInfoService.verifySingleModel('text-embedding-004', fakeKey)).rejects.toThrow('không hỗ trợ phương thức tạo nội dung');
  });

  it('isModelVerified should return false for shutdown models and unknown uncached models', async () => {
    expect(await modelInfoService.isModelVerified('gemini-2.0-flash')).toBe(false);
    expect(await modelInfoService.isModelVerified('completely-unknown-model-xyz')).toBe(false);
  });
});

