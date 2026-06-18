import React, { useState, useEffect, useRef } from 'react';
import { StoryProject, GlossaryItem, PendingGlossaryItem, Chapter } from '../types';
import {
  Play, Pause, Sliders, Database, Cpu, Layers, Download,
  Check, RefreshCw, Sparkles, ChevronRight, FileText, ListOrdered,
  Square, Clock, Zap, BookOpen, Eye, X
} from 'lucide-react';

// Nhập khẩu các kiến trúc thành phần giao diện đã được phân rã để giảm tải dung lượng file
import { TerminalConsole, LogEntry } from './auto-translator/TerminalConsole';
import { DriveProgressWidget } from './auto-translator/DriveProgressWidget';
import { GlossaryScanWidget } from './auto-translator/GlossaryScanWidget';

interface AutoTranslatorProps {
  activeProject: StoryProject;
  onUpdateProject: (updated: StoryProject) => void;
  apiKeys: string[];
  selectedModel: string;
}

export default function AutoTranslator({
                                         activeProject,
                                         onUpdateProject,
                                         apiKeys,
                                         selectedModel,
                                       }: AutoTranslatorProps) {
  // Cấu hình tham số
  const [polishCycles, setPolishCycles] = useState<number>(1);
  const [autoTranslateMode, setAutoTranslateMode] = useState<'resume' | 'from_scratch'>('resume');
  const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
  const [isExtractionDuringTranslationEnabled, setIsExtractionDuringTranslationEnabled] = useState<boolean>(true);

  // Giới hạn phạm vi
  const [rangeEnabled, setRangeEnabled] = useState<boolean>(false);
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(() => activeProject.chapters.length || 1);

  // States dành cho bộ lọc quét thuật ngữ sỉ
  const [isScanningGlossary, setIsScanningGlossary] = useState<boolean>(false);
  const [scanningProgress, setScanningProgress] = useState<number>(0);
  const [extractionLoops, setExtractionLoops] = useState<number>(1);
  const [currentExtractionLoop, setCurrentExtractionLoop] = useState<number>(1);
  const isStopScanRequestedRef = useRef<boolean>(false);

  // Áp dụng từ điển vào sourceText gốc
  const [isApplyingGlossary, setIsApplyingGlossary] = useState<boolean>(false);
  const [applyGlossaryResult, setApplyGlossaryResult] = useState<{ replaced: number; chapters: number } | null>(null);
  const [applyGlossaryRangeEnabled, setApplyGlossaryRangeEnabled] = useState<boolean>(false);
  const [applyGlossaryRangeStart, setApplyGlossaryRangeStart] = useState<number>(1);
  const [applyGlossaryRangeEnd, setApplyGlossaryRangeEnd] = useState<number>(() => activeProject.chapters.length || 1);

  // Modal xem chi tiết diff
  const [isDiffModalOpen, setIsDiffModalOpen] = useState<boolean>(false);
  const [diffModalChapterIndex, setDiffModalChapterIndex] = useState<number>(0);

  // Phạm vi rà soát thuật ngữ
  const [scanRangeEnabled, setScanRangeEnabled] = useState<boolean>(false);
  const [scanRangeStart, setScanRangeStart] = useState<number>(1);
  const [scanRangeEnd, setScanRangeEnd] = useState<number>(() => activeProject.chapters.length || 1);

  // Floating scan widget states
  const [isScanWidgetVisible, setIsScanWidgetVisible] = useState<boolean>(false);
  const [isScanWidgetMinimized, setIsScanWidgetMinimized] = useState<boolean>(false);
  const [currentScanningChapterTitle, setCurrentScanningChapterTitle] = useState<string>('');
  const [currentScanningChapterIndex, setCurrentScanningChapterIndex] = useState<number>(0);
  const [totalScanChapters, setTotalScanChapters] = useState<number>(0);
  const [scanFoundCount, setScanFoundCount] = useState<number>(0);

  // Cấu hình xuất tệp văn bản sạch
  const [chaptersPerFile, setChaptersPerFile] = useState<number>(10);
  const [exportScope, setExportScope] = useState<'all' | 'translated'>('translated');
  const [isExportingTxt, setIsExportingTxt] = useState<boolean>(false);
  const [exportMode, setExportMode] = useState<'web' | 'audio' | 'align_jsonl'>('web');

  const handleExportModeChange = (mode: 'web' | 'audio' | 'align_jsonl') => {
    setExportMode(mode);
    if (mode === 'audio' && chaptersPerFile > 10) {
      setChaptersPerFile(10);
    }
  };

  // Trạng thái vận hành luồng dịch
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(-1);
  const [chaptersQueue, setChaptersQueue] = useState<Chapter[]>([]);
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoDiscoveredBatch, setAutoDiscoveredBatch] = useState<GlossaryItem[]>([]);

  // Floating drive widget states
  const [processStartTime, setProcessStartTime] = useState<number | null>(null);
  const [isDriveWidgetVisible, setIsDriveWidgetVisible] = useState<boolean>(false);
  const [isDriveWidgetMinimized, setIsDriveWidgetMinimized] = useState<boolean>(false);
  const [estTimeStr, setEstTimeStr] = useState<string>('Đang tính toán...');

  // Tham chiếu bền vững chống Stale Closure
  const projectRef = useRef<StoryProject>(activeProject);
  const isPauseRequestedRef = useRef<boolean>(false);
  const currentApiKeyIndexRef = useRef<number>(0);
  const bufferedProjectRef = useRef<StoryProject | null>(null);

  useEffect(() => {
    projectRef.current = activeProject;
  }, [activeProject]);

  useEffect(() => {
    const total = activeProject.chapters.length;
    if (total > 0) {
      setRangeEnd(prev => prev >= total - 1 ? total : prev);
    }
  }, [activeProject.chapters.length]);

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
    setIsDriveWidgetVisible(true);
    setIsDriveWidgetMinimized(false);
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
                const itemPayload: any = {
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
          if (idx > 0) fileContent += "\n\n";

          // SAU (code đã sửa)
          if (exportMode === 'web') {
            const lines = content.split('\n');
            const firstLine = lines[0].trim();

            // Kiểm tra dòng đầu là tiêu đề Việt (Chương X... / Chapter X...)
            const isVietnameseChapterTitle = /^(Chương|Chapter)\s+\d+/i.test(firstLine);

            // Kiểm tra dòng đầu là tiêu đề Trung (第X章...) — cần loại bỏ khỏi body
            const isChineseTitleLine = /^第[\d零一二三四五六七八九十百千万]+[章节]/.test(firstLine);

            if (isVietnameseChapterTitle) {
              // ✅ Dòng đầu đã là tiêu đề Việt → dùng làm header, bỏ khỏi body
              const bodyContent = lines.slice(1).join('\n').trimStart();
              fileContent += `*** ${firstLine}\n${bodyContent}`;
            } else {
              // ✅ Tạo tiêu đề Việt: trích số chương từ title Trung, hoặc dùng số thứ tự toàn cục
              const globalIdx = chunkIdx * cap + idx;
              const chineseNumMatch = chap.title.match(/第(\d+)[章节]/);
              const vietnameseTitle = chineseNumMatch
                  ? `Chương ${chineseNumMatch[1]}`
                  : `Chương ${globalIdx + 1}`;

              // Nếu dòng đầu là tiêu đề Trung → loại bỏ khỏi body, tránh lặp
              const bodyContent = isChineseTitleLine
                  ? lines.slice(1).join('\n').trimStart()
                  : content;

              fileContent += `*** ${vietnameseTitle}\n${bodyContent}`;
            }
          } else {
            fileContent += content;
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
      addLog("ĐA HOÀN TẤT TẢI XUỐNG TOÀN BỘ CÁC TỆP .TXT VĂN BẢN CHẤT LƯỢNG CAO!", "success");
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

      // Lọc phạm vi chương
      let scopedChapters = chapters;
      if (applyGlossaryRangeEnabled) {
        const startIdx = Math.max(0, applyGlossaryRangeStart - 1);
        const endIdx = Math.min(chapters.length, applyGlossaryRangeEnd);
        scopedChapters = chapters.slice(startIdx, endIdx);
      }

      let totalReplaced = 0;
      let chaptersAffected = 0;

      const updatedChapters = chapters.map(chap => {
        if (!scopedChapters.includes(chap)) return chap;

        let result = chap.sourceText;
        let chapReplaced = 0;

        sortedGlossary.forEach(item => {
          if (!item.chinese || !item.vietnamese) return;
          const escaped = item.chinese.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escaped, 'g');
          const before = result;
          result = result.replace(regex, item.vietnamese);
          if (result !== before) chapReplaced++;
        });

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

    // Lọc phạm vi chương rà soát
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
    setIsScanWidgetVisible(true);
    setIsScanWidgetMinimized(false);
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

                // Trích gốc đoạn chứa từ trong chế độ quét sỉ
                const originParagraph = chap.sourceText.split('\n').find(p =>
                    p.includes(chineseTrimmed) || p.replace(/\s+/g, '').includes(chineseTrimmed.replace(/\s+/g, ''))
                )?.trim() || "";
                if (!exists) {
                  const itemPayload: any = {
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
    } finally { // <--- SỬA LỖI CÚ PHÁP TẠI ĐÂY THÀNH FINALLY
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

  const totalUntranslatedChapters = projectRef.current.chapters.filter(c => !c.polishedTranslation.trim() && !c.rawTranslation.trim()).length;

  return (
      <div id="auto-translator" className="space-y-6">
        {/* Banner tổng quan tham số */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
          <div className="space-y-1">
            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-500/35 uppercase tracking-wider">HỆ THỐNG AUTOMATION SỈ</span>
            <h2 className="text-base font-bold tracking-tight mt-1 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-400 animate-spin" />
              Biên Dịch &amp; Tự Động Thuật Ngữ Bộ Truyện
            </h2>
            <p className="text-slate-400 text-xs">Hệ thống kích hoạt dịch tuần tự song song, tự động bóc tách từ vựng mới nạp gối đầu cho các chương kế sau.</p>
          </div>

          <div className="bg-white/5 border border-white/10 p-3 rounded-lg text-xs grid grid-cols-2 gap-x-4 gap-y-1.5 max-w-sm shrink-0">
            <div className="text-slate-400 font-semibold">Mô hình AI:</div>
            <div className="text-indigo-300 font-extrabold text-right">{selectedModel}</div>
            <div className="text-slate-400 font-semibold">Tông xưng hô:</div>
            <div className="text-indigo-300 font-extrabold text-right line-clamp-1">{projectRef.current.tone}</div>
            <div className="text-slate-400 font-semibold text-xs leading-none">Chương chưa dịch:</div>
            <div className="text-yellow-400 font-extrabold text-right text-xs leading-none">{totalUntranslatedChapters} / {projectRef.current.chapters.length} chap</div>
          </div>
        </div>

        {/* Cấu hình tham số và bảng điều khiển */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6 lg:col-span-1">
            <div className="space-y-4 bg-white border border-slate-200 p-5 rounded-xl shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                <Sliders className="w-4 h-4 text-indigo-600" /> Tham số dịch tự động
              </h3>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Chế độ dịch tự động:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                      type="button"
                      onClick={() => setAutoTranslateMode('resume')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer flex flex-col items-center justify-center min-h-[56px] ${autoTranslateMode === 'resume' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-extrabold' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  >
                    <span className="text-[11px] flex items-center gap-1"><Play className="w-3 h-3 text-indigo-600 fill-indigo-600" /> Tiếp tục dịch</span>
                    <span className="text-[9px] text-slate-400 font-normal mt-0.5">({totalUntranslatedChapters} chương)</span>
                  </button>

                  <button
                      type="button"
                      onClick={() => setAutoTranslateMode('from_scratch')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer flex flex-col items-center justify-center min-h-[56px] ${autoTranslateMode === 'from_scratch' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-extrabold' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  >
                    <span className="text-[11px] flex items-center gap-1"><RefreshCw className="w-3 h-3 text-indigo-600" /> Dịch từ đầu</span>
                    <span className="text-[9px] text-slate-400 font-normal mt-0.5">({projectRef.current.chapters.length} chương)</span>
                  </button>
                </div>
              </div>

              {/* Giới hạn phân đoạn vùng chương */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><ListOrdered className="w-3.5 h-3.5 text-indigo-500" /> Giới hạn phạm vi chương</span>
                    <span className="text-[10px] text-slate-400 font-normal mt-0.5">Dịch từ số thứ tự X đến Y trong danh sách</span>
                  </div>
                  <button
                      type="button"
                      onClick={() => setRangeEnabled(!rangeEnabled)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${rangeEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${rangeEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                {rangeEnabled && (() => {
                  const total = projectRef.current.chapters.length;
                  const safeStart = Math.max(1, Math.min(rangeStart, total));
                  const safeEnd = Math.max(safeStart, Math.min(rangeEnd, total));
                  return (
                      <div className="space-y-3 animate-in slide-in-from-top-1 duration-200">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block">Từ số</label>
                            <input
                                type="number"
                                min={1}
                                max={total}
                                value={rangeStart}
                                onChange={e => {
                                  const v = Math.max(1, Math.min(total, Number(e.target.value)));
                                  setRangeStart(v);
                                  if (v > rangeEnd) setRangeEnd(v);
                                }}
                                className="w-full text-center text-sm font-extrabold border border-slate-250 rounded-lg bg-slate-50 py-1.5 text-indigo-900 focus:outline-none focus:border-indigo-600"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block">Đến số</label>
                            <input
                                type="number"
                                min={rangeStart}
                                max={total}
                                value={rangeEnd}
                                onChange={e => setRangeEnd(Math.max(rangeStart, Math.min(total, Number(e.target.value))))}
                                className="w-full text-center text-sm font-extrabold border border-slate-250 rounded-lg bg-slate-50 py-1.5 text-indigo-900 focus:outline-none focus:border-indigo-600"
                            />
                          </div>
                        </div>
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-[11px] text-indigo-900 flex items-center justify-between">
                          <span>Hàng đợi phân phối:</span>
                          <strong className="text-indigo-700 font-extrabold">{safeEnd - safeStart + 1} chương</strong>
                        </div>
                      </div>
                  );
                })()}
              </div>

              <div className="flex justify-between items-center text-xs pt-1">
                <label className="font-bold text-slate-700 flex items-center gap-1"><Layers className="w-3.5 h-3.5 text-indigo-500" /> Lượt chuốt văn văn học:</label>
                <span className="bg-indigo-600 text-white rounded-full px-2.5 py-0.5 text-[10px] font-extrabold">{polishCycles} vòng</span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                {[1, 2, 3, 4, 5].map(n => (
                    <button
                        key={n}
                        type="button"
                        onClick={() => setPolishCycles(n)}
                        className={`flex-1 py-1.5 rounded-md text-xs font-bold border cursor-pointer transition-colors ${polishCycles === n ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-250 bg-slate-50 text-slate-700 font-semibold'}`}
                    >
                      {n}
                    </button>
                ))}
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Yêu cầu bổ sung khi biên tập:</label>
                <input
                    type="text"
                    placeholder="Ví dụ: truyện tiên hiệp hãy làm cho câu từ bay bổng hơn..."
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-250 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="pt-3 pb-1 flex items-center justify-between border-t border-slate-100 mt-2">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-bold text-slate-700">Rà soát từ mới khi dịch</span>
                  <span className="text-[10px] text-slate-400 font-normal">Tự động đẩy vào kho từ vựng gối đầu</span>
                </div>
                <button
                    type="button"
                    onClick={() => setIsExtractionDuringTranslationEnabled(!isExtractionDuringTranslationEnabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${isExtractionDuringTranslationEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${isExtractionDuringTranslationEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100">
                {isProcessing ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={handleToggleProcessing} className="py-2.5 rounded-lg text-xs font-extrabold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer bg-amber-500 hover:bg-amber-600 text-white"><Pause className="w-3.5 h-3.5 fill-white" /> Tạm dừng</button>
                      <button onClick={handleStopTranslation} className="py-2.5 rounded-lg text-xs font-extrabold shadow-sm flex items-center justify-center gap-1.5 cursor-pointer bg-rose-600 hover:bg-rose-700 text-white"><Square className="w-3.5 h-3.5 fill-white" /> Dừng &amp; Lưu</button>
                    </div>
                ) : (
                    <button onClick={handleToggleProcessing} className="w-full py-2.5 rounded-lg text-xs font-extrabold shadow-sm flex items-center justify-center gap-2 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white"><Play className="w-4 h-4 fill-white" /> Kích hoạt Dịch Tự Động sỉ</button>
                )}

                <div className="flex gap-2">
                  <button type="button" onClick={handleResetQueue} className="flex-1 py-1.5 rounded-lg border border-slate-205 text-slate-600 hover:bg-slate-50 cursor-pointer text-xs font-bold">Reset hàng đợi</button>
                  <button type="button" onClick={triggerExportDownload} className="flex-1 py-1.5 rounded-lg border border-slate-205 text-slate-600 hover:bg-slate-50 cursor-pointer text-xs font-bold flex items-center justify-center gap-1"><Download className="w-3.5 h-3.5" /> Lưu cấu trúc truyện</button>
                </div>
              </div>
            </div>

            {/* Áp dụng từ điển vào sourceText gốc */}
            <div id="apply-glossary-card" className="space-y-4 bg-white border border-slate-200 p-5 rounded-xl shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                <BookOpen className="w-4 h-4 text-amber-600" /> Áp dụng từ điển vào raw
              </h3>
              <p className="text-[11px] text-slate-500">Thay thế trước các từ tiếng Trung trong <strong>văn bản gốc</strong> của chương được chọn bằng bản dịch từ từ điển. Khi dịch tự động sẽ ưu tiên dùng văn bản đã xử lý này.</p>

              {/* Phạm vi chương */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><ListOrdered className="w-3.5 h-3.5 text-amber-500" /> Giới hạn phạm vi chương</span>
                  <button
                    type="button"
                    onClick={() => setApplyGlossaryRangeEnabled(!applyGlossaryRangeEnabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${applyGlossaryRangeEnabled ? 'bg-amber-500' : 'bg-slate-200'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${applyGlossaryRangeEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                {applyGlossaryRangeEnabled && (() => {
                  const total = projectRef.current.chapters.length;
                  return (
                    <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-1 duration-200">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Từ chương</label>
                        <input
                          type="number" min={1} max={total}
                          value={applyGlossaryRangeStart}
                          onChange={e => {
                            const v = Math.max(1, Math.min(total, Number(e.target.value)));
                            setApplyGlossaryRangeStart(v);
                            if (v > applyGlossaryRangeEnd) setApplyGlossaryRangeEnd(v);
                          }}
                          className="w-full text-center text-sm font-extrabold border border-slate-200 rounded-lg bg-slate-50 py-1.5 text-amber-900 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Đến chương</label>
                        <input
                          type="number" min={applyGlossaryRangeStart} max={total}
                          value={applyGlossaryRangeEnd}
                          onChange={e => setApplyGlossaryRangeEnd(Math.max(applyGlossaryRangeStart, Math.min(total, Number(e.target.value))))}
                          className="w-full text-center text-sm font-extrabold border border-slate-200 rounded-lg bg-slate-50 py-1.5 text-amber-900 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="col-span-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 text-[11px] text-amber-900 flex items-center justify-between">
                        <span>Phạm vi áp dụng:</span>
                        <strong className="text-amber-700 font-extrabold">{applyGlossaryRangeEnd - applyGlossaryRangeStart + 1} chương</strong>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {applyGlossaryResult && !isApplyingGlossary && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-900 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Đã thay <strong>{applyGlossaryResult.replaced}</strong> thuật ngữ trên <strong>{applyGlossaryResult.chapters}</strong> chương.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setDiffModalChapterIndex(0); setIsDiffModalOpen(true); }}
                    className="flex items-center gap-1 text-amber-700 hover:text-amber-900 font-bold shrink-0 border border-amber-300 bg-white px-2 py-0.5 rounded cursor-pointer hover:bg-amber-50 transition-colors"
                  >
                    <Eye className="w-3 h-3" /> Xem chi tiết
                  </button>
                </div>
              )}

              {/* Nút xem chi tiết khi chưa có kết quả mới nhưng đã có chương được xử lý */}
              {!applyGlossaryResult && projectRef.current.chapters.some(c => c.processedSourceText) && (
                <button
                  type="button"
                  onClick={() => { setDiffModalChapterIndex(0); setIsDiffModalOpen(true); }}
                  className="w-full flex items-center justify-center gap-1.5 border border-amber-200 text-amber-700 hover:bg-amber-50 font-bold px-3 py-1.5 rounded text-xs cursor-pointer transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" /> Xem chi tiết các chương đã xử lý
                </button>
              )}

              <button
                type="button"
                disabled={isApplyingGlossary || isProcessing || projectRef.current.glossary.length === 0 || projectRef.current.chapters.length === 0}
                onClick={handleApplyGlossaryToAllChapters}
                className={`w-full py-2.5 rounded-lg text-xs font-extrabold shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  isApplyingGlossary
                    ? 'bg-amber-400 text-white cursor-wait'
                    : 'bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                {isApplyingGlossary ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang xử lý chương...</>
                ) : (
                  <><BookOpen className="w-3.5 h-3.5" /> Áp dụng từ điển ({projectRef.current.glossary.length} từ / {applyGlossaryRangeEnabled ? `${applyGlossaryRangeEnd - applyGlossaryRangeStart + 1}` : projectRef.current.chapters.length} chương)</>
                )}
              </button>
            </div>

            {/* Quét lọc thuật ngữ sỉ */}
            <div id="bulk-glossary-extract-card" className="space-y-4 bg-white border border-slate-200 p-5 rounded-xl shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                <Database className="w-4 h-4 text-amber-600" /> Rà soát &amp; Lọc thuật ngữ sỉ
              </h3>
              <p className="text-[11px] text-slate-500">Quét sỉ toàn tập truyện để tự động bóc tách, chuẩn hóa danh xưng danh riêng phương Tây/Trung Hoa cổ phong đưa thẳng vào bộ quy tắc.</p>

              {/* Phạm vi chương rà soát */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><ListOrdered className="w-3.5 h-3.5 text-amber-500" /> Giới hạn phạm vi chương</span>
                  <button
                    type="button"
                    disabled={isScanningGlossary}
                    onClick={() => setScanRangeEnabled(!scanRangeEnabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${scanRangeEnabled ? 'bg-amber-500' : 'bg-slate-200'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${scanRangeEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                {scanRangeEnabled && (() => {
                  const total = projectRef.current.chapters.length;
                  return (
                    <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-1 duration-200">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Từ chương</label>
                        <input
                          type="number" min={1} max={total}
                          value={scanRangeStart}
                          disabled={isScanningGlossary}
                          onChange={e => {
                            const v = Math.max(1, Math.min(total, Number(e.target.value)));
                            setScanRangeStart(v);
                            if (v > scanRangeEnd) setScanRangeEnd(v);
                          }}
                          className="w-full text-center text-sm font-extrabold border border-slate-200 rounded-lg bg-slate-50 py-1.5 text-amber-900 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Đến chương</label>
                        <input
                          type="number" min={scanRangeStart} max={total}
                          value={scanRangeEnd}
                          disabled={isScanningGlossary}
                          onChange={e => setScanRangeEnd(Math.max(scanRangeStart, Math.min(total, Number(e.target.value))))}
                          className="w-full text-center text-sm font-extrabold border border-slate-200 rounded-lg bg-slate-50 py-1.5 text-amber-900 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                        />
                      </div>
                      <div className="col-span-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 text-[11px] text-amber-900 flex items-center justify-between">
                        <span>Phạm vi quét:</span>
                        <strong className="text-amber-700 font-extrabold">{scanRangeEnd - scanRangeStart + 1} chương</strong>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-slate-700">Vòng lặp rà soát sâu:</label>
                  <span className="bg-amber-600 text-white rounded-full px-2.5 py-0.5 text-[10px] font-extrabold">{extractionLoops} vòng</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  {[1, 2, 3, 4, 5].map(n => (
                      <button
                          key={n}
                          type="button"
                          disabled={isScanningGlossary}
                          onClick={() => setExtractionLoops(n)}
                          className={`flex-1 py-1.5 rounded-md text-xs font-bold border cursor-pointer transition-colors ${extractionLoops === n ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-250 bg-slate-50 text-slate-700 disabled:opacity-50'}`}
                      >
                        {n}
                      </button>
                  ))}
                </div>
              </div>

              <button type="button" onClick={handleAutoExtractGlossary} className={`w-full py-2.5 rounded-lg text-xs font-extrabold shadow-sm flex items-center justify-center gap-2 cursor-pointer ${isScanningGlossary ? 'bg-rose-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}>
                {isScanningGlossary ? <><Square className="w-3.5 h-3.5 fill-white" /> Dừng quét lọc ({scanningProgress}%)</> : <><Database className="w-3.5 h-3.5 fill-white" /> Kích hoạt quét lọc sỉ mới</>}
              </button>
            </div>

            {/* Khối sản xuất văn bản đầu ra */}
            <div id="export-txt-card" className="space-y-4 bg-white border border-slate-200 p-5 rounded-xl shadow-xs">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                <FileText className="w-4 h-4 text-emerald-600" /> Sản xuất tập tin kết quả sau dịch
              </h3>

              <div className="space-y-1.5">
                <div className="grid grid-cols-3 gap-1.5">
                  <button type="button" onClick={() => handleExportModeChange('web')} className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer flex flex-col items-center justify-center min-h-[64px] ${exportMode === 'web' ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-extrabold' : 'border-slate-205 text-slate-500 hover:bg-slate-100/50'}`}>
                    <span className="text-[11px] font-bold">Web Truyện</span>
                    <span className="text-[8px] text-slate-400 font-normal mt-0.5">Giữ tiêu đề (≤20 ch.)</span>
                  </button>
                  <button type="button" onClick={() => handleExportModeChange('audio')} className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer flex flex-col items-center justify-center min-h-[64px] ${exportMode === 'audio' ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-extrabold' : 'border-slate-205 text-slate-500 hover:bg-slate-100/50'}`}>
                    <span className="text-[11px] font-bold">Làm Audio</span>
                    <span className="text-[8px] text-slate-400 font-normal mt-0.5">Xóa tiêu đề (≤10 ch.)</span>
                  </button>
                  <button type="button" onClick={() => handleExportModeChange('align_jsonl')} className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer flex flex-col items-center justify-center min-h-[64px] ${exportMode === 'align_jsonl' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-extrabold' : 'border-slate-205 text-slate-500 hover:bg-slate-100/50'}`}>
                    <span className="text-[11px] font-bold">Gióng hàng FT</span>
                    <span className="text-[8px] text-slate-400 font-normal mt-0.5">JSONL Song ngữ</span>
                  </button>
                </div>
              </div>

              {exportMode !== 'align_jsonl' ? (
                  <>
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700">Gom chương mỗi tệp:</span>
                        <span className="bg-emerald-600 text-white rounded-full px-2 py-0.5 text-[10px] font-extrabold">{chaptersPerFile} chương / file</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input type="range" min={1} max={exportMode === 'web' ? 20 : 10} value={chaptersPerFile} onChange={(e) => setChaptersPerFile(Number(e.target.value))} className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600" />
                        <input type="number" min={1} max={exportMode === 'web' ? 20 : 10} value={chaptersPerFile} onChange={(e) => setChaptersPerFile(Math.min(exportMode === 'web' ? 20 : 10, Math.max(1, Number(e.target.value))))} className="w-12 text-center text-xs border border-slate-250 rounded bg-slate-50 py-0.5 font-bold" />
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-bold text-slate-700 block">Lọc phạm vi xuất:</label>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <button type="button" onClick={() => setExportScope('translated')} className={`py-1.5 px-2 rounded-lg text-xs font-bold border cursor-pointer ${exportScope === 'translated' ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-extrabold' : 'border-slate-205 text-slate-500 font-semibold'}`}>Chỉ chương đã dịch</button>
                        <button type="button" onClick={() => setExportScope('all')} className={`py-1.5 px-2 rounded-lg text-xs font-bold border cursor-pointer ${exportScope === 'all' ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-extrabold' : 'border-slate-205 text-slate-500 font-semibold'}`}>Toàn bộ dự án</button>
                      </div>
                    </div>
                  </>
              ) : (
                  <div className="bg-indigo-50/40 border border-indigo-100 p-3 rounded-lg text-[10px] text-indigo-900 leading-relaxed">• Mỗi chương trích một file `.jsonl` độc lập.<br />• Khớp sọc đối nghĩa Trung-Việt 100% làm học liệu huấn luyện tinh chỉnh AI.</div>
              )}

              <button onClick={exportMode === 'align_jsonl' ? handleExportAlignJsonl : handleExportTxt} disabled={isExportingTxt} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer">
                {isExportingTxt ? "Đang xử lý kết xuất..." : exportMode === 'align_jsonl' ? "Bắt đầu gióng hàng & tải .JSONL" : "Bắt đầu xuất tải tệp .TXT sỉ"}
              </button>
            </div>
          </div>

          {/* Cột theo dõi trạng thái và Console logs Terminal */}
          <div id="queue-and-discovered-view" className="lg:col-span-2 space-y-4">
            {chaptersQueue.length > 0 && (
                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5"><ListOrdered className="w-4 h-4 text-indigo-500" /> Trạng thái vận chuyển hàng đợi ({processedCount}/{chaptersQueue.length})</span>
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-extrabold text-slate-700">{Math.round((processedCount / chaptersQueue.length) * 100)}% Hoàn thành</span>
                  </div>
                  <div className="w-full bg-slate-150 rounded-full h-2 overflow-hidden">
                    <div className="bg-indigo-600 h-2 rounded-full transition-all duration-500" style={{ width: `${(processedCount / chaptersQueue.length) * 100}%` }}></div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-24 overflow-y-auto pt-1 text-[10px]">
                    {chaptersQueue.map((chap, idx) => {
                      const isCurrent = idx === currentChapterIndex;
                      const isDone = idx < currentChapterIndex;
                      return (
                          <div key={chap.id} className={`p-1.5 rounded border flex items-center justify-between ${isCurrent ? 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold animate-pulse' : isDone ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-slate-100 bg-slate-50/50 text-slate-400'}`}>
                            <span className="truncate flex-1" title={chap.title}>{chap.title}</span>
                            {isDone && <Check className="w-3 h-3 text-emerald-600 shrink-0 ml-1" />}
                            {isCurrent && <RefreshCw className="w-2.5 h-2.5 animate-spin text-indigo-600 shrink-0 ml-1" />}
                          </div>
                      );
                    })}
                  </div>
                </div>
            )}

            {/* Thành phần Console Log đã bóc tách được ghi nhận tối ưu bọc React.memo */}
            <TerminalConsole logs={logs} onClear={() => setLogs([])} />

            {/* Bảng danh sách hiển thị các từ vựng mới tự động trích lọc gối đầu */}
            {autoDiscoveredBatch.length > 0 && (
                <div className="bg-emerald-50/60 border border-emerald-205 text-emerald-950 p-4 rounded-xl space-y-2 shadow-3xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-850"><Sparkles className="w-4 h-4 text-emerald-600 animate-bounce" /> <span>Tổng thuật ngữ thu hoạch mới kì này ({autoDiscoveredBatch.length})</span></div>
                    <span className="text-[9px] text-emerald-600 bg-white border border-emerald-200 px-2 py-0.5 rounded-full font-bold">Tự động liên kết gối đầu thành công</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1 pt-1">
                    {autoDiscoveredBatch.map((item) => (
                        <span key={item.id} className="inline-flex items-center gap-1.5 bg-white border border-emerald-200 rounded px-2 py-0.5 text-xs shadow-3xs font-semibold" title={`Ghi chú: ${item.note || 'Không có'}`}>
                        <code className="text-rose-600 font-bold font-mono text-[10px]">{item.chinese}</code>
                        <ChevronRight className="w-2.5 h-2.5 text-emerald-400" />
                        <span className="text-indigo-900 font-extrabold">{item.vietnamese}</span>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded">{item.type === 'character' ? 'Nhân vật' : item.type === 'location' ? 'Địa danh' : 'Bí pháp'}</span>
                      </span>
                    ))}
                  </div>
                </div>
            )}
          </div>
        </div>

        {/* Modal xem chi tiết diff sourceText vs processedSourceText */}
        {isDiffModalOpen && (() => {
          const processedChapters = projectRef.current.chapters.filter(c => c.processedSourceText);
          if (processedChapters.length === 0) return null;
          const safeIdx = Math.min(diffModalChapterIndex, processedChapters.length - 1);
          const chap = processedChapters[safeIdx];
          const glossary = projectRef.current.glossary;

          // Tìm các từ đã được thay trong chương này
          const replacedTerms = glossary.filter(item => {
            if (!item.chinese || !item.vietnamese) return false;
            return chap.sourceText.includes(item.chinese);
          });

          // Highlight processedSourceText: bọc các từ đã thay bằng span màu
          const buildHighlightedHtml = (text: string) => {
            let result = text;
            const sorted = [...glossary]
              .filter(i => i.vietnamese)
              .sort((a, b) => b.vietnamese.length - a.vietnamese.length);
            const placeholder: Record<string, string> = {};
            sorted.forEach((item, idx) => {
              if (!item.vietnamese) return;
              const escaped = item.vietnamese.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const key = `««TERM_${idx}»»`;
              result = result.replace(new RegExp(escaped, 'g'), key);
              placeholder[key] = `<mark class="bg-amber-200 text-amber-900 rounded px-0.5 font-bold">${item.vietnamese}</mark>`;
            });
            Object.entries(placeholder).forEach(([k, v]) => {
              result = result.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), v);
            });
            return result;
          };

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 shrink-0">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-amber-600" />
                    <h2 className="text-sm font-bold text-slate-900">Kiểm tra thay thế từ điển vào văn bản gốc</h2>
                    <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-bold">{processedChapters.length} chương đã xử lý</span>
                  </div>
                  <button onClick={() => setIsDiffModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer">
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>

                {/* Chapter selector */}
                <div className="px-5 py-2.5 border-b border-slate-100 shrink-0 flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-600 shrink-0">Chương:</span>
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5 flex-1">
                    {processedChapters.map((c, idx) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setDiffModalChapterIndex(idx)}
                        className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                          idx === safeIdx
                            ? 'bg-amber-500 border-amber-500 text-white'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {c.title.length > 20 ? c.title.slice(0, 20) + '…' : c.title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Từ đã thay */}
                {replacedTerms.length > 0 && (
                  <div className="px-5 py-2.5 border-b border-slate-100 shrink-0 bg-amber-50/50">
                    <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1.5">Thuật ngữ được thay trong chương này ({replacedTerms.length}):</p>
                    <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                      {replacedTerms.map(item => (
                        <span key={item.id} className="inline-flex items-center gap-1 bg-white border border-amber-200 rounded px-2 py-0.5 text-[11px] font-semibold">
                          <code className="text-rose-600 font-bold font-mono text-[10px]">{item.chinese}</code>
                          <ChevronRight className="w-2.5 h-2.5 text-amber-400" />
                          <span className="text-amber-900 font-bold">{item.vietnamese}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Diff view */}
                <div className="grid grid-cols-2 flex-1 overflow-hidden">
                  {/* Cột trái: sourceText gốc */}
                  <div className="flex flex-col border-r border-slate-200 overflow-hidden">
                    <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 shrink-0">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">● Văn bản gốc (sourceText)</span>
                    </div>
                    <pre className="flex-1 overflow-y-auto p-4 text-xs text-slate-700 font-mono leading-relaxed whitespace-pre-wrap break-words">{chap.sourceText}</pre>
                  </div>

                  {/* Cột phải: processedSourceText có highlight */}
                  <div className="flex flex-col overflow-hidden">
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 shrink-0">
                      <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">● Đã áp dụng từ điển (processedSourceText)</span>
                    </div>
                    <div
                      className="flex-1 overflow-y-auto p-4 text-xs text-slate-700 font-mono leading-relaxed whitespace-pre-wrap break-words"
                      dangerouslySetInnerHTML={{ __html: buildHighlightedHtml(chap.processedSourceText || '') }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-200 shrink-0 flex justify-end">
                  <button
                    onClick={() => setIsDiffModalOpen(false)}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Khối Floating Drive Progress Monitor Widget (Sub-component đã bóc tách độc lập) */}
        <DriveProgressWidget
            isVisible={isDriveWidgetVisible}
            isMinimized={isDriveWidgetMinimized}
            setIsMinimized={setIsDriveWidgetMinimized}
            setIsVisible={setIsDriveWidgetVisible}
            isProcessing={isProcessing}
            processedCount={processedCount}
            totalQueueLength={chaptersQueue.length}
            estTimeStr={estTimeStr}
            remainingRequests={remainingRequests}
            polishCycles={polishCycles}
            remainingChapters={remainingChapters}
            currentChapterTitle={chaptersQueue[currentChapterIndex]?.title}
            selectedModel={selectedModel}
            onStop={handleStopTranslation}
            onResume={handleToggleProcessing}
            onSaveBackup={triggerExportDownload}
        />

        {/* Khối Floating Glossary Scan Progress Widget (Sub-component đã bóc tách độc lập) */}
        <GlossaryScanWidget
            isVisible={isScanWidgetVisible}
            isMinimized={isScanWidgetMinimized}
            setIsMinimized={setIsScanWidgetMinimized}
            setIsVisible={setIsScanWidgetVisible}
            isScanning={isScanningGlossary}
            currentScanningChapterIndex={currentScanningChapterIndex}
            totalScanChapters={totalScanChapters}
            scanningProgress={scanningProgress}
            currentExtractionLoop={currentExtractionLoop}
            extractionLoops={extractionLoops}
            scanFoundCount={scanFoundCount}
            currentScanningChapterTitle={currentScanningChapterTitle}
            selectedModel={selectedModel}
            onToggleScan={handleAutoExtractGlossary}
        />
      </div>
  );
}


