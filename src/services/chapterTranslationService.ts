import { Chapter, ChapterMetadata, GlossaryItem, PendingGlossaryItem } from '../types';
import { getChapterFromDB, saveChapterToDB } from './db';
import { isHanEquivalent } from '../lib/sinoNormalize';
import { separateChapterTitleAndBody } from '../utils/textCleaner';
import { getPolishStrategyForRound, calculateTextSimilarity } from '../lib/text';
import {
  translateRawDirect,
  polishTranslationDirect,
  qaCritiqueDirect,
} from './directTranslationEngine';

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

  let hasFreshRaw = false;

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
    let rawData: { rawTranslation: string; discoveredEntities?: any[]; successKeyIndex?: number };

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
        onSplitRetry: (info) => {
          const reasonSummary = info.reason.includes('UNTRANSLATED_CHINESE_LEFTOVER')
            ? 'Bản dịch sót nhiều chữ Hán'
            : info.reason.includes('bộ lọc an toàn') || info.reason.includes('SAFETY')
            ? 'Vi phạm bộ lọc an toàn'
            : 'Phản hồi rỗng';
          addLog(
            `${logPrefix} [Cứu nguy GĐ1] Phát hiện sự cố (${reasonSummary}). Tự động kích hoạt phân đoạn thích ứng cấp ${info.depth + 1} (chia ${info.partsCount} phần) để dịch lại...`,
            'warn'
          );
        },
      });
    } catch (err: any) {
      const isOverload = err?.message && /429|RESOURCE_EXHAUSTED|hạn mức|quá tải/i.test(err.message);
      throw Object.assign(new Error(err?.message || 'Lỗi dịch thô từ hệ thống AI trực tiếp.'), { isOverload });
    }

    firstDraft = rawData.rawTranslation || '';
    hasFreshRaw = true;
    if (typeof rawData.successKeyIndex === 'number') {
      currentKeyIndex = rawData.successKeyIndex;
    }
    addLog(`${logPrefix} Đã hoàn thành biểu mẫu dịch thô GĐ1.`, 'success');

    // Trích xuất entity mới
    if (isExtractionDuringTranslationEnabled && rawData.discoveredEntities && Array.isArray(rawData.discoveredEntities) && rawData.discoveredEntities.length > 0) {
      rawData.discoveredEntities.forEach((ent: any) => {
        if (!ent.chinese || !ent.vietnamese) return;

        const cleanChinese = ent.chinese.replace(/\s+/g, '').trim();
        const cleanVietnamese = ent.vietnamese.trim();
        const cleanPinyin = (ent.pinyin || '').trim();
        const cleanNote = (ent.note || '').trim();

        const matchedByCn = localGlossary.find((gItem) => isHanEquivalent(gItem.chinese, ent.chinese));
        const matchedByVi = localGlossary.find((gItem) => gItem.vietnamese.trim().toLowerCase() === cleanVietnamese.toLowerCase());

        const rawChinese = ent.chinese.trim();
        const originParagraph = chapter.sourceText.split('\n').find((p) =>
          p.includes(rawChinese) || p.replace(/\s+/g, '').includes(cleanChinese)
        )?.trim() || '';

        if (!matchedByCn && !matchedByVi && !ent.needsReview) {
          const itemPayload: GlossaryItem = {
            id: 'glo_auto_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            chinese: cleanChinese,
            pinyin: cleanPinyin || cleanVietnamese,
            vietnamese: cleanVietnamese,
            type: ent.type || 'other',
            note: cleanNote,
            sourceChapter: chapter.title,
            sourceParagraph: originParagraph,
            sourceChapterId: chapter.id,
            origin: 'scanned',
            createdAt: new Date().toISOString(),
          };
          newGlossaryItems.push(itemPayload);
          localGlossary.push(itemPayload);
        } else {
          let reason: PendingGlossaryItem['reason'] = 'Duplicate Chinese';
          let originalValue = '';

          if (ent.needsReview) {
            reason = 'AI trích xuất nghi ngờ hallucinate';
            originalValue = 'Không tìm thấy cụm từ này trong văn bản gốc của chương.';
          } else if (matchedByCn && matchedByVi) {
            reason = 'Duplicate Both';
            originalValue = `Trùng cả cụm: Gốc "${matchedByCn.chinese}" -> Nghĩa "${matchedByCn.vietnamese}"`;
          } else if (matchedByCn) {
            reason = 'Duplicate Chinese';
            originalValue = `Trùng chữ Trung gốc: "${matchedByCn.chinese}" đã dịch là "${matchedByCn.vietnamese}"`;
          } else if (matchedByVi) {
            reason = 'Duplicate Vietnamese';
            originalValue = `Trùng nghĩa dịch Việt: "${matchedByVi.vietnamese}" đã được dùng cho gốc "${matchedByVi.chinese}"`;
          }

          newPendingItems.push({
            id: 'pend_auto_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            chinese: cleanChinese,
            pinyin: cleanPinyin,
            vietnamese: cleanVietnamese,
            type: ent.type || 'other',
            note: cleanNote,
            reason,
            originalValue,
            importedAt: new Date().toISOString(),
            needsReview: !!ent.needsReview,
            sourceChapterId: chapter.id,
          });
        }
      });
    }
  }

  // ── GIAI ĐOẠN 2: Chuốt văn phong trực tiếp ──
  let currentTextToPolish = firstDraft;
  addLog(`${logPrefix} Kích hoạt chu trình mài giũa văn phong (${polishCycles} lượt)...`, 'info');
  for (let j = 1; j <= polishCycles; j++) {
    const strategy = getPolishStrategyForRound(j, polishCycles);
    const shouldExtract = isExtractionDuringTranslationEnabled && j === 1;
    if (j === 1 && isExtractionDuringTranslationEnabled) {
      addLog(`${logPrefix} [Rà soát từ điển] Kích hoạt rà soát thuật ngữ bị sót (chỉ chạy 1 lần/chương tại lượt polish đầu tiên).`, 'info');
    }

    addLog(`${logPrefix} Biên tập chuốt chữ trực tiếp Lần ${j}/${polishCycles} [${strategy.stageName}]...${hasProcessedText ? ' (Sử dụng văn bản đã quét từ điển)' : ''}`, 'gemini');
    let polishData: { polishedTranslation?: string; successKeyIndex?: number };

    try {
      polishData = await polishTranslationDirect({
        sourceText: (hasProcessedText ? chapter.processedSourceText : chapter.sourceText) || '',
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
      const isOverload = err?.message && /429|RESOURCE_EXHAUSTED|hạn mức|quá tải/i.test(err.message);
      if (isOverload) {
        throw Object.assign(new Error(`${logPrefix} Thất bại tại vòng biên tập thứ ${j}: ` + (err?.message || 'Lỗi không xác định')), { isOverload });
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
    currentTextToPolish = polishData.polishedTranslation || currentTextToPolish;
    if (typeof polishData.successKeyIndex === 'number') {
      currentKeyIndex = polishData.successKeyIndex;
    }

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

  // ── GIAI ĐOẠN 3: Kiểm duyệt chất lượng AI trực tiếp (Critique Phase) ──
  let detectedQaIssues: any[] = [];
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

      if (Array.isArray(qaData.issues)) {
        detectedQaIssues = qaData.issues;
      }

      if (qaData.isValid) {
        addLog(`${logPrefix} [Kiểm duyệt AI] Đạt chuẩn! Không phát hiện lỗi bỏ sót, thêm thắt hoặc lặp lại.`, 'success');
      } else if (Array.isArray(qaData.issues) && qaData.issues.length > 0) {
        addLog(`${logPrefix} [Kiểm duyệt AI] Phát hiện ${qaData.issues.length} vấn đề kiểm duyệt:`, 'warn');
        qaData.issues.forEach((issue: any) => {
          addLog(`- [${issue.type.toUpperCase()}] (${issue.severity}): ${issue.description}`, 'warn');
        });
      }

      if (typeof qaData.successKeyIndex === 'number') {
        currentKeyIndex = qaData.successKeyIndex;
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
    qaIssues: detectedQaIssues.length > 0 ? detectedQaIssues : chapter.qaIssues,
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
