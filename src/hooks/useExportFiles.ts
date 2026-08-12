import { useState, useRef, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { StoryProject, Chapter, ChapterMetadata } from '../types';
import { getChapterFromDB, getChaptersByProjectFromDB } from '../services/db';
import { LogEntry } from './useAutoTranslationQueue';
import { triggerDownload } from '../utils/download';
import { useNotifications } from '../components/NotificationSystem';

export interface UseExportFilesProps {
  activeProject: StoryProject;
  chaptersPerFile: number;
  exportScope: 'all' | 'translated';
  exportMode: 'web' | 'audio' | 'align_jsonl';
  apiKeys: string[];
  selectedModel: string;

  // Shared state updater
  addLog: (message: string, type?: LogEntry['type']) => void;

  exportRangeEnabled: boolean;
  exportRangeStart: number;
  exportRangeEnd: number;
}

export function useExportFiles({
  activeProject,
  chaptersPerFile,
  exportScope,
  exportMode,
  apiKeys,
  selectedModel,
  addLog,
  exportRangeEnabled,
  exportRangeStart,
  exportRangeEnd,
}: UseExportFilesProps) {
  const { showToast } = useNotifications();
  const [isExportingTxt, setIsExportingTxt] = useState<boolean>(false);

  const projectRef = useRef<StoryProject>(activeProject);

  useEffect(() => {
    projectRef.current = activeProject;
  }, [activeProject]);

  const handleExportTxt = useCallback(async () => {
    setIsExportingTxt(true);
    addLog(`BẮT ĐẦU SẢN XUẤT CÁC PHÂN ĐOẠN TỆP VĂN BẢN SẠCH (.TXT)...`, "info");
    try {
      const proj = projectRef.current;
      const allChapters = proj.chapters || [];
      if (allChapters.length === 0) {
        showToast({ message: "Bộ truyện chưa có chương nào để xuất!", type: 'warning' });
        setIsExportingTxt(false);
        return;
      }

      let chaptersToExport = allChapters;
      if (exportScope === 'translated') {
        chaptersToExport = allChapters.filter(c => c.status === 'completed' || c.status === 'in_progress');
      }

      if (exportRangeEnabled) {
        const startIdx = Math.max(0, exportRangeStart - 1);
        const endIdx = Math.min(allChapters.length, exportRangeEnd);
        const allowedIds = new Set(allChapters.slice(startIdx, endIdx).map(c => c.id));
        chaptersToExport = chaptersToExport.filter(c => allowedIds.has(c.id));
      }

      if (chaptersToExport.length === 0) {
        showToast({
          message: exportRangeEnabled
            ? "Không tìm thấy chương nào trong phạm vi đã chọn thỏa điều kiện lọc!"
            : "Không tìm thấy chương nào thỏa mãn điều kiện lọc!",
          type: 'warning'
        });
        setIsExportingTxt(false);
        return;
      }

      const dbChapters = await getChaptersByProjectFromDB(proj.id);
      const chaptersMap = new Map(dbChapters.map(c => [c.id, c]));

      const chaptersChunks: ChapterMetadata[][] = [];
      const maxLimit = exportMode === 'web' ? 20 : 10;
      const cap = Math.min(maxLimit, Math.max(1, chaptersPerFile));
      for (let i = 0; i < chaptersToExport.length; i += cap) {
        chaptersChunks.push(chaptersToExport.slice(i, i + cap));
      }

      const sanitize = (str: string) => str.replace(/[\s\/:*?"<>|\\#%@;=]+/g, '_').substring(0, 30);
      const cleanTitle = sanitize(proj.title);

      const zip = new JSZip();

      for (let chunkIdx = 0; chunkIdx < chaptersChunks.length; chunkIdx++) {
        const chunkMeta = chaptersChunks[chunkIdx];
        const validChunk = chunkMeta.map(meta => chaptersMap.get(meta.id)).filter((c): c is Chapter => !!c);
        if (validChunk.length === 0) continue;

        let fileContent = "";
        validChunk.forEach((chap, idx) => {
          const content = (chap.polishedTranslation || chap.rawTranslation || "").trim();
          const lines = content.split('\n');
          const titleRegex = /^(?:Chương|Chapter|Quyển|Tập|Thứ)\s+(?:\d+|[IVXLCDM]+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười|trăm|ngàn|vạn|nhất|nhị|tam|tứ|ngũ|lục|thất|bát|cửu|thập)/i;
          const chineseTitleRegex = /^第\s*[\d零一二三四五六七八九十百]+\s*[章节]/;
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

        const firstChapter = validChunk[0];
        const lastChapter = validChunk[validChunk.length - 1];
        const startName = sanitize(firstChapter.title);
        const endName = sanitize(lastChapter.title);

        const suffix = exportMode === 'audio' ? '_AUDIO' : '_WEB';
        const filename = `${cleanTitle}_[${startName}]_den_[${endName}]${suffix}.txt`;
        zip.file(filename, fileContent);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const zipFilename = `${cleanTitle}_TXT_EXPORT.zip`;
      triggerDownload(url, zipFilename);
      URL.revokeObjectURL(url);

      addLog("ĐÃ HOÀN TẤT ĐÓNG GÓI VÀ TẢI XUỐNG TỆP .ZIP CHỨA CÁC TỆP .TXT VĂN BẢN CHẤT LƯỢNG CAO!", "success");
    } catch (error: any) {
      addLog(`Lỗi khi xuất tệp: ${error.message || error}`, "error");
    } finally {
      setIsExportingTxt(false);
    }
  }, [chaptersPerFile, exportScope, exportMode, addLog, exportRangeEnabled, exportRangeStart, exportRangeEnd]);

  const handleExportAlignJsonl = useCallback(async () => {
    setIsExportingTxt(true);
    addLog(`BẮT ĐẦU QUY TRÌNH GIÓNG HÀNG SONG NGỮ TRUNG - VIỆT (HUẤN LUYỆN JSONL)...`, "info");
    try {
      const proj = projectRef.current;
      const allChapters = proj.chapters || [];
      if (allChapters.length === 0) {
        showToast({ message: "Bộ truyện chưa có chương nào để xuất!", type: 'warning' });
        setIsExportingTxt(false);
        return;
      }
      let chaptersToExport = allChapters.filter(c => c.status === 'completed' || c.status === 'in_progress');
      if (exportRangeEnabled) {
        const startIdx = Math.max(0, exportRangeStart - 1);
        const endIdx = Math.min(allChapters.length, exportRangeEnd);
        const allowedIds = new Set(allChapters.slice(startIdx, endIdx).map(c => c.id));
        chaptersToExport = chaptersToExport.filter(c => allowedIds.has(c.id));
      }

      if (chaptersToExport.length === 0) {
        showToast({
          message: exportRangeEnabled
            ? "Không tìm thấy chương nào trong phạm vi đã chọn thỏa điều kiện lọc!"
            : "Không tìm thấy chương truyện nào đã được dịch thuật để gióng hàng!",
          type: 'warning'
        });
        setIsExportingTxt(false);
        return;
      }

      const dbChapters = await getChaptersByProjectFromDB(proj.id);
      const chaptersMap = new Map(dbChapters.map(c => [c.id, c]));

      for (let i = 0; i < chaptersToExport.length; i++) {
        const chapMeta = chaptersToExport[i];
        const chap = chaptersMap.get(chapMeta.id);
        if (!chap) continue;
        addLog(`--------------------------------------------------`, 'info');
        addLog(`[Gióng hàng ${i + 1}/${chaptersToExport.length}] Phân tích gióng câu bằng AI: ${chap.title}...`, 'gemini');

        const translatedText = (chap.polishedTranslation || chap.rawTranslation || "").trim();
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
          triggerDownload(url, filename);
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
  }, [apiKeys, selectedModel, addLog, exportRangeEnabled, exportRangeStart, exportRangeEnd]);

  return {
    isExportingTxt,
    handleExportTxt,
    handleExportAlignJsonl,
  };
}
