import { describe, it, expect } from 'vitest';
import { cleanChineseText, separateChapterTitleAndBody } from '../textCleaner';

describe('textCleaner - Chinese Text Cleaning & Chapter Title Separation', () => {
  describe('cleanChineseText', () => {
    it('should remove HTML tags, web scraper ads, and watermark domains', () => {
      const dirty = `
        <p>第一章</p>
        uu看书 www.uukanshu.com
        最新章节：第一章
        太阳升起，大地一片金黄。
        【最新章节阅读】
        他慢慢站起身来。
      `;
      const cleaned = cleanChineseText(dirty);
      expect(cleaned).toContain('第一章');
      expect(cleaned).toContain('太阳升起，大地一片金黄。');
      expect(cleaned).toContain('他慢慢站起身来。');
      expect(cleaned).not.toContain('uukanshu');
      expect(cleaned).not.toContain('最新章节：');
    });

    it('should strip invisible anti-scraping zero-width characters', () => {
      const input = '第一\u200B章\uFEFF：\u200C修\u200D仙';
      const cleaned = cleanChineseText(input);
      expect(cleaned).toBe('第一章：修仙');
      expect(cleaned).not.toMatch(/[\u200B\uFEFF\u200D\u200C]/);
    });

    it('should normalize output string to Unicode NFC', () => {
      // Decomposed form NFD: "e" + combining acute accent "\u0301" -> NFC "\u00E9"
      const nfdText = '第\u200B一章\ne\u0301';
      const cleaned = cleanChineseText(nfdText);
      expect(cleaned).toBe('第一章\né');
      expect(cleaned).toBe(cleaned.normalize('NFC'));
    });
  });

  describe('separateChapterTitleAndBody', () => {
    it('should split attached chapter title and first body sentence into separate paragraphs', () => {
      const input =
        'Chương 1: Đài Phát Thanh Kinh Hoàng. Đôi môi đỏ thắm, đêm tối mịt mờ; đêm nay, thuộc về sự buông thả.';
      const output = separateChapterTitleAndBody(input);

      expect(output).toBe(
        'Chương 1: Đài Phát Thanh Kinh Hoàng\n\nĐôi môi đỏ thắm, đêm tối mịt mờ; đêm nay, thuộc về sự buông thả.'
      );
    });

    it('should handle title with exclamation mark', () => {
      const input =
        'Chương 5: Đại chiến bắt đầu! Hắn rút kiếm xông thẳng về phía trước.';
      const output = separateChapterTitleAndBody(input);

      expect(output).toBe(
        'Chương 5: Đại chiến bắt đầu\n\nHắn rút kiếm xông thẳng về phía trước.'
      );
    });

    it('should handle title followed by quotes in first sentence', () => {
      const input =
        'Chương 2: Bí cảnh thần bí. "Ngươi là ai?" Nàng lớn tiếng hỏi.';
      const output = separateChapterTitleAndBody(input);

      expect(output).toBe(
        'Chương 2: Bí cảnh thần bí\n\n"Ngươi là ai?" Nàng lớn tiếng hỏi.'
      );
    });

    it('should preserve text that already has proper newline separation', () => {
      const input =
        'Chương 1: Đài Phát Thanh Kinh Hoàng\n\nĐôi môi đỏ thắm, đêm tối mịt mờ.';
      const output = separateChapterTitleAndBody(input);

      expect(output).toBe(input);
    });

    it('should preserve body sentences containing the word Chương without title prefix format', () => {
      const input =
        'Đây là một chương mới trong cuộc đời của hắn.\nMặt trời dần lặn xuống núi.';
      const output = separateChapterTitleAndBody(input);

      expect(output).toBe(input);
    });
  });
});
