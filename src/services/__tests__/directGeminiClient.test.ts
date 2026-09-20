import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callGeminiDirect, DirectGeminiRequestOptions } from '../directGeminiClient';
import { localQuotaTracker, hashApiKey } from '../localQuotaTracker';
import { saveStoredCustomLimits, clearStoredCustomLimits } from '../../utils/customLimitsStorage';

describe('src/services/directGeminiClient.ts', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    localQuotaTracker.resetMetrics();
    clearStoredCustomLimits();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('successfully sends request and parses Gemini candidate response', async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: '{"rawTranslation": "Bản dịch thử nghiệm", "discoveredEntities": []}',
              },
            ],
            role: 'model',
          },
          finishReason: 'STOP',
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as any);

    const options: DirectGeminiRequestOptions = {
      apiKeys: ['AQ_TEST_KEY_123'],
      model: 'gemini-2.5-flash',
      prompt: 'Dịch câu này',
      systemInstruction: 'Bạn là dịch giả',
      schema: { type: 'OBJECT', properties: { rawTranslation: { type: 'STRING' } } },
      temperature: 0.3,
    };

    const res = await callGeminiDirect(options);
    expect(res.text).toBe('{"rawTranslation": "Bản dịch thử nghiệm", "discoveredEntities": []}');
    expect(res.successKeyIndex).toBe(0);

    // Verify fetch call structure
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1beta/models/gemini-2.5-flash:generateContent'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-goog-api-key': 'AQ_TEST_KEY_123',
        }),
      })
    );
  });

  it('rotates to next API key when encountering 429 Rate Limit', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (_url, init) => {
      callCount++;
      const apiKey = init.headers['x-goog-api-key'];
      if (apiKey === 'KEY_1') {
        return {
          ok: false,
          status: 429,
          json: async () => ({ error: { message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' } }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '{"rawTranslation": "Dịch thành công với key 2"}' }],
                role: 'model',
              },
            },
          ],
        }),
      };
    });

    const res = await callGeminiDirect({
      apiKeys: ['KEY_1', 'KEY_2'],
      model: 'gemini-2.5-flash',
      prompt: 'Test',
      startKeyIndex: 0,
    });

    expect(callCount).toBe(2);
    expect(res.text).toContain('Dịch thành công với key 2');
    expect(res.successKeyIndex).toBe(1);
  });

  it('throws descriptive error if all keys are exhausted', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limit hit', status: 'RESOURCE_EXHAUSTED' } }),
    } as any);

    await expect(
      callGeminiDirect({
        apiKeys: ['EXHAUSTED_KEY_1', 'EXHAUSTED_KEY_2'],
        model: 'gemini-2.5-flash',
        prompt: 'Test',
      })
    ).rejects.toThrow(/hạn mức|quá tải|RESOURCE_EXHAUSTED|429/i);
  });

  it('strictly enforces personal maxRpd limit: bypasses key that reached limit and routes to next key with 0 fetch calls for limited key', async () => {
    const key1 = 'CUSTOM_LIMITED_KEY_1';
    const key2 = 'HEALTHY_KEY_2';
    const key1Hash = hashApiKey(key1);

    // Set custom limit of 2 requests for key 1
    saveStoredCustomLimits({
      [key1Hash]: { maxRpm: 15, maxRpd: 2, maxTpm: 1000000 },
    });

    // Record 2 provider attempts on key 1 to hit the limit
    localQuotaTracker.recordProviderAttempt(key1, 'gemini-2.5-flash');
    localQuotaTracker.recordProviderAttempt(key1, 'gemini-2.5-flash');

    const calledKeys: string[] = [];
    global.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const apiKey = init.headers['x-goog-api-key'];
      calledKeys.push(apiKey);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'OK with Key 2' }], role: 'model' } }],
        }),
      };
    });

    const res = await callGeminiDirect({
      apiKeys: [key1, key2],
      model: 'gemini-2.5-flash',
      prompt: 'Test limit',
      startKeyIndex: 0,
    });

    // KEY 1 should NEVER be fetched! Only KEY 2 is called.
    expect(calledKeys).toEqual([key2]);
    expect(res.successKeyIndex).toBe(1);
    expect(res.text).toBe('OK with Key 2');

    // Key 1 errorsTotal should still be 0!
    const status = localQuotaTracker.getQuotaStatus([key1]);
    expect(status.keys[0].errorsTotal).toBe(0);
    expect(status.keys[0].isCustomLimitReached).toBe(true);
  });

  it('aborts immediately with ALL_KEYS_EXHAUSTED if all keys have reached personal limits, with 0 fetch calls', async () => {
    const key1 = 'ALL_EXHAUSTED_KEY_1';
    const key1Hash = hashApiKey(key1);

    saveStoredCustomLimits({
      [key1Hash]: { maxRpm: 15, maxRpd: 1, maxTpm: 1000000 },
    });
    localQuotaTracker.recordProviderAttempt(key1, 'gemini-2.5-flash');

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    await expect(
      callGeminiDirect({
        apiKeys: [key1],
        model: 'gemini-2.5-flash',
        prompt: 'Test all exhausted',
      })
    ).rejects.toThrow(/hạn mức|quá tải|RESOURCE_EXHAUSTED|cá nhân/i);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
