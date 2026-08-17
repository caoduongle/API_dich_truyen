import { useState, useEffect, useCallback } from 'react';
import { GlossaryItem, Chapter, ChapterMetadata } from '../types';
import { getChaptersByProjectFromDB } from '../services/db';

export interface ContextMatchItem {
  chapterId: string;
  chapterTitle: string;
  textType: 'source' | 'raw' | 'polished';
  paragraphText: string;
  paragraphIndex: number;
}

export function useGlossaryContextSearch(projectId: string, chapters: ChapterMetadata[] = [], _glossary: GlossaryItem[] = []) {
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
      if (results.length >= 3) break;
    }
    return results;
  }, [fullChapters]);

  const scanOccurrences = useCallback((itemOrZh: GlossaryItem | string, viTermParam?: string) => {
    let zhTerm = '';
    let viTerm = '';
    if (typeof itemOrZh === 'object' && itemOrZh !== null) {
      zhTerm = (itemOrZh.chinese || '').trim();
      viTerm = (itemOrZh.vietnamese || '').trim();
    } else if (typeof itemOrZh === 'string') {
      zhTerm = itemOrZh.trim();
      viTerm = (viTermParam || '').trim();
    }

    if (!zhTerm && !viTerm) {
      setSearchContextMatches([]);
      return;
    }

    const matches: ContextMatchItem[] = [];

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

  return {
    fullChapters,
    searchContextMatches,
    setSearchContextMatches,
    contextFilterType,
    setContextFilterType,
    findLiveContext,
    scanOccurrences,
  };
}
