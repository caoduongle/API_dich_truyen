import { callGeminiDirect } from './directGeminiClient';
import {
  buildAnalyzeGlossaryPayload,
  buildAnalyzeGuidelinesPayload,
  buildExtractGlossaryPayload,
  buildAlignChapterPayload,
  buildAlignmentJsonlLines,
} from '@shared/prompts';
import {
  safeParseJson,
  splitTextAdaptively,
  splitTextIntoChunks,
  estimateTokenCount,
} from '@shared/text';
import { validateAndSnapBackEntities, isHanEquivalent } from '@shared/sinoNormalize';
import { parseGlossaryFromMd } from '@shared/parser';
import { GLOSSARY_LIMITS } from '@shared/constants';

const { MAX_CHARS_FOR_GLOSSARY_ANALYSIS, MAX_CHARS_FOR_GUIDELINES_ANALYSIS } = GLOSSARY_LIMITS;
const MAX_CHUNKS_TO_ANALYZE = 5;

function isSafetyOrEmptyErrorDirect(err: any): boolean {
  const msg = err?.message || '';
  return msg.includes('bộ lọc an toàn') || msg.includes('phản hồi rỗng');
}

export interface DirectGlossaryCommonParams {
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  signal?: AbortSignal;
}

async function callGlossaryAnalysisDirect(
  text: string,
  common: DirectGlossaryCommonParams
): Promise<{ suggestions: any[]; successKeyIndex: number }> {
  const { systemInstruction, prompt, schema } = buildAnalyzeGlossaryPayload({ text });
  const response = await callGeminiDirect({
    apiKeys: common.apiKeys,
    model: common.model,
    prompt,
    systemInstruction,
    schema,
    temperature: 0.2,
    startKeyIndex: common.startKeyIndex,
    signal: common.signal,
  });

  const parsed = safeParseJson(response.text);
  const suggestions = parsed && Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  return { suggestions, successKeyIndex: response.successKeyIndex };
}

async function analyzeGlossaryWithContentSplitDirect(
  text: string,
  common: DirectGlossaryCommonParams,
  depth = 0
): Promise<{ suggestions: any[]; successKeyIndex: number }> {
  if (estimateTokenCount(text) < 180 || depth > 4) {
    try {
      return await callGlossaryAnalysisDirect(text, common);
    } catch (leafErr: any) {
      if (depth > 0) {
        return { suggestions: [], successKeyIndex: common.startKeyIndex ?? 0 };
      }
      throw leafErr;
    }
  }

  try {
    return await callGlossaryAnalysisDirect(text, common);
  } catch (error: any) {
    if (!isSafetyOrEmptyErrorDirect(error)) {
      throw error;
    }

    const partsCount = depth >= 2 ? 3 : 2;
    const parts = splitTextAdaptively(text, partsCount);

    if (parts.length <= 1) {
      if (depth > 0) {
        return { suggestions: [], successKeyIndex: common.startKeyIndex ?? 0 };
      }
      throw error;
    }

    const results = await Promise.all(
      parts.map(async (part) => {
        try {
          return await analyzeGlossaryWithContentSplitDirect(part, common, depth + 1);
        } catch {
          return { suggestions: [], successKeyIndex: common.startKeyIndex ?? 0 };
        }
      })
    );

    const combinedSuggestions = results.flatMap((r) => r.suggestions || []);
    const lastSuccessKey = results[results.length - 1].successKeyIndex;
    return { suggestions: combinedSuggestions, successKeyIndex: lastSuccessKey };
  }
}

export interface AnalyzeGlossaryDirectParams extends DirectGlossaryCommonParams {
  text: string;
  chapterId?: string;
  sourceChapterId?: string;
}

export interface AnalyzeGlossaryDirectResult {
  suggestions: any[];
  successKeyIndex: number;
  truncated?: boolean;
  originalLength?: number;
  analyzedLength?: number;
}

export async function analyzeGlossaryDirect(
  params: AnalyzeGlossaryDirectParams
): Promise<AnalyzeGlossaryDirectResult> {
  const { text, chapterId, sourceChapterId, ...common } = params;

  const chunks = splitTextIntoChunks(text, MAX_CHARS_FOR_GLOSSARY_ANALYSIS);
  const chunksToProcess = chunks.slice(0, MAX_CHUNKS_TO_ANALYZE);
  const hasTruncatedChunks = chunks.length > MAX_CHUNKS_TO_ANALYZE;
  const totalAnalyzedLength = chunksToProcess.reduce((sum, chunk) => sum + chunk.length, 0);
  const textToAnalyze = text.substring(0, totalAnalyzedLength);

  let result = { suggestions: [] as any[], successKeyIndex: common.startKeyIndex ?? 0 };
  try {
    result = await analyzeGlossaryWithContentSplitDirect(textToAnalyze, common, 0);
  } catch (splitError: any) {
    if (isSafetyOrEmptyErrorDirect(splitError)) {
      result = { suggestions: [], successKeyIndex: common.startKeyIndex ?? 0 };
    } else {
      throw splitError;
    }
  }

  const uniqueSuggestions: any[] = [];
  for (const item of result.suggestions) {
    if (!item || typeof item.chinese !== 'string') continue;
    const isDuplicate = uniqueSuggestions.some((existingItem) => isHanEquivalent(existingItem.chinese, item.chinese));
    if (!isDuplicate) {
      uniqueSuggestions.push(item);
    }
  }

  const validatedSuggestions = validateAndSnapBackEntities(uniqueSuggestions, text);
  const resolvedChapterId = sourceChapterId || chapterId;
  const finalSuggestions = resolvedChapterId
    ? validatedSuggestions.map((s: any) => ({ ...s, sourceChapterId: resolvedChapterId }))
    : validatedSuggestions;

  return {
    suggestions: finalSuggestions,
    successKeyIndex: result.successKeyIndex,
    ...(hasTruncatedChunks
      ? { truncated: true, originalLength: text.length, analyzedLength: totalAnalyzedLength }
      : {}),
  };
}

export interface AnalyzeGuidelinesDirectParams extends DirectGlossaryCommonParams {
  text: string;
}

export interface AnalyzeGuidelinesDirectResult {
  extractedGlossary: any[];
  genre: string;
  tone: string;
  description: string;
  successKeyIndex: number;
  truncated?: boolean;
  originalLength?: number;
  analyzedLength?: number;
}

export async function analyzeGuidelinesDirect(
  params: AnalyzeGuidelinesDirectParams
): Promise<AnalyzeGuidelinesDirectResult> {
  const { text, ...common } = params;

  const parsedGlossary = parseGlossaryFromMd(text);
  const guidelinesSection = text.slice(0, MAX_CHARS_FOR_GUIDELINES_ANALYSIS);
  const isGuidelinesTruncated = text.length > MAX_CHARS_FOR_GUIDELINES_ANALYSIS;

  const { systemInstruction, prompt, schema } = buildAnalyzeGuidelinesPayload({ guidelinesSection });
  const response = await callGeminiDirect({
    apiKeys: common.apiKeys,
    model: common.model,
    prompt,
    systemInstruction,
    schema,
    temperature: 0.1,
    startKeyIndex: common.startKeyIndex,
    signal: common.signal,
  });

  const aiMeta = safeParseJson(response.text);

  return {
    extractedGlossary: parsedGlossary,
    genre: aiMeta.genre,
    tone: aiMeta.tone,
    description: aiMeta.description,
    successKeyIndex: response.successKeyIndex,
    ...(isGuidelinesTruncated
      ? { truncated: true, originalLength: text.length, analyzedLength: MAX_CHARS_FOR_GUIDELINES_ANALYSIS }
      : {}),
  };
}

export interface ExtractGlossaryDirectParams extends DirectGlossaryCommonParams {
  text: string;
  chapterId?: string;
  sourceChapterId?: string;
}

export interface ExtractGlossaryDirectResult {
  glossary: any[];
  successKeyIndex: number;
  warning?: string;
}

export async function extractGlossaryDirect(
  params: ExtractGlossaryDirectParams
): Promise<ExtractGlossaryDirectResult> {
  const { text, chapterId, sourceChapterId, ...common } = params;

  try {
    const { systemInstruction, prompt, schema } = buildExtractGlossaryPayload({ text });
    const response = await callGeminiDirect({
      apiKeys: common.apiKeys,
      model: common.model,
      prompt,
      systemInstruction,
      schema,
      temperature: 0.2,
      startKeyIndex: common.startKeyIndex,
      signal: common.signal,
    });

    let parsed: any;
    try {
      parsed = safeParseJson(response.text);
    } catch {
      parsed = [];
    }

    const parsedGlossary = Array.isArray(parsed) ? parsed : parsed?.suggestions || [];
    let validatedGlossary = validateAndSnapBackEntities(parsedGlossary, text);
    const resolvedChapterId = sourceChapterId || chapterId;
    if (resolvedChapterId) {
      validatedGlossary = validatedGlossary.map((s: any) => ({ ...s, sourceChapterId: resolvedChapterId }));
    }

    return { glossary: validatedGlossary, successKeyIndex: response.successKeyIndex };
  } catch (error: any) {
    if (isSafetyOrEmptyErrorDirect(error)) {
      return {
        glossary: [],
        successKeyIndex: common.startKeyIndex ?? 0,
        warning: 'Bị chặn bởi bộ lọc an toàn.',
      };
    }
    throw error;
  }
}

export interface AlignChapterDirectParams extends DirectGlossaryCommonParams {
  sourceText: string;
  translatedText: string;
}

export interface AlignChapterDirectResult {
  jsonlLines: string[];
  successKeyIndex: number;
}

export async function alignChapterDirect(
  params: AlignChapterDirectParams
): Promise<AlignChapterDirectResult> {
  const { sourceText, translatedText, ...common } = params;

  const { systemInstruction, prompt, schema } = buildAlignChapterPayload({ sourceText, translatedText });
  const response = await callGeminiDirect({
    apiKeys: common.apiKeys,
    model: common.model,
    prompt,
    systemInstruction,
    schema,
    temperature: 0.15,
    startKeyIndex: common.startKeyIndex,
    signal: common.signal,
  });

  const parsed = safeParseJson(response.text);
  const list = Array.isArray(parsed?.alignments) ? parsed.alignments : [];
  const jsonlLines = buildAlignmentJsonlLines(list);

  return { jsonlLines, successKeyIndex: response.successKeyIndex };
}
