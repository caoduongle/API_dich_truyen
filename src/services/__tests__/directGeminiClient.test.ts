import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callGeminiDirect, DirectGeminiRequestOptions } from '../directGeminiClient';

describe('src/services/directGeminiClient.ts', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
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
    global.fetch = vi.fn().mockImplementation(async (url, init) => {
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
});
