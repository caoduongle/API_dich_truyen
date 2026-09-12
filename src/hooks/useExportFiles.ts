import { useState, useRef, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { StoryProject, Chapter, ChapterMetadata } from '../types';
import { getChaptersByProjectFromDB } from '../services/db';
import { LogEntry } from './useAutoTranslationQueue';
import { triggerDownload } from '../utils/download';
import { useNotifications } from '../context/NotificationContext';
import { buildExportFileContent, formatExportTxtFileName } from '../utils/exportFormatter';

export interface UseExportFilesProps {
  activeProject: StoryProject;
  chaptersPerFile: number;
  exportScope: 'all' | 'translated';
  exportMode: 'web' | 'audio';
  apiKeys?: string[];
  selectedModel?: string;

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
      const chapterIndexMap = new Map(allChapters.map((c, idx) => [c.id, idx + 1]));
      const getChapterIndex = (chapId: string) => chapterIndexMap.get(chapId) || 1;

      const chaptersChunks: ChapterMetadata[][] = [];
      const maxLimit = exportMode === 'web' ? 20 : 10;
      const cap = Math.min(maxLimit, Math.max(1, chaptersPerFile));
      for (let i = 0; i < chaptersToExport.length; i += cap) {
        chaptersChunks.push(chaptersToExport.slice(i, i + cap));
      }

      const sanitize = (str: string) => (str || 'Truyen').replace(/[\s\/:*?"<>|\\#%@;=]+/g, '_').substring(0, 30);
      const cleanTitle = sanitize(proj.title);

      const zip = new JSZip();

      for (let chunkIdx = 0; chunkIdx < chaptersChunks.length; chunkIdx++) {
        const chunkMeta = chaptersChunks[chunkIdx];
        const validChunk = chunkMeta.map(meta => chaptersMap.get(meta.id)).filter((c): c is Chapter => !!c);
        if (validChunk.length === 0) continue;

        const formattedInputs = validChunk.map((chap) => ({
          index: getChapterIndex(chap.id),
          chapterTitle: chap.title,
          sourceText: chap.sourceText,
          translatedText: chap.polishedTranslation || chap.rawTranslation || "",
        }));

        const fileContent = buildExportFileContent(formattedInputs, exportMode);

        const firstChapter = validChunk[0];
        const lastChapter = validChunk[validChunk.length - 1];
        const startIndex = getChapterIndex(firstChapter.id);
        const endIndex = getChapterIndex(lastChapter.id);

        const filename = formatExportTxtFileName({
          projectTitle: proj.title,
          startIndex,
          endIndex,
          mode: exportMode,
        });
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

  return {
    isExportingTxt,
    handleExportTxt,
  };
}
