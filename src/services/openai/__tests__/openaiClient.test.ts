// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  callOpenAICompatible,
  clearOpenAIResponseFormatCache,
  listOpenAIModels,
  testOpenAIConnection,
} from '../openaiClient';
import {
  saveOpenAIApiKeys,
  saveStoredAIProviderConfig,
} from '../../../utils/aiProviderStorage';
import { localQuotaTracker } from '../../localQuotaTracker';

describe('openaiClient Adapter & Diagnostics (Feature 174)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearOpenAIResponseFormatCache();
    localQuotaTracker.resetMetrics();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('isolates OpenAI model/keys from Gemini caller options (never leaks AIza... keys or gemini-* model)', async () => {
    saveStoredAIProviderConfig({
      providerMode: 'openai-compatible',
      presetId: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
    });
    saveOpenAIApiKeys(['sk-openai-real-1111'], false);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"rawTranslation":"Xin chào"}' } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await callOpenAICompatible({
      apiKeys: ['AIzaSyFakeGeminiSecretKeyDoNotLeak123456'],
      model: 'gemini-3.5-flash-lite',
      prompt: 'Dịch câu này',
      systemInstruction: 'Hệ thống dịch',
      schema: {
        type: 'OBJECT',
        properties: { rawTranslation: { type: 'STRING' } },
        required: ['rawTranslation'],
      },
    });

    expect(result.text).toBe('{"rawTranslation":"Xin chào"}');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('https://api.deepseek.com/v1/chat/completions');
    const headers = init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-openai-real-1111');
    expect(JSON.stringify(headers)).not.toContain('AIzaSyFakeGeminiSecretKey');

    const sentBody = JSON.parse(String(init?.body));
    expect(sentBody.model).toBe('deepseek-chat');
    expect(sentBody.model).not.toContain('gemini');
    expect(sentBody.response_format?.type).toBe('json_schema');
    expect(sentBody.response_format?.json_schema?.strict).toBe(false);
  });

  it('supports keyless local Ollama/LM Studio requests without sending Authorization header', async () => {
    saveStoredAIProviderConfig({
      providerMode: 'openai-compatible',
      presetId: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      model: 'qwen2.5:14b',
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '<think>{"ignored":true}</think>\n```json\n{"polishedTranslation":"Hoàn tất"}\n```',
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await callOpenAICompatible({
      apiKeys: [],
      prompt: 'Chuốt văn',
    });

    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('http://localhost:11434/v1/chat/completions');
    const headers = init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
    expect(result.successKeyIndex).toBe(0);
    expect(result.text).not.toContain('<think>');
    expect(result.text).toContain('"polishedTranslation":"Hoàn tất"');
  });

  it('downgrades response_format dynamically (json_schema -> json_object -> prompt_only) and caches tier per session', async () => {
    saveStoredAIProviderConfig({
      providerMode: 'openai-compatible',
      presetId: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      model: 'llama-3.3-70b-versatile',
    });
    saveOpenAIApiKeys(['gsk_test_key_123456'], false);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { message: 'Unsupported response_format json_schema' } }),
          { status: 400 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { message: 'response_format json_object is not supported' } }),
          { status: 400 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }),
          { status: 200 }
        )
      );

    globalThis.fetch = fetchMock as typeof fetch;

    const schema = {
      type: 'OBJECT',
      properties: { ok: { type: 'BOOLEAN' } },
    };

    const res1 = await callOpenAICompatible({ prompt: 'Turn 1', systemInstruction: 'Sys', schema });
    expect(res1.text).toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const req1 = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const req2 = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    const req3 = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(req1.response_format).toMatchObject({ type: 'json_schema' });
    expect(req2.response_format).toEqual({ type: 'json_object' });
    expect(req3.response_format).toBeUndefined();
    expect(req3.messages[0].content).toContain('[ĐỊNH DẠNG ĐẦU RA BẮT BUỘC]');

    // Second call uses cached 'prompt_only' directly (no extra 400 errors)
    const res2 = await callOpenAICompatible({ prompt: 'Turn 2', systemInstruction: 'Sys', schema });
    expect(res2.text).toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('skips json_schema directly when root schema type is ARRAY', async () => {
    saveStoredAIProviderConfig({
      providerMode: 'openai-compatible',
      presetId: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
    });
    saveOpenAIApiKeys(['sk-array-test'], false);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '[]' } }] }), { status: 200 })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    await callOpenAICompatible({
      prompt: 'Extract array',
      schema: {
        type: 'ARRAY',
        items: { type: 'OBJECT', properties: { chinese: { type: 'STRING' } } },
      },
    });

    const sent = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(sent.response_format).toBeUndefined();
    expect(sent.messages[0].content).toContain('JSON Array');
  });

  it('rotates multiple remote OpenAI keys on 429 and redacts secret keys from error messages', async () => {
    saveStoredAIProviderConfig({
      providerMode: 'openai-compatible',
      presetId: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
    });
    saveOpenAIApiKeys(['sk-secret-key-one-aaaa', 'sk-secret-key-two-bbbb'], false);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { message: 'Rate limit hit for sk-secret-key-one-aaaa' } }),
          { status: 429, headers: { 'retry-after': '10' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: '{"rawTranslation":"Key 2 OK"}' } }] }),
          { status: 200 }
        )
      );
    globalThis.fetch = fetchMock as typeof fetch;

    const res = await callOpenAICompatible({ prompt: 'Test rotation' });
    expect(res.successKeyIndex).toBe(1);
    expect(res.text).toContain('Key 2 OK');
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer sk-secret-key-one-aaaa'
    );
    expect((fetchMock.mock.calls[1][1]?.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer sk-secret-key-two-bbbb'
    );

    // Verify 401 failure redacts raw secret key
    const authFailFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: 'Invalid key sk-secret-key-one-aaaa provided' } }),
        { status: 401 }
      )
    );
    globalThis.fetch = authFailFetch as typeof fetch;
    await expect(
      callOpenAICompatible(
        { prompt: 'Fail' },
        { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', apiKeys: ['sk-secret-key-one-aaaa'] }
      )
    ).rejects.toSatisfy((err: Error) => !err.message.includes('sk-secret-key-one-aaaa'));
  });

  it('lists models from /v1/models and reports Vietnamese CORS guidance on local TypeError', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: 'qwen2.5:14b', owned_by: 'library' },
            { id: 'deepseek-r1:14b', owned_by: 'library' },
          ],
        }),
        { status: 200 }
      )
    ) as typeof fetch;

    const models = await listOpenAIModels('http://localhost:11434/v1');
    expect(models.map((m) => m.name)).toEqual(['qwen2.5:14b', 'deepseek-r1:14b']);

    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as typeof fetch;
    const testRes = await testOpenAIConnection('http://localhost:11434/v1', 'qwen2.5:14b');
    expect(testRes.ok).toBe(false);
    expect(testRes.isCorsSuspected).toBe(true);
    expect(testRes.message).toContain('CORS');
    expect(testRes.message).toContain('OLLAMA_ORIGINS');
  });
});
