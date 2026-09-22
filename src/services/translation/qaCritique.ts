/**
 * QA Critique Service (Phase 3)
 * Kiểm duyệt đối chiếu song ngữ, phát hiện câu sót, từ sai nghĩa hoặc lệch văn cảnh
 */

import { callGeminiDirect } from '../directGeminiClient';
import { buildQaCritiquePayload } from '../ai/prompts';
import {
  parseGeminiStructuredResponse,
  isQaCritiqueResponse,
  isQaCritiqueIssue,
  QaCritiqueResponse,
} from '../../lib/text';
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

  const parsed = parseGeminiStructuredResponse<QaCritiqueResponse>(response.text, {
    validator: isQaCritiqueResponse,
    contextName: 'qaCritique',
  });
  const normalizeIssueType = (val: unknown): DirectQaCritiqueResult['issues'][number]['type'] => {
    if (val === 'omission' || val === 'addition' || val === 'repetition' || val === 'terminology') {
      return val;
    }
    return 'other';
  };

  const normalizeIssueSeverity = (val: unknown): DirectQaCritiqueResult['issues'][number]['severity'] => {
    if (val === 'critical' || val === 'info') {
      return val;
    }
    return 'warning';
  };

  const rawIssues = Array.isArray(parsed.issues) ? parsed.issues : [];
  const safeIssues: DirectQaCritiqueResult['issues'] = rawIssues
    .filter(isQaCritiqueIssue)
    .map((it) => ({
      type: normalizeIssueType(it.type),
      severity: normalizeIssueSeverity(it.severity),
      targetText: typeof it.targetText === 'string' ? it.targetText : '',
      description:
        typeof it.description === 'string' && it.description.trim()
          ? it.description.trim()
          : typeof it.message === 'string'
          ? it.message.trim()
          : '',
    }));

  return {
    isValid: parsed.isValid,
    issues: safeIssues,
    successKeyIndex: response.successKeyIndex,
  };
}
