import { describe, it, expect } from 'vitest';
import {
  escapeRegex,
  findMatchesInText,
  replaceSingleMatch,
  replaceAllMatches,
  getNextMatchIndex,
  getPrevMatchIndex,
} from '../textSearch';

describe('textSearch Utility Suite (136-find-and-replace)', () => {
  describe('escapeRegex', () => {
    it('escapes regular expression metacharacters safely', () => {
      const input = 'a[b]c(d)?*+.$|^\\e';
      const escaped = escapeRegex(input);
      expect(escaped).toBe('a\\[b\\]c\\(d\\)\\?\\*\\+\\.\\$\\|\\^\\\\e');
    });

    it('preserves normal alphanumeric and unicode characters untouched', () => {
      const input = 'Tiêu Viêm 123 Tô Bạch';
      expect(escapeRegex(input)).toBe('Tiêu Viêm 123 Tô Bạch');
    });
  });

  describe('findMatchesInText', () => {
    const sampleText =
      'Tiêu Viêm nhìn Tô Bạch. Tô Bạch mỉm cười. tiêu viêm cũng cười theo Tô bạch.';

    it('returns empty array when text or search term is empty', () => {
      expect(findMatchesInText('', 'Tô Bạch')).toEqual([]);
      expect(findMatchesInText(sampleText, '')).toEqual([]);
      expect(findMatchesInText('', '')).toEqual([]);
    });

    it('finds matches with case-insensitive search by default', () => {
      const matches = findMatchesInText(sampleText, 'Tiêu Viêm', false);
      expect(matches).toHaveLength(2);
      expect(matches[0]).toEqual({ start: 0, end: 9 });
      expect(sampleText.substring(matches[0].start, matches[0].end)).toBe('Tiêu Viêm');
      expect(sampleText.substring(matches[1].start, matches[1].end)).toBe('tiêu viêm');
    });

    it('finds matches with case-sensitive search when matchCase is true', () => {
      const matches = findMatchesInText(sampleText, 'Tô Bạch', true);
      expect(matches).toHaveLength(2);
      expect(sampleText.substring(matches[0].start, matches[0].end)).toBe('Tô Bạch');
      expect(sampleText.substring(matches[1].start, matches[1].end)).toBe('Tô Bạch');

      // 'Tô bạch' with lower 'b' was ignored
      const matchesLower = findMatchesInText(sampleText, 'Tô bạch', true);
      expect(matchesLower).toHaveLength(1);
    });

    it('finds search terms containing regex special characters without errors', () => {
      const textWithSymbols = 'Chương [1]: Khởi đầu? Đúng vậy (tập 1)...';
      const matches = findMatchesInText(textWithSymbols, '[1]', false);
      expect(matches).toHaveLength(1);
      expect(textWithSymbols.substring(matches[0].start, matches[0].end)).toBe('[1]');

      const questionMatches = findMatchesInText(textWithSymbols, 'đầu?', false);
      expect(questionMatches).toHaveLength(1);
    });

    it('accurately handles Vietnamese accented letters and diacritics', () => {
      const text = 'Hắn há hốc mồm thở ra một ngàn khói trắng, gương mặt đờ đẫn ngẩn ngơ.';
      const matches = findMatchesInText(text, 'ngẩn ngơ', false);
      expect(matches).toHaveLength(1);
      expect(text.substring(matches[0].start, matches[0].end)).toBe('ngẩn ngơ');
    });
  });

  describe('replaceSingleMatch', () => {
    it('replaces single match at specified location and leaves rest intact', () => {
      const text = 'Tô Bạch và Tiêu Viêm đi cùng Tô Bạch.';
      const match = { start: 0, end: 7 }; // first 'Tô Bạch'
      const result = replaceSingleMatch(text, match, 'Lâm Động');

      expect(result).toBe('Lâm Động và Tiêu Viêm đi cùng Tô Bạch.');
    });

    it('deletes the match when replaceTerm is an empty string', () => {
      const text = 'Xin chào quý bạn đọc thân mến.';
      const match = { start: 9, end: 13 }; // 'quý '
      const result = replaceSingleMatch(text, match, '');

      expect(result).toBe('Xin chào bạn đọc thân mến.');
    });

    it('handles out of bounds match safely', () => {
      const text = 'Ngắn gọn';
      expect(replaceSingleMatch(text, { start: -1, end: 5 }, 'X')).toBe(text);
      expect(replaceSingleMatch(text, { start: 2, end: 20 }, 'X')).toBe(text);
      expect(replaceSingleMatch(text, { start: 5, end: 2 }, 'X')).toBe(text);
    });
  });

  describe('replaceAllMatches', () => {
    it('replaces all occurrences and returns the exact replaced count', () => {
      const text = 'hắn nói rằng hắn không biết chuyện đó và hắn bỏ đi.';
      const result = replaceAllMatches(text, 'hắn', 'chàng', false);

      expect(result.count).toBe(3);
      expect(result.newText).toBe('chàng nói rằng chàng không biết chuyện đó và chàng bỏ đi.');
    });

    it('respects matchCase parameter when replacing all', () => {
      const text = 'Thần linh và thần thú, Thần bí vô cùng.';
      const resultCase = replaceAllMatches(text, 'Thần', 'Chúa', true);

      expect(resultCase.count).toBe(2);
      expect(resultCase.newText).toBe('Chúa linh và thần thú, Chúa bí vô cùng.');

      const resultAll = replaceAllMatches(text, 'Thần', 'Chúa', false);
      expect(resultAll.count).toBe(3);
      expect(resultAll.newText).toBe('Chúa linh và Chúa thú, Chúa bí vô cùng.');
    });

    it('prevents recursive expansion when replacement contains search term', () => {
      const text = 'Rút Kiếm chém một Kiếm.';
      const result = replaceAllMatches(text, 'Kiếm', 'Thánh Kiếm', false);

      expect(result.count).toBe(2);
      expect(result.newText).toBe('Rút Thánh Kiếm chém một Thánh Kiếm.');
    });

    it('handles empty replacement string for batch deletion', () => {
      const text = 'Đoạn này bị [LỖI] và chỗ kia cũng [LỖI].';
      const result = replaceAllMatches(text, '[LỖI]', '', false);

      expect(result.count).toBe(2);
      expect(result.newText).toBe('Đoạn này bị  và chỗ kia cũng .');
    });

    it('returns original text with 0 count when term is not found', () => {
      const text = 'Văn bản bình thường.';
      const result = replaceAllMatches(text, 'Không tồn tại', 'Mới', false);

      expect(result.count).toBe(0);
      expect(result.newText).toBe(text);
    });
  });

  describe('getNextMatchIndex and getPrevMatchIndex', () => {
    it('wraps around to 0 when reaching the end of matches', () => {
      expect(getNextMatchIndex(0, 3)).toBe(1);
      expect(getNextMatchIndex(1, 3)).toBe(2);
      expect(getNextMatchIndex(2, 3)).toBe(0); // wrap-around
    });

    it('wraps around to last index when navigating before the first match', () => {
      expect(getPrevMatchIndex(2, 3)).toBe(1);
      expect(getPrevMatchIndex(1, 3)).toBe(0);
      expect(getPrevMatchIndex(0, 3)).toBe(2); // wrap-around
    });

    it('handles edge cases with 0 or -1 indices', () => {
      expect(getNextMatchIndex(-1, 5)).toBe(0);
      expect(getPrevMatchIndex(-1, 5)).toBe(4);
      expect(getNextMatchIndex(0, 0)).toBe(-1);
      expect(getPrevMatchIndex(0, 0)).toBe(-1);
    });
  });
});
