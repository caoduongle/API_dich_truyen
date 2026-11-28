import { describe, it, expect } from 'vitest';
import {
  buildJsonInstructionHint,
  canUseOpenAIJsonSchema,
  convertGeminiSchemaToJsonSchema,
} from '../openaiSchemaAdapter';

describe('openaiSchemaAdapter (Feature 174)', () => {
  it('converts Gemini uppercase schema types recursively and attaches additionalProperties: false', () => {
    const geminiSchema = {
      type: 'OBJECT',
      properties: {
        rawTranslation: { type: 'STRING', description: 'Bản dịch thô' },
        discoveredEntities: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              chinese: { type: 'STRING' },
              type: { type: 'STRING', enum: ['character', 'location', 'term'] },
            },
            required: ['chinese'],
          },
        },
      },
      required: ['rawTranslation'],
    };

    expect(canUseOpenAIJsonSchema(geminiSchema)).toBe(true);
    const converted = convertGeminiSchemaToJsonSchema(geminiSchema);
    expect(converted).toEqual({
      type: 'object',
      properties: {
        rawTranslation: { type: 'string', description: 'Bản dịch thô' },
        discoveredEntities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              chinese: { type: 'string' },
              type: { type: 'string', enum: ['character', 'location', 'term'] },
            },
            required: ['chinese'],
            additionalProperties: false,
          },
        },
      },
      required: ['rawTranslation'],
      additionalProperties: false,
    });
  });

  it('skips json_schema eligibility for root ARRAY schemas (such as buildExtractGlossaryPayload)', () => {
    const rootArraySchema = {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          chinese: { type: 'STRING' },
          vietnamese: { type: 'STRING' },
        },
        required: ['chinese', 'vietnamese'],
      },
    };

    expect(canUseOpenAIJsonSchema(rootArraySchema)).toBe(false);
    const hint = buildJsonInstructionHint(rootArraySchema);
    expect(hint).toContain('JSON Array');
  });

  it('builds readable JSON hint summarizing required vs optional fields', () => {
    const hint = buildJsonInstructionHint({
      type: 'OBJECT',
      properties: {
        polishedTranslation: { type: 'STRING' },
        notes: { type: 'STRING' },
      },
      required: ['polishedTranslation'],
    });

    expect(hint).toContain('"polishedTranslation": (string, bắt buộc)');
    expect(hint).toContain('"notes": (string, tùy chọn)');
  });
});
