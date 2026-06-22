import { describe, it, expect } from 'vitest';
import {
  canonicalizeHan,
  isHanEquivalent,
  findCanonicalSubstring,
  validateAndSnapBackEntities,
  findFuzzyCandidates
} from '../sinoNormalize';

describe('sinoNormalize shared utils', () => {
  describe('canonicalizeHan', () => {
    it('should convert Traditional Chinese characters to Simplified', () => {
      expect(canonicalizeHan('萬劍歸宗')).toBe('万剑归宗');
      expect(canonicalizeHan('蕭炎')).toBe('萧炎');
    });

    it('should leave already simplified characters unchanged', () => {
      expect(canonicalizeHan('万剑归宗')).toBe('万剑归宗');
    });

    it('should leave non-Chinese text unchanged', () => {
      expect(canonicalizeHan('hello 123')).toBe('hello 123');
    });

    it('should handle empty/null inputs', () => {
      expect(canonicalizeHan('')).toBe('');
      expect(canonicalizeHan(null as any)).toBe('');
    });
  });

  describe('isHanEquivalent', () => {
    it('should match Traditional and Simplified representations', () => {
      expect(isHanEquivalent('萬', '万')).toBe(true);
      expect(isHanEquivalent(' 萬劍歸宗 ', '万剑归宗')).toBe(true);
    });

    it('should return false for different words', () => {
      expect(isHanEquivalent('萧炎', '林动')).toBe(false);
    });
  });

  describe('findCanonicalSubstring', () => {
    it('should return the original matched substring in haystack', () => {
      expect(findCanonicalSubstring('這是一個萬劍歸宗', '万剑归宗')).toBe('萬劍歸宗');
    });

    it('should return null if no equivalent match exists', () => {
      expect(findCanonicalSubstring('這是一個萬劍歸宗', '九阳神功')).toBeNull();
    });

    it('should handle empty or null values', () => {
      expect(findCanonicalSubstring('', '万')).toBeNull();
      expect(findCanonicalSubstring('万', '')).toBeNull();
    });
  });

  describe('validateAndSnapBackEntities', () => {
    it('should keep entity unchanged if exact match exists in raw source', () => {
      const entities = [{ chinese: '萧炎', pinyin: 'Tiêu Viêm' }];
      const result = validateAndSnapBackEntities(entities, 'Đây là 萧炎 trong truyện.');
      expect(result[0].chinese).toBe('萧炎');
      expect(result[0].needsReview).toBeUndefined();
    });

    it('should snap back entity to raw source style if canonical match exists', () => {
      const entities = [{ chinese: '萧炎', pinyin: 'Tiêu Viêm' }];
      // Raw source uses traditional '蕭炎'
      const result = validateAndSnapBackEntities(entities, 'Đây là 蕭炎 trong truyện.');
      expect(result[0].chinese).toBe('蕭炎');
      expect(result[0].needsReview).toBeUndefined();
    });

    it('should set needsReview if entity not present in raw source', () => {
      const entities = [{ chinese: '林动', pinyin: 'Lâm Động' }];
      const result = validateAndSnapBackEntities(entities, 'Đây là 萧炎 trong truyện.');
      expect(result[0].needsReview).toBe(true);
    });
  });

  describe('findFuzzyCandidates', () => {
    it('should find similar terms within the source text', () => {
      const haystack = 'Hôm nay 萧炎 đấu với 纳兰嫣然 ở 乌坦城.';
      const candidates = findFuzzyCandidates(haystack, '萧炎');
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0].text).toBe('萧炎');
      expect(candidates[0].similarity).toBe(100);
    });

    it('should find partial bigram matches', () => {
      const haystack = '萬劍歸宗, 萬劍, 歸宗';
      const candidates = findFuzzyCandidates(haystack, '万剑归宗');
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.some(c => c.text === '萬劍歸宗')).toBe(true);
    });

    it('should return empty list on empty inputs', () => {
      expect(findFuzzyCandidates('', '萧炎')).toEqual([]);
      expect(findFuzzyCandidates('萧炎', '')).toEqual([]);
    });
  });
});
