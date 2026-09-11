import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callGeminiDirect } from '../directGeminiClient';
import { localQuotaTracker } from '../localQuotaTracker';

describe('src/services/clientKeyRotation.test.ts', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    localQuotaTracker.resetMetrics();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('rotates through multiple keys starting from startKeyIndex', async () => {
    const calledKeys: string[] = [];

    global.fetch = vi.fn().mockImplementation(async (url, init) => {
      const apiKey = init.headers['x-goog-api-key'];
      calledKeys.push(apiKey);

      if (apiKey === 'KEY_B') {
        return {
          ok: false,
          status: 429,
          json: async () => ({ error: { message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' } }),
        };
      }
      if (apiKey === 'KEY_C') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: '{"rawTranslation": "Thành công với key C"}' }],
                  role: 'model',
                },
              },
            ],
          }),
        };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    });

    const res = await callGeminiDirect({
      apiKeys: ['KEY_A', 'KEY_B', 'KEY_C'],
      model: 'gemini-2.5-flash',
      prompt: 'Test',
      startKeyIndex: 1, // Start at KEY_B
    });

    expect(calledKeys).toEqual(['KEY_B', 'KEY_C']);
    expect(res.successKeyIndex).toBe(2);
    expect(res.text).toContain('Thành công với key C');
  });

  it('rotates on 503 Provider Unavailable error', async () => {
    const calledKeys: string[] = [];

    global.fetch = vi.fn().mockImplementation(async (url, init) => {
      const apiKey = init.headers['x-goog-api-key'];
      calledKeys.push(apiKey);

      if (apiKey === 'KEY_1') {
        return {
          ok: false,
          status: 503,
          json: async () => ({ error: { message: 'Service Unavailable', status: 'UNAVAILABLE' } }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '{"rawTranslation": "OK sau khi đổi key"}' }],
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

    expect(calledKeys).toEqual(['KEY_1', 'KEY_2']);
    expect(res.successKeyIndex).toBe(1);
  });

  it('bypasses already QuotaExhausted keys completely without issuing HTTP fetch or inflating error count', async () => {
    const exhaustedKey = 'ALREADY_EXHAUSTED_KEY';
    const healthyKey = 'HEALTHY_KEY_2';

    // Simulate exhaustedKey previously receiving 429 daily quota exhausted
    localQuotaTracker.recordFailure(exhaustedKey, 'gemini-2.5-flash', {
      status: 429,
      message: 'Resource has been exhausted (e.g. check quota)',
      isRateLimit: true,
    });

    const initialStatus = localQuotaTracker.getQuotaStatus([exhaustedKey]);
    expect(initialStatus.keys[0].healthState).toBe('QuotaExhausted');
    const initialErrors = initialStatus.keys[0].errorsTotal;
    expect(initialErrors).toBe(1);

    const calledKeys: string[] = [];
    global.fetch = vi.fn().mockImplementation(async (url, init) => {
      const apiKey = init.headers['x-goog-api-key'];
      calledKeys.push(apiKey);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Success with Healthy Key' }], role: 'model' } }],
        }),
      };
    });

    // Send 5 consecutive requests with startKeyIndex: 0 (which would be exhaustedKey if not pre-checked)
    for (let i = 0; i < 5; i++) {
      const res = await callGeminiDirect({
        apiKeys: [exhaustedKey, healthyKey],
        model: 'gemini-2.5-flash',
        prompt: `Test call #${i}`,
        startKeyIndex: 0,
      });
      expect(res.successKeyIndex).toBe(1);
    }

    // Exhausted key should NEVER be passed to fetch across all 5 calls!
    expect(calledKeys).toEqual([
      healthyKey,
      healthyKey,
      healthyKey,
      healthyKey,
      healthyKey,
    ]);

    // Exhausted key errorsTotal must still be 1 (NOT 1 + 5 = 6)!
    const finalStatus = localQuotaTracker.getQuotaStatus([exhaustedKey]);
    expect(finalStatus.keys[0].errorsTotal).toBe(1);
  });
});
