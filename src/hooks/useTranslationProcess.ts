import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StoryProject, Chapter, ChapterMetadata, GlossaryItem, PendingGlossaryItem } from '../types';
import { getChapterFromDB, saveChapterToDB } from '../services/db';
import { LogEntry } from './useAutoTranslationQueue';
import { triggerDownload } from '../utils/download';
import { useNotifications } from '../components/NotificationSystem';
import { isHanEquivalent } from '@shared/sinoNormalize';
import { apiFetch } from '../utils/apiClient';

export interface UseTranslationProcessProps {
  activeProject: StoryProject;
  onUpdateProject: (updated: StoryProject) => void;
  apiKeys: string[];
  selectedModel: string;
  polishCycles: number;
  autoTranslateMode: 'resume' | 'from_scratch';
  additionalInstructions: string;
  isExtractionDuringTranslationEnabled: boolean;
  rangeEnabled: boolean;
  rangeStart: number;
  rangeEnd: number;
  
  // Shared ref and state updaters
  currentApiKeyIndexRef: React.MutableRefObject<number>;
  addLog: (message: string, type?: LogEntry['type']) => void;
  setAutoDiscoveredBatch: React.Dispatch<React.SetStateAction<GlossaryItem[]>>;
  setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;

  // Add the retry configuration prop
  skipFailedChapters: boolean;

  // Concurrency
  concurrency: number;

  enableAiQaCritique: boolean;
  enableSegmentTranslation: boolean;
}

export function useTranslationProcess({
  activeProject,
  onUpdateProject,
  apiKeys,
  selectedModel,
  polishCycles,
  autoTranslateMode,
  additionalInstructions,
  isExtractionDuringTranslationEnabled,
  rangeEnabled,
  rangeStart,
  rangeEnd,
  currentApiKeyIndexRef,
  addLog,
  setAutoDiscoveredBatch,
  setLogs,
  skipFailedChapters,
  concurrency,
  enableAiQaCritique,
  enableSegmentTranslation,
}: UseTranslationProcessProps) {
  const { showToast } = useNotifications();
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(-1);
  const [chaptersQueue, setChaptersQueue] = useState<ChapterMetadata[]>([]);
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [processStartTime, setProcessStartTime] = useState<number | null>(null);
  const [estTimeStr, setEstTimeStr] = useState<string>('Đang tính toán...');

  const projectRef = useRef<StoryProject>(activeProject);
  const isPauseRequestedRef = useRef<boolean>(false);
  const bufferedProjectRef = useRef<StoryProject | null>(null);
  const currentAbortControllerRef = useRef<AbortController | null>(null);
  const activeAbortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const paramsRef = useRef({
    apiKeys,
    selectedModel,
    polishCycles,
    autoTranslateMode,
    additionalInstructions,
    isExtractionDuringTranslationEnabled,
    skipFailedChapters,
    enableAiQaCritique,
    enableSegmentTranslation
  });

  useEffect(() => {
    projectRef.current = activeProject;
  }, [activeProject]);

  useEffect(() => {
    if (activeProject.translationQueueState) {
      const { queueIds, currentIndex, failedIds } = activeProject.translationQueueState;
      const reconstructedQueue = (activeProject.chapters || []).filter(c => queueIds.includes(c.id));
      if (reconstructedQueue.length > 0) {
        setChaptersQueue(reconstructedQueue);
        setCurrentChapterIndex(currentIndex);
        setProcessedCount(currentIndex >= 0 ? currentIndex : 0);
        
        if (currentIndex >= reconstructedQueue.length) {
          if (failedIds && failedIds.length > 0) {
            addLog(`[Khôi phục] Phát hiện phiên dịch trước đã hoàn tất với ${failedIds.length} chương lỗi cần dịch lại.`, 'warn');
          }
        } else {
          addLog(`[Khôi phục] Phát hiện tiến trình dịch tự động chưa hoàn thành từ phiên trước (Chương ${Math.min(reconstructedQueue.length, currentIndex + 1)}/${reconstructedQueue.length}). Bạn có thể nhấn Tiếp tục để tiếp diễn.`, 'info');
        }
      }
    } else {
      setChaptersQueue([]);
      setCurrentChapterIndex(-1);
      setProcessedCount(0);
    }
  }, [activeProject.id]);

  useEffect(() => {
    paramsRef.current = {
      apiKeys,
      selectedModel,
      polishCycles,
      autoTranslateMode,
      additionalInstructions,
      isExtractionDuringTranslationEnabled,
      skipFailedChapters,
      enableAiQaCritique,
      enableSegmentTranslation
    };
  }, [apiKeys, selectedModel, polishCycles, autoTranslateMode, additionalInstructions, isExtractionDuringTranslationEnabled, skipFailedChapters]);

  const triggerExportDownload = useCallback(async () => {
    addLog("ĐANG TIẾN HÀNH XUẤT SAO LƯU DỰ ÁN DẠNG CẤU TRÚC (.JSON) VỀ MÁY...", "warn");
    try {
      const proj = projectRef.current;
      const fullChapters: Chapter[] = [];
      if (proj.chapters && Array.isArray(proj.chapters)) {
        for (const meta of proj.chapters) {
          const chap = await getChapterFromDB(meta.id);
          if (chap) {
            fullChapters.push(chap);
          }
        }
      }

      const projectWithFullChapters = {
        ...proj,
        chapters: fullChapters
      };

      const jsonString = JSON.stringify(projectWithFullChapters, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const cleanTitle = proj.title.replace(/[\s\/:*?"<>|]+/g, '_');
      triggerDownload(url, `DAT_AUTO_${cleanTitle}_${dateStr}_backup.json`);
      URL.revokeObjectURL(url);
      addLog("TẢI XUỐNG FILE .JSON BACKUP THÀNH CÔNG!", "success");
    } catch (e: any) {
      addLog(`Lỗi khi cố gắng tự động lưu xuống tệp JSON: ${e.message}`, 'error');
    }
  }, [addLog]);

  const prepareQueue = useCallback(() => {
    const chaps = projectRef.current.chapters || [];
    if (chaps.length === 0) {
      addLog("Bộ truyện không có chương nào để dịch. Hãy nạp file truyện trước.", "warn");
      return [];
    }

    let scopedChaps = chaps;
    if (rangeEnabled) {
      const startIdx = Math.max(0, rangeStart - 1);
      const endIdx = Math.min(chaps.length, rangeEnd);
      scopedChaps = chaps.slice(startIdx, endIdx);
      addLog(`Phạm vi giới hạn: thứ tự ${rangeStart} → ${rangeEnd} (${scopedChaps.length} chương)`, 'info');
    }

    if (paramsRef.current.autoTranslateMode === 'resume') {
      const queue = scopedChaps.filter(c => c.status !== 'completed');
      addLog(`Chế độ 'Tiếp tục dịch' (Resume): Tìm thấy ${queue.length}/${scopedChaps.length} chương cần dịch.`, 'info');
      return queue;
    } else {
      addLog(`Chế độ 'Dịch từ đầu': Nạp sẵn sàng toàn bộ ${scopedChaps.length} chương.`, 'info');
      return [...scopedChaps];
    }
  }, [rangeEnabled, rangeStart, rangeEnd, addLog]);

  // ── HÀM DỊCH 1 CHƯƠNG (tách ra để dùng cho cả tuần tự lẫn song song) ──
  interface SingleChapterResult {
    success: boolean;
    chapterId: string;
    isOverload: boolean;
    newGlossaryItems: GlossaryItem[];
    newPendingItems: PendingGlossaryItem[];
    updatedChapter: Chapter | null;
    lastKeyIndex: number;
  }

  const translateSingleChapter = useCallback(async (
    chapterMeta: ChapterMetadata,
    glossarySnapshot: GlossaryItem[],
    signal: AbortSignal,
    logPrefix: string,
    startKeyIndex: number,
    projState: { genre: string; tone: string; description: string }
  ): Promise<SingleChapterResult> => {
    const chapter = await getChapterFromDB(chapterMeta.id);
    if (!chapter) {
      addLog(`${logPrefix} Lỗi: Không tìm thấy dữ liệu của chương: ${chapterMeta.title}`, 'error');
      return { success: false, chapterId: chapterMeta.id, isOverload: false, newGlossaryItems: [], newPendingItems: [], updatedChapter: null, lastKeyIndex: startKeyIndex };
    }

    let currentKeyIndex = startKeyIndex;
    let firstDraft = "";
    // Dùng glossary snapshot (frozen copy cho lô), thu thập items mới riêng
    let localGlossary = [...glossarySnapshot];
    const newGlossaryItems: GlossaryItem[] = [];
    const newPendingItems: PendingGlossaryItem[] = [];

    const existingTranslation = (chapter.polishedTranslation || chapter.rawTranslation || "").trim();
    const hasExistingTranslation = existingTranslation.length > 0;
    const hasProcessedText = !!(chapter.processedSourceText && chapter.processedSourceText.trim());

    // ── GIAI ĐOẠN 1: Dịch thô ──
    if (paramsRef.current.autoTranslateMode === 'from_scratch' && hasExistingTranslation) {
      addLog(`${logPrefix} [Dịch từ đầu] Phát hiện bản dịch khả dụng. Tiến hành chuốt văn luôn (Bỏ qua Giai đoạn 1)...`, "success");
      firstDraft = existingTranslation;
    } else {
      addLog(`${logPrefix} Đang gọi API dịch thô (Giai đoạn 1)...${hasProcessedText ? " (Sử dụng văn bản đã quét từ điển, không gửi kèm glossary)" : ""}`, "gemini");
      const rawRes = await apiFetch('/api/translate-raw', {
        method: 'POST',
        body: JSON.stringify({
          text: hasProcessedText ? chapter.processedSourceText : chapter.sourceText,
          genre: projState.genre,
          tone: projState.tone,
          description: projState.description,
          glossary: hasProcessedText ? [] : glossarySnapshot,
          apiKeys: paramsRef.current.apiKeys,
          model: paramsRef.current.selectedModel,
          startKeyIndex: currentKeyIndex,
          sourceChapterId: chapter.id,
          enableSegmentTranslation: paramsRef.current.enableSegmentTranslation
        }),
        signal
      });

      if (!rawRes.ok) {
        const errData = await rawRes.json().catch(() => ({ error: 'Lỗi không xác định' }));
        const isOverload = errData.errorType === 'overload';
        throw Object.assign(new Error(errData.error || "Lỗi dịch thô từ hệ thống AI."), { isOverload });
      }

      const rawData = await rawRes.json();
      firstDraft = rawData.rawTranslation || "";
      if (typeof rawData.successKeyIndex === 'number') {
        currentKeyIndex = rawData.successKeyIndex;
      }
      addLog(`${logPrefix} Đã hoàn thành biểu mẫu dịch thô GĐ1.`, "success");

      // Trích xuất entity mới (thu thập riêng, KHÔNG merge vào glossarySnapshot)
      if (paramsRef.current.isExtractionDuringTranslationEnabled && rawData.discoveredEntities && Array.isArray(rawData.discoveredEntities) && rawData.discoveredEntities.length > 0) {
        rawData.discoveredEntities.forEach((ent: any) => {
          if (!ent.chinese || !ent.vietnamese) return;

          const cleanChinese = ent.chinese.replace(/\s+/g, '').trim();
          const cleanVietnamese = ent.vietnamese.trim();
          const cleanPinyin = (ent.pinyin || '').trim();
          const cleanNote = (ent.note || '').trim();

          const matchedByCn = localGlossary.find((gItem) => isHanEquivalent(gItem.chinese, ent.chinese));
          const matchedByVi = localGlossary.find((gItem) => gItem.vietnamese.trim().toLowerCase() === cleanVietnamese.toLowerCase());

          const rawChinese = ent.chinese.trim();
          const originParagraph = chapter.sourceText.split('\n').find(p =>
              p.includes(rawChinese) || p.replace(/\s+/g, '').includes(cleanChinese)
          )?.trim() || "";

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
              createdAt: new Date().toISOString()
            };
            newGlossaryItems.push(itemPayload);
            localGlossary.push(itemPayload); // Dedup nội bộ chương này
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
              sourceChapterId: chapter.id
            });
          }
        });
      }
    }

    // ── GIAI ĐOẠN 2: Chuốt văn phong ──
    let currentTextToPolish = firstDraft;
    addLog(`${logPrefix} Kích hoạt chu trình mài giũa văn phong (${paramsRef.current.polishCycles} lượt)...`, 'info');
    for (let j = 1; j <= paramsRef.current.polishCycles; j++) {
      // Rà soát từ điển bổ sung chỉ chạy ở lượt polish ĐẦU TIÊN vì sourceText
      // không đổi giữa các lượt — tránh gọi Gemini API thừa mỗi vòng lặp.
      const shouldExtract = paramsRef.current.isExtractionDuringTranslationEnabled && j === 1;
      if (j === 1 && paramsRef.current.isExtractionDuringTranslationEnabled) {
        addLog(`${logPrefix} [Rà soát từ điển] Kích hoạt rà soát thuật ngữ bị sót (chỉ chạy 1 lần/chương tại lượt polish đầu tiên).`, 'info');
      }
      addLog(`${logPrefix} Biên tập chuốt chữ Lần ${j}/${paramsRef.current.polishCycles}...${hasProcessedText ? " (Sử dụng văn bản đã quét từ điển, không gửi kèm glossary)" : ""}`, "gemini");
      const polishRes = await apiFetch('/api/polish-translation', {
        method: 'POST',
        body: JSON.stringify({
          sourceText: hasProcessedText ? chapter.processedSourceText : chapter.sourceText,
          rawTranslation: currentTextToPolish,
          genre: projState.genre,
          tone: projState.tone,
          description: projState.description,
          glossary: hasProcessedText ? [] : localGlossary,
          additionalInstructions: paramsRef.current.additionalInstructions || "Hãy tối ưu ngữ điệu mượt mà, bay bổng nhất có thể.",
          apiKeys: paramsRef.current.apiKeys,
          model: paramsRef.current.selectedModel,
          startKeyIndex: currentKeyIndex,
          isExtractionEnabled: shouldExtract,
          sourceChapterId: chapter.id,
          enableSegmentTranslation: paramsRef.current.enableSegmentTranslation
        }),

        signal
      });

      if (!polishRes.ok) {
        const errData = await polishRes.json().catch(() => ({ error: 'Lỗi không xác định' }));
        const isOverload = errData.errorType === 'overload';
        throw Object.assign(new Error(`${logPrefix} Thất bại tại vòng biên tập thứ ${j}: ` + (errData.error || "Lỗi không xác định")), { isOverload });
      }

      const polishData = await polishRes.json();
      currentTextToPolish = polishData.polishedTranslation || currentTextToPolish;
      if (typeof polishData.successKeyIndex === 'number') {
        currentKeyIndex = polishData.successKeyIndex;
      }
      addLog(`${logPrefix} Hoàn tất chuốt mịn lượt thứ ${j}!`, 'success');
    }

    // ── GIAI ĐOẠN 3: Kiểm duyệt chất lượng AI (Critique Phase) ──
    if (paramsRef.current.enableAiQaCritique) {
      addLog(`${logPrefix} [Kiểm duyệt AI] Bắt đầu rà soát thẩm định chất lượng bản dịch...`, 'info');
      try {
        const qaRes = await apiFetch('/api/qa-critique', {
          method: 'POST',
          body: JSON.stringify({
            sourceText: chapter.sourceText,
            translatedText: currentTextToPolish,
            apiKeys: paramsRef.current.apiKeys,
            model: paramsRef.current.selectedModel,
            startKeyIndex: currentKeyIndex
          }),
          signal
        });
        if (qaRes.ok) {
          const qaData = await qaRes.json();
          if (qaData.isValid) {
            addLog(`${logPrefix} [Kiểm duyệt AI] Đạt chuẩn! Không phát hiện lỗi bỏ sót, thêm thắt hoặc lặp lại.`, 'success');
          } else {
            addLog(`${logPrefix} [Kiểm duyệt AI] Phát hiện ${qaData.issues.length} vấn đề kiểm duyệt:`, 'warn');
            qaData.issues.forEach((issue: any) => {
              addLog(`- [${issue.type.toUpperCase()}] (${issue.severity}): ${issue.description}`, 'warn');
            });
          }
          if (typeof qaData.successKeyIndex === 'number') {
            currentKeyIndex = qaData.successKeyIndex;
          }
        } else {
          addLog(`${logPrefix} [Kiểm duyệt AI] Lỗi hệ thống kiểm duyệt, tiếp tục tiến trình...`, 'warn');
        }
      } catch (qaErr: any) {
        addLog(`${logPrefix} [Kiểm duyệt AI] Lỗi gọi API QA Critique: ${qaErr.message || qaErr}`, 'warn');
      }
    }

    // ── Lưu kết quả ──
    const paragraphs = chapter.sourceText.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
    const translatedLines = currentTextToPolish
      ? currentTextToPolish.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0)
      : firstDraft.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);

    const updatedFullChapter: Chapter = {
      ...chapter,
      rawTranslation: firstDraft,
      polishedTranslation: currentTextToPolish,
      paragraphs,
      translatedLines,
      status: 'completed',
      updatedAt: new Date().toISOString()
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
      lastKeyIndex: currentKeyIndex
    };
  }, [addLog]);

  // ── VÒNG LẶP DỊCH CHÍNH (batch mode) ──
  const runTranslationLoop = useCallback(async (queue: ChapterMetadata[], startIndex: number) => {
    setIsProcessing(true);
    isPauseRequestedRef.current = false;

    if (!bufferedProjectRef.current) {
      bufferedProjectRef.current = { ...projectRef.current };
    }

    // Adaptive concurrency: bắt đầu từ giá trị người dùng chọn
    let effectiveConcurrency = concurrency;

    let i = startIndex;
    while (i < queue.length) {
      if (isPauseRequestedRef.current) break;

      // ── Cắt batch ──
      const batchSize = Math.min(effectiveConcurrency, queue.length - i);
      const batch = queue.slice(i, i + batchSize);

      setCurrentChapterIndex(i);

      // ── Snapshot glossary cho lô này ──
      const glossarySnapshot = [...bufferedProjectRef.current!.glossary];
      const projState = {
        genre: bufferedProjectRef.current!.genre,
        tone: bufferedProjectRef.current!.tone,
        description: bufferedProjectRef.current!.description
      };

      // ── Stagger API key cho từng chương trong lô ──
      const baseKeyIndex = currentApiKeyIndexRef.current;
      const keyCount = paramsRef.current.apiKeys?.length || 1;

      // ── Tạo AbortController cho từng chương ──
      const batchControllers = new Map<string, AbortController>();
      batch.forEach(chap => {
        const ctrl = new AbortController();
        batchControllers.set(chap.id, ctrl);
        activeAbortControllersRef.current.set(chap.id, ctrl);
      });

      if (batchSize > 1) {
        addLog(`══════════════════════════════════════════════════`, 'info');
        addLog(`Bắt đầu lô ${Math.floor(i / effectiveConcurrency) + 1}: Chương ${i + 1}–${i + batchSize} / tổng ${queue.length} (song song ${batchSize} luồng, effectiveConcurrency=${effectiveConcurrency})`, 'info');
      }

      // ── Chạy batch ──
      type BatchResult = { result: SingleChapterResult } | { error: any; chapterId: string };
      let batchResults: BatchResult[];

      if (effectiveConcurrency <= 1) {
        // ═══ CHẾ ĐỘ TUẦN TỰ (concurrency=1): hành vi 100% giống code cũ ═══
        const chapterMeta = batch[0];
        const controller = batchControllers.get(chapterMeta.id)!;
        currentAbortControllerRef.current = controller;

        const logPrefix = batchSize > 1 ? `[${chapterMeta.title}]` : '';
        addLog(`--------------------------------------------------`, 'info');
        addLog(`${logPrefix} Xử lý [${i + 1}/${queue.length}]: ${chapterMeta.title} | Key xoay vòng: #${baseKeyIndex + 1}`, 'info');

        try {
          const result = await translateSingleChapter(
            chapterMeta, glossarySnapshot, controller.signal, logPrefix, baseKeyIndex, projState
          );
          batchResults = [{ result }];
        } catch (err: any) {
          // AbortError → break toàn bộ loop
          if (err.name === 'AbortError' || (err instanceof DOMException && err.name === 'AbortError')) {
            addLog("Đã hủy yêu cầu đang xử lý theo lệnh dừng của người dùng", "warn");
            // Cleanup controllers
            batchControllers.forEach((_, id) => activeAbortControllersRef.current.delete(id));
            currentAbortControllerRef.current = null;
            break;
          }
          batchResults = [{ error: err, chapterId: chapterMeta.id }];
        } finally {
          activeAbortControllersRef.current.delete(chapterMeta.id);
          if (currentAbortControllerRef.current === controller) {
            currentAbortControllerRef.current = null;
          }
        }
      } else {
        // ═══ CHẾ ĐỘ SONG SONG (concurrency>1): Promise.allSettled ═══
        const settled = await Promise.allSettled(
          batch.map((chap, batchIdx) => {
            const logPrefix = `[${chap.title}]`;
            const keyIdx = (baseKeyIndex + batchIdx) % keyCount;
            const ctrl = batchControllers.get(chap.id)!;

            addLog(`${logPrefix} Xử lý [${i + batchIdx + 1}/${queue.length}]: ${chap.title} | Key xoay vòng: #${keyIdx + 1}`, 'info');

            return translateSingleChapter(chap, glossarySnapshot, ctrl.signal, logPrefix, keyIdx, projState);
          })
        );

        batchResults = settled.map((s, idx) => {
          if (s.status === 'fulfilled') return { result: s.value };
          return { error: s.reason, chapterId: batch[idx].id };
        });

        // Cleanup controllers
        batchControllers.forEach((_, id) => activeAbortControllersRef.current.delete(id));
      }

      // ── XỬ LÝ KẾT QUẢ LÔ ──
      let batchOverloadCount = 0;
      let batchSuccessCount = 0;
      let lastSuccessKeyIndex = baseKeyIndex;
      const batchNewGlossary: GlossaryItem[] = [];
      const batchNewPending: PendingGlossaryItem[] = [];
      const batchFailedIds: string[] = [];
      let allKeysExhausted = false;
      let hasAbort = false;

      // Xử lý theo thứ tự chương trong lô (quan trọng cho dedup glossary)
      for (const br of batchResults) {
        if ('result' in br) {
          const r = br.result;
          if (r.success) {
            batchSuccessCount++;
            lastSuccessKeyIndex = r.lastKeyIndex;

            // Gộp glossary mới (dedup với cả glossary snapshot + items đã gộp từ chương trước trong lô)
            const mergedSoFar = [...glossarySnapshot, ...batchNewGlossary];
            for (const item of r.newGlossaryItems) {
              const dupCn = mergedSoFar.find(g => isHanEquivalent(g.chinese, item.chinese));
              const dupVi = mergedSoFar.find(g => g.vietnamese.trim().toLowerCase() === item.vietnamese.trim().toLowerCase());
              if (!dupCn && !dupVi) {
                batchNewGlossary.push(item);
                mergedSoFar.push(item);
              }
            }
            batchNewPending.push(...r.newPendingItems);

            // Cập nhật status chương
            bufferedProjectRef.current = {
              ...bufferedProjectRef.current!,
              chapters: bufferedProjectRef.current!.chapters.map(c =>
                c.id === r.chapterId ? { ...c, status: 'completed' as const, updatedAt: new Date().toISOString() } : c
              )
            };
          } else {
            // translateSingleChapter trả success=false (getChapterFromDB failed)
            batchFailedIds.push(r.chapterId);
          }
        } else {
          // Error case
          const err = br.error;
          const errMsg: string = err?.message || String(err);
          const chapterId = br.chapterId;
          const chapTitle = batch.find(b => b.id === chapterId)?.title || chapterId;

          if (err?.name === 'AbortError' || (err instanceof DOMException && err?.name === 'AbortError')) {
            hasAbort = true;
            continue;
          }

          if (errMsg.startsWith("ALL_KEYS_EXHAUSTED")) {
            allKeysExhausted = true;
            continue;
          }

          const isOverload = !!(err as any)?.isOverload;
          if (isOverload) {
            batchOverloadCount++;
            addLog(`⚡ Chương "${chapTitle}" lỗi tạm thời do model quá tải (có thể dịch lại ngay sẽ thành công).`, 'warn');
          } else {
            addLog(`Lỗi xử lý chương "${chapTitle}": ${errMsg}`, 'error');
          }

          if (paramsRef.current.skipFailedChapters) {
            addLog(`Bỏ qua chương "${chapTitle}" lỗi và tiếp tục...`, 'warn');
            batchFailedIds.push(chapterId);
          } else {
            // Không skip → dừng toàn bộ
            batchFailedIds.push(chapterId);
            if (bufferedProjectRef.current) {
              onUpdateProject({ ...bufferedProjectRef.current });
              bufferedProjectRef.current = null;
            }
            setIsProcessing(false);
            return;
          }
        }
      }

      // ── Gộp glossary mới vào state chính SAU KHI cả lô xong ──
      if (batchNewGlossary.length > 0) {
        addLog(`Trích xuất sỉ thành công ${batchNewGlossary.length} thuật ngữ mới sạch kèm nguồn gốc vào bộ quy tắc gối đầu.`, 'success');
        setAutoDiscoveredBatch((prev) => [...prev, ...batchNewGlossary]);
        bufferedProjectRef.current = {
          ...bufferedProjectRef.current!,
          glossary: [...bufferedProjectRef.current!.glossary, ...batchNewGlossary]
        };
      }
      if (batchNewPending.length > 0) {
        addLog(`Phát hiện và đẩy sỉ ${batchNewPending.length} từ trùng/xung đột vào hàng chờ kiểm duyệt.`, 'warn');
        bufferedProjectRef.current = {
          ...bufferedProjectRef.current!,
          pendingGlossary: [...(bufferedProjectRef.current!.pendingGlossary || []), ...batchNewPending]
        };
      }

      // ── Cập nhật key index ──
      currentApiKeyIndexRef.current = lastSuccessKeyIndex;

      // ── Cập nhật failedIds & queue state MỘT LẦN cho cả lô ──
      const existingFailedIds: string[] = bufferedProjectRef.current?.translationQueueState?.failedIds || [];
      const allFailedIds: string[] = [...existingFailedIds, ...batchFailedIds];
      const nextIndex = i + batchSize;
      const isQueueFinished = nextIndex >= queue.length;

      bufferedProjectRef.current = {
        ...bufferedProjectRef.current!,
        translationQueueState: (isQueueFinished && allFailedIds.length === 0) ? undefined : {
          queueIds: queue.map(c => c.id),
          currentIndex: isQueueFinished ? queue.length : nextIndex,
          mode: paramsRef.current.autoTranslateMode,
          skipFailedChapters: paramsRef.current.skipFailedChapters,
          failedIds: allFailedIds
        }
      };

      onUpdateProject({ ...bufferedProjectRef.current! });
      setProcessedCount((prev) => prev + batchSize);

      // ── Adaptive concurrency (chỉ khi concurrency > 1) ──
      if (concurrency > 1) {
        if (batchOverloadCount >= 1) {
          effectiveConcurrency = Math.max(1, Math.floor(effectiveConcurrency / 2));
          addLog(`⚠️ Phát hiện model quá tải (${batchOverloadCount} chương lỗi trong lô), tự động giảm số chương dịch song song xuống ${effectiveConcurrency} để tăng khả năng thành công.`, 'warn');
        } else if (batchSuccessCount === batchSize && effectiveConcurrency < concurrency) {
          effectiveConcurrency = Math.min(concurrency, effectiveConcurrency + 1);
          addLog(`✅ Model ổn định, tăng song song lên ${effectiveConcurrency}/${concurrency}.`, 'info');
        }
      }

      // ── Dừng nếu all keys exhausted hoặc abort ──
      if (allKeysExhausted) {
        addLog("⚠️ TẤT CẢ API KEY ĐÃ CẠN KIỆT HẠN MỨC QUOTA!", 'error');
        if (bufferedProjectRef.current) {
          onUpdateProject({ ...bufferedProjectRef.current });
          bufferedProjectRef.current = null;
        }
        triggerExportDownload();
        break;
      }
      if (hasAbort) {
        addLog("Đã hủy yêu cầu đang xử lý theo lệnh dừng của người dùng", "warn");
        break;
      }

      i += batchSize;
    }

    setIsProcessing(false);

    if (isPauseRequestedRef.current) {
      isPauseRequestedRef.current = false;
      addLog("Đã tạm dừng tiến trình dịch tự động an toàn.", "warn");
      if (bufferedProjectRef.current) {
        onUpdateProject({ ...bufferedProjectRef.current });
        bufferedProjectRef.current = null;
      }
    } else if (i >= queue.length) {
      const currentFailed = bufferedProjectRef.current?.translationQueueState?.failedIds || [];
      if (currentFailed.length > 0) {
        addLog(`TẤT CẢ CHƯƠNG TRONG HÀNG ĐỢI ĐÃ ĐƯỢC XỬ LÝ (Có ${currentFailed.length} chương lỗi).`, "warn");
      } else {
        addLog("TẤT CẢ CHƯƠNG TRONG HÀNG ĐỢI ĐÃ ĐƯỢC BIÊN DỊCH THÀNH CÔNG!", "success");
      }
      setCurrentChapterIndex(-1);
      if (bufferedProjectRef.current) {
        onUpdateProject({ ...bufferedProjectRef.current });
        bufferedProjectRef.current = null;
      }
      triggerExportDownload();
    }
  }, [currentApiKeyIndexRef, onUpdateProject, triggerExportDownload, addLog, setAutoDiscoveredBatch, translateSingleChapter, concurrency]);

  const handleToggleProcessing = useCallback(async () => {
    if (isProcessing) {
      isPauseRequestedRef.current = true;
      addLog("Đang yêu cầu tạm dừng tiến trình dịch... Vui lòng chờ kết thúc chương hiện tại.", "warn");
      return;
    }

    let queue = chaptersQueue;
    let startIdx = currentChapterIndex;
    const isResetRun = queue.length === 0 || processedCount >= queue.length;
    if (isResetRun) {
      const prepared = prepareQueue();
      if (prepared.length === 0) {
        showToast({ message: "Không tìm thấy chương truyện nào trong hàng đợi cần dịch thuật!", type: 'warning' });
        return;
      }
      queue = prepared;
      setChaptersQueue(prepared);
      startIdx = 0;
      setCurrentChapterIndex(0);
      setProcessedCount(0);
      setAutoDiscoveredBatch([]);
      setLogs([]);
      setProcessStartTime(Date.now());
      bufferedProjectRef.current = {
        ...projectRef.current,
        translationQueueState: {
          queueIds: prepared.map(c => c.id),
          currentIndex: 0,
          mode: paramsRef.current.autoTranslateMode,
          skipFailedChapters: paramsRef.current.skipFailedChapters,
          failedIds: []
        }
      };
      onUpdateProject({ ...bufferedProjectRef.current });
    } else {
      if (startIdx < 0) startIdx = 0;
      if (!processStartTime) setProcessStartTime(Date.now());
      if (!bufferedProjectRef.current) bufferedProjectRef.current = { ...projectRef.current };
    }

    addLog(`BẮT ĐẦU TIẾN TRÌNH DỊCH TỰ ĐỘNG | Mô hình gốc: '${selectedModel}'`, 'success');
    runTranslationLoop(queue, startIdx);
  }, [isProcessing, chaptersQueue, processedCount, currentChapterIndex, prepareQueue, setAutoDiscoveredBatch, setLogs, processStartTime, selectedModel, addLog, runTranslationLoop]);

  const handleStopTranslation = useCallback(() => {
    isPauseRequestedRef.current = true;
    setIsProcessing(false);
    addLog("ĐÃ YÊU CẦU: Dừng tiến trình dịch tự động ngay lập tức!", "warn");

    // Abort ongoing translation requests immediately
    currentAbortControllerRef.current?.abort();
    activeAbortControllersRef.current.forEach((ctrl) => ctrl.abort());
    activeAbortControllersRef.current.clear();

    addLog("Hệ thống lưu trữ khẩn cấp dữ liệu từ bộ đệm vào IndexedDB...", 'info');
    if (bufferedProjectRef.current) {
      onUpdateProject({ ...bufferedProjectRef.current });
      bufferedProjectRef.current = null;
    }
    triggerExportDownload();
  }, [onUpdateProject, triggerExportDownload, addLog]);

  const handleResetQueue = useCallback(() => {
    setIsProcessing(false);
    isPauseRequestedRef.current = false;
    setCurrentChapterIndex(-1);
    setChaptersQueue([]);
    setProcessedCount(0);
    setAutoDiscoveredBatch([]);
    setLogs([]);
    currentApiKeyIndexRef.current = 0;
    bufferedProjectRef.current = null;

    const updated = {
      ...projectRef.current,
      translationQueueState: undefined
    };
    onUpdateProject(updated);

    addLog("Đã reset trạng thái dịch tự động và cấu hình luân chuyển key.", "info");
  }, [onUpdateProject, setAutoDiscoveredBatch, setLogs, currentApiKeyIndexRef, addLog]);

  // Dự toán thời gian còn lại
  const remainingChapters = Math.max(0, chaptersQueue.length - processedCount);
  useEffect(() => {
    if (!isProcessing) {
      setEstTimeStr(chaptersQueue.length > 0 && processedCount >= chaptersQueue.length ? 'Đã hoàn thành!' : '--');
      return;
    }
    if (processedCount === 0 || !processStartTime) {
      const secsNeeded = remainingChapters * 25;
      const mins = Math.floor(secsNeeded / 60);
      setEstTimeStr(mins > 0 ? `~${mins} phút ${secsNeeded % 60} giây` : `~${secsNeeded % 60} giây`);
      return;
    }

    const elapsedMs = Date.now() - processStartTime;
    const estSecsNeeded = Math.round(((elapsedMs / processedCount) * remainingChapters) / 1000);
    if (estSecsNeeded <= 0) {
      setEstTimeStr('Sắp xong...');
    } else {
      const mins = Math.floor(estSecsNeeded / 60);
      setEstTimeStr(mins > 0 ? `~${mins} phút ${estSecsNeeded % 60} giây` : `~${estSecsNeeded % 60} giây`);
    }
  }, [isProcessing, processedCount, remainingChapters, processStartTime, chaptersQueue.length]);

  const handleRetryFailedChapters = useCallback(() => {
    const failedIds = projectRef.current.translationQueueState?.failedIds || [];
    if (failedIds.length === 0) return;

    const chaps = projectRef.current.chapters || [];
    const failedChaps = chaps.filter(c => failedIds.includes(c.id));
    if (failedChaps.length === 0) {
      addLog("Không tìm thấy chương lỗi nào trong dự án.", "warn");
      return;
    }

    addLog(`Chuẩn bị dịch lại ${failedChaps.length} chương lỗi...`, 'info');
    
    setChaptersQueue(failedChaps);
    setCurrentChapterIndex(0);
    setProcessedCount(0);
    setProcessStartTime(Date.now());
    setAutoDiscoveredBatch([]);
    setLogs([]);

    bufferedProjectRef.current = {
      ...projectRef.current,
      translationQueueState: {
        queueIds: failedChaps.map(c => c.id),
        currentIndex: 0,
        mode: paramsRef.current.autoTranslateMode,
        skipFailedChapters: paramsRef.current.skipFailedChapters,
        failedIds: [] // reset failedIds for the retry queue run
      }
    };

    onUpdateProject({ ...bufferedProjectRef.current });

    addLog(`BẮT ĐẦU DỊCH LẠI CÁC CHƯƠNG LỖI | Mô hình: '${selectedModel}'`, 'success');
    runTranslationLoop(failedChaps, 0);
  }, [runTranslationLoop, onUpdateProject, selectedModel, addLog, setAutoDiscoveredBatch, setLogs]);

  return {
    isProcessing,
    setIsProcessing,
    currentChapterIndex,
    setCurrentChapterIndex,
    chaptersQueue,
    setChaptersQueue,
    processedCount,
    setProcessedCount,
    estTimeStr,
    handleToggleProcessing,
    handleStopTranslation,
    handleResetQueue,
    triggerExportDownload,
    handleRetryFailedChapters,
  };
}
