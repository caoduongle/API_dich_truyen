import { Chapter, ChapterMetadata, GlossaryItem, PendingGlossaryItem } from '../types';
import { getChapterFromDB, saveChapterToDB } from './db';
import { classifyDiscoveredEntitiesForGlossary, selectRelevantGlossary } from '../lib/glossaryMatch';
import { separateChapterTitleAndBody } from '../utils/textCleaner';
import { getPolishStrategyForRound, calculateTextSimilarity } from '../lib/text';
import {
  translateRawDirect,
  polishTranslationDirect,
  qaCritiqueDirect,
  buildChapterContinuityContext,
  resolvePreviousChapterId,
  evaluatePolishRoundFidelity,
  runDeterministicTranslationChecks,
  mergeAndDeduplicateQaIssues,
  repairChapterCriticalIssuesDirect,
} from './directTranslationEngine';
import { ContinuityContext, DiscoveredEntity, DirectQaCritiqueIssue } from './translation/types';

export { buildChapterContinuityContext, resolvePreviousChapterId };

export interface SingleChapterResult {
  success: boolean;
  chapterId: string;
  isOverload: boolean;
  newGlossaryItems: GlossaryItem[];
  newPendingItems: PendingGlossaryItem[];
  updatedChapter: Chapter | null;
  lastKeyIndex: number;
}

export interface TranslateChapterParams {
  chapterMeta: ChapterMetadata;
  glossarySnapshot: GlossaryItem[];
  signal: AbortSignal;
  logPrefix: string;
  startKeyIndex: number;
  projState: { genre: string; tone: string; description: string };
  apiKeys: string[];
  selectedModel: string;
  polishCycles: number;
  autoTranslateMode: 'resume' | 'from_scratch' | 'repolish';
  additionalInstructions: string;
  isExtractionDuringTranslationEnabled: boolean;
  enableAiQaCritique: boolean;
  enableSegmentTranslation: boolean;
  enableAutoTargetedRepair?: boolean;
  previousChapterContinuity?: ContinuityContext;
  projectChapters?: ChapterMetadata[];
  addLog: (message: string, type?: 'info' | 'gemini' | 'success' | 'warn' | 'error') => void;
}

/**
 * Kiểm định tính toàn vẹn của bản nháp so với văn bản gốc.
 * Nhận diện các bản dịch bị cụt (ví dụ chỉ có 1 đoạn ngắn hoặc độ dài quá thấp do lỗi mạng/AI).
 */
export function isDraftTruncated(draft: string, sourceText: string): boolean {
  const cleanDraft = (draft || '').trim();
  const cleanSource = (sourceText || '').trim();

  if (!cleanDraft || cleanDraft.length === 0) return true;
  // Với văn bản gốc ngắn (<= 150 ký tự), bỏ qua kiểm tra tỷ lệ
  if (cleanSource.length <= 150) return false;

  // Bản dịch tiếng Việt thường dài hơn hoặc tương đương tiếng Trung (tỷ lệ 1.0 - 1.8).
  // Nếu tỷ lệ ký tự dưới 35% so với tiếng Trung gốc -> Bị cụt nặng.
  if (cleanDraft.length < cleanSource.length * 0.35) {
    return true;
  }

  // Nếu bản gốc có từ 3 đoạn văn trở lên nhưng bản dịch chỉ có 1 đoạn và độ dài dưới 50% bản gốc
  const sourceParagraphs = cleanSource.split(/\n+/).filter(p => p.trim().length > 0).length;
  const draftParagraphs = cleanDraft.split(/\n+/).filter(p => p.trim().length > 0).length;
  if (sourceParagraphs >= 3 && draftParagraphs <= 1 && cleanDraft.length < cleanSource.length * 0.5) {
    return true;
  }

  return false;
}

/**
 * Dịch một chương đơn lẻ qua 3 giai đoạn trực tiếp từ trình duyệt đến Google Gemini API:
 * Dịch thô -> Chuốt văn phong -> Kiểm duyệt QA
 * Bắt buộc 100% người dùng phải cung cấp Gemini API Key cá nhân.
 */
export async function executeSingleChapterTranslation({
  chapterMeta,
  glossarySnapshot,
  signal,
  logPrefix,
  startKeyIndex,
  projState,
  apiKeys,
  selectedModel,
  polishCycles,
  autoTranslateMode,
  additionalInstructions,
  isExtractionDuringTranslationEnabled,
  enableAiQaCritique,
  enableSegmentTranslation,
  enableAutoTargetedRepair = false,
  previousChapterContinuity,
  projectChapters,
  addLog,
}: TranslateChapterParams): Promise<SingleChapterResult> {
  const hasValidKeys = Array.isArray(apiKeys) && apiKeys.some((k) => typeof k === 'string' && k.trim().length > 0);
  if (!hasValidKeys) {
    const errorMsg = 'Chưa cấu hình API Key cá nhân. Vui lòng thêm ít nhất một Gemini API Key trong phần Cấu hình AI để thực hiện dịch thuật.';
    addLog(`${logPrefix} [LỖI] ${errorMsg}`, 'error');
    throw new Error(errorMsg);
  }

  const chapter = await getChapterFromDB(chapterMeta.id);
  if (!chapter) {
    addLog(`${logPrefix} Lỗi: Không tìm thấy dữ liệu của chương: ${chapterMeta.title}`, 'error');
    return {
      success: false,
      chapterId: chapterMeta.id,
      isOverload: false,
      newGlossaryItems: [],
      newPendingItems: [],
      updatedChapter: null,
      lastKeyIndex: startKeyIndex,
    };
  }

  let currentKeyIndex = startKeyIndex;
  let firstDraft = '';
  const localGlossary = [...glossarySnapshot];
  const newGlossaryItems: GlossaryItem[] = [];
  const newPendingItems: PendingGlossaryItem[] = [];

  const rawCandidate = (chapter.rawTranslation || '').trim();
  const hasRawTranslation = rawCandidate.length > 0;
  const isRawTruncated = hasRawTranslation ? isDraftTruncated(rawCandidate, chapter.sourceText) : true;
  const hasProcessedText = !!(chapter.processedSourceText && chapter.processedSourceText.trim());

  let effectiveContinuity = previousChapterContinuity;
  if (!effectiveContinuity && Array.isArray(projectChapters)) {
    const prevId = resolvePreviousChapterId(projectChapters, chapterMeta.id);
    if (prevId) {
      const prevChap = await getChapterFromDB(prevId).catch(() => null);
      effectiveContinuity = buildChapterContinuityContext(prevChap);
    }
  }

  let hasFreshRaw = false;

  const { conflicts: glossaryConflicts } = selectRelevantGlossary(chapter.sourceText, localGlossary);
  if (glossaryConflicts.length > 0) {
    addLog(
      `${logPrefix} [Cảnh báo Từ điển] Phát hiện ${glossaryConflicts.length} xung đột ánh xạ thuật ngữ trong chương (${glossaryConflicts
        .map(
          (c) =>
            `${c.winningItem.chinese}: ${c.winningItem.vietnamese} vs ${c.shadowedItems
              .map((s) => s.vietnamese)
              .join('/')}`
        )
        .join('; ')}). Đã ưu tiên bản ghi ghim/mới nhất.`,
      'warn'
    );
  }

  // ── GIAI ĐOẠN 1: Dịch thô trực tiếp ──
  // Mode 'repolish': Cho phép tái sử dụng bản dịch thô ĐÃ CÓ nếu bản thô hợp lệ và không bị cụt.
  // Mode 'from_scratch': BẮT BUỘC dịch lại mới 100% từ tiếng Trung gốc.
  // Mode 'resume': Dịch nếu chưa có bản thô hoặc bản thô bị cụt.
  const canReuseRaw = (autoTranslateMode === 'repolish') && hasRawTranslation && !isRawTruncated;

  if (canReuseRaw) {
    addLog(`${logPrefix} [Chuốt lại từ bản thô] Phát hiện bản dịch thô hợp lệ (${rawCandidate.length} ký tự). Bỏ qua Giai đoạn 1 và tiến hành chuốt văn phong...`, 'info');
    firstDraft = rawCandidate;
    hasFreshRaw = false;
  } else {
    if (autoTranslateMode === 'repolish' && hasRawTranslation && isRawTruncated) {
      addLog(`${logPrefix} [Cảnh báo toàn vẹn] Bản dịch thô hiện tại có dấu hiệu bị cụt (${rawCandidate.length} ký tự vs ${chapter.sourceText.length} ký tự gốc). Tự động dịch thô lại mới từ đầu để bảo đảm tính toàn vẹn...`, 'warn');
    } else if (autoTranslateMode === 'from_scratch') {
      addLog(`${logPrefix} [Dịch từ đầu] Đang dịch thô mới trực tiếp từ văn bản gốc tiếng Trung (Giai đoạn 1)...${hasProcessedText ? ' (Sử dụng văn bản đã quét từ điển)' : ''}`, 'gemini');
    } else {
      addLog(`${logPrefix} Đang dịch thô trực tiếp qua Gemini API cá nhân (Giai đoạn 1)...${hasProcessedText ? ' (Sử dụng văn bản đã quét từ điển)' : ''}`, 'gemini');
    }
    let rawData: { rawTranslation: string; discoveredEntities?: DiscoveredEntity[]; successKeyIndex?: number };

    try {
      rawData = await translateRawDirect({
        text: (hasProcessedText ? chapter.processedSourceText : chapter.sourceText) || '',
        genre: projState.genre,
        tone: projState.tone,
        description: projState.description,
        glossary: glossarySnapshot,
        apiKeys,
        model: selectedModel,
        startKeyIndex: currentKeyIndex,
        enableSegmentTranslation,
        signal,
        ...(effectiveContinuity ? { continuity: effectiveContinuity } : {}),
        onSplitRetry: (info) => {
          const reasonSummary = info.reason.includes('UNTRANSLATED_CHINESE_LEFTOVER')
            ? 'Bản dịch sót nhiều chữ Hán'
            : info.reason.includes('bộ lọc an toàn') || info.reason.includes('SAFETY')
            ? 'Vi phạm bộ lọc an toàn'
            : 'Phản hồi rỗng';

          if (info.tier === 'line-by-line') {
            addLog(
              `${logPrefix} [Cứu nguy GĐ1 - Dịch từng dòng] Phát hiện sự cố (${reasonSummary}). Tự động kích hoạt dịch phân rã từng dòng để cô lập đoạn lỗi...`,
              'warn'
            );
          } else if (info.tier === 'sino-fallback') {
            addLog(
              `${logPrefix} [Cứu nguy GĐ1 - Phiên âm dự phòng] Kích hoạt phiên âm Hán-Việt & từ điển dự phòng cho câu khó để bảo toàn chương...`,
              'warn'
            );
          } else {
            addLog(
              `${logPrefix} [Cứu nguy GĐ1] Phát hiện sự cố (${reasonSummary}). Tự động kích hoạt phân đoạn thích ứng cấp ${info.depth + 1} (chia ${info.partsCount} phần) để dịch lại...`,
              'warn'
            );
          }
        },
      });
    } catch (err: any) {
      if (err?.name === 'AbortError' || (err instanceof DOMException && err.name === 'AbortError')) {
        throw err;
      }
      const isAllKeysExhausted =
        err?.code === 'ALL_KEYS_EXHAUSTED' ||
        (typeof err?.message === 'string' && err.message.includes('Toàn bộ API Key đã hết hạn mức'));
      const isOverload = err?.message && /429|RESOURCE_EXHAUSTED|hạn mức|quá tải/i.test(err.message);
      throw Object.assign(new Error(err?.message || 'Lỗi dịch thô từ hệ thống AI trực tiếp.'), {
        isOverload,
        code: isAllKeysExhausted ? 'ALL_KEYS_EXHAUSTED' : err?.code,
      });
    }

    firstDraft = rawData.rawTranslation || '';
    hasFreshRaw = true;
    if (typeof rawData.successKeyIndex === 'number') {
      currentKeyIndex = rawData.successKeyIndex;
    }
    addLog(`${logPrefix} Đã hoàn thành biểu mẫu dịch thô GĐ1.`, 'success');

    const rawComplianceIssues = runDeterministicTranslationChecks({
      sourceText: chapter.sourceText,
      translatedText: firstDraft,
      glossary: localGlossary,
      isPartialFallback: Boolean((rawData as { isPartial?: boolean }).isPartial),
    });
    if (rawComplianceIssues.length > 0) {
      addLog(
        `${logPrefix} [Kiểm tra tuân thủ GĐ1] Phát hiện ${rawComplianceIssues.length} điểm lệch từ điển/xưng hô hoặc sót chữ Hán trong bản dịch thô.`,
        'warn'
      );
    }

    // Trích xuất entity mới qua logic phân loại dùng chung (FR-021)
    if (isExtractionDuringTranslationEnabled && rawData.discoveredEntities && Array.isArray(rawData.discoveredEntities) && rawData.discoveredEntities.length > 0) {
      const classified = classifyDiscoveredEntitiesForGlossary({
        discoveredEntities: rawData.discoveredEntities,
        existingGlossary: localGlossary,
        sourceText: chapter.sourceText,
        chapterTitle: chapter.title,
        chapterId: chapter.id,
        idPrefix: 'auto',
        defaultPinyinToVietnamese: true,
      });
      if (classified.newGlossaryItems.length > 0) {
        newGlossaryItems.push(...classified.newGlossaryItems);
        localGlossary.push(...classified.newGlossaryItems);
      }
      if (classified.newPendingItems.length > 0) {
        newPendingItems.push(...classified.newPendingItems);
      }
    }
  }

  // ── GIAI ĐOẠN 2: Chuốt văn phong trực tiếp ──
  let currentTextToPolish = firstDraft;
  let lastPolishIsPartial = false;
  addLog(`${logPrefix} Kích hoạt chu trình mài giũa văn phong (${polishCycles} lượt)...`, 'info');
  for (let j = 1; j <= polishCycles; j++) {
    const strategy = getPolishStrategyForRound(j, polishCycles);
    const shouldExtract = isExtractionDuringTranslationEnabled && j === 1;
    if (j === 1 && isExtractionDuringTranslationEnabled) {
      addLog(`${logPrefix} [Rà soát từ điển] Kích hoạt rà soát thuật ngữ bị sót (chỉ chạy 1 lần/chương tại lượt polish đầu tiên).`, 'info');
    }

    addLog(`${logPrefix} Biên tập chuốt chữ trực tiếp Lần ${j}/${polishCycles} [${strategy.stageName}]...`, 'gemini');
    let polishData: { polishedTranslation?: string; successKeyIndex?: number; isPartial?: boolean };

    try {
      polishData = await polishTranslationDirect({
        sourceText: chapter.sourceText,
        rawTranslation: currentTextToPolish,
        genre: projState.genre,
        tone: projState.tone,
        description: projState.description,
        glossary: localGlossary,
        additionalInstructions: additionalInstructions || 'Hãy tối ưu ngữ điệu mượt mà, bay bổng nhất có thể, giữ trọn vẹn văn phong tiểu thuyết.',
        apiKeys,
        model: selectedModel,
        startKeyIndex: currentKeyIndex,
        isExtractionEnabled: shouldExtract,
        enableSegmentTranslation,
        signal,
        roundIndex: j,
        totalRounds: polishCycles,
        ...(effectiveContinuity ? { continuity: effectiveContinuity } : {}),
        onSplitRetry: (info) => {
          const reasonSummary = info.reason.includes('UNTRANSLATED_CHINESE_LEFTOVER')
            ? 'Bản chuốt văn sót nhiều chữ Hán'
            : info.reason.includes('bộ lọc an toàn') || info.reason.includes('SAFETY')
            ? 'Vi phạm bộ lọc an toàn'
            : 'Phản hồi rỗng';
          addLog(
            `${logPrefix} [Cứu nguy GĐ2 Lượt ${j}] Phát hiện sự cố (${reasonSummary}). Tự động kích hoạt phân đoạn thích ứng cấp ${info.depth + 1} (chia ${info.partsCount} phần) để chuốt lại...`,
            'warn'
          );
        },
      });
    } catch (err: any) {
      if (err?.name === 'AbortError' || (err instanceof DOMException && err.name === 'AbortError')) {
        throw err;
      }
      const isAllKeysExhausted =
        err?.code === 'ALL_KEYS_EXHAUSTED' ||
        (typeof err?.message === 'string' && err.message.includes('Toàn bộ API Key đã hết hạn mức'));
      const isOverload = err?.message && /429|RESOURCE_EXHAUSTED|hạn mức|quá tải/i.test(err.message);
      if (isAllKeysExhausted || isOverload) {
        throw Object.assign(
          new Error(`${logPrefix} Thất bại tại vòng biên tập thứ ${j}: ` + (err?.message || 'Lỗi không xác định')),
          {
            isOverload,
            code: isAllKeysExhausted ? 'ALL_KEYS_EXHAUSTED' : err?.code,
          }
        );
      }

      // Xử lý cứu nguy khi AI gặp sự cố phản hồi rỗng / bộ lọc không thể khắc phục
      if (j > 1) {
        addLog(
          `${logPrefix} [Cứu nguy] Vòng biên tập thứ ${j} gặp sự cố AI (${err?.message || 'Phản hồi rỗng'}). Tự động bảo lưu kết quả mượt mà của Lượt ${j - 1} để tiếp tục.`,
          'warn'
        );
        break;
      } else {
        addLog(
          `${logPrefix} [Cứu nguy] Vòng biên tập thứ 1 gặp sự cố AI (${err?.message || 'Phản hồi rỗng'}). Tự động bảo lưu bản dịch thô (Phase 1) để tiếp tục.`,
          'warn'
        );
        currentTextToPolish = firstDraft;
        break;
      }
    }

    const previousRoundText = currentTextToPolish;
    const candidatePolished = polishData.polishedTranslation || currentTextToPolish;
    if (typeof polishData.successKeyIndex === 'number') {
      currentKeyIndex = polishData.successKeyIndex;
    }

    if (polishData.polishedTranslation && previousRoundText) {
      const fidelity = evaluatePolishRoundFidelity({
        sourceText: chapter.sourceText,
        previousDraft: previousRoundText,
        candidatePolished,
        glossary: localGlossary,
        roundIndex: j,
      });
      if (!fidelity.isAcceptable) {
        addLog(
          `${logPrefix} [Hậu kiểm GĐ2 Lượt ${j}] Từ chối bản chuốt vì làm suy giảm độ trung thành (${fidelity.rejectionReason || 'regression'}). Khôi phục bản lượt trước và dừng chuốt sớm.`,
          'warn'
        );
        currentTextToPolish = previousRoundText;
        break;
      }
    }

    currentTextToPolish = candidatePolished;
    lastPolishIsPartial = Boolean(polishData.isPartial);

    // Kiểm tra độ tương đồng và phát hiện hội tụ từ lượt 2 trở đi
    if (j > 1 && previousRoundText) {
      const conv = calculateTextSimilarity(previousRoundText, currentTextToPolish, 0.96);
      if (conv.isConverged) {
        addLog(
          `${logPrefix} [Hội tụ] Bản dịch đã đạt độ hoàn thiện tối ưu tại Lần ${j}/${polishCycles} (Độ tương đồng ${(conv.similarity * 100).toFixed(1)}%). Tự động dừng sớm để tiết kiệm hạn mức API.`,
          'success'
        );
        break;
      } else {
        addLog(
          `${logPrefix} Hoàn tất chuốt mịn lượt thứ ${j}! (Thay đổi ${conv.diffPercentage}% câu cú/từ vựng so với lượt trước)`,
          'success'
        );
      }
    } else {
      addLog(`${logPrefix} Hoàn tất chuốt mịn lượt thứ ${j}!`, 'success');
    }
  }

  const postPolishDeterministicIssues = runDeterministicTranslationChecks({
    sourceText: chapter.sourceText,
    translatedText: currentTextToPolish,
    glossary: localGlossary,
    isPartialFallback: lastPolishIsPartial,
  });
  if (postPolishDeterministicIssues.length > 0) {
    addLog(
      `${logPrefix} [Kiểm tra tuân thủ GĐ2] Phát hiện ${postPolishDeterministicIssues.length} điểm lệch từ điển/xưng hô hoặc sót chữ Hán sau chuốt văn phong.`,
      'warn'
    );
  }

  // ── GIAI ĐOẠN 3: Kiểm duyệt chất lượng AI trực tiếp (Critique Phase) ──
  let detectedQaIssues: DirectQaCritiqueIssue[] = [];
  let qaRunSucceeded = false;
  if (enableAiQaCritique) {
    addLog(`${logPrefix} [Kiểm duyệt AI] Bắt đầu rà soát thẩm định chất lượng bản dịch...`, 'info');
    try {
      const qaData = await qaCritiqueDirect({
        sourceText: chapter.sourceText,
        translatedText: currentTextToPolish,
        genre: projState.genre,
        tone: projState.tone,
        description: projState.description,
        glossary: localGlossary,
        apiKeys,
        model: selectedModel,
        startKeyIndex: currentKeyIndex,
        signal,
      });

      qaRunSucceeded = true;
      const aiIssues = Array.isArray(qaData.issues) ? qaData.issues : [];
      detectedQaIssues = mergeAndDeduplicateQaIssues({
        deterministicIssues: postPolishDeterministicIssues,
        aiIssues,
        translatedText: currentTextToPolish,
      });

      if (qaData.isValid && detectedQaIssues.length === 0) {
        addLog(`${logPrefix} [Kiểm duyệt AI] Đạt chuẩn! Không phát hiện lỗi bỏ sót, thêm thắt hoặc lặp lại.`, 'success');
      } else if (detectedQaIssues.length > 0) {
        addLog(`${logPrefix} [Kiểm duyệt AI] Phát hiện ${detectedQaIssues.length} vấn đề kiểm duyệt:`, 'warn');
        detectedQaIssues.forEach((issue) => {
          addLog(`- [${issue.type.toUpperCase()}] (${issue.severity}): ${issue.description}`, 'warn');
        });
      }

      if (typeof qaData.successKeyIndex === 'number') {
        currentKeyIndex = qaData.successKeyIndex;
      }

      if (enableAutoTargetedRepair) {
        const repairableCritical = detectedQaIssues.filter(
          (i) => i.severity === 'critical' && typeof i.paragraphIndex === 'number'
        );
        if (repairableCritical.length > 0) {
          addLog(
            `${logPrefix} [Sửa đoạn QA] Bắt đầu 1 lượt tự động sửa ${repairableCritical.length} lỗi nghiêm trọng...`,
            'info'
          );
          try {
            const repairRes = await repairChapterCriticalIssuesDirect({
              sourceText: chapter.sourceText,
              translatedText: currentTextToPolish,
              issues: detectedQaIssues,
              glossary: localGlossary,
              genre: projState.genre,
              tone: projState.tone,
              description: projState.description,
              apiKeys,
              model: selectedModel,
              startKeyIndex: currentKeyIndex,
              signal,
            });
            currentTextToPolish = repairRes.repairedTranslatedText;
            detectedQaIssues = repairRes.updatedIssues;
            currentKeyIndex = repairRes.successKeyIndex;

            if (repairRes.repairedParagraphIndices.length > 0) {
              addLog(
                `${logPrefix} [Sửa đoạn QA] Đã sửa an toàn ${repairRes.repairedParagraphIndices.length} đoạn (${repairRes.rejectedParagraphIndices.length} đoạn bị từ chối/hoàn tác).`,
                'success'
              );
            } else if (repairRes.rejectedParagraphIndices.length > 0) {
              addLog(
                `${logPrefix} [Sửa đoạn QA] Giữ nguyên bản trước sửa (${repairRes.rejectedParagraphIndices.length} đoạn không đạt kiểm tra an toàn).`,
                'warn'
              );
            }
          } catch (repairErr: any) {
            if (signal?.aborted) throw repairErr;
            addLog(
              `${logPrefix} [Sửa đoạn QA] Lỗi khi tự động sửa đoạn: ${repairErr?.message || repairErr}`,
              'warn'
            );
          }
        }
      }
    } catch (qaErr: any) {
      addLog(`${logPrefix} [Kiểm duyệt AI] Lỗi gọi API QA Critique: ${qaErr.message || qaErr}`, 'warn');
    }
  }

  // ── Lưu kết quả ──
  const cleanRaw = hasFreshRaw
    ? separateChapterTitleAndBody(firstDraft)
    : (chapter.rawTranslation || separateChapterTitleAndBody(firstDraft));
  const cleanPolished = currentTextToPolish ? separateChapterTitleAndBody(currentTextToPolish) : '';

  const paragraphs = chapter.sourceText.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 0);
  const translatedLines = cleanPolished
    ? cleanPolished.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 0)
    : cleanRaw.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 0);

  const updatedFullChapter: Chapter = {
    ...chapter,
    rawTranslation: cleanRaw,
    polishedTranslation: cleanPolished,
    paragraphs,
    translatedLines,
    status: 'completed',
    updatedAt: new Date().toISOString(),
    qaIssues: enableAiQaCritique && qaRunSucceeded ? detectedQaIssues : chapter.qaIssues,
  };
  await saveChapterToDB(updatedFullChapter);

  addLog(`${logPrefix} Đã biên phiên dịch hoàn chỉnh chương: ${chapter.title}`, 'success');

  return {
    success: true,
    chapterId: chapter.id,
    isOverload: false,
    newGlossaryItems,
    newPendingItems,
    updatedChapter: updatedFullChapter,
    lastKeyIndex: currentKeyIndex,
  };
}
