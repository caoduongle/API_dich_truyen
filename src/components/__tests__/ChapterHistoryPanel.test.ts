import { describe, it, expect } from 'vitest';
import {
  transformChapterDeletePolished,
  transformChapterDeleteRaw,
  transformChapterPromotePolishedToRaw,
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
});
