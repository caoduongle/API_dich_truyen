/**
 * Raw Translation Service (Phase 1)
 * Dịch thô sơ khởi và trích xuất thực thể/nhân vật từ văn bản tiếng Trung sang tiếng Việt
 */

import { callGeminiDirect } from '../directGeminiClient';
import { buildRawTranslationPayload } from '../ai/prompts';
import {
  parseGeminiStructuredResponse,
  isRawTranslationResponse,
  RawTranslationResponse,
  separateChapterTitleAndBody,
  validateTranslationOutput,
  splitTextAdaptively,
  estimateTokenCount,
} from '../../lib/text';
import { validateAndSnapBackEntities } from '../../lib/sinoNormalize';
import { GlossaryItem } from '../../types';
import {
  DirectRawTranslationParams,
  DirectRawTranslationResult,
} from './types';
import { isAdaptiveSplitRetryableError } from './translationValidation';

/**
 * Tầng Cứu nguy: Thay thế các thuật ngữ và chữ Hán bằng bản dịch từ điển hoặc phiên âm Hán-Việt
 */
export function fallbackSinoVietnameseLine(
  line: string,
  glossary: GlossaryItem[] = []
): string {
  let result = line;
  if (Array.isArray(glossary) && glossary.length > 0) {
    const sorted = [...glossary].sort((a, b) => (b.chinese || '').length - (a.chinese || '').length);
    for (const g of sorted) {
      if (!g.chinese || !g.chinese.trim()) continue;
      const mainZh = g.chinese.trim();
      const vi = (g.vietnamese || g.pinyin || '').trim();
      if (vi) {
        result = result.replaceAll(mainZh, vi);
      }
      if (Array.isArray(g.variants)) {
        for (const v of g.variants) {
          if (v && v.trim()) {
            result = result.replaceAll(v.trim(), vi);
          }
        }
      }
    }
  }
  result = result.replace(/\[([^\]]+)\]/g, '$1');
  return result;
}

/**
 * Gọi Gemini API đơn lẻ cho 1 khối văn bản dịch thô
 */
export async function callRawDirectCore(
  params: DirectRawTranslationParams
): Promise<DirectRawTranslationResult> {
  const {
    text,
    genre,
    tone,
    glossary,
    apiKeys,
    model,
    startKeyIndex = 0,
    description,
    enableSegmentTranslation,
    signal,
    isRetry,
  } = params;

  if (!text || !text.trim()) {
    throw new Error('Văn bản cần dịch không được để trống.');
  }

  // Chế độ dịch theo từng câu/dòng độc lập
  if (enableSegmentTranslation) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const translatedParagraphs: string[] = [];
    let currentKeyIdx = startKeyIndex;
    const discoveredEntitiesAll: any[] = [];

    for (const line of lines) {
      if (!line) continue;
      const res = await translateRawDirect({
        ...params,
        text: line,
        enableSegmentTranslation: false,
        startKeyIndex: currentKeyIdx,
      });
      translatedParagraphs.push(res.rawTranslation);
      currentKeyIdx = res.successKeyIndex;
      if (Array.isArray(res.discoveredEntities)) {
        discoveredEntitiesAll.push(...res.discoveredEntities);
      }
    }

    return {
      rawTranslation: translatedParagraphs.join('\n\n'),
      discoveredEntities: discoveredEntitiesAll,
      successKeyIndex: currentKeyIdx,
    };
  }

  const { systemInstruction, prompt, schema } = buildRawTranslationPayload({
    text,
    genre,
    tone,
    description,
    glossary,
    isRetry,
  });

  const response = await callGeminiDirect({
    apiKeys,
    model,
    prompt,
    systemInstruction,
    schema,
    temperature: 0.3,
    startKeyIndex,
    signal,
  });

  const parsed = parseGeminiStructuredResponse<RawTranslationResponse>(response.text, {
    validator: isRawTranslationResponse,
    fallback: {},
    contextName: 'rawTranslation',
  });
  let finalRawTranslation = parsed.rawTranslation || '';

  if (!finalRawTranslation || finalRawTranslation.trim() === '') {
    const altKey = parsed?.translation || parsed?.text || parsed?.vietnamese || parsed?.output || parsed?.raw_translation;
    if (altKey && altKey.trim() !== '') {
      finalRawTranslation = altKey;
    } else if (response.text && response.text.trim().length > 30) {
      if (!response.text.includes('"rawTranslation"') && !response.text.includes('"translation"')) {
        finalRawTranslation = response.text;
      }
    }
  }

  let finalDiscoveredEntities = Array.isArray(parsed?.discoveredEntities) ? parsed.discoveredEntities : [];
  finalDiscoveredEntities = validateAndSnapBackEntities(finalDiscoveredEntities, text);

  finalRawTranslation = separateChapterTitleAndBody(finalRawTranslation);
  validateTranslationOutput(finalRawTranslation);

  return {
    rawTranslation: finalRawTranslation,
    discoveredEntities: finalDiscoveredEntities,
    successKeyIndex: response.successKeyIndex,
  };
}

/**
 * Dịch thô phân đoạn thích ứng đệ quy (Divide & Conquer) khi gặp phản hồi rỗng, bộ lọc an toàn hoặc sót chữ Hán
 */
export async function rawWithContentSplitDirect(
  params: DirectRawTranslationParams,
  retryDepth = 0,
  isPreSplit = false
): Promise<DirectRawTranslationResult> {
  const { text, apiKeys, startKeyIndex = 0, onSplitRetry } = params;

  if (retryDepth === 0 && !isPreSplit && estimateTokenCount(text) > 2000) {
    const chunks = splitTextAdaptively(text, 2);
    if (chunks.length > 1) {
      const translatedChunks: string[] = [];
      let currentKeyIdx = startKeyIndex;
      const discoveredEntitiesAll: any[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const staggeredKey = Array.isArray(apiKeys) && apiKeys.length > 0
          ? (currentKeyIdx + i) % apiKeys.length
          : currentKeyIdx;

        const res = await rawWithContentSplitDirect(
          {
            ...params,
            text: chunk,
            startKeyIndex: staggeredKey,
          },
          0,
          true
        );
        translatedChunks.push(res.rawTranslation);
        currentKeyIdx = res.successKeyIndex;
        if (Array.isArray(res.discoveredEntities)) {
          discoveredEntitiesAll.push(...res.discoveredEntities);
        }
      }

      return {
        rawTranslation: separateChapterTitleAndBody(translatedChunks.join('\n\n').trim()),
        discoveredEntities: discoveredEntitiesAll,
        successKeyIndex: currentKeyIdx,
      };
    }
  }

  try {
    return await callRawDirectCore(params);
  } catch (error: any) {
    if (!isAdaptiveSplitRetryableError(error)) {
      throw error;
    }

    if (retryDepth < 4) {
      const partsCount = 2;
      const chunks = splitTextAdaptively(text, partsCount);

      if (chunks.length > 1) {
        onSplitRetry?.({
          stage: 'raw',
          depth: retryDepth,
          partsCount: chunks.length,
          reason: error?.message || 'UNTRANSLATED_CHINESE_LEFTOVER',
          tier: 'split',
        });

        const translatedChunks: string[] = [];
        let currentKeyIdx = startKeyIndex;
        const discoveredEntitiesAll: any[] = [];

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const staggeredKeyIndex = Array.isArray(apiKeys) && apiKeys.length > 0
            ? (currentKeyIdx + i) % apiKeys.length
            : currentKeyIdx;

          const res = await rawWithContentSplitDirect(
            {
              ...params,
              text: chunk,
              startKeyIndex: staggeredKeyIndex,
              isRetry: true,
            },
            retryDepth + 1,
            true
          );

          translatedChunks.push(res.rawTranslation);
          currentKeyIdx = res.successKeyIndex;
          if (Array.isArray(res.discoveredEntities)) {
            discoveredEntitiesAll.push(...res.discoveredEntities);
          }
        }

        return {
          rawTranslation: separateChapterTitleAndBody(translatedChunks.join('\n\n').trim()),
          discoveredEntities: discoveredEntitiesAll,
          successKeyIndex: currentKeyIdx,
        };
      }
    }

    onSplitRetry?.({
      stage: 'raw',
      depth: retryDepth,
      partsCount: 1,
      reason: error?.message || 'SINO_FALLBACK_RESCUE',
      tier: 'sino-fallback',
    });

    const rescuedText = fallbackSinoVietnameseLine(text, params.glossary);
    return {
      rawTranslation: separateChapterTitleAndBody(rescuedText.trim()),
      discoveredEntities: [],
      successKeyIndex: startKeyIndex,
    };
  }
}

/**
 * Thực thi dịch thô Giai đoạn 1 trực tiếp từ trình duyệt
 */
export async function translateRawDirect(
  params: DirectRawTranslationParams
): Promise<DirectRawTranslationResult> {
  return rawWithContentSplitDirect(params, 0);
}
