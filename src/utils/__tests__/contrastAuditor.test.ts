import { describe, it, expect } from 'vitest';
import {
  calculateLuminance,
  calculateContrastRatio,
  auditThemeSnippets,
  THEME_PALETTES,
} from '../contrastAuditor';

describe('WCAG 2.1 Color Contrast Auditor Tests', () => {
  describe('calculateLuminance', () => {
    it('calculates 0 for pure black and 1 for pure white', () => {
      expect(calculateLuminance('#000000')).toBe(0);
      expect(calculateLuminance('#FFFFFF')).toBeCloseTo(1, 4);
    });
  });

  describe('calculateContrastRatio', () => {
    it('returns 21:1 for pure black on pure white', () => {
      const ratio = calculateContrastRatio('#000000', '#FFFFFF');
      expect(ratio).toBe(21);
    });

    it('returns 1:1 for identical colors', () => {
      const ratio = calculateContrastRatio('#123456', '#123456');
      expect(ratio).toBe(1);
    });

    it('identifies the severe failure of pale amber-100 on white', () => {
      // The bug that occurred: #FEF3C7 on #FFFFFF
      const brokenRatio = calculateContrastRatio('#FEF3C7', '#FFFFFF');
      expect(brokenRatio).toBeLessThan(1.5);
      expect(brokenRatio).toBeCloseTo(1.09, 1);
    });
  });

  describe('auditThemeSnippets across all themes', () => {
    it('guarantees WCAG AAA contrast ratio (>= 7.0:1) on Light theme', () => {
      const result = auditThemeSnippets('light');
      
      expect(result.vietnameseEvidence.isWcagAaaPass).toBe(true);
      expect(result.vietnameseEvidence.ratio).toBeGreaterThanOrEqual(7.0);

      expect(result.rawChineseSnippet.isWcagAaaPass).toBe(true);
      expect(result.rawChineseSnippet.ratio).toBeGreaterThanOrEqual(7.0);
    });

    it('guarantees WCAG AAA contrast ratio (>= 7.0:1) on Dark theme', () => {
      const result = auditThemeSnippets('dark');

      expect(result.vietnameseEvidence.isWcagAaaPass).toBe(true);
      expect(result.vietnameseEvidence.ratio).toBeGreaterThanOrEqual(7.0);

      expect(result.rawChineseSnippet.isWcagAaaPass).toBe(true);
      expect(result.rawChineseSnippet.ratio).toBeGreaterThanOrEqual(7.0);
    });

    it('guarantees WCAG AA (>= 4.5:1) and AAA (>= 7.0:1) on Sepia theme', () => {
      const result = auditThemeSnippets('sepia');

      expect(result.vietnameseEvidence.isWcagAaPass).toBe(true);
      expect(result.vietnameseEvidence.ratio).toBeGreaterThanOrEqual(4.5);

      expect(result.rawChineseSnippet.isWcagAaaPass).toBe(true);
      expect(result.rawChineseSnippet.ratio).toBeGreaterThanOrEqual(7.0);
    });
  });
});
