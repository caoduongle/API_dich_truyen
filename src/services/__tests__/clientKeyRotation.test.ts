import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callGeminiDirect } from '../directGeminiClient';

describe('src/services/clientKeyRotation.test.ts', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
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
});
