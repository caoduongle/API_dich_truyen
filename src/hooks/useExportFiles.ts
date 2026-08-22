import { useState, useRef, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { StoryProject, Chapter, ChapterMetadata } from '../types';
import { getChapterFromDB, getChaptersByProjectFromDB } from '../services/db';
import { LogEntry } from './useAutoTranslationQueue';
import { triggerDownload } from '../utils/download';
import { useNotifications } from '../components/NotificationSystem';
import { apiFetch } from '../utils/apiClient';
import { buildExportFileContent } from '../utils/exportFormatter';

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

        const formattedInputs = validChunk.map((chap, idx) => ({
          index: chunkIdx * cap + idx + 1,
          chapterTitle: chap.title,
          sourceText: chap.sourceText,
          translatedText: chap.polishedTranslation || chap.rawTranslation || "",
        }));

        const fileContent = buildExportFileContent(formattedInputs, exportMode);

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
      const generatedFiles: Array<{ filename: string; content: string }> = [];

      for (let i = 0; i < chaptersToExport.length; i++) {
        const chapMeta = chaptersToExport[i];
        const chap = chaptersMap.get(chapMeta.id);
        if (!chap) continue;
        addLog(`--------------------------------------------------`, 'info');
        addLog(`[Gióng hàng ${i + 1}/${chaptersToExport.length}] Phân tích gióng câu bằng AI: ${chap.title}...`, 'gemini');

        const translatedText = (chap.polishedTranslation || chap.rawTranslation || "").trim();
        try {
          // TODO(zero-knowledge-session): port sang client-direct, xem specs/060-zero-knowledge-session-sync
          const res = await apiFetch('/api/align-chapter', {
            method: 'POST',
            allowApiKeysInBody: true,
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

          generatedFiles.push({ filename, content: fileContent });
          addLog(`Gióng hàng thành công chương: ${chap.title}`, 'success');
        } catch (chapErr: any) {
          addLog(`Thất bại tại chương "${chap.title}": ${chapErr.message || chapErr}`, 'error');
        }
      }

      if (generatedFiles.length === 0) {
        showToast({ message: "Không có dữ liệu gióng hàng nào được tạo ra!", type: 'warning' });
      } else if (generatedFiles.length === 1) {
        const single = generatedFiles[0];
        const blob = new Blob([single.content], { type: "application/x-jsonlines;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        triggerDownload(url, single.filename);
        URL.revokeObjectURL(url);
        addLog(`Xuất bản thành công tệp học liệu: ${single.filename}`, 'success');
      } else {
        addLog(`Đang nén ${generatedFiles.length} tệp học liệu thành file .ZIP...`, 'info');
        const zip = new JSZip();
        for (const file of generatedFiles) {
          zip.file(file.filename, file.content);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const sanitize = (str: string) => str.replace(/[\s\/:*?"<>|\\#%@;=]+/g, '_').substring(0, 30);
        const zipName = `${sanitize(proj.title)}_ALIGN_FT_${generatedFiles.length}chaps.zip`;
        triggerDownload(url, zipName);
        URL.revokeObjectURL(url);
        addLog(`Xuất bản thành công gói học liệu dạng ZIP: ${zipName}`, 'success');
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
