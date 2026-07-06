import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StoryProject, GlossaryItem, PendingGlossaryItem } from '../types';
import { getChapterFromDB, getChaptersByProjectFromDB } from '../services/db';
import { LogEntry } from './useAutoTranslationQueue';
import { useNotifications } from '../components/NotificationSystem';
import { isHanEquivalent } from '@shared/sinoNormalize';

export interface UseGlossaryScanProps {
  activeProject: StoryProject;
  onUpdateProject: (updated: StoryProject) => void;
  apiKeys: string[];
  selectedModel: string;
  extractionLoops: number;
  scanRangeEnabled: boolean;
  scanRangeStart: number;
  scanRangeEnd: number;

  // Shared ref and state updaters
  currentApiKeyIndexRef: React.MutableRefObject<number>;
  addLog: (message: string, type?: LogEntry['type']) => void;
  setAutoDiscoveredBatch: React.Dispatch<React.SetStateAction<GlossaryItem[]>>;
}

export function useGlossaryScan({
  activeProject,
  onUpdateProject,
  apiKeys,
  selectedModel,
  extractionLoops,
  scanRangeEnabled,
  scanRangeStart,
  scanRangeEnd,
  currentApiKeyIndexRef,
  addLog,
  setAutoDiscoveredBatch,
}: UseGlossaryScanProps) {
  const { showToast } = useNotifications();
  const [isScanningGlossary, setIsScanningGlossary] = useState<boolean>(false);
  const [scanningProgress, setScanningProgress] = useState<number>(0);
  const [currentExtractionLoop, setCurrentExtractionLoop] = useState<number>(1);
  const [currentScanningChapterTitle, setCurrentScanningChapterTitle] = useState<string>('');
  const [currentScanningChapterIndex, setCurrentScanningChapterIndex] = useState<number>(0);
  const [totalScanChapters, setTotalScanChapters] = useState<number>(0);
  const [scanFoundCount, setScanFoundCount] = useState<number>(0);

  const projectRef = useRef<StoryProject>(activeProject);
  const isStopScanRequestedRef = useRef<boolean>(false);

  useEffect(() => {
    projectRef.current = activeProject;
  }, [activeProject]);

  const handleAutoExtractGlossary = useCallback(async () => {
    if (isScanningGlossary) {
      isStopScanRequestedRef.current = true;
      addLog("ĐANG YÊU CẦU DỪNG QUÉT... Vui lòng chờ kết thúc chương hiện tại.", "warn");
      return;
    }

    const chaps = projectRef.current.chapters || [];
    if (chaps.length === 0) {
      showToast({ message: "Bộ truyện không có chương nào để lọc!", type: 'warning' });
      return;
    }

    let scopedChaps = chaps;
    if (scanRangeEnabled) {
      const startIdx = Math.max(0, scanRangeStart - 1);
      const endIdx = Math.min(chaps.length, scanRangeEnd);
      scopedChaps = chaps.slice(startIdx, endIdx);
    }

    setIsScanningGlossary(true);
    isStopScanRequestedRef.current = false;
    setScanningProgress(0);
    setScanFoundCount(0);
    setCurrentScanningChapterIndex(0);
    setTotalScanChapters(scopedChaps.length);
    setCurrentScanningChapterTitle('');
    addLog(`=== KHỞI CHẠY QUÉT LỌC THUẬT NGỮ SỈ${scanRangeEnabled ? ` (Chương ${scanRangeStart}→${scanRangeEnd})` : ' TOÀN BỘ TRUYỆN'} ===`, 'success');

    try {
      const dbChapters = await getChaptersByProjectFromDB(projectRef.current.id);
      const chaptersMap = new Map(dbChapters.map(c => [c.id, c]));

      let updatedGlossary = [...projectRef.current.glossary];
      let chaptersProcessedSinceLastUpdate = 0;

      for (let loop = 1; loop <= extractionLoops; loop++) {
        if (isStopScanRequestedRef.current) break;
        setCurrentExtractionLoop(loop);

        for (let i = 0; i < scopedChaps.length; i++) {
          if (isStopScanRequestedRef.current) break;
          const chapMeta = scopedChaps[i];
          const chap = chaptersMap.get(chapMeta.id);
          if (!chap) continue;
          setCurrentScanningChapterIndex(i + 1);
          setCurrentScanningChapterTitle(chap.title);
          setScanningProgress(Math.round(((i + 1) / scopedChaps.length) * 100));
          addLog(`[Vòng ${loop}] Quét lọc Chương ${i + 1}/${scopedChaps.length}: ${chap.title}`, 'gemini');

          try {
            const response = await fetch('/api/analyze-glossary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: `${chap.title}\n\n${chap.sourceText}`,
                apiKeys,
                model: selectedModel,
                startKeyIndex: currentApiKeyIndexRef.current,
                sourceChapterId: chap.id
              }),
            });

            if (!response.ok) throw new Error("Gặp lỗi phản hồi trích xuất từ AI.");
            const data = await response.json();
            if (data.truncated) {
              showToast({
                message: `Lưu ý: Chỉ ${data.analyzedLength.toLocaleString()} / ${data.originalLength.toLocaleString()} ký tự đầu tiên của Chương ${i + 1} được phân tích để tối ưu hiệu suất.`,
                type: 'warning'
              });
            }
            if (data.partialFailure === true) {
              const successfulChunks = data.totalChunks - data.failedChunks.length;
              addLog(
                `Chương ${chap.title}: chỉ phân tích được ${successfulChunks}/${data.totalChunks} phần, các phần lỗi: ${data.failedChunks.join(', ')}`,
                'warn'
              );
            }
            if (typeof data.successKeyIndex === 'number') {
              currentApiKeyIndexRef.current = data.successKeyIndex;
            }

            const suggestions = data.suggestions || [];
            if (suggestions.length > 0) {
              const newlyDiscovered: GlossaryItem[] = [];
              const pendingDiscovered: PendingGlossaryItem[] = [];

              suggestions.forEach((ent: any) => {
                const chineseTrimmed = ent.chinese?.trim() || "";
                if (!chineseTrimmed) return;

                const exists = updatedGlossary.some((gItem) => isHanEquivalent(gItem.chinese, chineseTrimmed));
                const originParagraph = chap.sourceText.split('\n').find(p =>
                    p.includes(chineseTrimmed) || p.replace(/\s+/g, '').includes(chineseTrimmed.replace(/\s+/g, ''))
                )?.trim() || "";
                if (!exists) {
                  const itemPayload: GlossaryItem = {
                    id: 'glo_auto_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                    chinese: chineseTrimmed,
                    pinyin: (ent.pinyin || "").trim(),
                    vietnamese: (ent.vietnamese || "").trim(),
                    type: ent.type || "other",
                    note: (ent.note || "").trim(),
                    sourceChapter: chap.title,
                    sourceParagraph: originParagraph,
                    sourceChapterId: chap.id,
                    origin: 'scanned',
                    createdAt: new Date().toISOString(),
                    needsReview: ent.needsReview
                  };

                  if (ent.needsReview) {
                    const pendingPayload: PendingGlossaryItem = {
                      id: 'pend_auto_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                      chinese: chineseTrimmed,
                      pinyin: (ent.pinyin || "").trim(),
                      vietnamese: (ent.vietnamese || "").trim(),
                      type: ent.type || "other",
                      note: (ent.note || "").trim(),
                      reason: 'AI trích xuất nghi ngờ hallucinate',
                      originalValue: 'Không tìm thấy cụm từ này trong văn bản gốc của chương.',
                      importedAt: new Date().toISOString(),
                      needsReview: true,
                      sourceChapterId: chap.id
                    };
                    pendingDiscovered.push(pendingPayload);
                    addLog(`[Hallucinate] Phát hiện từ nghi ngờ AI nhận diện sai "${chineseTrimmed}" - Đã chuyển vào hàng chờ kiểm duyệt.`, 'warn');
                  } else {
                    newlyDiscovered.push(itemPayload);
                    updatedGlossary.push(itemPayload);
                  }
                }
              });

              if (newlyDiscovered.length > 0 || pendingDiscovered.length > 0) {
                if (newlyDiscovered.length > 0) {
                  addLog(`Phát hiện ${newlyDiscovered.length} thuật ngữ mới tại chương "${chap.title}"`, 'success');
                  setAutoDiscoveredBatch((prev) => [...prev, ...newlyDiscovered]);
                  setScanFoundCount((prev) => prev + newlyDiscovered.length);
                }
                if (pendingDiscovered.length > 0) {
                  projectRef.current.pendingGlossary = [...(projectRef.current.pendingGlossary || []), ...pendingDiscovered];
                }
              }
            }
          } catch (chapErr: any) {
            if (String(chapErr.message).startsWith("ALL_KEYS_EXHAUSTED")) {
              isStopScanRequestedRef.current = true;
              addLog("Dừng quét thuật ngữ do hệ thống Key hết hạn mức.", 'error');
              break;
            }
            addLog(`Bỏ qua lỗi tại chương [${chap.title}]: ${chapErr.message}`, 'error');
          }

          chaptersProcessedSinceLastUpdate++;
          if (chaptersProcessedSinceLastUpdate >= 10) {
            onUpdateProject({ ...projectRef.current, glossary: updatedGlossary });
            chaptersProcessedSinceLastUpdate = 0;
          }
        }
      }

      onUpdateProject({ ...projectRef.current, glossary: updatedGlossary });
      if (isStopScanRequestedRef.current) {
        addLog("=== TIẾN TRÌNH QUÉT LỌC TỰ ĐỘNG ĐÃ DỪNG THEO YÊU CẦU ===", 'warn');
      } else {
        addLog("=== ĐÃ HOÀN TẤT TOÀN BỘ QUY TRÌNH QUÉT LỌC TỰ ĐỘNG THÀNH CÔNG ===", 'success');
      }
    } catch (err: any) {
      addLog(`Lỗi hệ thống rà soát từ vựng sỉ: ${err.message}`, 'error');
    } finally {
      setIsScanningGlossary(false);
      isStopScanRequestedRef.current = false;
    }
  }, [isScanningGlossary, scanRangeEnabled, scanRangeStart, scanRangeEnd, extractionLoops, apiKeys, selectedModel, currentApiKeyIndexRef, onUpdateProject, addLog, setAutoDiscoveredBatch]);

  return {
    isScanningGlossary,
    scanningProgress,
    currentExtractionLoop,
    currentScanningChapterTitle,
    currentScanningChapterIndex,
    totalScanChapters,
    scanFoundCount,
    handleAutoExtractGlossary,
  };
}
