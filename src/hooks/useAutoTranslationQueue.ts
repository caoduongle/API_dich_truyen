import { useState, useEffect, useRef } from 'react';
import { StoryProject, Chapter, GlossaryItem, PendingGlossaryItem } from '../types';

export interface UseAutoTranslationQueueProps {
  activeProject: StoryProject;
  onUpdateProject: (updated: StoryProject) => void;
  apiKeys: string[];
  selectedModel: string;
  polishCycles: number;
  autoTranslateMode: 'resume' | 'from_scratch';
  additionalInstructions: string;
  isExtractionDuringTranslationEnabled: boolean;
  
  // Scopes and ranges
  rangeEnabled: boolean;
  rangeStart: number;
  rangeEnd: number;

  applyGlossaryRangeEnabled: boolean;
  applyGlossaryRangeStart: number;
  applyGlossaryRangeEnd: number;

  scanRangeEnabled: boolean;
  scanRangeStart: number;
  scanRangeEnd: number;
  extractionLoops: number;

  // Export configs
  chaptersPerFile: number;
  exportScope: 'all' | 'translated';
  exportMode: 'web' | 'audio' | 'align_jsonl';
}

export interface LogEntry {
  timestamp: string;
  type: 'info' | 'warn' | 'success' | 'error' | 'gemini';
  message: string;
}

export function useAutoTranslationQueue({
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
  applyGlossaryRangeEnabled,
  applyGlossaryRangeStart,
  applyGlossaryRangeEnd,
  scanRangeEnabled,
  scanRangeStart,
  scanRangeEnd,
  extractionLoops,
  chaptersPerFile,
  exportScope,
  exportMode,
}: UseAutoTranslationQueueProps) {
  // Trạng thái vận hành luồng dịch
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(-1);
  const [chaptersQueue, setChaptersQueue] = useState<Chapter[]>([]);
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoDiscoveredBatch, setAutoDiscoveredBatch] = useState<GlossaryItem[]>([]);

  // Floating drive widget states
  const [processStartTime, setProcessStartTime] = useState<number | null>(null);
  const [estTimeStr, setEstTimeStr] = useState<string>('Đang tính toán...');

  // States dành cho bộ lọc quét thuật ngữ sỉ
  const [isScanningGlossary, setIsScanningGlossary] = useState<boolean>(false);
  const [scanningProgress, setScanningProgress] = useState<number>(0);
  const [currentExtractionLoop, setCurrentExtractionLoop] = useState<number>(1);
  const [currentScanningChapterTitle, setCurrentScanningChapterTitle] = useState<string>('');
  const [currentScanningChapterIndex, setCurrentScanningChapterIndex] = useState<number>(0);
  const [totalScanChapters, setTotalScanChapters] = useState<number>(0);
  const [scanFoundCount, setScanFoundCount] = useState<number>(0);

  // Áp dụng từ điển vào sourceText gốc
  const [isApplyingGlossary, setIsApplyingGlossary] = useState<boolean>(false);
  const [applyGlossaryResult, setApplyGlossaryResult] = useState<{ replaced: number; chapters: number } | null>(null);

  // Cấu hình xuất tệp văn bản sạch
  const [isExportingTxt, setIsExportingTxt] = useState<boolean>(false);

  // Tham chiếu bền vững chống Stale Closure
  const projectRef = useRef<StoryProject>(activeProject);
  const isPauseRequestedRef = useRef<boolean>(false);
  const currentApiKeyIndexRef = useRef<number>(0);
  const bufferedProjectRef = useRef<StoryProject | null>(null);
  const isStopScanRequestedRef = useRef<boolean>(false);

  useEffect(() => {
    projectRef.current = activeProject;
  }, [activeProject]);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('vi-VN');
    setLogs((prev) => [...prev, { timestamp: time, type, message }]);
  };

  const prepareQueue = () => {
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

    if (autoTranslateMode === 'resume') {
      const queue = scopedChaps.filter(c => !c.polishedTranslation.trim() && !c.rawTranslation.trim());
      addLog(`Chế độ 'Tiếp tục dịch' (Resume): Tìm thấy ${queue.length}/${scopedChaps.length} chương cần dịch.`, 'info');
      return queue;
    } else {
      addLog(`Chế độ 'Dịch từ đầu': Nạp sẵn sàng toàn bộ ${scopedChaps.length} chương.`, 'info');
      return [...scopedChaps];
    }
  };

  const handleToggleProcessing = async () => {
    if (isProcessing) {
      isPauseRequestedRef.current = true;
      addLog("Đang yêu cầu tạm dừng tiến trình dịch... Vui lòng chờ kết thúc chương hiện tại.", "warn");
      return;
    }

    let queue = chaptersQueue;
    const isResetRun = queue.length === 0 || processedCount >= queue.length;
    if (isResetRun) {
      const prepared = prepareQueue();
      if (prepared.length === 0) {
        alert("Không tìm thấy chương truyện nào trong hàng đợi cần dịch thuật!");
        return;
      }
      queue = prepared;
      setChaptersQueue(prepared);
      setCurrentChapterIndex(0);
      setProcessedCount(0);
      setAutoDiscoveredBatch([]);
      setLogs([]);
      setProcessStartTime(Date.now());
      bufferedProjectRef.current = { ...projectRef.current };
    } else {
      if (!processStartTime) setProcessStartTime(Date.now());
      if (!bufferedProjectRef.current) bufferedProjectRef.current = { ...projectRef.current };
    }

    setIsProcessing(true);
    isPauseRequestedRef.current = false;
    addLog(`BẮT ĐẦU TIẾN TRÌNH DỊCH TỰ ĐỘNG | Mô hình gốc: '${selectedModel}'`, 'success');
  };

  const handleStopTranslation = () => {
    isPauseRequestedRef.current = true;
    setIsProcessing(false);
    addLog("ĐÃ YÊU CẦU: Dừng tiến trình dịch tự động ngay lập tức!", "warn");
    addLog("Hệ thống lưu trữ khẩn cấp dữ liệu từ bộ đệm vào IndexedDB...", 'info');
    if (bufferedProjectRef.current) {
      onUpdateProject({ ...bufferedProjectRef.current });
      bufferedProjectRef.current = null;
    }
    triggerExportDownload();
  };

  const triggerExportDownload = () => {
    addLog("ĐANG TIẾN HÀNH XUẤT SAO LƯU DỰ ÁN DẠNG CẤU TRÚC (.JSON) VỀ MÁY...", "warn");
    try {
      const proj = projectRef.current;
      const jsonString = JSON.stringify(proj, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const cleanTitle = proj.title.replace(/[\s\/:*?"<>|]+/g, '_');
      downloadAnchor.download = `DAT_AUTO_${cleanTitle}_${dateStr}_backup.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);
      addLog("TẢI XUỐNG FILE .JSON BACKUP THÀNH CÔNG!", "success");
    } catch (e: any) {
      addLog(`Lỗi khi cố gắng tự động lưu xuống tệp JSON: ${e.message}`, 'error');
    }
  };

  // Vòng lặp chính xử lý biên dịch tự động từng chương sách
  useEffect(() => {
    if (!isProcessing || currentChapterIndex < 0 || currentChapterIndex >= chaptersQueue.length) {
      if (isProcessing) {
        setIsProcessing(false);
        addLog("TẤT CẢ CHƯƠNG TRONG HÀNG ĐỢI ĐÃ ĐƯỢC BIÊN DỊCH THÀNH CÔNG!", "success");
        if (bufferedProjectRef.current) {
          onUpdateProject({ ...bufferedProjectRef.current });
          bufferedProjectRef.current = null;
        }
        triggerExportDownload();
      }
      return;
    }

    if (isPauseRequestedRef.current) {
      setIsProcessing(false);
      isPauseRequestedRef.current = false;
      addLog("Đã tạm dừng tiến trình dịch tự động an toàn.", "warn");
      if (bufferedProjectRef.current) {
        onUpdateProject({ ...bufferedProjectRef.current });
        bufferedProjectRef.current = null;
      }
      return;
    }

    const processChapter = async () => {
      const chapter = chaptersQueue[currentChapterIndex];
      addLog(`--------------------------------------------------`, 'info');
      addLog(`Xử lý [${currentChapterIndex + 1}/${chaptersQueue.length}]: ${chapter.title} | Key xoay vòng: #${currentApiKeyIndexRef.current + 1}`, 'info');

      try {
        if (!bufferedProjectRef.current) {
          bufferedProjectRef.current = { ...projectRef.current };
        }
        const currentProjState = bufferedProjectRef.current;

        let firstDraft = "";
        let updatedGlossary = [...currentProjState.glossary];
        const existingTranslation = (chapter.polishedTranslation || chapter.rawTranslation || "").trim();
        const hasExistingTranslation = existingTranslation.length > 0;

        if (autoTranslateMode === 'from_scratch' && hasExistingTranslation) {
          addLog(`[Dịch từ đầu] Phát hiện bản dịch khả dụng. Tiến hành chuốt văn luôn (Bỏ qua Giai đoạn 1)...`, "success");
          firstDraft = existingTranslation;
        } else {
          addLog(`Đang gọi API dịch thô (Giai đoạn 1)...`, "gemini");
          const rawRes = await fetch('/api/translate-raw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: chapter.processedSourceText || chapter.sourceText,
              genre: currentProjState.genre,
              tone: currentProjState.tone,
              description: currentProjState.description,
              glossary: currentProjState.glossary,
              apiKeys,
              model: selectedModel,
              startKeyIndex: currentApiKeyIndexRef.current
            }),
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

          if (isExtractionDuringTranslationEnabled && rawData.discoveredEntities && Array.isArray(rawData.discoveredEntities) && rawData.discoveredEntities.length > 0) {
            const bulkNewGlossary: GlossaryItem[] = [];
            const bulkPendingGlossary: PendingGlossaryItem[] = [];

            rawData.discoveredEntities.forEach((ent: any) => {
              if (!ent.chinese || !ent.vietnamese) return;

              const cleanChinese = ent.chinese.replace(/\s+/g, '').trim();
              const cleanVietnamese = ent.vietnamese.trim();
              const cleanPinyin = (ent.pinyin || '').trim();
              const cleanNote = (ent.note || '').trim();

              const matchedByCn = updatedGlossary.find((gItem) => gItem.chinese.replace(/\s+/g, '').trim() === cleanChinese);
              const matchedByVi = updatedGlossary.find((gItem) => gItem.vietnamese.trim().toLowerCase() === cleanVietnamese.toLowerCase());

              // Định vị đoạn văn gốc tiếng Trung chứa thực thể này
              const rawChinese = ent.chinese.trim();
              const originParagraph = chapter.sourceText.split('\n').find(p =>
                  p.includes(rawChinese) || p.replace(/\s+/g, '').includes(cleanChinese)
              )?.trim() || "";
              if (!matchedByCn && !matchedByVi) {
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

                if (matchedByCn && matchedByVi) {
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
                  importedAt: new Date().toISOString()
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
        addLog(`Kích hoạt chu trình mài giũa văn phong (${polishCycles} lượt)...`, 'info');
        for (let i = 1; i <= polishCycles; i++) {
          addLog(`Biên tập chuốt chữ Lần ${i}/${polishCycles}...`, "gemini");
          const polishRes = await fetch('/api/polish-translation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceText: chapter.sourceText,
              rawTranslation: currentTextToPolish,
              genre: currentProjState.genre,
              tone: currentProjState.tone,
              description: currentProjState.description,
              glossary: updatedGlossary,
              additionalInstructions: additionalInstructions || "Hãy tối ưu ngữ điệu mượt mà, bay bổng nhất có thể.",
              apiKeys,
              model: selectedModel,
              startKeyIndex: currentApiKeyIndexRef.current,
              isExtractionEnabled: isExtractionDuringTranslationEnabled
            }),
          });

          if (!polishRes.ok) {
            const errData = await polishRes.json();
            throw new Error(`Thất bại tại vòng biên tập thứ ${i}: ` + (errData.error || "Lỗi không xác định"));
          }

          const polishData = await polishRes.json();
          currentTextToPolish = polishData.polishedTranslation || currentTextToPolish;
          if (typeof polishData.successKeyIndex === 'number') {
            currentApiKeyIndexRef.current = polishData.successKeyIndex;
          }
          addLog(`Hoàn tất chuốt mịn lượt thứ ${i}!`, 'success');
        }

        const updatedChaptersList = bufferedProjectRef.current!.chapters.map(c => {
          if (c.id === chapter.id) {
            return {
              ...c,
              rawTranslation: firstDraft,
              polishedTranslation: currentTextToPolish,
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

        const batchSize = 10;
        const isLastChapter = (currentChapterIndex + 1) >= chaptersQueue.length;
        const shouldFlushBatch = ((currentChapterIndex + 1) % batchSize === 0) || isLastChapter;
        if (shouldFlushBatch) {
          onUpdateProject({ ...bufferedProjectRef.current! });
          addLog(`[Batch Flush] Xả bộ đệm, lưu sỉ cụm chương thành công vào IndexedDB.`, 'info');
        }

        setProcessedCount((prev) => prev + 1);
        setCurrentChapterIndex((prev) => prev + 1);

      } catch (err: any) {
        console.error(err);
        const errMsg: string = err.message || String(err);
        if (bufferedProjectRef.current) {
          onUpdateProject({ ...bufferedProjectRef.current });
          bufferedProjectRef.current = null;
        }

        if (errMsg.startsWith("ALL_KEYS_EXHAUSTED")) {
          addLog("⚠️ TẤT CẢ API KEY ĐÃ CẠN KIỆT HẠN MỨC QUOTA!", 'error');
          setIsProcessing(false);
          triggerExportDownload();
          return;
        }
        addLog(`Lỗi xử lý chương "${chapter.title}": ${errMsg}`, 'error');
        setIsProcessing(false);
      }
    };

    processChapter();
  }, [isProcessing, currentChapterIndex, chaptersQueue]);

  const handleExportTxt = () => {
    setIsExportingTxt(true);
    addLog(`BẮT ĐẦU SẢN XUẤT CÁC PHÂN ĐOẠN TỆP VĂN BẢN SẠCH (.TXT)...`, "info");
    try {
      const proj = projectRef.current;
      const allChapters = proj.chapters || [];
      if (allChapters.length === 0) {
        alert("Bộ truyện chưa có chương nào để xuất!");
        setIsExportingTxt(false);
        return;
      }

      let chaptersToExport = allChapters;
      if (exportScope === 'translated') {
        chaptersToExport = allChapters.filter(c => c.polishedTranslation.trim() || c.rawTranslation.trim());
      }

      if (chaptersToExport.length === 0) {
        alert("Không tìm thấy chương nào thỏa mãn điều kiện lọc!");
        setIsExportingTxt(false);
        return;
      }

      const chaptersChunks: Chapter[][] = [];
      const maxLimit = exportMode === 'web' ? 20 : 10;
      const cap = Math.min(maxLimit, Math.max(1, chaptersPerFile));
      for (let i = 0; i < chaptersToExport.length; i += cap) {
        chaptersChunks.push(chaptersToExport.slice(i, i + cap));
      }

      chaptersChunks.forEach((chunk, chunkIdx) => {
        let fileContent = "";
        chunk.forEach((chap, idx) => {
          const content = (chap.polishedTranslation || chap.rawTranslation || "").trim();
          const lines = content.split('\n');
          const titleRegex = /^(?:Chương|Chapter|Quyển|Tập|Thứ)\s+(?:\d+|[IVXLCDM]+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười|trăm|ngàn|vạn|nhất|nhị|tam|tứ|ngũ|lục|thất|bát|cửu|thập)/i;
          const chineseTitleRegex = /^第\s*[\d零一二三四五六七八九十百antam]+\s*[章节]/;
          const partIndicatorRegex = /[\(\[（【]\s*(?:\d+\s*[\/|／]\s*\d+|phần\s*\d+|đoạn\s*\d+)\s*[\)\]）】]/i;
          const partIndicatorRegexG = /[\(\[（【]\s*(?:\d+\s*[\/|／]\s*\d+|phần\s*\d+|đoạn\s*\d+)\s*[\)\]）】]/gi;
          
          let detectedTitle = "";
          const cleanLines: string[] = [];
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) {
              if (cleanLines.length > 0 && cleanLines[cleanLines.length - 1] !== "") {
                cleanLines.push("");
              }
              continue;
            }
            
            const isTitle = titleRegex.test(line) || chineseTitleRegex.test(line);
            if (isTitle) {
              if (i < 5 && !detectedTitle) {
                detectedTitle = line;
                continue;
              }
              const hasPartIndicator = partIndicatorRegex.test(line);
              const cleanMain = detectedTitle ? detectedTitle.replace(partIndicatorRegexG, '').replace(/[\s\W_]+/g, '').toLowerCase() : "";
              const cleanCurrent = line.replace(partIndicatorRegexG, '').replace(/[\s\W_]+/g, '').toLowerCase();
              const isSimilarToMain = cleanMain && cleanCurrent && (cleanCurrent.includes(cleanMain) || cleanMain.includes(cleanCurrent));
              
              if (hasPartIndicator || isSimilarToMain || i >= 5) {
                continue;
              }
            }
            cleanLines.push(lines[i]);
          }
          
          let finalTitle = "";
          if (detectedTitle && /^(Chương|Chapter|Quyển|Tập)/i.test(detectedTitle)) {
            finalTitle = detectedTitle;
          } else {
            const chapTitleTrim = chap.title.trim();
            if (/^(Chương|Chapter|Quyển|Tập)/i.test(chapTitleTrim)) {
              finalTitle = chapTitleTrim;
            } else {
              const globalIdx = chunkIdx * cap + idx;
              const chineseNumMatch = chap.title.match(/第\s*([\d零一二三四五六七八九十百千万]+)\s*[章节]/);
              const num = chineseNumMatch ? chineseNumMatch[1] : (globalIdx + 1).toString();
              finalTitle = `Chương ${num}`;
            }
          }
          
          finalTitle = finalTitle.replace(/^\*+\s*/, '').trim();
          finalTitle = finalTitle.replace(partIndicatorRegexG, '').trim();
          
          let bodyContent = cleanLines.join('\n').trim();
          bodyContent = bodyContent.replace(/(?:\*\s*){3,}/g, '').trim();

          if (idx > 0) fileContent += "\n\n";

          if (exportMode === 'web') {
            fileContent += `*** ${finalTitle}\n${bodyContent}`;
          } else {
            fileContent += bodyContent;
          }
        });

        const firstChapter = chunk[0];
        const lastChapter = chunk[chunk.length - 1];
        const sanitize = (str: string) => str.replace(/[\s\/:*?"<>|\\#%@;=]+/g, '_').substring(0, 30);
        const cleanTitle = sanitize(proj.title);
        const startName = sanitize(firstChapter.title);
        const endName = sanitize(lastChapter.title);

        const suffix = exportMode === 'audio' ? '_AUDIO' : '_WEB';
        const filename = `${cleanTitle}_[${startName}]_den_[${endName}]${suffix}.txt`;
        const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      });
      addLog("ĐÃ HOÀN TẤT TẢI XUỐNG TOÀN BỘ CÁC TỆP .TXT VĂN BẢN CHẤT LƯỢNG CAO!", "success");
    } catch (error: any) {
      addLog(`Lỗi khi xuất tệp: ${error.message || error}`, "error");
    } finally {
      setIsExportingTxt(false);
    }
  };

  const handleExportAlignJsonl = async () => {
    setIsExportingTxt(true);
    addLog(`BẮT ĐẦU QUY TRÌNH GIÓNG HÀNG SONG NGỮ TRUNG - VIỆT (HUẤN LUYỆN JSONL)...`, "info");
    try {
      const proj = projectRef.current;
      const allChapters = proj.chapters || [];
      if (allChapters.length === 0) {
        alert("Bộ truyện chưa có chương nào để xuất!");
        setIsExportingTxt(false);
        return;
      }

      const chaptersToExport = allChapters.filter(c => c.polishedTranslation.trim() || c.rawTranslation.trim());
      if (chaptersToExport.length === 0) {
        alert("Không tìm thấy chương truyện nào đã được dịch thuật để gióng hàng!");
        setIsExportingTxt(false);
        return;
      }

      for (let i = 0; i < chaptersToExport.length; i++) {
        const chap = chaptersToExport[i];
        addLog(`--------------------------------------------------`, 'info');
        addLog(`[Gióng hàng ${i + 1}/${chaptersToExport.length}] Phân tích gióng câu bằng AI: ${chap.title}...`, 'gemini');

        const translatedText = chap.polishedTranslation.trim() || chap.rawTranslation.trim();
        try {
          const res = await fetch('/api/align-chapter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceText: chap.sourceText,
              translatedText: translatedText,
              apiKeys,
              model: selectedModel
            })
          });

          if (!res.ok) {
            throw new Error("Lỗi phản hồi từ máy chủ gióng hàng.");
          }

          const data = await res.json();
          const jsonlLines = data.jsonlLines || [];
          if (jsonlLines.length === 0) continue;

          const fileContent = jsonlLines.join('\n') + '\n';
          const sanitize = (str: string) => str.replace(/[\s\/:*?"<>|\\#%@;=]+/g, '_').substring(0, 30);
          const cleanTitle = sanitize(proj.title);
          const cleanChapTitle = sanitize(chap.title);
          const filename = `${cleanTitle}_[${cleanChapTitle}]_ALIGN_FT.jsonl`;

          const blob = new Blob([fileContent], { type: "application/x-jsonlines;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = filename;
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          URL.revokeObjectURL(url);

          addLog(`Xuất bản thành công tệp học liệu: ${filename}`, 'success');
        } catch (chapErr: any) {
          addLog(`Thất bại tại chương "${chap.title}": ${chapErr.message || chapErr}`, 'error');
        }
      }
      addLog("HOÀN TẤT QUY TRÌNH SẢN XUẤT HỌC LIỆU GIÓNG HÀNG FINE-TUNE!", "success");
    } catch (error: any) {
      addLog(`Lỗi hệ thống gióng hàng sỉ: ${error.message || error}`, "error");
    } finally {
      setIsExportingTxt(false);
    }
  };

  const handleApplyGlossaryToAllChapters = () => {
    const glossary = projectRef.current.glossary;
    const chapters = projectRef.current.chapters;

    if (glossary.length === 0) {
      alert('Từ điển dự án đang trống!');
      return;
    }
    if (chapters.length === 0) {
      alert('Bộ truyện chưa có chương nào!');
      return;
    }

    setIsApplyingGlossary(true);
    setApplyGlossaryResult(null);

    setTimeout(() => {
      const sortedGlossary = [...glossary].sort((a, b) => b.chinese.length - a.chinese.length);
      let scopedChapters = chapters;
      if (applyGlossaryRangeEnabled) {
        const startIdx = Math.max(0, applyGlossaryRangeStart - 1);
        const endIdx = Math.min(chapters.length, applyGlossaryRangeEnd);
        scopedChapters = chapters.slice(startIdx, endIdx);
      }

      let totalReplaced = 0;
      let chaptersAffected = 0;

      const glossaryMap = new Map<string, string>();
      const terms: string[] = [];

      sortedGlossary.forEach((item) => {
        if (item.chinese && item.vietnamese) {
          const cleanChinese = item.chinese.trim();
          glossaryMap.set(cleanChinese, item.vietnamese.trim());
          terms.push(cleanChinese);
        }
      });

      let pattern: RegExp | null = null;
      if (terms.length > 0) {
        const escapedTerms = terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        pattern = new RegExp(escapedTerms.join('|'), 'g');
      }

      const updatedChapters = chapters.map(chap => {
        if (!scopedChapters.includes(chap)) return chap;
        if (!pattern) return chap;

        let result = chap.sourceText;
        const matchedTerms = new Set<string>();

        result = result.replace(pattern, (match) => {
          matchedTerms.add(match);
          return glossaryMap.get(match) || match;
        });

        const chapReplaced = matchedTerms.size;
        if (chapReplaced > 0) {
          totalReplaced += chapReplaced;
          chaptersAffected++;
          return { ...chap, processedSourceText: result };
        }
        return chap;
      });

      onUpdateProject({ ...projectRef.current, chapters: updatedChapters });
      setApplyGlossaryResult({ replaced: totalReplaced, chapters: chaptersAffected });
      setIsApplyingGlossary(false);
      addLog(`Áp dụng từ điển hoàn tất: thay thế ${totalReplaced} thuật ngữ trên ${chaptersAffected}/${scopedChapters.length} chương được chọn.`, 'success');
    }, 400);
  };

  const handleResetQueue = () => {
    setIsProcessing(false);
    isPauseRequestedRef.current = false;
    setCurrentChapterIndex(-1);
    setChaptersQueue([]);
    setProcessedCount(0);
    setAutoDiscoveredBatch([]);
    setLogs([]);
    currentApiKeyIndexRef.current = 0;
    bufferedProjectRef.current = null;
    addLog("Đã reset trạng thái dịch tự động và cấu hình luân chuyển key.", "info");
  };

  const handleAutoExtractGlossary = async () => {
    if (isScanningGlossary) {
      isStopScanRequestedRef.current = true;
      addLog("ĐANG YÊU CẦU DỪNG QUÉT... Vui lòng chờ kết thúc chương hiện tại.", "warn");
      return;
    }

    const chaps = projectRef.current.chapters || [];
    if (chaps.length === 0) {
      alert("Bộ truyện không có chương nào để lọc!");
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
    setLogs([]);
    addLog(`=== KHỞI CHẠY QUÉT LỌC THUẬT NGỮ SỈ${scanRangeEnabled ? ` (Chương ${scanRangeStart}→${scanRangeEnd})` : ' TOÀN BỘ TRUYỆN'} ===`, 'success');

    try {
      let updatedGlossary = [...projectRef.current.glossary];
      let chaptersProcessedSinceLastUpdate = 0;

      for (let loop = 1; loop <= extractionLoops; loop++) {
        if (isStopScanRequestedRef.current) break;
        setCurrentExtractionLoop(loop);

        for (let i = 0; i < scopedChaps.length; i++) {
          if (isStopScanRequestedRef.current) break;

          const chap = scopedChaps[i];
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
                startKeyIndex: currentApiKeyIndexRef.current
              }),
            });

            if (!response.ok) throw new Error("Gặp lỗi phản hồi trích xuất từ AI.");
            const data = await response.json();
            if (typeof data.successKeyIndex === 'number') {
              currentApiKeyIndexRef.current = data.successKeyIndex;
            }

            const suggestions = data.suggestions || [];
            if (suggestions.length > 0) {
              const newlyDiscovered: GlossaryItem[] = [];
              suggestions.forEach((ent: any) => {
                const chineseTrimmed = ent.chinese?.trim() || "";
                if (!chineseTrimmed) return;

                const exists = updatedGlossary.some((gItem) => gItem.chinese.trim() === chineseTrimmed);
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
                    origin: 'scanned',
                    createdAt: new Date().toISOString()
                  };
                  newlyDiscovered.push(itemPayload);
                  updatedGlossary.push(itemPayload);
                }
              });

              if (newlyDiscovered.length > 0) {
                addLog(`Phát hiện ${newlyDiscovered.length} thuật ngữ mới tại chương "${chap.title}"`, 'success');
                setAutoDiscoveredBatch((prev) => [...prev, ...newlyDiscovered]);
                setScanFoundCount((prev) => prev + newlyDiscovered.length);
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
  };

  const remainingChapters = Math.max(0, chaptersQueue.length - processedCount);
  const requestsPerChapter = 1 + polishCycles;
  const remainingRequests = Math.max(0, remainingChapters * requestsPerChapter);

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
  }, [isProcessing, processedCount, remainingChapters, processStartTime, polishCycles]);

  return {
    isProcessing,
    currentChapterIndex,
    chaptersQueue,
    processedCount,
    logs,
    autoDiscoveredBatch,
    estTimeStr,
    isScanningGlossary,
    scanningProgress,
    currentExtractionLoop,
    currentScanningChapterTitle,
    currentScanningChapterIndex,
    totalScanChapters,
    scanFoundCount,
    isApplyingGlossary,
    applyGlossaryResult,
    isExportingTxt,
    setLogs,
    setApplyGlossaryResult,
    handleToggleProcessing,
    handleStopTranslation,
    handleExportTxt,
    handleExportAlignJsonl,
    handleApplyGlossaryToAllChapters,
    handleResetQueue,
    handleAutoExtractGlossary,
    triggerExportDownload,
  };
}
