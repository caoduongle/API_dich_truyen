/**
 * QA Critique Service (Phase 3)
 * Kiểm duyệt đối chiếu song ngữ, phát hiện câu sót, từ sai nghĩa hoặc lệch văn cảnh
 */

import { callGeminiDirect } from '../directGeminiClient';
import { buildQaCritiquePayload } from '../ai/prompts';
import { safeParseJson } from '../../lib/text';
import {
  DirectQaCritiqueParams,
  DirectQaCritiqueResult,
} from './types';

export async function qaCritiqueDirect(
  params: DirectQaCritiqueParams
): Promise<DirectQaCritiqueResult> {
  const {
    sourceText,
    translatedText,
    genre,
    tone,
    description,
    glossary,
    apiKeys,
    model,
    startKeyIndex = 0,
    signal,
  } = params;

  const { systemInstruction, prompt, schema } = buildQaCritiquePayload({
    sourceText,
    translatedText,
    genre,
    tone,
    description,
    glossary,
  });

  const response = await callGeminiDirect({
    apiKeys,
    model,
    prompt,
    systemInstruction,
    schema,
    temperature: 0.15,
    startKeyIndex,
    signal,
  });

  const parsed = safeParseJson(response.text);
  return {
    isValid: parsed?.isValid ?? true,
    issues: Array.isArray(parsed?.issues) ? parsed.issues : [],
    successKeyIndex: response.successKeyIndex,
  };
}
