import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StoryProject, Chapter, ChapterMetadata, GlossaryItem, PendingGlossaryItem } from '../types';
import { getChapterFromDB, saveChapterToDB } from '../services/db';
import { LogEntry } from './useAutoTranslationQueue';
import { triggerDownload } from '../utils/download';
import { useNotifications } from '../components/NotificationSystem';
import { isHanEquivalent } from '../utils/sinoNormalize';

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
    skipFailedChapters
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
      skipFailedChapters
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

  const runTranslationLoop = useCallback(async (queue: ChapterMetadata[], startIndex: number) => {
    setIsProcessing(true);
    isPauseRequestedRef.current = false;

    if (!bufferedProjectRef.current) {
      bufferedProjectRef.current = { ...projectRef.current };
    }

    let i = startIndex;
    for (; i < queue.length; i++) {
      if (isPauseRequestedRef.current) {
        break;
      }

      setCurrentChapterIndex(i);

      const chapterMeta = queue[i];
      const chapter = await getChapterFromDB(chapterMeta.id);
      if (!chapter) {
        addLog(`Lỗi: Không tìm thấy dữ liệu của chương: ${chapterMeta.title}`, 'error');
        break;
      }

      addLog(`--------------------------------------------------`, 'info');
      addLog(`Xử lý [${i + 1}/${queue.length}]: ${chapter.title} | Key xoay vòng: #${currentApiKeyIndexRef.current + 1}`, 'info');

      const controller = new AbortController();
      currentAbortControllerRef.current = controller;
      activeAbortControllersRef.current.set(chapterMeta.id, controller);

      try {
        const currentProjState = bufferedProjectRef.current;
        let firstDraft = "";
        let updatedGlossary = [...currentProjState.glossary];
        const existingTranslation = (chapter.polishedTranslation || chapter.rawTranslation || "").trim();
        const hasExistingTranslation = existingTranslation.length > 0;
        const hasProcessedText = !!(chapter.processedSourceText && chapter.processedSourceText.trim());

        if (paramsRef.current.autoTranslateMode === 'from_scratch' && hasExistingTranslation) {
          addLog(`[Dịch từ đầu] Phát hiện bản dịch khả dụng. Tiến hành chuốt văn luôn (Bỏ qua Giai đoạn 1)...`, "success");
          firstDraft = existingTranslation;
        } else {
          addLog(`Đang gọi API dịch thô (Giai đoạn 1)...${hasProcessedText ? " (Sử dụng văn bản đã quét từ điển, không gửi kèm glossary)" : ""}`, "gemini");
          const rawRes = await fetch('/api/translate-raw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: hasProcessedText ? chapter.processedSourceText : chapter.sourceText,
              genre: currentProjState.genre,
              tone: currentProjState.tone,
              description: currentProjState.description,
              glossary: hasProcessedText ? [] : currentProjState.glossary,
              apiKeys: paramsRef.current.apiKeys,
              model: paramsRef.current.selectedModel,
              startKeyIndex: currentApiKeyIndexRef.current
            }),
            signal: controller.signal
          });

          if (!rawRes.ok) {
            const errData = await rawRes.json();
            throw new Error(errData.error || "Lỗi dịch thô từ hệ thống AI.");
          }

          const rawData = await rawRes.json();
          firstDraft = rawData.rawTranslation || "";
          if (typeof rawData.successKeyIndex === 'number') {
            currentApiKeyIndexRef.current = rawData.successKeyIndex;
          }
          addLog("Đã hoàn thành biểu mẫu dịch thô GĐ1.", "success");

          if (paramsRef.current.isExtractionDuringTranslationEnabled && rawData.discoveredEntities && Array.isArray(rawData.discoveredEntities) && rawData.discoveredEntities.length > 0) {
            const bulkNewGlossary: GlossaryItem[] = [];
            const bulkPendingGlossary: PendingGlossaryItem[] = [];

            rawData.discoveredEntities.forEach((ent: any) => {
              if (!ent.chinese || !ent.vietnamese) return;

              const cleanChinese = ent.chinese.replace(/\s+/g, '').trim();
              const cleanVietnamese = ent.vietnamese.trim();
              const cleanPinyin = (ent.pinyin || '').trim();
              const cleanNote = (ent.note || '').trim();

              const matchedByCn = updatedGlossary.find((gItem) => isHanEquivalent(gItem.chinese, ent.chinese));
              const matchedByVi = updatedGlossary.find((gItem) => gItem.vietnamese.trim().toLowerCase() === cleanVietnamese.toLowerCase());

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
                  origin: 'scanned',
                  createdAt: new Date().toISOString()
                };
                bulkNewGlossary.push(itemPayload);
                updatedGlossary.push(itemPayload);
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

                bulkPendingGlossary.push({
                  id: 'pend_auto_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                  chinese: cleanChinese,
                  pinyin: cleanPinyin,
                  vietnamese: cleanVietnamese,
                  type: ent.type || 'other',
                  note: cleanNote,
                  reason,
                  originalValue,
                  importedAt: new Date().toISOString(),
                  needsReview: !!ent.needsReview
                });
              }
            });

            if (bulkPendingGlossary.length > 0) {
              bufferedProjectRef.current = {
                ...bufferedProjectRef.current!,
                pendingGlossary: [...(bufferedProjectRef.current!.pendingGlossary || []), ...bulkPendingGlossary]
              };
              addLog(`Phát hiện và đẩy sỉ ${bulkPendingGlossary.length} từ trùng/xung đột vào hàng chờ kiểm duyệt.`, 'warn');
            }
            if (bulkNewGlossary.length > 0) {
              addLog(`Trích xuất sỉ thành công ${bulkNewGlossary.length} thuật ngữ mới sạch kèm nguồn gốc vào bộ quy tắc gối đầu.`, 'success');
              setAutoDiscoveredBatch((prev) => [...prev, ...bulkNewGlossary]);
              bufferedProjectRef.current = { ...bufferedProjectRef.current!, glossary: updatedGlossary };
            }
          }
        }

        let currentTextToPolish = firstDraft;
        addLog(`Kích hoạt chu trình mài giũa văn phong (${paramsRef.current.polishCycles} lượt)...`, 'info');
        for (let j = 1; j <= paramsRef.current.polishCycles; j++) {
          addLog(`Biên tập chuốt chữ Lần ${j}/${paramsRef.current.polishCycles}...${hasProcessedText ? " (Sử dụng văn bản đã quét từ điển, không gửi kèm glossary)" : ""}`, "gemini");
          const polishRes = await fetch('/api/polish-translation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceText: hasProcessedText ? chapter.processedSourceText : chapter.sourceText,
              rawTranslation: currentTextToPolish,
              genre: currentProjState.genre,
              tone: currentProjState.tone,
              description: currentProjState.description,
              glossary: hasProcessedText ? [] : updatedGlossary,
              additionalInstructions: paramsRef.current.additionalInstructions || "Hãy tối ưu ngữ điệu mượt mà, bay bổng nhất có thể.",
              apiKeys: paramsRef.current.apiKeys,
              model: paramsRef.current.selectedModel,
              startKeyIndex: currentApiKeyIndexRef.current,
              isExtractionEnabled: paramsRef.current.isExtractionDuringTranslationEnabled
            }),
            signal: controller.signal
          });

          if (!polishRes.ok) {
            const errData = await polishRes.json();
            throw new Error(`Thất bại tại vòng biên tập thứ ${j}: ` + (errData.error || "Lỗi không xác định"));
          }

          const polishData = await polishRes.json();
          currentTextToPolish = polishData.polishedTranslation || currentTextToPolish;
          if (typeof polishData.successKeyIndex === 'number') {
            currentApiKeyIndexRef.current = polishData.successKeyIndex;
          }
          addLog(`Hoàn tất chuốt mịn lượt thứ ${j}!`, 'success');
        }

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

        const updatedChaptersList = bufferedProjectRef.current!.chapters.map(c => {
          if (c.id === chapter.id) {
            return {
              ...c,
              status: 'completed' as const,
              updatedAt: new Date().toISOString()
            };
          }
          return c;
        });

        bufferedProjectRef.current = {
          ...bufferedProjectRef.current!,
          chapters: updatedChaptersList,
          glossary: updatedGlossary,
        };

        addLog(`Đã biên phiên dịch hoàn chỉnh chương: ${chapter.title}`, 'success');

        const nextIndex = i + 1;
        const isQueueFinished = nextIndex >= queue.length;
        const currentFailedIds = bufferedProjectRef.current?.translationQueueState?.failedIds || [];

        bufferedProjectRef.current = {
          ...bufferedProjectRef.current!,
          translationQueueState: (isQueueFinished && currentFailedIds.length === 0) ? undefined : {
            queueIds: queue.map(c => c.id),
            currentIndex: isQueueFinished ? queue.length : nextIndex,
            mode: paramsRef.current.autoTranslateMode,
            skipFailedChapters: paramsRef.current.skipFailedChapters,
            failedIds: currentFailedIds
          }
        };

        onUpdateProject({ ...bufferedProjectRef.current! });
        setProcessedCount((prev) => prev + 1);

      } catch (err: any) {
        console.error(err);
        const errMsg: string = err.message || String(err);

        if (err.name === 'AbortError' || (err instanceof DOMException && err.name === 'AbortError')) {
          addLog("Đã hủy yêu cầu đang xử lý theo lệnh dừng của người dùng", "warn");
          break;
        }

        if (errMsg.startsWith("ALL_KEYS_EXHAUSTED")) {
          addLog("⚠️ TẤT CẢ API KEY ĐÃ CẠN KIỆT HẠN MỨC QUOTA!", 'error');
          if (bufferedProjectRef.current) {
            onUpdateProject({ ...bufferedProjectRef.current });
            bufferedProjectRef.current = null;
          }
          triggerExportDownload();
          break;
        }

        addLog(`Lỗi xử lý chương "${chapter.title}": ${errMsg}`, 'error');

        if (paramsRef.current.skipFailedChapters) {
          addLog(`Bỏ qua chương "${chapter.title}" lỗi và tiếp tục dịch chương sau...`, 'warn');
          
          const currentFailedIds = [
            ...(bufferedProjectRef.current?.translationQueueState?.failedIds || []),
            chapter.id
          ];

          const nextIndex = i + 1;
          const isQueueFinished = nextIndex >= queue.length;

          bufferedProjectRef.current = {
            ...bufferedProjectRef.current!,
            translationQueueState: (isQueueFinished && currentFailedIds.length === 0) ? undefined : {
              queueIds: queue.map(c => c.id),
              currentIndex: isQueueFinished ? queue.length : nextIndex,
              mode: paramsRef.current.autoTranslateMode,
              skipFailedChapters: paramsRef.current.skipFailedChapters,
              failedIds: currentFailedIds
            }
          };

          onUpdateProject({ ...bufferedProjectRef.current! });
          setProcessedCount((prev) => prev + 1);
          continue;
        } else {
          if (bufferedProjectRef.current) {
            onUpdateProject({ ...bufferedProjectRef.current });
            bufferedProjectRef.current = null;
          }
          break;
        }
      } finally {
        activeAbortControllersRef.current.delete(chapterMeta.id);
        if (currentAbortControllerRef.current === controller) {
          currentAbortControllerRef.current = null;
        }
      }
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
  }, [currentApiKeyIndexRef, onUpdateProject, triggerExportDownload, addLog, setAutoDiscoveredBatch]);

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
