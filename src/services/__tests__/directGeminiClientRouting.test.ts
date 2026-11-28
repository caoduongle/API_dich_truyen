// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallGemini = vi.fn();
const mockCallOpenAICompatible = vi.fn();

vi.mock('../gemini/geminiClient', () => ({
  callGemini: (...args: any[]) => mockCallGemini(...args),
}));

vi.mock('../openai/openaiClient', () => ({
  callOpenAICompatible: (...args: any[]) => mockCallOpenAICompatible(...args),
}));

import { callGeminiDirect } from '../directGeminiClient';
import { saveStoredAIProviderConfig } from '../../utils/aiProviderStorage';

describe('directGeminiClient Gateway Routing (Feature 174)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mockCallGemini.mockReset();
    mockCallOpenAICompatible.mockReset();
  });

  it('routes to Google Gemini callGemini by default when providerMode is gemini', async () => {
    mockCallGemini.mockResolvedValue({ text: 'gemini-ok', successKeyIndex: 0 });

    const res = await callGeminiDirect({
      apiKeys: ['gemini-key-1'],
      model: 'gemini-2.5-flash',
      prompt: 'Hello',
    });

    expect(res).toEqual({ text: 'gemini-ok', successKeyIndex: 0 });
    expect(mockCallGemini).toHaveBeenCalledTimes(1);
    expect(mockCallOpenAICompatible).not.toHaveBeenCalled();
  });

  it('routes all pipeline calls to callOpenAICompatible when providerMode is openai-compatible', async () => {
    saveStoredAIProviderConfig({
      providerMode: 'openai-compatible',
      presetId: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      model: 'qwen2.5:14b',
    });
    mockCallOpenAICompatible.mockResolvedValue({ text: 'openai-ok', successKeyIndex: 0 });

    const res = await callGeminiDirect({
      apiKeys: [],
      model: 'gemini-3.5-flash-lite',
      prompt: 'Translate chapter',
    });

    expect(res).toEqual({ text: 'openai-ok', successKeyIndex: 0 });
    expect(mockCallOpenAICompatible).toHaveBeenCalledTimes(1);
    expect(mockCallGemini).not.toHaveBeenCalled();
  });
});
