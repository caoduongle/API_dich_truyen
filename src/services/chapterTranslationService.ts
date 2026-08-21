import { Chapter, ChapterMetadata, GlossaryItem, PendingGlossaryItem } from '../types';
import { getChapterFromDB, saveChapterToDB } from './db';
import { isHanEquivalent } from '@shared/sinoNormalize';
import { apiFetch } from '../utils/apiClient';
import { separateChapterTitleAndBody } from '../utils/textCleaner';
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
  autoTranslateMode: 'resume' | 'from_scratch';
  additionalInstructions: string;
  isExtractionDuringTranslationEnabled: boolean;
  enableAiQaCritique: boolean;
  enableSegmentTranslation: boolean;
  addLog: (message: string, type?: 'info' | 'gemini' | 'success' | 'warn' | 'error') => void;
}

/**
 * Dịch một chương đơn lẻ qua 3 giai đoạn: Dịch thô -> Chuốt văn phong -> Kiểm duyệt QA
 * Tự động chuyển đổi giữa Direct Client Mode (khi có personal API key) và Server Fallback Mode.
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

  const isDirectClientMode = Array.isArray(apiKeys) && apiKeys.some((k) => typeof k === 'string' && k.trim().length > 0);
  let currentKeyIndex = startKeyIndex;
  let firstDraft = '';
  const localGlossary = [...glossarySnapshot];
  const newGlossaryItems: GlossaryItem[] = [];
  const newPendingItems: PendingGlossaryItem[] = [];

  const existingTranslation = (chapter.polishedTranslation || chapter.rawTranslation || '').trim();
  const hasExistingTranslation = existingTranslation.length > 0;
  const hasProcessedText = !!(chapter.processedSourceText && chapter.processedSourceText.trim());

  // ── GIAI ĐOẠN 1: Dịch thô ──
  if (autoTranslateMode === 'from_scratch' && hasExistingTranslation) {
    addLog(`${logPrefix} [Dịch từ đầu] Phát hiện bản dịch khả dụng. Tiến hành chuốt văn luôn (Bỏ qua Giai đoạn 1)...`, 'success');
    firstDraft = existingTranslation;
  } else {
    let rawData: { rawTranslation: string; discoveredEntities?: any[]; successKeyIndex?: number };

    if (isDirectClientMode) {
      addLog(`${logPrefix} Đang dịch thô trực tiếp qua Gemini API cá nhân (Giai đoạn 1)...${hasProcessedText ? ' (Sử dụng văn bản đã quét từ điển)' : ''}`, 'gemini');
      try {
        rawData = await translateRawDirect({
          text: (hasProcessedText ? chapter.processedSourceText : chapter.sourceText) || '',
          genre: projState.genre,
          tone: projState.tone,
          description: projState.description,
          glossary: hasProcessedText ? [] : glossarySnapshot,
          apiKeys,
          model: selectedModel,
          startKeyIndex: currentKeyIndex,
          enableSegmentTranslation,
          signal,
        });
      } catch (err: any) {
        const isOverload = err?.message && /429|RESOURCE_EXHAUSTED|hạn mức|quá tải/i.test(err.message);
        throw Object.assign(new Error(err?.message || 'Lỗi dịch thô từ hệ thống AI trực tiếp.'), { isOverload });
      }
    } else {
      addLog(`${logPrefix} Đang gọi API máy chủ dịch thô (Giai đoạn 1)...${hasProcessedText ? ' (Sử dụng văn bản đã quét từ điển, không gửi kèm glossary)' : ''}`, 'gemini');
      const rawRes = await apiFetch('/api/translate-raw', {
        method: 'POST',
        body: JSON.stringify({
          text: hasProcessedText ? chapter.processedSourceText : chapter.sourceText,
          genre: projState.genre,
          tone: projState.tone,
          description: projState.description,
          glossary: hasProcessedText ? [] : glossarySnapshot,
          apiKeys,
          model: selectedModel,
          startKeyIndex: currentKeyIndex,
          sourceChapterId: chapter.id,
          enableSegmentTranslation,
        }),
        signal,
      });

      if (!rawRes.ok) {
        const errData = await rawRes.json().catch(() => ({ error: 'Lỗi không xác định' }));
        const isOverload = errData.errorType === 'overload';
        throw Object.assign(new Error(errData.error || 'Lỗi dịch thô từ hệ thống AI.'), { isOverload });
      }

      rawData = await rawRes.json();
    }

    firstDraft = rawData.rawTranslation || '';
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

  // ── GIAI ĐOẠN 2: Chuốt văn phong ──
  let currentTextToPolish = firstDraft;
  addLog(`${logPrefix} Kích hoạt chu trình mài giũa văn phong (${polishCycles} lượt)...`, 'info');
  for (let j = 1; j <= polishCycles; j++) {
    const shouldExtract = isExtractionDuringTranslationEnabled && j === 1;
    if (j === 1 && isExtractionDuringTranslationEnabled) {
      addLog(`${logPrefix} [Rà soát từ điển] Kích hoạt rà soát thuật ngữ bị sót (chỉ chạy 1 lần/chương tại lượt polish đầu tiên).`, 'info');
    }

    let polishData: { polishedTranslation?: string; successKeyIndex?: number };

    if (isDirectClientMode) {
      addLog(`${logPrefix} Biên tập chuốt chữ trực tiếp Lần ${j}/${polishCycles}...${hasProcessedText ? ' (Sử dụng văn bản đã quét từ điển)' : ''}`, 'gemini');
      try {
        polishData = await polishTranslationDirect({
          sourceText: (hasProcessedText ? chapter.processedSourceText : chapter.sourceText) || '',
          rawTranslation: currentTextToPolish,
          genre: projState.genre,
          tone: projState.tone,
          description: projState.description,
          glossary: hasProcessedText ? [] : localGlossary,
          additionalInstructions: additionalInstructions || 'Hãy tối ưu ngữ điệu mượt mà, bay bổng nhất có thể.',
          apiKeys,
          model: selectedModel,
          startKeyIndex: currentKeyIndex,
          isExtractionEnabled: shouldExtract,
          enableSegmentTranslation,
          signal,
        });
      } catch (err: any) {
        const isOverload = err?.message && /429|RESOURCE_EXHAUSTED|hạn mức|quá tải/i.test(err.message);
        throw Object.assign(new Error(`${logPrefix} Thất bại tại vòng biên tập thứ ${j}: ` + (err?.message || 'Lỗi không xác định')), { isOverload });
      }
    } else {
      addLog(`${logPrefix} Biên tập chuốt chữ Lần ${j}/${polishCycles}...${hasProcessedText ? ' (Sử dụng văn bản đã quét từ điển, không gửi kèm glossary)' : ''}`, 'gemini');
      const polishRes = await apiFetch('/api/polish-translation', {
        method: 'POST',
        body: JSON.stringify({
          sourceText: hasProcessedText ? chapter.processedSourceText : chapter.sourceText,
          rawTranslation: currentTextToPolish,
          genre: projState.genre,
          tone: projState.tone,
          description: projState.description,
          glossary: hasProcessedText ? [] : localGlossary,
          additionalInstructions: additionalInstructions || 'Hãy tối ưu ngữ điệu mượt mà, bay bổng nhất có thể.',
          apiKeys,
          model: selectedModel,
          startKeyIndex: currentKeyIndex,
          isExtractionEnabled: shouldExtract,
          sourceChapterId: chapter.id,
          enableSegmentTranslation,
        }),
        signal,
      });

      if (!polishRes.ok) {
        const errData = await polishRes.json().catch(() => ({ error: 'Lỗi không xác định' }));
        const isOverload = errData.errorType === 'overload';
        throw Object.assign(new Error(`${logPrefix} Thất bại tại vòng biên tập thứ ${j}: ` + (errData.error || 'Lỗi không xác định')), { isOverload });
      }

      polishData = await polishRes.json();
    }

    currentTextToPolish = polishData.polishedTranslation || currentTextToPolish;
    if (typeof polishData.successKeyIndex === 'number') {
      currentKeyIndex = polishData.successKeyIndex;
    }
    addLog(`${logPrefix} Hoàn tất chuốt mịn lượt thứ ${j}!`, 'success');
  }

  // ── GIAI ĐOẠN 3: Kiểm duyệt chất lượng AI (Critique Phase) ──
  if (enableAiQaCritique) {
    addLog(`${logPrefix} [Kiểm duyệt AI] Bắt đầu rà soát thẩm định chất lượng bản dịch...`, 'info');
    try {
      let qaData: { isValid?: boolean; issues?: any[]; successKeyIndex?: number };

      if (isDirectClientMode) {
        qaData = await qaCritiqueDirect({
          sourceText: chapter.sourceText,
          translatedText: currentTextToPolish,
          apiKeys,
          model: selectedModel,
          startKeyIndex: currentKeyIndex,
          signal,
        });
      } else {
        const qaRes = await apiFetch('/api/qa-critique', {
          method: 'POST',
          body: JSON.stringify({
            sourceText: chapter.sourceText,
            translatedText: currentTextToPolish,
            apiKeys,
            model: selectedModel,
            startKeyIndex: currentKeyIndex,
          }),
          signal,
        });
        if (qaRes.ok) {
          qaData = await qaRes.json();
        } else {
          qaData = { isValid: true, issues: [] };
          addLog(`${logPrefix} [Kiểm duyệt AI] Lỗi hệ thống kiểm duyệt, tiếp tục tiến trình...`, 'warn');
        }
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
  const cleanRaw = separateChapterTitleAndBody(firstDraft);
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
