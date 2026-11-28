// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_AI_PROVIDER_CONFIG,
  getIncludePinnedGlossaryPreference,
  getStoredAIProviderConfig,
  hasActiveAICredentials,
  loadOpenAIApiKeys,
  maskSecretKey,
  saveOpenAIApiKeys,
  saveStoredAIProviderConfig,
  setIncludePinnedGlossaryPreference,
} from '../aiProviderStorage';

describe('aiProviderStorage & credential boundaries (Feature 174)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('defaults to gemini provider mode and OFF for includePinnedGlossary', () => {
    expect(getStoredAIProviderConfig()).toEqual(DEFAULT_AI_PROVIDER_CONFIG);
    expect(getIncludePinnedGlossaryPreference()).toBe(false);

    setIncludePinnedGlossaryPreference(true);
    expect(getIncludePinnedGlossaryPreference()).toBe(true);
    setIncludePinnedGlossaryPreference(false);
    expect(getIncludePinnedGlossaryPreference()).toBe(false);
  });

  it('stores OpenAI keys in sessionStorage and scrubs savedOpenAIKeys when rememberKeys is false', () => {
    saveOpenAIApiKeys(['sk-secret-openai-9999'], true);
    expect(JSON.parse(sessionStorage.getItem('openai_api_keys') || '[]')).toEqual([
      'sk-secret-openai-9999',
    ]);
    expect(JSON.parse(localStorage.getItem('app_ui_prefs') || '{}').savedOpenAIKeys).toEqual([
      'sk-secret-openai-9999',
    ]);

    // Turn off rememberKeys -> must scrub savedOpenAIKeys immediately
    saveOpenAIApiKeys(['sk-secret-openai-9999'], false);
    expect(JSON.parse(localStorage.getItem('app_ui_prefs') || '{}').savedOpenAIKeys).toEqual([]);

    // Also scrubs stale savedOpenAIKeys on loadOpenAIApiKeys if rememberKeys === false
    sessionStorage.clear();
    localStorage.setItem(
      'app_ui_prefs',
      JSON.stringify({ rememberKeys: false, savedOpenAIKeys: ['sk-stale-leak'] })
    );
    expect(loadOpenAIApiKeys()).toEqual([]);
    expect(JSON.parse(localStorage.getItem('app_ui_prefs') || '{}').savedOpenAIKeys).toEqual([]);
  });

  it('evaluates hasActiveAICredentials uniformly for gemini, local keyless, and remote OpenAI', () => {
    // Gemini default
    expect(hasActiveAICredentials([])).toBe(false);
    expect(hasActiveAICredentials(['gemini-key-1'])).toBe(true);

    // Local Ollama with 0 keys -> true
    saveStoredAIProviderConfig({
      providerMode: 'openai-compatible',
      presetId: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      model: 'qwen2.5:14b',
    });
    expect(hasActiveAICredentials([])).toBe(true);

    // Remote DeepSeek with 0 keys -> false; once OpenAI key added -> true
    saveStoredAIProviderConfig({
      providerMode: 'openai-compatible',
      presetId: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
    });
    expect(hasActiveAICredentials(['gemini-key-should-not-unlock-remote-openai'])).toBe(false);

    saveOpenAIApiKeys(['sk-deepseek-key'], false);
    expect(hasActiveAICredentials([])).toBe(true);

    // Spoofed http remote host -> blocked
    saveStoredAIProviderConfig({
      providerMode: 'openai-compatible',
      presetId: 'custom',
      baseUrl: 'http://localhost.evil.com/v1',
      model: 'bad-model',
    });
    expect(hasActiveAICredentials([])).toBe(false);
  });

  it('masks secret keys without revealing full tokens', () => {
    expect(maskSecretKey('sk-1234567890abcdef')).toBe('sk-1...cdef');
    expect(maskSecretKey('short')).toBe('****');
    expect(maskSecretKey('')).toBe('');
  });
});
