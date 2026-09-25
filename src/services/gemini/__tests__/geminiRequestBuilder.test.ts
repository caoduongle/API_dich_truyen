import { describe, it, expect } from 'vitest';
import {
  normalizeModelName,
  buildEndpointUrl,
  buildPayload,
  getPermissiveSafetySettings,
} from '../geminiRequestBuilder';

describe('geminiRequestBuilder', () => {
  it('strips "models/" prefix from model names', () => {
    expect(normalizeModelName('models/gemini-2.5-flash')).toBe('gemini-2.5-flash');
    expect(normalizeModelName('gemini-2.5-pro')).toBe('gemini-2.5-pro');
  });

  it('builds standard v1beta endpoint URL', () => {
    const url = buildEndpointUrl('gemini-2.5-flash');
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
    );
  });

  it('builds request payload with prompt and system instructions', () => {
    const payload = buildPayload({
      prompt: 'Translate this',
      systemInstruction: 'You are a translator',
      temperature: 0.5,
    });

    expect(payload.contents[0].parts[0].text).toBe('Translate this');
    expect(payload.systemInstruction.parts[0].text).toBe('You are a translator');
    expect(payload.generationConfig.temperature).toBe(0.5);
  });

  it('configures responseSchema when JSON schema is provided', () => {
    const schema = { type: 'object', properties: { text: { type: 'string' } } };
    const payload = buildPayload({
      prompt: 'Extract JSON',
      schema,
    });

    expect(payload.generationConfig.responseMimeType).toBe('application/json');
    expect(payload.generationConfig.responseSchema).toEqual(schema);
    expect(payload.safetySettings).toHaveLength(4);
  });

  describe('Permissive Safety Settings (Spec 162 US2)', () => {
    it('returns permissive BLOCK_NONE settings for 4 harm categories', () => {
      const settings = getPermissiveSafetySettings();
      expect(settings).toHaveLength(4);
      expect(settings.every((s) => s.threshold === 'BLOCK_NONE')).toBe(true);
      const categories = settings.map((s) => s.category);
      expect(categories).toContain('HARM_CATEGORY_HARASSMENT');
      expect(categories).toContain('HARM_CATEGORY_HATE_SPEECH');
      expect(categories).toContain('HARM_CATEGORY_SEXUALLY_EXPLICIT');
      expect(categories).toContain('HARM_CATEGORY_DANGEROUS_CONTENT');
    });

    it('injects permissive safetySettings into payload by default', () => {
      const payload = buildPayload({ prompt: 'Võ thuật chiến đấu' });
      expect(payload.safetySettings).toBeDefined();
      expect(payload.safetySettings).toHaveLength(4);
      expect(payload.safetySettings[0].threshold).toBe('BLOCK_NONE');
    });

    it('allows caller to override safetySettings when explicitly supplied', () => {
      const custom = [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      ];
      const payload = buildPayload({
        prompt: 'Custom test',
        safetySettings: custom,
      });
      expect(payload.safetySettings).toEqual(custom);
    });
  });
});
