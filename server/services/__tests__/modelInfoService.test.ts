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
