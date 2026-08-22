import { describe, it, expect } from 'vitest';
import {
  getLuminance,
  getContrastRatio,
  auditPalette,
} from '../contrastAuditor';
import {
  DEFAULT_DARK_PALETTE,
  DEFAULT_LIGHT_PALETTE,
  DEFAULT_SEPIA_PALETTE,
} from '../../types/theme';

describe('contrastAuditor (WCAG 2.1 Relative Luminance & Contrast)', () => {
  it('calculates relative luminance correctly for pure black and pure white', () => {
    expect(getLuminance('#000000')).toBeCloseTo(0, 4);
    expect(getLuminance('#FFFFFF')).toBeCloseTo(1, 4);
  });

  it('calculates maximum contrast ratio 21:1 for black and white', () => {
    const ratio = getContrastRatio('#000000', '#FFFFFF');
    expect(ratio).toBeCloseTo(21, 1);
  });

  it('calculates 1:1 ratio for identical colors', () => {
    const ratio = getContrastRatio('#1F1914', '#1F1914');
    expect(ratio).toBeCloseTo(1, 1);
  });

  it('audits DEFAULT_DARK_PALETTE and confirms WCAG AA compliance for main text', () => {
    const audit = auditPalette(DEFAULT_DARK_PALETTE);
    expect(audit.textMainOnParchment).toBeGreaterThanOrEqual(7.0); // AAA level
    expect(audit.isTextMainCompliant).toBe(true);
    expect(audit.polishOnParchment).toBeGreaterThanOrEqual(3.0);
  });

  it('audits DEFAULT_LIGHT_PALETTE and confirms WCAG AA compliance for main text', () => {
    const audit = auditPalette(DEFAULT_LIGHT_PALETTE);
    expect(audit.textMainOnParchment).toBeGreaterThanOrEqual(7.0); // AAA level
    expect(audit.isTextMainCompliant).toBe(true);
    expect(audit.polishOnParchment).toBeGreaterThanOrEqual(4.5);
  });

  it('audits DEFAULT_SEPIA_PALETTE and confirms WCAG AA compliance for main text', () => {
    const audit = auditPalette(DEFAULT_SEPIA_PALETTE);
    expect(audit.textMainOnParchment).toBeGreaterThanOrEqual(4.5); // AA level
    expect(audit.isTextMainCompliant).toBe(true);
    expect(audit.polishOnParchment).toBeGreaterThanOrEqual(4.5);
  });

  it('flags low-contrast custom palette as non-compliant', () => {
    const badPalette = {
      ink: '#FFFFFF',
      parchment: '#FFFFFF',
      parchment2: '#E5E5E5',
      textMain: '#D0D0D0', // very faint gray on white
      textMuted: '#E0E0E0',
      polish: '#B8402C',
    };
    const audit = auditPalette(badPalette);
    expect(audit.textMainOnParchment).toBeLessThan(4.5);
    expect(audit.isTextMainCompliant).toBe(false);
  });
});
