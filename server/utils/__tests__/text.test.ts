import { describe, it, expect } from 'vitest';
import { safeParseJson, findSplitPoint, escapeRegex, getGenreStyleGuide } from '../text';

describe('text utils', () => {
  describe('safeParseJson', () => {
    it('should parse valid JSON', () => {
      expect(safeParseJson('{"name": "test", "value": 123}')).toEqual({ name: 'test', value: 123 });
    });

    it('should parse JSON wrapped in markdown block', () => {
      expect(safeParseJson('```json\n{"foo": "bar"}\n```')).toEqual({ foo: 'bar' });
    });

    it('should isolate and parse JSON embedded in text', () => {
      expect(safeParseJson('Here is some text {"key": "val"} and more text')).toEqual({ key: 'val' });
    });

    it('should return null for empty or falsy input', () => {
      expect(safeParseJson('')).toBeNull();
      expect(safeParseJson(null as any)).toBeNull();
    });

    it('should throw error when no JSON structure can be recovered', () => {
      expect(() => safeParseJson('no json here')).toThrow();
    });
  });

  describe('findSplitPoint', () => {
    it('should split on newline if present near midpoint', () => {
      const text = 'line one\nline two\nline three';
      // Midpoint of text is around index 15
      const splitPoint = findSplitPoint(text);
      expect(text[splitPoint]).toBe('\n');
    });

    it('should split on sentence delimiter if no newline is available', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const splitPoint = findSplitPoint(text);
      expect(splitPoint).toBeGreaterThan(0);
      expect(['.', '?', '!']).toContain(text[splitPoint - 1]);
    });

    it('should split at midpoint if no newline or sentence delimiters are found', () => {
      const text = 'abcdefghijklmnopqrstuvwxyz';
      const splitPoint = findSplitPoint(text);
      expect(splitPoint).toBe(13); // exactly half
    });
  });

  describe('escapeRegex', () => {
    it('should escape all regex special characters', () => {
      const special = '-\\^$*+?.()|[]{}';
      const escaped = escapeRegex(special);
      expect(escaped).toBe('-\\^$*+?.()|[]{}');
    });

    it('should leave normal strings unchanged', () => {
      expect(escapeRegex('hello123_')).toBe('hello123_');
    });

    it('should handle empty strings', () => {
      expect(escapeRegex('')).toBe('');
    });
  });

  describe('getGenreStyleGuide', () => {
    it('should return correct style guide for Tiên Hiệp', () => {
      expect(getGenreStyleGuide('Tiên Hiệp')).toContain('ta-ngươi-huynh-muội');
    });

    it('should return correct style guide for Ngôn Tình', () => {
      expect(getGenreStyleGuide('Ngôn Tình')).toContain('chàng-nàng');
    });

    it('should return correct style guide for Đô Thị', () => {
      expect(getGenreStyleGuide('Đô Thị')).toContain('không dùng từ cổ phong');
    });

    it('should return fallback guide for unrecognized genre', () => {
      expect(getGenreStyleGuide('Khác')).toContain('dịch tự nhiên phù hợp');
    });
  });
});
