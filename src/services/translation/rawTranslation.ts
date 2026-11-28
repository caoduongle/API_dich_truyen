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
  calculateChineseCharRatio,
  countChineseCharacters,
  countParagraphs,
  splitTextAdaptively,
  estimateTokenCount,
  DiscoveredEntity,
  validateDiscoveredEntity,
  verifySourceCoverage,
  isChapterTitleLine,
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
  isNonSplittableInfrastructureError,
} from './translationValidation';
import {
  normalizeTranslatedPunctuation,
  realignParagraphStructure,
  splitParagraphsPreservingOrder,
  validateStrictStructureParity,
} from './structureParity';
import {
  encodeAnchoredParagraphs,
  parseAnchoredParagraphs,
  stripParagraphAnchors,
} from './paragraphAnchor';
import { mapWithConcurrencyLimit } from '../../lib/concurrency';
import {
  createEmptyTelemetry,
  mergeBranchTelemetry,
  recordSplitEvent,
} from './telemetry';

const LEFTOVER_HAN_SEQ_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]{2,}/;

class SurgicalRawRecoveryError extends Error {
  readonly kind: 'missing_anchor' | 'leftover_han';
  readonly sourceParagraphs: string[];
  readonly slotsByIndex: Record<number, string>;
  readonly repairIndices: number[];
  readonly discoveredEntities: DiscoveredEntity[];
  readonly successKeyIndex: number;

  constructor(
    message: string,
    payload: {
      kind: 'missing_anchor' | 'leftover_han';
      sourceParagraphs: string[];
      slotsByIndex: Record<number, string>;
      repairIndices: number[];
      discoveredEntities: DiscoveredEntity[];
      successKeyIndex: number;
    }
  ) {
    super(message);
    this.name = 'SurgicalRawRecoveryError';
    this.kind = payload.kind;
    this.sourceParagraphs = payload.sourceParagraphs;
    this.slotsByIndex = payload.slotsByIndex;
    this.repairIndices = payload.repairIndices;
    this.discoveredEntities = payload.discoveredEntities;
    this.successKeyIndex = payload.successKeyIndex;
  }
}

function sliceRawSourceChunks(
  fullText: string,
  fullRawSource: string | undefined,
  chunks: string[]
): Array<string | undefined> {
  if (!fullRawSource) return chunks.map(() => undefined);
  const processedParas = splitParagraphsPreservingOrder(fullText);
  const rawParas = splitParagraphsPreservingOrder(fullRawSource);
  if (processedParas.length === 0 || processedParas.length !== rawParas.length) {
    return chunks.map(() => undefined);
  }
  let cursor = 0;
  return chunks.map((chunk) => {
    const count = splitParagraphsPreservingOrder(chunk).length;
    const sliced = rawParas.slice(cursor, cursor + count);
    cursor += count;
    return count > 0 && sliced.length === count ? sliced.join('\n\n') : undefined;
  });
}

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

  const sourceEncoding = encodeAnchoredParagraphs(text);
  const shouldUseAnchors = params.useParagraphAnchors !== false && sourceEncoding.expectedCount >= 2;

  const { systemInstruction, prompt, schema } = buildRawTranslationPayload({
    text,
    rawSourceText: params.rawSourceText,
    genre,
    tone,
    description,
    glossary,
    isRetry,
    useParagraphAnchors: shouldUseAnchors,
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
    enableProactivePacing: true,
    autoWaitForCooldown: true,
    ...(params.onWaitStatus ? { onWaitStatus: params.onWaitStatus } : {}),
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

  let finalDiscoveredEntities = validateAndSnapBackEntities(finalDiscoveredEntitiesRaw, params.rawSourceText || text);
  const normalizedEntities: DiscoveredEntity[] = finalDiscoveredEntities
    .map((ent) => validateDiscoveredEntity(ent))
    .filter((ent): ent is DiscoveredEntity => ent !== null);

  // Giải mã & gỡ sạch nhãn neo <<Pk>> trước khi tách tiêu đề chương và chuẩn hóa dấu câu
  const anchorParsed = parseAnchoredParagraphs(finalRawTranslation, sourceEncoding.expectedCount);
  if (anchorParsed.usedAnchors) {
    if (
      anchorParsed.missingIndices.length >= 1 &&
      anchorParsed.missingIndices.length <= 3 &&
      !isRetry &&
      shouldUseAnchors
    ) {
      throw new SurgicalRawRecoveryError(
        `PARAGRAPH_STRUCTURE_DIVERGENCE: Thiếu ${anchorParsed.missingIndices.length} đoạn neo trong phản hồi dịch thô.`,
        {
          kind: 'missing_anchor',
          sourceParagraphs: sourceEncoding.sourceParagraphs,
          slotsByIndex: anchorParsed.paragraphsByIndex,
          repairIndices: anchorParsed.missingIndices,
          discoveredEntities: normalizedEntities,
          successKeyIndex: response.successKeyIndex,
        }
      );
    }
    if (anchorParsed.missingIndices.length === 0 && anchorParsed.paragraphs.length > 0) {
      finalRawTranslation = anchorParsed.paragraphs.join('\n\n');
    } else {
      finalRawTranslation = stripParagraphAnchors(finalRawTranslation);
    }
  } else {
    finalRawTranslation = stripParagraphAnchors(finalRawTranslation);
  }

  finalRawTranslation = separateChapterTitleAndBody(finalRawTranslation);
  finalRawTranslation = stripDuplicatedContinuityOverlap(
    finalRawTranslation,
    params.continuity?.previousTranslationTail
  );
  finalRawTranslation = normalizeTranslatedPunctuation(finalRawTranslation);
  finalRawTranslation = realignParagraphStructure(text, finalRawTranslation);

  try {
    validateTranslationOutput(finalRawTranslation);
  } catch (valErr: any) {
    const errMsg = valErr?.message || '';
    if (!isRetry && errMsg.includes('UNTRANSLATED_CHINESE_LEFTOVER') && sourceEncoding.expectedCount >= 4) {
      const draftParas = splitParagraphsPreservingOrder(finalRawTranslation);
      if (draftParas.length === sourceEncoding.expectedCount) {
        const defectiveIndices: number[] = [];
        for (let idx = 0; idx < draftParas.length; idx++) {
          const para = draftParas[idx];
          const ratio = calculateChineseCharRatio(para);
          if (
            (para.length >= 20 && ratio > 0.1) ||
            (para.length >= 10 && ratio > 0.3) ||
            LEFTOVER_HAN_SEQ_RE.test(para)
          ) {
            defectiveIndices.push(idx);
          }
        }
        if (
          defectiveIndices.length >= 1 &&
          defectiveIndices.length <= 4 &&
          defectiveIndices.length / draftParas.length <= 0.4 &&
          (draftParas.length >= 6 || anchorParsed.usedAnchors)
        ) {
          const slotsByIndex: Record<number, string> = {};
          draftParas.forEach((p, idx) => {
            slotsByIndex[idx] = p;
          });
          throw new SurgicalRawRecoveryError(errMsg, {
            kind: 'leftover_han',
            sourceParagraphs: sourceEncoding.sourceParagraphs,
            slotsByIndex,
            repairIndices: defectiveIndices,
            discoveredEntities: normalizedEntities,
            successKeyIndex: response.successKeyIndex,
          });
        }
      }
    }
    throw valErr;
  }

  if (!isRetry || anchorParsed.usedAnchors) {
    try {
      validateStrictStructureParity(text, finalRawTranslation);
    } catch (parityErr: any) {
      const msg = parityErr?.message || '';
      if (msg.includes('PARAGRAPH_STRUCTURE_DIVERGENCE')) {
        const srcParas = splitParagraphsPreservingOrder(text);
        const tgtParas = splitParagraphsPreservingOrder(finalRawTranslation);
        const srcCount = countParagraphs(text);
        const tgtCount = countParagraphs(finalRawTranslation);
        const delta = Math.abs(srcCount - tgtCount);
        const minHealthyLength = Math.max(200, Math.round(text.trim().length * 0.8));
        const hasTitlePreserved =
          !isChapterTitleLine(srcParas[0] || '') ||
          (tgtParas.length > 0 && isChapterTitleLine(tgtParas[0]));
        const maxAllowedDelta =
          srcCount >= 15
            ? Math.min(3, Math.floor(srcCount * 0.08))
            : srcCount >= 12
              ? 2
              : srcCount >= 8
                ? 1
                : 0;
        const canTolerateMinorVariance =
          maxAllowedDelta > 0 &&
          delta <= maxAllowedDelta &&
          hasTitlePreserved &&
          finalRawTranslation.trim().length >= minHealthyLength &&
          countChineseCharacters(finalRawTranslation) === 0;
        if (!canTolerateMinorVariance) {
          throw parityErr;
        }
      } else {
        throw parityErr;
      }
    }
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
  let accumulatedWaitMs = 0;
  const wrappedOnWaitStatus: DirectRawTranslationParams['onWaitStatus'] = (info) => {
    if (typeof info.waitMs === 'number' && info.waitMs > 0) {
      accumulatedWaitMs += info.waitMs;
    }
    params.onWaitStatus?.(info);
  };
  const paramsWithWaitTracking: DirectRawTranslationParams = {
    ...params,
    onWaitStatus: wrappedOnWaitStatus,
  };
  const getActiveElapsedMs = () => Math.max(0, Date.now() - callStartTime - accumulatedWaitMs);

  if (retryDepth === 0 && !isPreSplit && estimateTokenCount(text) > 2000) {
    const chunks = splitTextAdaptively(text, 2);
    if (chunks.length > 1) {
      verifySourceCoverage(text, chunks);
      const rawChunkSlices = sliceRawSourceChunks(text, params.rawSourceText, chunks);

      const results = await mapWithConcurrencyLimit(
        chunks,
        params.concurrencyLimit || 2,
        async (chunk, i) => {
          if (params.signal?.aborted) {
            const abortErr = new Error('Quá trình dịch đã bị hủy bởi người dùng.');
            abortErr.name = 'AbortError';
            throw abortErr;
          }

          const elapsed = getActiveElapsedMs();
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
              ...paramsWithWaitTracking,
              text: chunk,
              rawSourceText: rawChunkSlices[i],
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
    const coreResult = await callRawDirectCore(paramsWithWaitTracking);
    return {
      ...coreResult,
      isPartial: false,
      telemetry: {
        ...createEmptyTelemetry(),
        executionDurationMs: Date.now() - callStartTime,
      },
    };
  } catch (error: any) {
    // Sửa phẫu thuật cục bộ ở retryDepth === 0 nếu chỉ thiếu 1–3 đoạn neo hoặc sót chữ Hán ở 1–4 đoạn đơn lẻ
    if (retryDepth === 0 && error instanceof SurgicalRawRecoveryError && !params.signal?.aborted) {
      const remainingAtStart = typeof params.cumulativeTimeoutMs === 'number'
        ? params.cumulativeTimeoutMs - getActiveElapsedMs()
        : undefined;
      if (remainingAtStart === undefined || remainingAtStart > 200) {
        try {
          const repairedSlots: Record<number, string> = { ...error.slotsByIndex };
          const rawSrcParagraphs = params.rawSourceText
            ? splitParagraphsPreservingOrder(params.rawSourceText)
            : [];
          const surgicalEntities = [...error.discoveredEntities];
          let lastKey = error.successKeyIndex;
          let allRepairedCleanly = true;

          for (const idx of error.repairIndices) {
            if (params.signal?.aborted) {
              const abortErr = new Error('Quá trình dịch đã bị hủy bởi người dùng.');
              abortErr.name = 'AbortError';
              throw abortErr;
            }
            const remMs = typeof params.cumulativeTimeoutMs === 'number'
              ? params.cumulativeTimeoutMs - getActiveElapsedMs()
              : undefined;
            if (typeof remMs === 'number' && remMs <= 100) {
              allRepairedCleanly = false;
              break;
            }
            const targetSrcPara = error.sourceParagraphs[idx] || '';
            const matchingRawPara =
              rawSrcParagraphs.length === error.sourceParagraphs.length
                ? rawSrcParagraphs[idx]
                : undefined;

            const subRes = await callRawDirectCore({
              ...paramsWithWaitTracking,
              text: targetSrcPara,
              ...(matchingRawPara ? { rawSourceText: matchingRawPara } : {}),
              startKeyIndex: lastKey,
              isRetry: true,
              useParagraphAnchors: false,
              continuity: undefined,
            });
            const repairedText = stripParagraphAnchors(subRes.rawTranslation)
              .replace(/\n+/g, ' ')
              .trim();
            if (!repairedText) {
              allRepairedCleanly = false;
              break;
            }
            repairedSlots[idx] = repairedText;
            lastKey = subRes.successKeyIndex;
            if (subRes.discoveredEntities?.length) {
              surgicalEntities.push(...subRes.discoveredEntities);
            }
          }

          if (allRepairedCleanly) {
            const orderedParagraphs = error.sourceParagraphs.map((_, idx) => repairedSlots[idx] || '');
            if (orderedParagraphs.every((p) => p.length > 0)) {
              let stitched = orderedParagraphs.join('\n\n');
              stitched = separateChapterTitleAndBody(stitched);
              stitched = normalizeTranslatedPunctuation(stitched);
              stitched = realignParagraphStructure(text, stitched);
              validateTranslationOutput(stitched);
              validateStrictStructureParity(text, stitched);
              return {
                rawTranslation: stitched,
                discoveredEntities: surgicalEntities,
                successKeyIndex: lastKey,
                isPartial: false,
                telemetry: {
                  ...createEmptyTelemetry(),
                  executionDurationMs: Date.now() - callStartTime,
                },
              };
            }
          }
        } catch (surgicalErr: any) {
          if (isNonSplittableInfrastructureError(surgicalErr)) {
            throw surgicalErr;
          }
          // Rơi xuống chiến lược chia đoạn đệ quy chuẩn nếu sửa phẫu thuật cục bộ chưa giải quyết hết
        }
      }
    }

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
        const rawChunkSlices = sliceRawSourceChunks(text, params.rawSourceText, chunks);
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

            const elapsed = getActiveElapsedMs();
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
                ...paramsWithWaitTracking,
                text: chunk,
                rawSourceText: rawChunkSlices[i],
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
