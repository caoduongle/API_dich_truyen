/**
 * Polish Translation Service (Phase 2)
 * Chuốt mịn văn phong, trau chuốt câu từ dựa trên ngữ cảnh bản dịch thô và nguyên tác
 */

import { callGeminiDirect } from '../directGeminiClient';
import { buildPolishTranslationPayload } from '../ai/prompts';
import {
  safeParseJson,
  ensureChapterTitlePreserved,
  validateTranslationOutput,
  validatePolishIntegrity,
  validateParagraphParity,
  estimateTokenCount,
  getPolishStrategyForRound,
} from '../../lib/text';
import { validateAndSnapBackEntities } from '../../lib/sinoNormalize';
import {
  DirectPolishTranslationParams,
  DirectPolishTranslationResult,
} from './types';
import { isAdaptiveSplitRetryableError } from './translationValidation';
import { splitBilingualAdaptively } from './bilingualSplit';
import { mapWithConcurrencyLimit } from '../../lib/concurrency';

/**
 * Gọi Gemini API đơn lẻ cho 1 khối văn bản chuốt văn
 */
export async function callPolishDirectCore(
  params: DirectPolishTranslationParams
): Promise<DirectPolishTranslationResult> {
  const {
    sourceText,
    rawTranslation,
    genre,
    tone,
    glossary,
    additionalInstructions,
    apiKeys,
    model,
    startKeyIndex = 0,
    description,
    isExtractionEnabled = true,
    signal,
    roundIndex = 1,
    totalRounds = 1,
    temperature,
  } = params;

  if (!rawTranslation || !rawTranslation.trim()) {
    throw new Error('Bản dịch thô không được để trống khi chuốt văn phong.');
  }

  const polishStrategy = getPolishStrategyForRound(roundIndex, totalRounds);
  const effectiveTemperature = typeof temperature === 'number'
    ? temperature
    : (roundIndex === 2 ? 0.5 : 0.3);

  const { systemInstruction, prompt, schema } = buildPolishTranslationPayload({
    sourceText,
    rawTranslation,
    genre,
    tone,
    glossary,
    description,
    additionalInstructions,
    isExtractionEnabled,
    roundIndex,
    totalRounds,
  });

  const response = await callGeminiDirect({
    apiKeys,
    model,
    prompt,
    systemInstruction,
    schema,
    temperature: effectiveTemperature,
    startKeyIndex,
    signal,
  });

  const parsed = safeParseJson(response.text);
  let finalPolishedTranslation = parsed?.polishedTranslation || '';

  if (!finalPolishedTranslation || finalPolishedTranslation.trim() === '') {
    const altKey = parsed?.translation || parsed?.text || parsed?.vietnamese || parsed?.output || parsed?.polished_translation;
    if (altKey && altKey.trim() !== '') {
      finalPolishedTranslation = altKey;
    } else if (response.text && response.text.trim().length > 30) {
      if (!response.text.includes('"polishedTranslation"') && !response.text.includes('"translation"')) {
        finalPolishedTranslation = response.text;
      }
    }
  }

  finalPolishedTranslation = ensureChapterTitlePreserved(rawTranslation, finalPolishedTranslation);
  validateTranslationOutput(finalPolishedTranslation);
  validatePolishIntegrity(rawTranslation, finalPolishedTranslation);
  validateParagraphParity(sourceText, finalPolishedTranslation);

  const discoveredEntities = isExtractionEnabled && Array.isArray(parsed?.discoveredEntities)
    ? validateAndSnapBackEntities(parsed.discoveredEntities, sourceText)
    : [];

  return {
    polishedTranslation: finalPolishedTranslation,
    discoveredEntities,
    successKeyIndex: response.successKeyIndex,
  };
}

/**
 * Chuốt văn phong phân đoạn thích ứng đệ quy (Divide & Conquer) khi gặp phản hồi rỗng, bộ lọc an toàn, cắt cụt hoặc lệch cấu trúc
 */
export async function polishWithContentSplitDirect(
  params: DirectPolishTranslationParams,
  depth = 0,
  isPreSplit = false
): Promise<DirectPolishTranslationResult> {
  const { sourceText, rawTranslation, apiKeys, startKeyIndex = 0 } = params;

  // Tiền phân đoạn (Pre-split) nếu văn bản dài (> 1500 token tiếng Trung hoặc > 1800 token tiếng Việt) ở lượt gọi đầu
  if (depth === 0 && !isPreSplit && (estimateTokenCount(sourceText) > 1500 || estimateTokenCount(rawTranslation) > 1800)) {
    const bilingualChunks = splitBilingualAdaptively(sourceText, rawTranslation, 2);

    if (bilingualChunks.length > 1) {
      const polishedChunks: string[] = [];
      let currentKeyIdx = startKeyIndex;
      const discoveredEntitiesAll: any[] = [];
      let anyPartial = false;

      for (let i = 0; i < bilingualChunks.length; i++) {
        const chunk = bilingualChunks[i];
        const staggeredKey = Array.isArray(apiKeys) && apiKeys.length > 0
          ? (currentKeyIdx + i) % apiKeys.length
          : currentKeyIdx;

        const res = await polishWithContentSplitDirect(
          {
            ...params,
            sourceText: chunk.sourceText,
            rawTranslation: chunk.rawText,
            startKeyIndex: staggeredKey,
          },
          0,
          true
        );

        polishedChunks.push(res.polishedTranslation);
        currentKeyIdx = res.successKeyIndex ?? staggeredKey;
        if (res.isPartial) anyPartial = true;
        if (Array.isArray(res.discoveredEntities)) {
          discoveredEntitiesAll.push(...res.discoveredEntities);
        }
      }

      const combined = polishedChunks.map((c) => c.trim()).filter(Boolean).join('\n\n').trim();
      const formatted = ensureChapterTitlePreserved(rawTranslation, combined);

      return {
        polishedTranslation: formatted,
        discoveredEntities: discoveredEntitiesAll,
        successKeyIndex: currentKeyIdx,
        isPartial: anyPartial,
      };
    }
  }

  try {
    return await callPolishDirectCore(params);
  } catch (error: any) {
    if (!isAdaptiveSplitRetryableError(error)) {
      throw error;
    }

    if (depth >= 4) {
      return {
        polishedTranslation: rawTranslation,
        discoveredEntities: [],
        successKeyIndex: startKeyIndex,
        isPartial: true,
      };
    }

    const partsCount = 2;
    const chunks = splitBilingualAdaptively(sourceText, rawTranslation, partsCount);

    if (chunks.length <= 1) {
      return {
        polishedTranslation: rawTranslation,
        discoveredEntities: [],
        successKeyIndex: startKeyIndex,
        isPartial: true,
      };
    }

    params.onSplitRetry?.({
      stage: 'polish',
      depth,
      partsCount: chunks.length,
      reason: error?.message || 'POLISH_TRUNCATION_DETECTED',
      tier: 'split',
    });

    const results = await mapWithConcurrencyLimit(
      chunks,
      2,
      async (chunk, index) => {
        const staggeredKeyIndex = Array.isArray(apiKeys) && apiKeys.length > 0
          ? (startKeyIndex + index) % apiKeys.length
          : startKeyIndex;
        try {
          return await polishWithContentSplitDirect(
            {
              ...params,
              sourceText: chunk.sourceText,
              rawTranslation: chunk.rawText,
              startKeyIndex: staggeredKeyIndex,
            },
            depth + 1,
            true
          );
        } catch (partErr: any) {
          if (isAdaptiveSplitRetryableError(partErr)) {
            return {
              polishedTranslation: chunk.rawText,
              discoveredEntities: [],
              successKeyIndex: staggeredKeyIndex,
              isPartial: true,
            };
          }
          throw partErr;
        }
      }
    );

    const hasPartial = results.some((r) => r.isPartial);
    const combinedPolished = results.map((r) => r.polishedTranslation.trim()).filter(Boolean).join('\n\n').trim();
    const combinedEntities = results.flatMap((r) => r.discoveredEntities || []);
    const lastSuccessKey = results.findLast((r) => !r.isPartial)?.successKeyIndex ?? results[results.length - 1].successKeyIndex;

    const formattedPolished = ensureChapterTitlePreserved(rawTranslation, combinedPolished);

    return {
      polishedTranslation: formattedPolished,
      discoveredEntities: combinedEntities,
      successKeyIndex: lastSuccessKey,
      isPartial: hasPartial,
    };
  }
}

/**
 * Thực thi chuốt văn phong Giai đoạn 2 trực tiếp từ trình duyệt
 */
export async function polishTranslationDirect(
  params: DirectPolishTranslationParams
): Promise<DirectPolishTranslationResult> {
  return polishWithContentSplitDirect(params, 0);
}
