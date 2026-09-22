import { callGeminiDirect } from './directGeminiClient';
import {
  buildAnalyzeGlossaryPayload,
  buildAnalyzeGuidelinesPayload,
  buildExtractGlossaryPayload,
  buildAlignChapterPayload,
  buildAlignmentJsonlLines,
} from './ai/prompts';
import {
  splitTextAdaptively,
  splitTextIntoChunks,
  estimateTokenCount,
  parseGeminiStructuredResponse,
  isGlossarySuggestionsResponse,
  isGuidelinesAnalysisResponse,
  isExtractGlossaryResponse,
  isAlignChapterResponse,
  GlossarySuggestionsResponse,
  GuidelinesAnalysisResponse,
  AlignChapterResponse,
  GlossarySuggestion,
} from '../lib/text';
import { validateAndSnapBackEntities, isHanEquivalent } from '../lib/sinoNormalize';
import { parseGlossaryFromMd } from '../lib/parser';
import { GlossaryType } from '../types';
import { GLOSSARY_LIMITS } from '../config/constants';

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
  knownChineseTerms?: string[];
  loopIndex?: number;
  totalLoops?: number;
}

async function callGlossaryAnalysisDirect(
  text: string,
  common: DirectGlossaryCommonParams
): Promise<{ suggestions: GlossarySuggestion[]; successKeyIndex: number }> {
  const { systemInstruction, prompt, schema } = buildAnalyzeGlossaryPayload({
    text,
    knownChineseTerms: common.knownChineseTerms,
    loopIndex: common.loopIndex,
    totalLoops: common.totalLoops,
  });

  let temp = 0.2;
  if (common.loopIndex === 2) temp = 0.35;
  else if (common.loopIndex && common.loopIndex >= 3) temp = 0.45;

  const response = await callGeminiDirect({
    apiKeys: common.apiKeys,
    model: common.model,
    prompt,
    systemInstruction,
    schema,
    temperature: temp,
    startKeyIndex: common.startKeyIndex,
    signal: common.signal,
  });

  const parsed = parseGeminiStructuredResponse<GlossarySuggestionsResponse>(response.text, {
    validator: isGlossarySuggestionsResponse,
    fallback: { suggestions: [] },
    contextName: 'callGlossaryAnalysisDirect',
  });
  const rawSuggestions = (parsed && Array.isArray(parsed.suggestions) ? parsed.suggestions : []) as any[];
  const suggestions: GlossarySuggestion[] = rawSuggestions.map((item: any) => ({
    chinese: typeof item?.chinese === 'string' ? item.chinese : (typeof item?.term === 'string' ? item.term : ''),
    vietnamese: typeof item?.vietnamese === 'string' ? item.vietnamese : '',
    pinyin: typeof item?.pinyin === 'string' ? item.pinyin : '',
    type: (['character', 'location', 'term', 'phrase', 'other'].includes(item?.type) ? item.type : 'other') as GlossaryType,
    note: typeof item?.note === 'string' ? item.note : '',
    ...(item?.sourceChapterId ? { sourceChapterId: item.sourceChapterId } : {}),
    ...(typeof item?.needsReview === 'boolean' ? { needsReview: item.needsReview } : {}),
  }));
  return { suggestions, successKeyIndex: response.successKeyIndex };
}

async function analyzeGlossaryWithContentSplitDirect(
  text: string,
  common: DirectGlossaryCommonParams,
  depth = 0
): Promise<{ suggestions: GlossarySuggestion[]; successKeyIndex: number }> {
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
  suggestions: GlossarySuggestion[];
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

  let result = { suggestions: [] as GlossarySuggestion[], successKeyIndex: common.startKeyIndex ?? 0 };
  try {
    result = await analyzeGlossaryWithContentSplitDirect(textToAnalyze, common, 0);
  } catch (splitError: any) {
    if (isSafetyOrEmptyErrorDirect(splitError)) {
      result = { suggestions: [], successKeyIndex: common.startKeyIndex ?? 0 };
    } else {
      throw splitError;
    }
  }

  const uniqueSuggestions: GlossarySuggestion[] = [];
  for (const item of result.suggestions) {
    if (!item || typeof item.chinese !== 'string') continue;
    const isDuplicate = uniqueSuggestions.some((existingItem) => isHanEquivalent(existingItem.chinese, item.chinese));
    if (!isDuplicate) {
      uniqueSuggestions.push(item);
    }
  }

  const validatedSuggestions = validateAndSnapBackEntities(uniqueSuggestions, text) as GlossarySuggestion[];
  const resolvedChapterId = sourceChapterId || chapterId;
  const finalSuggestions: GlossarySuggestion[] = resolvedChapterId
    ? validatedSuggestions.map((s) => ({ ...s, sourceChapterId: resolvedChapterId }))
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
  extractedGlossary: GlossarySuggestion[];
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

  const aiMeta = parseGeminiStructuredResponse<GuidelinesAnalysisResponse>(response.text, {
    validator: isGuidelinesAnalysisResponse,
    fallback: {},
    contextName: 'analyzeGuidelinesDirect',
  });

  return {
    extractedGlossary: parsedGlossary,
    genre: aiMeta.genre || '',
    tone: aiMeta.tone || '',
    description: aiMeta.description || '',
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
  glossary: GlossarySuggestion[];
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

    const parsed = parseGeminiStructuredResponse<any>(response.text, {
      validator: isExtractGlossaryResponse,
      fallback: [],
      contextName: 'extractGlossaryDirect',
    });

    const rawList = (Array.isArray(parsed) ? parsed : parsed?.suggestions || []) as any[];
    const parsedGlossary: GlossarySuggestion[] = rawList.map((item: any) => ({
      chinese: typeof item?.chinese === 'string' ? item.chinese : (typeof item?.term === 'string' ? item.term : ''),
      vietnamese: typeof item?.vietnamese === 'string' ? item.vietnamese : '',
      pinyin: typeof item?.pinyin === 'string' ? item.pinyin : '',
      type: (['character', 'location', 'term', 'phrase', 'other'].includes(item?.type) ? item.type : 'other') as GlossaryType,
      note: typeof item?.note === 'string' ? item.note : '',
      ...(item?.sourceChapterId ? { sourceChapterId: item.sourceChapterId } : {}),
      ...(typeof item?.needsReview === 'boolean' ? { needsReview: item.needsReview } : {}),
    }));
    let validatedGlossary = validateAndSnapBackEntities(parsedGlossary, text) as GlossarySuggestion[];
    const resolvedChapterId = sourceChapterId || chapterId;
    if (resolvedChapterId) {
      validatedGlossary = validatedGlossary.map((s) => ({ ...s, sourceChapterId: resolvedChapterId }));
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

  const parsed = parseGeminiStructuredResponse<AlignChapterResponse>(response.text, {
    validator: isAlignChapterResponse,
    fallback: { alignments: [] },
    contextName: 'alignChapterDirect',
  });
  const list = (Array.isArray(parsed?.alignments) ? parsed.alignments : []) as Array<{
    chinese?: string;
    vietnamese?: string;
  }>;
  const jsonlLines = buildAlignmentJsonlLines(list);

  return { jsonlLines, successKeyIndex: response.successKeyIndex };
}
