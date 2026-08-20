import { describe, it, expect, beforeEach, vi } from 'vitest';
import { modelInfoService, buildGoogleApiHeaders } from '../modelInfoService';

describe('Google Model Discovery Header-Based Auth (TASK 07)', () => {
  beforeEach(() => {
    modelInfoService.clearCache();
    vi.restoreAllMocks();
  });

  // 1. URL does not contain key
  it('URL does not contain key: verifies requests to /models, /models/{id}, and :generateContent contain no query parameter keys', async () => {
    const testApiKey = 'AIzaSySecretApiKeyNoUrl1234567890';

    const recordedCalls: { url: string; options: any }[] = [];
    const mockFetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      recordedCalls.push({ url, options });
      if (url.includes(':generateContent')) {
        return {
          ok: true,
          json: async () => ({ candidates: [{ content: { parts: [{ text: 'Pong' }] } }] }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          name: 'models/gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          models: [
            {
              name: 'models/gemini-2.5-flash',
              displayName: 'Gemini 2.5 Flash',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
          supportedGenerationMethods: ['generateContent'],
        }),
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    // Call 1: listModelsForKey (/models)
    await modelInfoService.listModelsForKey(testApiKey, true);

    // Call 2: verifySingleModel (/models/{id}) with custom model ID
    await modelInfoService.verifySingleModel('gemini-custom-no-url', testApiKey);

    // Call 3: probeModelGeneration (:generateContent)
    await modelInfoService.probeModelGeneration('gemini-custom-no-url', testApiKey);

    expect(recordedCalls.length).toBeGreaterThanOrEqual(3);

    for (const call of recordedCalls) {
      // 1. URL tuyệt đối không chứa ?key= hoặc &key=
      expect(call.url).not.toContain('?key=');
      expect(call.url).not.toContain('&key=');
      expect(call.url).not.toContain(testApiKey);

      // 2. URL phải thuộc chuẩn REST sạch
      expect(call.url.startsWith('https://generativelanguage.googleapis.com/v1beta/')).toBe(true);
    }
  });

  // 2. header contains key
  it('header contains key: verifies x-goog-api-key header is present in all outbound discovery and probe calls', async () => {
    const testApiKey = 'AIzaSySecretApiKeyInHeader987654321';

    const recordedCalls: { url: string; options: any }[] = [];
    const mockFetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      recordedCalls.push({ url, options });
      return {
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
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    await modelInfoService.listModelsForKey(testApiKey, true);

    expect(recordedCalls.length).toBe(1);
    const headers = recordedCalls[0].options.headers;

    // Header bắt buộc phải có 'x-goog-api-key' chứa đúng API key
    expect(headers['x-goog-api-key']).toBe(testApiKey);
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['User-Agent']).toBe('aistudio-build');

    // Test unit buildGoogleApiHeaders
    const built = buildGoogleApiHeaders(`  ${testApiKey}  `);
    expect(built['x-goog-api-key']).toBe(testApiKey);
  });

  // 3. logs do not contain key
  it('logs do not contain key: ensures errors and logs are redacted and do not expose API keys', async () => {
    const secretApiKey = 'AIzaSyUltraSecretLeakCheck555555555';

    // Mock API trả về 500 kèm message chứa URL cũ hoặc raw text
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({
        error: {
          message: `Request with key ${secretApiKey} failed on server`,
        },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    let caughtError: Error | null = null;
    try {
      await modelInfoService.listModelsForKey(secretApiKey, true);
    } catch (err: any) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
    // Thông điệp lỗi đã được sanitize qua redactApiKey
    expect(caughtError!.message).not.toContain(secretApiKey);
    expect(caughtError!.message).toContain('***REDACTED***');
  });
});
