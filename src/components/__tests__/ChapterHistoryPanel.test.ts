import { describe, it, expect } from 'vitest';
import {
  transformChapterDeletePolished,
  transformChapterDeleteRaw,
  transformChapterPromotePolishedToRaw,
  transformChaptersBatch,
} from '../ChapterHistoryPanel';
import { Chapter } from '../../types';

describe('ChapterHistoryPanel Draft Transformation Functions', () => {
  const baseChapter: Chapter = {
    id: 'chap_138',
    title: '第一百三十八章 捅向裆部',
    sourceText: '检查对方身上是否有值钱的东西。\n\n然而让他有些失望的是。',
    rawTranslation: 'Chương 138: Đâm thẳng vào hạ bộ\n\nKiểm tra xem trên người đối phương có thứ gì đáng giá hay không.\n\nNhưng điều khiến hắn có chút thất vọng là.',
    polishedTranslation: 'Chương 138: Đâm thẳng vào hạ bộ\n\nKiểm tra xem trên người đối phương có thứ gì đáng giá hay không vốn là thói quen mỗi khi Tô Bạch ra tay.',
    paragraphs: ['检查对方身上是否有值钱的东西。', '然而让他有些失望的是。'],
    translatedLines: ['Chương 138: Đâm thẳng vào hạ bộ', 'Kiểm tra xem trên người đối phương có thứ gì đáng giá hay không vốn là thói quen mỗi khi Tô Bạch ra tay.'],
    status: 'completed',
    createdAt: '2026-08-17T23:29:14.000Z',
    updatedAt: '2026-08-17T23:29:14.000Z',
  };

  describe('transformChapterDeletePolished', () => {
    it('clears polishedTranslation, retains rawTranslation, and transitions status to in_progress', () => {
      const result = transformChapterDeletePolished(baseChapter);

      expect(result.polishedTranslation).toBe('');
      expect(result.rawTranslation).toBe(baseChapter.rawTranslation);
      expect(result.status).toBe('in_progress');
      expect(result.translatedLines.length).toBeGreaterThan(0);
      expect(result.translatedLines).toEqual(
        baseChapter.rawTranslation.split(/\n+/).map((l) => l.trim()).filter(Boolean)
      );
    });

    it('sets status to not_started if rawTranslation is also empty', () => {
      const chapterWithoutRaw: Chapter = {
        ...baseChapter,
        rawTranslation: '',
      };
      const result = transformChapterDeletePolished(chapterWithoutRaw);

      expect(result.polishedTranslation).toBe('');
      expect(result.rawTranslation).toBe('');
      expect(result.status).toBe('not_started');
      expect(result.translatedLines).toEqual([]);
    });
  });

  describe('transformChapterDeleteRaw', () => {
    it('clears rawTranslation, retains polishedTranslation, and keeps status completed', () => {
      const result = transformChapterDeleteRaw(baseChapter);

      expect(result.rawTranslation).toBe('');
      expect(result.polishedTranslation).toBe(baseChapter.polishedTranslation);
      expect(result.status).toBe('completed');
      expect(result.translatedLines).toEqual(
        baseChapter.polishedTranslation.split(/\n+/).map((l) => l.trim()).filter(Boolean)
      );
    });

    it('sets status to not_started if polishedTranslation is also empty', () => {
      const chapterWithoutPolished: Chapter = {
        ...baseChapter,
        polishedTranslation: '',
      };
      const result = transformChapterDeleteRaw(chapterWithoutPolished);

      expect(result.rawTranslation).toBe('');
      expect(result.status).toBe('not_started');
      expect(result.translatedLines).toEqual([]);
    });
  });

  describe('transformChapterPromotePolishedToRaw', () => {
    it('copies polishedTranslation to rawTranslation, clears polishedTranslation, and sets status to in_progress', () => {
      const result = transformChapterPromotePolishedToRaw(baseChapter);

      expect(result.rawTranslation).toBe(baseChapter.polishedTranslation);
      expect(result.polishedTranslation).toBe('');
      expect(result.status).toBe('in_progress');
      expect(result.translatedLines).toEqual(
        baseChapter.polishedTranslation.split(/\n+/).map((l) => l.trim()).filter(Boolean)
      );
    });
  });

  describe('transformChaptersBatch', () => {
    const chapter1: Chapter = {
      ...baseChapter,
      id: 'chap_1',
      title: 'Chương 1',
      rawTranslation: 'Bản dịch thô 1',
      polishedTranslation: 'Bản biên tập 1',
      status: 'completed',
    };

    const chapter2: Chapter = {
      ...baseChapter,
      id: 'chap_2',
      title: 'Chương 2',
      rawTranslation: 'Bản dịch thô 2',
      polishedTranslation: '',
      status: 'in_progress',
    };

    const chapter3: Chapter = {
      ...baseChapter,
      id: 'chap_3',
      title: 'Chương 3',
      rawTranslation: '',
      polishedTranslation: 'Bản biên tập 3',
      status: 'completed',
    };

    it('batch deletePolished only modifies chapters with polished translations', () => {
      const { updatedChapters, modifiedCount } = transformChaptersBatch(
        [chapter1, chapter2, chapter3],
        'deletePolished'
      );

      expect(modifiedCount).toBe(2);
      // chapter 1 had polished -> cleared, raw preserved
      expect(updatedChapters[0].polishedTranslation).toBe('');
      expect(updatedChapters[0].rawTranslation).toBe('Bản dịch thô 1');
      expect(updatedChapters[0].status).toBe('in_progress');

      // chapter 2 had no polished -> untouched
      expect(updatedChapters[1].polishedTranslation).toBe('');
      expect(updatedChapters[1].rawTranslation).toBe('Bản dịch thô 2');

      // chapter 3 had polished but no raw -> cleared, status not_started
      expect(updatedChapters[2].polishedTranslation).toBe('');
      expect(updatedChapters[2].status).toBe('not_started');
    });

    it('batch deleteRaw only modifies chapters with raw translations', () => {
      const { updatedChapters, modifiedCount } = transformChaptersBatch(
        [chapter1, chapter2, chapter3],
        'deleteRaw'
      );

      expect(modifiedCount).toBe(2);
      // chapter 1 had raw -> cleared, polished preserved
      expect(updatedChapters[0].rawTranslation).toBe('');
      expect(updatedChapters[0].polishedTranslation).toBe('Bản biên tập 1');
      expect(updatedChapters[0].status).toBe('completed');

      // chapter 2 had raw but no polished -> cleared, status not_started
      expect(updatedChapters[1].rawTranslation).toBe('');
      expect(updatedChapters[1].status).toBe('not_started');

      // chapter 3 had no raw -> untouched
      expect(updatedChapters[2].rawTranslation).toBe('');
      expect(updatedChapters[2].polishedTranslation).toBe('Bản biên tập 3');
    });

    it('batch promotePolishedToRaw only modifies chapters with polished translations', () => {
      const { updatedChapters, modifiedCount } = transformChaptersBatch(
        [chapter1, chapter2, chapter3],
        'promotePolishedToRaw'
      );

      expect(modifiedCount).toBe(2);
      // chapter 1: polished becomes raw
      expect(updatedChapters[0].rawTranslation).toBe('Bản biên tập 1');
      expect(updatedChapters[0].polishedTranslation).toBe('');
      expect(updatedChapters[0].status).toBe('in_progress');

      // chapter 2: had no polished -> untouched
      expect(updatedChapters[1].rawTranslation).toBe('Bản dịch thô 2');

      // chapter 3: polished becomes raw
      expect(updatedChapters[2].rawTranslation).toBe('Bản biên tập 3');
      expect(updatedChapters[2].polishedTranslation).toBe('');
      expect(updatedChapters[2].status).toBe('in_progress');
    });

    it('returns 0 modifiedCount when no chapters meet criteria', () => {
      const { updatedChapters, modifiedCount } = transformChaptersBatch(
        [chapter2],
        'deletePolished'
      );

      expect(modifiedCount).toBe(0);
      expect(updatedChapters[0]).toEqual(chapter2);
    });
  });
});
