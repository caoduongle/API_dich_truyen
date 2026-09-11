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

    it('should convert a single Traditional Chinese character to Simplified', () => {
      expect(canonicalizeHan('萬')).toBe('万');
    });

    it('should leave already simplified characters unchanged (idempotent)', () => {
      expect(canonicalizeHan('万剑归宗')).toBe('万剑归宗');
      expect(canonicalizeHan(canonicalizeHan('萬劍歸宗'))).toBe('万剑归宗');
    });

    it('should leave non-Chinese text unchanged', () => {
      expect(canonicalizeHan('hello 123')).toBe('hello 123');
    });

    it('should preserve non-Chinese characters in mixed string', () => {
      expect(canonicalizeHan('萬劍歸宗 123! hello')).toBe('万剑归宗 123! hello');
    });

    it('should handle empty/null inputs', () => {
      expect(canonicalizeHan('')).toBe('');
      expect(canonicalizeHan(null as any)).toBe('');
    });
  });

  describe('isHanEquivalent', () => {
    it('should return true for identical strings', () => {
      expect(isHanEquivalent('萧炎', '萧炎')).toBe(true);
    });

    it('should match Traditional and Simplified representations of the same content', () => {
      expect(isHanEquivalent('萬', '万')).toBe(true);
      expect(isHanEquivalent(' 萬劍歸宗 ', '万剑归宗')).toBe(true);
    });

    it('should return false for different words', () => {
      expect(isHanEquivalent('萧炎', '林动')).toBe(false);
    });

    it('should return false for empty or different length inputs', () => {
      expect(isHanEquivalent('', '万')).toBe(false);
      expect(isHanEquivalent('万', '')).toBe(false);
      expect(isHanEquivalent('万', '万剑')).toBe(false);
    });
  });

  describe('findCanonicalSubstring', () => {
    it('should find substring when haystack and needle use the same style', () => {
      expect(findCanonicalSubstring('Đây là 萧炎 trong truyện', '萧炎')).toBe('萧炎');
      expect(findCanonicalSubstring('Đây là 蕭炎 trong truyện', '蕭炎')).toBe('蕭炎');
    });

    it('should find substring when haystack and needle use different styles', () => {
      // haystack traditional, needle simplified
      expect(findCanonicalSubstring('Đây là 蕭炎 trong truyện', '萧炎')).toBe('蕭炎');
      // haystack simplified, needle traditional
      expect(findCanonicalSubstring('Đây là 萧炎 trong truyện', '蕭炎')).toBe('萧炎');
    });

    it('should return null if no equivalent match exists', () => {
      expect(findCanonicalSubstring('Đây là 萧炎 trong truyện', '九阳神功')).toBeNull();
    });

    it('should handle empty or null values', () => {
      expect(findCanonicalSubstring('', '万')).toBeNull();
      expect(findCanonicalSubstring('万', '')).toBeNull();
      expect(findCanonicalSubstring(null as any, '万')).toBeNull();
      expect(findCanonicalSubstring('万', null as any)).toBeNull();
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

    it('should snap back entity to raw source style if entity is traditional and source is simplified', () => {
      const entities = [{ chinese: '蕭炎', pinyin: 'Tiêu Viêm' }];
      // Raw source uses simplified '萧炎'
      const result = validateAndSnapBackEntities(entities, 'Đây là 萧炎 trong truyện.');
      expect(result[0].chinese).toBe('萧炎');
      expect(result[0].needsReview).toBeUndefined();
    });

    it('should set needsReview if entity not present in raw source', () => {
      const entities = [{ chinese: '林动', pinyin: 'Lâm Động' }];
      const result = validateAndSnapBackEntities(entities, 'Đây là 萧炎 trong truyện.');
      expect(result[0].needsReview).toBe(true);
    });

    it('should return empty list if entities is empty', () => {
      expect(validateAndSnapBackEntities([], 'text')).toEqual([]);
    });

    it('should handle empty or null rawText gracefully by returning input entities or marked', () => {
      const entities = [{ chinese: '萧炎', pinyin: 'Tiêu Viêm' }];
      expect(validateAndSnapBackEntities(entities, '')).toEqual(entities);
      expect(validateAndSnapBackEntities(entities, null as any)).toEqual(entities);
    });
  });

  describe('findFuzzyCandidates', () => {
    it('should place exact match as the first candidate with 100% similarity', () => {
      const haystack = 'Hôm nay 萧炎 đấu với 纳兰嫣然 ở 乌坦城.';
      const candidates = findFuzzyCandidates(haystack, '萧炎');
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0].text).toBe('萧炎');
      expect(candidates[0].similarity).toBe(100);
      expect(candidates[0].index).toBe(8); // Start index of '萧炎' in haystack
    });

    it('should find partial bigram matches when not exact', () => {
      const haystack = '萬劍歸宗, 萬劍, 歸宗';
      const candidates = findFuzzyCandidates(haystack, '万剑归宗');
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.some(c => c.text === '萬劍歸宗')).toBe(true);
    });

    it('should respect topN limit', () => {
      const haystack = '萬劍歸宗, 萬劍, 歸宗';
      const candidates = findFuzzyCandidates(haystack, '万剑', 1);
      expect(candidates.length).toBe(1);
    });

    it('should return empty list on empty inputs', () => {
      expect(findFuzzyCandidates('', '萧炎')).toEqual([]);
      expect(findFuzzyCandidates('萧炎', '')).toEqual([]);
      expect(findFuzzyCandidates(null as any, '萧炎')).toEqual([]);
      expect(findFuzzyCandidates('萧炎', null as any)).toEqual([]);
    });

    it('should handle very large haystack inputs without hanging', () => {
      // Create a 60,000 character string
      const largeHaystack = '萧炎 '.repeat(15000);
      const start = Date.now();
      const candidates = findFuzzyCandidates(largeHaystack, '萧炎', 3);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should run fast (under 1s)
      expect(candidates.length).toBeGreaterThan(0);
    });
  });
});
