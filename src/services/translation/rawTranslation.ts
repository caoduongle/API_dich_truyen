/**
 * Raw Translation Service (Phase 1)
 * Dịch thô sơ khởi và trích xuất thực thể/nhân vật từ văn bản tiếng Trung sang tiếng Việt
 */

import { callGeminiDirect } from '../directGeminiClient';
import { buildRawTranslationPayload } from '../ai/prompts';
import {
  parseGeminiStructuredResponseWithState,
  isRawTranslationResponse,
  RawTranslationResponse,
  separateChapterTitleAndBody,
  stripDuplicatedContinuityOverlap,
  validateTranslationOutput,
  splitTextAdaptively,
  estimateTokenCount,
  DiscoveredEntity,
  validateDiscoveredEntity,
  verifySourceCoverage,
} from '../../lib/text';
import { validateAndSnapBackEntities } from '../../lib/sinoNormalize';
import { substituteGlossaryTermsSafely } from '../../lib/glossaryMatch';
import { GlossaryItem } from '../../types';
import {
  DirectRawTranslationParams,
  DirectRawTranslationResult,
} from './types';
import {
  classifyTranslationOutcome,
} from './translationValidation';
import {
  normalizeTranslatedPunctuation,
  realignParagraphStructure,
  validateStrictStructureParity,
} from './structureParity';
import { mapWithConcurrencyLimit } from '../../lib/concurrency';
import {
  createEmptyTelemetry,
  mergeBranchTelemetry,
  recordSplitEvent,
} from './telemetry';

function buildContinuityTail(text: string | undefined, maxChars: number): string {
  if (!text || !text.trim()) return '';
  const tail = text
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(-2)
    .join('\n\n');
  return tail.length > maxChars ? tail.slice(-maxChars) : tail;
}

/**
 * Tầng Cứu nguy: Thay thế các thuật ngữ và chữ Hán bằng bản dịch từ điển hoặc phiên âm Hán-Việt
 */
export function fallbackSinoVietnameseLine(
  line: string,
  glossary: GlossaryItem[] = []
): string {
  const unbracketed = (line || '').replace(/\[([^\]]+)\]/g, '$1');
  if (!Array.isArray(glossary) || glossary.length === 0) {
    return unbracketed;
  }

  const normalizedGlossary = glossary.map((g) => ({
    ...g,
    vietnamese: (g.vietnamese || g.pinyin || '').trim(),
  }));

  const { substitutedText } = substituteGlossaryTermsSafely(unbracketed, normalizedGlossary, {
    minHanLength: 2,
  });

  return substitutedText.replace(/\[([^\]]+)\]/g, '$1');
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
    const discoveredEntitiesAll: DiscoveredEntity[] = [];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      if (!line) continue;
      const lineContinuity =
        lineIdx > 0
          ? {
              previousSourceTail: buildContinuityTail(lines[lineIdx - 1], 350),
              previousTranslationTail: buildContinuityTail(
                translatedParagraphs[translatedParagraphs.length - 1],
                500
              ),
              sourceKind: 'previous-chunk' as const,
            }
          : params.continuity;

      const res = await translateRawDirect({
        ...params,
        text: line,
        enableSegmentTranslation: false,
        startKeyIndex: currentKeyIdx,
        ...(lineContinuity ? { continuity: lineContinuity } : {}),
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
    ...(params.continuity ? { continuity: params.continuity } : {}),
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

  const parseResult = parseGeminiStructuredResponseWithState<RawTranslationResponse>(response.text, {
    validator: isRawTranslationResponse,
    contextName: 'rawTranslation',
  });

  if (parseResult.state === 'SCHEMA_INVALID') {
    throw new Error('Dữ liệu JSON từ AI trong ngữ cảnh [rawTranslation] không thỏa mãn cấu trúc yêu cầu.');
  }

  let finalRawTranslation = '';
  let finalDiscoveredEntitiesRaw: unknown[] = [];

  if (parseResult.state === 'VALID' && parseResult.data) {
    const parsed = parseResult.data;
    finalRawTranslation = parsed.rawTranslation || '';

    if (!finalRawTranslation || finalRawTranslation.trim() === '') {
      const altKey = parsed.translation || parsed.text || parsed.vietnamese || parsed.output || parsed.raw_translation;
      if (altKey && altKey.trim() !== '') {
        finalRawTranslation = altKey;
      }
    }

    if (Array.isArray(parsed.discoveredEntities)) {
      finalDiscoveredEntitiesRaw = parsed.discoveredEntities;
    }
  } else if (parseResult.state === 'PARSE_FAILED') {
    // Chỉ khi phản hồi KHÔNG phải là JSON (văn bản thuần prose từ model không hỗ trợ JSON schema)
    // thì mới cứu nguy bằng response.text nếu thỏa mãn điều kiện độ dài và không chứa syntax JSON
    const trimmedText = (response.text || '').trim();
    if (
      trimmedText.length > 30 &&
      !trimmedText.startsWith('{') &&
      !trimmedText.startsWith('[') &&
      !trimmedText.includes('"rawTranslation"') &&
      !trimmedText.includes('"translation"')
    ) {
      finalRawTranslation = response.text;
    } else {
      throw new Error('Không thể phân tích dữ liệu JSON trả về từ AI trong ngữ cảnh [rawTranslation].');
    }
  }

  let finalDiscoveredEntities = validateAndSnapBackEntities(finalDiscoveredEntitiesRaw, text);
  const normalizedEntities: DiscoveredEntity[] = finalDiscoveredEntities
    .map((ent) => validateDiscoveredEntity(ent))
    .filter((ent): ent is DiscoveredEntity => ent !== null);

  finalRawTranslation = separateChapterTitleAndBody(finalRawTranslation);
  finalRawTranslation = stripDuplicatedContinuityOverlap(
    finalRawTranslation,
    params.continuity?.previousTranslationTail
  );
  finalRawTranslation = normalizeTranslatedPunctuation(finalRawTranslation);
  finalRawTranslation = realignParagraphStructure(text, finalRawTranslation);
  validateTranslationOutput(finalRawTranslation);
  if (!isRetry) {
    validateStrictStructureParity(text, finalRawTranslation);
  }

  return {
    rawTranslation: finalRawTranslation,
    discoveredEntities: normalizedEntities,
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

  if (params.signal?.aborted) {
    const abortErr = new Error('Quá trình dịch đã bị hủy bởi người dùng.');
    abortErr.name = 'AbortError';
    throw abortErr;
  }

  const callStartTime = Date.now();

  if (retryDepth === 0 && !isPreSplit && estimateTokenCount(text) > 2000) {
    const chunks = splitTextAdaptively(text, 2);
    if (chunks.length > 1) {
      verifySourceCoverage(text, chunks);

      const results = await mapWithConcurrencyLimit(
        chunks,
        params.concurrencyLimit || 2,
        async (chunk, i) => {
          if (params.signal?.aborted) {
            const abortErr = new Error('Quá trình dịch đã bị hủy bởi người dùng.');
            abortErr.name = 'AbortError';
            throw abortErr;
          }

          const elapsed = Date.now() - callStartTime;
          const remainingDeadlineMs = typeof params.cumulativeTimeoutMs === 'number'
            ? Math.max(0, params.cumulativeTimeoutMs - elapsed)
            : undefined;

          const staggeredKey = Array.isArray(apiKeys) && apiKeys.length > 0
            ? (startKeyIndex + i) % apiKeys.length
            : startKeyIndex;

          const chunkContinuity =
            i > 0
              ? {
                  previousSourceTail: buildContinuityTail(chunks[i - 1], 350),
                  sourceKind: 'previous-chunk' as const,
                }
              : params.continuity;

          return await rawWithContentSplitDirect(
            {
              ...params,
              text: chunk,
              startKeyIndex: staggeredKey,
              cumulativeTimeoutMs: remainingDeadlineMs,
              ...(chunkContinuity ? { continuity: chunkContinuity } : {}),
            },
            0,
            true
          );
        }
      );

      const translatedChunks = results.map((r) => r.rawTranslation);
      const discoveredEntitiesAll = results.flatMap((r) => r.discoveredEntities || []);
      const anyPartial = results.some((r) => r.isPartial);
      const lastSuccessKey = results.findLast((r) => !r.isPartial)?.successKeyIndex ?? results[results.length - 1].successKeyIndex;

      let accumulatedTelemetry = createEmptyTelemetry();
      for (const res of results) {
        accumulatedTelemetry = mergeBranchTelemetry(accumulatedTelemetry, res.telemetry);
      }
      accumulatedTelemetry.executionDurationMs = Date.now() - callStartTime;

      return {
        rawTranslation: separateChapterTitleAndBody(translatedChunks.join('\n\n').trim()),
        discoveredEntities: discoveredEntitiesAll,
        successKeyIndex: lastSuccessKey,
        isPartial: anyPartial,
        telemetry: accumulatedTelemetry,
      };
    }
  }

  try {
    const coreResult = await callRawDirectCore(params);
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

    if (retryDepth < effectiveMaxDepth) {
      const partsCount = 2;
      const chunks = splitTextAdaptively(text, partsCount);
      verifySourceCoverage(text, chunks);

      if (chunks.length > 1) {
        onSplitRetry?.({
          stage: 'raw',
          depth: retryDepth,
          partsCount: chunks.length,
          reason: outcome.isContentBlocked ? 'CONTENT_BLOCKED' : (error?.message || 'UNTRANSLATED_CHINESE_LEFTOVER'),
          tier: 'split',
        });

        const results = await mapWithConcurrencyLimit(
          chunks,
          params.concurrencyLimit || 2,
          async (chunk, i) => {
            if (params.signal?.aborted) {
              const abortErr = new Error('Quá trình dịch đã bị hủy bởi người dùng.');
              abortErr.name = 'AbortError';
              throw abortErr;
            }

            const elapsed = Date.now() - callStartTime;
            const remainingDeadlineMs = typeof params.cumulativeTimeoutMs === 'number'
              ? Math.max(0, params.cumulativeTimeoutMs - elapsed)
              : undefined;

            if (typeof remainingDeadlineMs === 'number' && remainingDeadlineMs <= 100) {
              const rescuedText = fallbackSinoVietnameseLine(chunk, params.glossary);
              const timeoutTel = recordSplitEvent(createEmptyTelemetry(), {
                isFallback: true,
                failedKey: `raw-timeout-${retryDepth}`,
              });
              timeoutTel.executionDurationMs = Date.now() - callStartTime;
              return {
                rawTranslation: separateChapterTitleAndBody(rescuedText.trim()),
                discoveredEntities: [],
                successKeyIndex: startKeyIndex,
                isPartial: true,
                telemetry: timeoutTel,
              };
            }

            // Đối với lỗi CONTENT_BLOCKED (tất định do nội dung), TUYỆT ĐỐI không xoay vòng key
            const staggeredKeyIndex = outcome.isContentBlocked
              ? startKeyIndex
              : (Array.isArray(apiKeys) && apiKeys.length > 0
                  ? (startKeyIndex + i) % apiKeys.length
                  : startKeyIndex);

            return await rawWithContentSplitDirect(
              {
                ...params,
                text: chunk,
                startKeyIndex: staggeredKeyIndex,
                isRetry: true,
                cumulativeTimeoutMs: remainingDeadlineMs,
                // Không truyền ngữ cảnh nhánh trước khi chia nhỏ để cô lập lỗi (như CONTENT_BLOCKED)
                continuity: undefined,
              },
              retryDepth + 1,
              true
            );
          }
        );

        const translatedChunks = results.map((r) => r.rawTranslation);
        const discoveredEntitiesAll = results.flatMap((r) => r.discoveredEntities || []);
        const anyPartial = results.some((r) => r.isPartial);
        const lastSuccessKey = results.findLast((r) => !r.isPartial)?.successKeyIndex ?? results[results.length - 1].successKeyIndex;

        let accumulatedTelemetry = createEmptyTelemetry();
        accumulatedTelemetry = recordSplitEvent(accumulatedTelemetry, {
          failedKey: `depth-${retryDepth}`,
        });
        for (const res of results) {
          accumulatedTelemetry = mergeBranchTelemetry(accumulatedTelemetry, res.telemetry);
        }
        accumulatedTelemetry.executionDurationMs = Date.now() - callStartTime;

        return {
          rawTranslation: separateChapterTitleAndBody(translatedChunks.join('\n\n').trim()),
          discoveredEntities: discoveredEntitiesAll,
          successKeyIndex: lastSuccessKey,
          isPartial: anyPartial,
          telemetry: accumulatedTelemetry,
        };
      }
    }

    onSplitRetry?.({
      stage: 'raw',
      depth: retryDepth,
      partsCount: 1,
      reason: outcome.isContentBlocked ? 'CONTENT_BLOCKED_FALLBACK_RESCUE' : (error?.message || 'SINO_FALLBACK_RESCUE'),
      tier: 'sino-fallback',
    });

    const rescuedText = fallbackSinoVietnameseLine(text, params.glossary);
    const terminalTelemetry = recordSplitEvent(createEmptyTelemetry(), {
      isFallback: true,
      failedKey: `terminal-${retryDepth}`,
    });
    terminalTelemetry.executionDurationMs = Date.now() - callStartTime;

    return {
      rawTranslation: separateChapterTitleAndBody(rescuedText.trim()),
      discoveredEntities: [],
      successKeyIndex: startKeyIndex,
      isPartial: true,
      telemetry: terminalTelemetry,
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
