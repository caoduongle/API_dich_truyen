import { describe, it, expect } from 'vitest';
import {
  normalizeModelName,
  buildEndpointUrl,
  buildPayload,
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
  });
});
