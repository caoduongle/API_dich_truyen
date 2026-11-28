import { describe, it, expect } from 'vitest';
import {
  OPENAI_COMPATIBLE_PRESETS,
  buildOpenAICompatibleEndpoint,
  isLocalProviderUrl,
  validateProviderBaseUrl,
} from '../aiProviders';

describe('aiProviders config & URL security validation (Feature 174)', () => {
  it('defines all 7 required presets with accurate local keyless flags', () => {
    const ids = Object.keys(OPENAI_COMPATIBLE_PRESETS);
    expect(ids).toEqual([
      'deepseek',
      'qwen',
      'groq',
      'nvidia-nim',
      'ollama',
      'lm-studio',
      'custom',
    ]);
    expect(OPENAI_COMPATIBLE_PRESETS.ollama.isLocal).toBe(true);
    expect(OPENAI_COMPATIBLE_PRESETS.ollama.requiresApiKey).toBe(false);
    expect(OPENAI_COMPATIBLE_PRESETS['lm-studio'].isLocal).toBe(true);
    expect(OPENAI_COMPATIBLE_PRESETS['lm-studio'].requiresApiKey).toBe(false);
    expect(OPENAI_COMPATIBLE_PRESETS.deepseek.requiresApiKey).toBe(true);
    expect(OPENAI_COMPATIBLE_PRESETS.deepseek.baseUrl).toBe('https://api.deepseek.com/v1');
  });

  it('strictly parses hostname for isLocalProviderUrl to prevent subdomain/userinfo spoofing', () => {
    expect(isLocalProviderUrl('http://localhost:11434/v1')).toBe(true);
    expect(isLocalProviderUrl('http://127.0.0.1:1234/v1')).toBe(true);
    expect(isLocalProviderUrl('http://[::1]:11434/v1')).toBe(true);
    expect(isLocalProviderUrl('https://localhost:8443/v1')).toBe(true);

    // Spoofing attempts MUST return false
    expect(isLocalProviderUrl('http://localhost.evil.com/v1')).toBe(false);
    expect(isLocalProviderUrl('https://127.0.0.1.attacker.io/v1')).toBe(false);
    expect(isLocalProviderUrl('http://evil.com/?redirect=localhost')).toBe(false);
    expect(isLocalProviderUrl('javascript:alert(1)')).toBe(false);
    expect(isLocalProviderUrl('file:///etc/passwd')).toBe(false);
  });

  it('allows http:// only for loopback hosts and blocks insecure remote http:// or credentials in URL', () => {
    expect(validateProviderBaseUrl('http://localhost:11434/v1')).toEqual({
      valid: true,
      normalizedUrl: 'http://localhost:11434/v1',
      isLocal: true,
    });
    expect(validateProviderBaseUrl('https://api.deepseek.com/v1/')).toEqual({
      valid: true,
      normalizedUrl: 'https://api.deepseek.com/v1',
      isLocal: false,
    });

    expect(validateProviderBaseUrl('http://api.deepseek.com/v1').valid).toBe(false);
    expect(validateProviderBaseUrl('http://localhost.evil.com/v1').valid).toBe(false);
    expect(validateProviderBaseUrl('https://user:pass@api.deepseek.com/v1').valid).toBe(false);
    expect(validateProviderBaseUrl('ftp://api.deepseek.com/v1').valid).toBe(false);
  });

  it('builds /chat/completions and /models endpoints cleanly without path duplication', () => {
    expect(buildOpenAICompatibleEndpoint('http://localhost:11434/v1/', '/chat/completions')).toBe(
      'http://localhost:11434/v1/chat/completions'
    );
    expect(
      buildOpenAICompatibleEndpoint('https://api.deepseek.com/v1/chat/completions', '/models')
    ).toBe('https://api.deepseek.com/v1/models');
    expect(
      buildOpenAICompatibleEndpoint('https://dashscope-intl.aliyuncs.com/compatible-mode/v1', '/chat/completions')
    ).toBe('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions');
  });
});
