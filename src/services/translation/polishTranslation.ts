/**
 * Polish Translation Service (Phase 2)
 * Chuốt mịn văn phong, trau chuốt câu từ dựa trên ngữ cảnh bản dịch thô và nguyên tác
 */

import { callGeminiDirect } from '../directGeminiClient';
import { buildPolishTranslationPayload } from '../ai/prompts';
import {
  parseGeminiStructuredResponseWithState,
  isPolishTranslationResponse,
  PolishTranslationResponse,
  ensureChapterTitlePreserved,
  validateTranslationOutput,
  validatePolishIntegrity,
  validateParagraphParity,
  estimateTokenCount,
  DiscoveredEntity,
  validateDiscoveredEntity,
  verifySourceCoverage,
} from '../../lib/text';
import { validateAndSnapBackEntities } from '../../lib/sinoNormalize';
import {
  DirectPolishTranslationParams,
  DirectPolishTranslationResult,
} from './types';
import {
  classifyTranslationOutcome,
} from './translationValidation';
import { splitBilingualAdaptively } from './bilingualSplit';
import { mapWithConcurrencyLimit } from '../../lib/concurrency';
import {
  createEmptyTelemetry,
  mergeBranchTelemetry,
  recordSplitEvent,
} from './telemetry';

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

  const parseResult = parseGeminiStructuredResponseWithState<PolishTranslationResponse>(response.text, {
    validator: isPolishTranslationResponse,
    contextName: 'polishTranslation',
  });

  if (parseResult.state === 'SCHEMA_INVALID') {
    throw new Error('Dữ liệu JSON từ AI trong ngữ cảnh [polishTranslation] không thỏa mãn cấu trúc yêu cầu.');
  }

  let finalPolishedTranslation = '';
  let discoveredEntitiesRaw: unknown[] = [];

  if (parseResult.state === 'VALID' && parseResult.data) {
    const parsed = parseResult.data;
    finalPolishedTranslation = parsed.polishedTranslation || '';

    if (!finalPolishedTranslation || finalPolishedTranslation.trim() === '') {
      const altKey = parsed.translation || parsed.text || parsed.vietnamese || parsed.output || parsed.polished_translation;
      if (altKey && altKey.trim() !== '') {
        finalPolishedTranslation = altKey;
      }
    }

    if (isExtractionEnabled && Array.isArray(parsed.discoveredEntities)) {
      discoveredEntitiesRaw = parsed.discoveredEntities;
    }
  } else if (parseResult.state === 'PARSE_FAILED') {
    const trimmedText = (response.text || '').trim();
    if (
      trimmedText.length > 30 &&
      !trimmedText.startsWith('{') &&
      !trimmedText.startsWith('[') &&
      !trimmedText.includes('"polishedTranslation"') &&
      !trimmedText.includes('"translation"')
    ) {
      finalPolishedTranslation = response.text;
    } else {
      throw new Error('Không thể phân tích dữ liệu JSON trả về từ AI trong ngữ cảnh [polishTranslation].');
    }
  }

  finalPolishedTranslation = ensureChapterTitlePreserved(rawTranslation, finalPolishedTranslation);
  validateTranslationOutput(finalPolishedTranslation);
  validatePolishIntegrity(rawTranslation, finalPolishedTranslation);
  validateParagraphParity(sourceText, finalPolishedTranslation);

  const discoveredEntities = isExtractionEnabled && Array.isArray(discoveredEntitiesRaw)
    ? validateAndSnapBackEntities(discoveredEntitiesRaw, sourceText)
        .map((ent) => validateDiscoveredEntity(ent))
        .filter((ent): ent is DiscoveredEntity => ent !== null)
    : [];

  return {
    polishedTranslation: finalPolishedTranslation,
    discoveredEntities,
    successKeyIndex: response.successKeyIndex,
    isPartial: false,
    telemetry: createEmptyTelemetry(),
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

  if (params.signal?.aborted) {
    const abortErr = new Error('Quá trình chuốt văn đã bị hủy bởi người dùng.');
    abortErr.name = 'AbortError';
    throw abortErr;
  }

  const callStartTime = Date.now();

  // Tiền phân đoạn (Pre-split) nếu văn bản dài (> 1500 token tiếng Trung hoặc > 1800 token tiếng Việt) ở lượt gọi đầu
  if (depth === 0 && !isPreSplit && (estimateTokenCount(sourceText) > 1500 || estimateTokenCount(rawTranslation) > 1800)) {
    const bilingualChunks = splitBilingualAdaptively(sourceText, rawTranslation, 2);

    if (bilingualChunks.length > 1) {
      const polishedChunks: string[] = [];
      let currentKeyIdx = startKeyIndex;
      const discoveredEntitiesAll: DiscoveredEntity[] = [];
      let anyPartial = false;
      let preSplitTelemetry = createEmptyTelemetry();

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
        preSplitTelemetry = mergeBranchTelemetry(preSplitTelemetry, res.telemetry);
      }

      const combined = polishedChunks.map((c) => c.trim()).filter(Boolean).join('\n\n').trim();
      const formatted = ensureChapterTitlePreserved(rawTranslation, combined);
      preSplitTelemetry.executionDurationMs = Date.now() - callStartTime;

      return {
        polishedTranslation: formatted,
        discoveredEntities: discoveredEntitiesAll,
        successKeyIndex: currentKeyIdx,
        isPartial: anyPartial,
        telemetry: preSplitTelemetry,
      };
    }
  }

  try {
    const coreResult = await callPolishDirectCore(params);
    return {
      ...coreResult,
      isPartial: false,
      telemetry: {
        ...createEmptyTelemetry(),
        executionDurationMs: Date.now() - callStartTime,
      },
    };
  } catch (error: any) {
    const outcome = classifyTranslationOutcome(error);
    if (!outcome.canSplitRetry) {
      throw error;
    }

    const effectiveMaxDepth = Math.min(4, Math.max(1, params.maxDepth ?? 3));

    if (depth >= effectiveMaxDepth) {
      const terminalTelemetry = recordSplitEvent(createEmptyTelemetry(), {
        isFallback: true,
        failedKey: `polish-terminal-${depth}`,
      });
      terminalTelemetry.executionDurationMs = Date.now() - callStartTime;

      return {
        polishedTranslation: rawTranslation,
        discoveredEntities: [],
        successKeyIndex: startKeyIndex,
        isPartial: true,
        telemetry: terminalTelemetry,
      };
    }

    const partsCount = 2;
    const chunks = splitBilingualAdaptively(sourceText, rawTranslation, partsCount);
    verifySourceCoverage(sourceText, chunks.map(c => c.sourceText));

    if (chunks.length <= 1) {
      const fallbackTel = recordSplitEvent(createEmptyTelemetry(), {
        isFallback: true,
        failedKey: `polish-nosplit-${depth}`,
      });
      fallbackTel.executionDurationMs = Date.now() - callStartTime;

      return {
        polishedTranslation: rawTranslation,
        discoveredEntities: [],
        successKeyIndex: startKeyIndex,
        isPartial: true,
        telemetry: fallbackTel,
      };
    }

    params.onSplitRetry?.({
      stage: 'polish',
      depth,
      partsCount: chunks.length,
      reason: outcome.isContentBlocked ? 'CONTENT_BLOCKED' : (error?.message || 'POLISH_TRUNCATION_DETECTED'),
      tier: 'split',
    });

    const results = await mapWithConcurrencyLimit(
      chunks,
      params.concurrencyLimit || 2,
      async (chunk, index) => {
        if (params.signal?.aborted) {
          const abortErr = new Error('Quá trình chuốt văn đã bị hủy bởi người dùng.');
          abortErr.name = 'AbortError';
          throw abortErr;
        }

        const elapsed = Date.now() - callStartTime;
        const remainingDeadlineMs = typeof params.cumulativeTimeoutMs === 'number'
          ? Math.max(0, params.cumulativeTimeoutMs - elapsed)
          : undefined;

        const staggeredKeyIndex = outcome.isContentBlocked
          ? startKeyIndex
          : (Array.isArray(apiKeys) && apiKeys.length > 0
              ? (startKeyIndex + index) % apiKeys.length
              : startKeyIndex);

        if (typeof remainingDeadlineMs === 'number' && remainingDeadlineMs <= 100) {
          const timeoutTel = recordSplitEvent(createEmptyTelemetry(), {
            isFallback: true,
            failedKey: `polish-timeout-${depth}`,
          });
          timeoutTel.executionDurationMs = Date.now() - callStartTime;
          return {
            polishedTranslation: chunk.rawText,
            discoveredEntities: [],
            successKeyIndex: staggeredKeyIndex,
            isPartial: true,
            telemetry: timeoutTel,
          };
        }

        try {
          return await polishWithContentSplitDirect(
            {
              ...params,
              sourceText: chunk.sourceText,
              rawTranslation: chunk.rawText,
              startKeyIndex: staggeredKeyIndex,
              cumulativeTimeoutMs: remainingDeadlineMs,
            },
            depth + 1,
            true
          );
        } catch (partErr: any) {
          const partOutcome = classifyTranslationOutcome(partErr);
          if (partOutcome.canSplitRetry || partOutcome.isContentBlocked) {
            const errFallbackTel = recordSplitEvent(createEmptyTelemetry(), {
              isFallback: true,
              failedKey: `polish-chunk-err-${depth}`,
            });
            errFallbackTel.executionDurationMs = Date.now() - callStartTime;
            return {
              polishedTranslation: chunk.rawText,
              discoveredEntities: [],
              successKeyIndex: staggeredKeyIndex,
              isPartial: true,
              telemetry: errFallbackTel,
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

    let accumulatedTelemetry = createEmptyTelemetry();
    accumulatedTelemetry = recordSplitEvent(accumulatedTelemetry, {
      failedKey: `polish-depth-${depth}`,
    });
    for (const res of results) {
      accumulatedTelemetry = mergeBranchTelemetry(accumulatedTelemetry, res.telemetry);
    }
    accumulatedTelemetry.executionDurationMs = Date.now() - callStartTime;

    return {
      polishedTranslation: formattedPolished,
      discoveredEntities: combinedEntities,
      successKeyIndex: lastSuccessKey,
      isPartial: hasPartial,
      telemetry: accumulatedTelemetry,
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
