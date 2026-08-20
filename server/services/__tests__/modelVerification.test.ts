import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  evaluateModelGenerationCapability,
  modelInfoService,
} from '../modelInfoService';

describe('Model Verification Tri-State & Explicit Probe (TASK 06)', () => {
  beforeEach(() => {
    modelInfoService.clearCache();
    vi.restoreAllMocks();
  });

  // 1. capability present
  it('capability present: evaluates as supported and verifies successfully when generateContent is explicitly present', async () => {
    // Evaluation unit test
    const cap = evaluateModelGenerationCapability(['generateContent', 'countTokens']);
    expect(cap).toBe('supported');

    // Integration test with verifySingleModel
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'models/gemini-2.5-flash-custom',
        displayName: 'Gemini 2.5 Flash Custom',
        supportedGenerationMethods: ['generateContent'],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const verified = await modelInfoService.verifySingleModel(
      'gemini-2.5-flash-custom',
      'AIzaSyTestKeyValid111'
    );

    expect(verified.verified).toBe(true);
    expect(verified.capabilities.generateContent).toBe(true);
    expect(verified.id).toBe('gemini-2.5-flash-custom');
  });

  // 2. capability absent
  it('capability absent: evaluates as unsupported and rejects verification when generateContent is missing from methods array', async () => {
    // Evaluation unit test
    const cap = evaluateModelGenerationCapability(['embedContent', 'countTokens']);
    expect(cap).toBe('unsupported');

    // Integration test with verifySingleModel
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'models/text-embedding-004',
        displayName: 'Text Embedding 004',
        supportedGenerationMethods: ['embedContent', 'countTokens'],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      modelInfoService.verifySingleModel('text-embedding-004', 'AIzaSyTestKeyValid111')
    ).rejects.toThrow(/không hỗ trợ phương thức tạo nội dung \(generateContent\)/);
  });

  // 3. capability missing
  it('capability missing: evaluates as unknown (never defaults to true) when supportedGenerationMethods is undefined/null/empty', () => {
    expect(evaluateModelGenerationCapability(undefined)).toBe('unknown');
    expect(evaluateModelGenerationCapability(null)).toBe('unknown');
    expect(evaluateModelGenerationCapability([])).toBe('unknown');
  });

  // 4. malformed metadata
  it('malformed metadata: safely handles invalid types/objects without throwing TypeError and marks as unknown', () => {
    expect(evaluateModelGenerationCapability('not-an-array')).toBe('unknown');
    expect(evaluateModelGenerationCapability({ generateContent: true })).toBe('unknown');
    expect(evaluateModelGenerationCapability([123, null, undefined])).toBe('unknown');
    expect(evaluateModelGenerationCapability(12345)).toBe('unknown');
  });

  // 5. verification success (on unknown metadata via explicit probe)
  it('verification success: successfully verifies unknown model when explicit verification probe succeeds', async () => {
    // Model metadata has missing supportedGenerationMethods (unknown)
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes(':generateContent')) {
        // Probe endpoint returns 200 OK
        return {
          ok: true,
          json: async () => ({ candidates: [{ content: { parts: [{ text: 'Pong' }] } }] }),
        };
      }
      // Metadata endpoint returns missing methods
      return {
        ok: true,
        json: async () => ({
          name: 'models/gemini-experimental-unlisted',
          displayName: 'Gemini Experimental Unlisted',
          supportedGenerationMethods: undefined, // missing
        }),
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    const verified = await modelInfoService.verifySingleModel(
      'gemini-experimental-unlisted',
      'AIzaSyTestKeyValid111'
    );

    expect(verified.verified).toBe(true);
    expect(verified.capabilities.generateContent).toBe(true);
    // Verified that probe was called
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(':generateContent'),
      expect.anything()
    );
  });

  // 6. verification failure (on unknown metadata via failed explicit probe)
  it('verification failure: rejects verification when explicit verification probe fails', async () => {
    // Model metadata has empty supportedGenerationMethods (unknown) and probe fails (400)
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes(':generateContent')) {
        // Probe endpoint returns 400 Bad Request
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: { message: 'Method not supported on this model' } }),
        };
      }
      // Metadata endpoint returns empty methods
      return {
        ok: true,
        json: async () => ({
          name: 'models/gemini-broken-model',
          displayName: 'Gemini Broken Model',
          supportedGenerationMethods: [], // empty -> unknown
        }),
      };
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      modelInfoService.verifySingleModel('gemini-broken-model', 'AIzaSyTestKeyValid111')
    ).rejects.toThrow(/Explicit Verification Probe thất bại/);
  });
});
