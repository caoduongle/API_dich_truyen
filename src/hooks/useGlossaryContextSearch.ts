import { useState, useEffect, useMemo, useCallback } from 'react';
import { GlossaryItem, Chapter, ChapterMetadata } from '../types';
import { getChaptersByProjectFromDB } from '../services/db';

export interface ContextMatchItem {
  chapterId: string;
  chapterTitle: string;
  textType: 'source' | 'raw' | 'polished';
  paragraphText: string;
  paragraphIndex: number;
}

export function useGlossaryContextSearch(projectId: string, chapters: ChapterMetadata[] = [], glossary: GlossaryItem[] = []) {
  const [fullChapters, setFullChapters] = useState<Chapter[]>([]);
  const [searchContextMatches, setSearchContextMatches] = useState<ContextMatchItem[]>([]);
  const [contextFilterType, setContextFilterType] = useState<'all' | 'source' | 'translation'>('all');

  useEffect(() => {
    async function loadFullChapters() {
      if (projectId) {
        const full = await getChaptersByProjectFromDB(projectId);
        setFullChapters(full);
      }
    }
    loadFullChapters();
  }, [projectId, chapters]);

  const findLiveContext = useCallback((chineseTerm: string): Array<{
    chapterTitle: string;
    sourceLine: string;
    translationLine: string;
  }> => {
    const clean = chineseTerm.replace(/\s+/g, '').trim();
    const results: Array<{ chapterTitle: string; sourceLine: string; translationLine: string }> = [];

    for (const chap of fullChapters) {
      const srcLines = chap.sourceText.split('\n');
      const transLines = (chap.polishedTranslation || chap.rawTranslation || '').split('\n');

      for (let i = 0; i < srcLines.length; i++) {
        const line = srcLines[i].trim();
        if (!line) continue;
        if (line.includes(chineseTerm.trim()) || line.replace(/\s+/g, '').includes(clean)) {
          results.push({
            chapterTitle: chap.title,
            sourceLine: line,
            translationLine: transLines[i]?.trim() || '',
          });
          break;
        }
      }
    }
    return results;
  }, [fullChapters]);

  const scanOccurrences = useCallback((item: GlossaryItem) => {
    if (!fullChapters || fullChapters.length === 0) {
      setSearchContextMatches([]);
      return;
    }

    const matches: ContextMatchItem[] = [];
    const zhTerm = item.chinese.trim();
    const viTerm = item.vietnamese.trim();

    fullChapters.forEach((chap) => {
      if (zhTerm && chap.sourceText) {
        const paragraphs = chap.sourceText.split('\n');
        paragraphs.forEach((pText, idx) => {
          if (pText.includes(zhTerm)) {
            matches.push({
              chapterId: chap.id,
              chapterTitle: chap.title,
              textType: 'source',
              paragraphText: pText.trim(),
              paragraphIndex: idx + 1,
            });
          }
        });
      }

      if (viTerm && chap.rawTranslation) {
        const paragraphs = chap.rawTranslation.split('\n');
        paragraphs.forEach((pText, idx) => {
          if (pText.toLowerCase().includes(viTerm.toLowerCase())) {
            matches.push({
              chapterId: chap.id,
              chapterTitle: chap.title,
              textType: 'raw',
              paragraphText: pText.trim(),
              paragraphIndex: idx + 1,
            });
          }
        });
      }

      if (viTerm && chap.polishedTranslation) {
        const paragraphs = chap.polishedTranslation.split('\n');
        paragraphs.forEach((pText, idx) => {
          if (pText.toLowerCase().includes(viTerm.toLowerCase())) {
            matches.push({
              chapterId: chap.id,
              chapterTitle: chap.title,
              textType: 'polished',
              paragraphText: pText.trim(),
              paragraphIndex: idx + 1,
            });
          }
        });
      }
    });

    setSearchContextMatches(matches);
  }, [fullChapters]);

  // Compute total occurrences of all glossary terms across all chapters
  const chapterOccurrencesCount = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!fullChapters || fullChapters.length === 0) return counts;

    glossary.forEach((item) => {
      const zh = item.chinese.trim();
      if (!zh) return;
      let total = 0;
      fullChapters.forEach((chap) => {
        if (chap.sourceText) {
          const matched = chap.sourceText.split(zh).length - 1;
          total += matched;
        }
      });
      counts[item.id] = total;
    });
    return counts;
  }, [fullChapters, glossary]);

  return {
    fullChapters,
    searchContextMatches,
    setSearchContextMatches,
    contextFilterType,
    setContextFilterType,
    findLiveContext,
    scanOccurrences,
    chapterOccurrencesCount,
  };
}
