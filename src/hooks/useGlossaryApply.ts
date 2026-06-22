import { useState, useRef, useEffect, useCallback, startTransition } from 'react';
import { StoryProject } from '../types';
import { getChapterFromDB, saveChapterToDB, getChaptersByProjectFromDB } from '../services/db';
import { LogEntry } from './useAutoTranslationQueue';
import { useNotifications } from '../components/NotificationSystem';

export interface UseGlossaryApplyProps {
  activeProject: StoryProject;
  onUpdateProject: (updated: StoryProject) => void;
  applyGlossaryRangeEnabled: boolean;
  applyGlossaryRangeStart: number;
  applyGlossaryRangeEnd: number;

  // Shared state updater
  addLog: (message: string, type?: LogEntry['type']) => void;
}

export function useGlossaryApply({
  activeProject,
  onUpdateProject,
  applyGlossaryRangeEnabled,
  applyGlossaryRangeStart,
  applyGlossaryRangeEnd,
  addLog,
}: UseGlossaryApplyProps) {
  const { showToast } = useNotifications();
  const [isApplyingGlossary, setIsApplyingGlossary] = useState<boolean>(false);
  const [applyGlossaryResult, setApplyGlossaryResult] = useState<{ replaced: number; chapters: number } | null>(null);

  const projectRef = useRef<StoryProject>(activeProject);

  useEffect(() => {
    projectRef.current = activeProject;
  }, [activeProject]);

  const handleApplyGlossaryToAllChapters = useCallback(async () => {
    const glossary = projectRef.current.glossary;
    const chapters = projectRef.current.chapters;

    if (glossary.length === 0) {
      showToast({ message: 'Từ điển dự án đang trống!', type: 'warning' });
      return;
    }
    if (chapters.length === 0) {
      showToast({ message: 'Bộ truyện chưa có chương nào!', type: 'warning' });
      return;
    }

    setIsApplyingGlossary(true);
    setApplyGlossaryResult(null);

    const runApply = async () => {
      try {
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

        const dbChapters = await getChaptersByProjectFromDB(projectRef.current.id);
        const chaptersMap = new Map(dbChapters.map(c => [c.id, c]));

        const updatedChaptersMetadata = await Promise.all(chapters.map(async (chapMeta) => {
          if (!scopedChapters.includes(chapMeta) || !pattern) {
            return chapMeta;
          }

          const fullChap = chaptersMap.get(chapMeta.id);
          if (!fullChap) return chapMeta;

          let result = fullChap.sourceText;
          const matchedTerms = new Set<string>();

          result = result.replace(pattern, (match) => {
            matchedTerms.add(match);
            return glossaryMap.get(match) || match;
          });

          const chapReplaced = matchedTerms.size;
          if (chapReplaced > 0) {
            totalReplaced += chapReplaced;
            chaptersAffected++;
            const updatedFull = {
              ...fullChap,
              processedSourceText: result,
              updatedAt: new Date().toISOString()
            };
            await saveChapterToDB(updatedFull);
            return {
              ...chapMeta,
              updatedAt: updatedFull.updatedAt
            };
          }
          return chapMeta;
        }));

        startTransition(() => {
          onUpdateProject({ ...projectRef.current, chapters: updatedChaptersMetadata });
          setApplyGlossaryResult({ replaced: totalReplaced, chapters: chaptersAffected });
          setIsApplyingGlossary(false);
        });
        addLog(`Áp dụng từ điển hoàn tất: thay thế ${totalReplaced} thuật ngữ trên ${chaptersAffected}/${scopedChapters.length} chương được chọn.`, 'success');
      } catch (err: any) {
        console.error(err);
        addLog(`Lỗi áp dụng từ điển: ${err.message}`, 'error');
        startTransition(() => {
          setIsApplyingGlossary(false);
        });
      }
    };

    runApply();
  }, [applyGlossaryRangeEnabled, applyGlossaryRangeStart, applyGlossaryRangeEnd, onUpdateProject, addLog]);

  return {
    isApplyingGlossary,
    applyGlossaryResult,
    setApplyGlossaryResult,
    handleApplyGlossaryToAllChapters,
  };
}
