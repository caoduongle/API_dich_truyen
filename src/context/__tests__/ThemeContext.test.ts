import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeProvider, useThemeContext } from '../ThemeContext';
import {
  DEFAULT_DARK_PALETTE,
  DEFAULT_LIGHT_PALETTE,
  DEFAULT_SEPIA_PALETTE,
} from '../../types/theme';

describe('ThemeContext and Theme Presets Architecture', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('exports valid ThemeProvider component and useThemeContext hook', () => {
    expect(typeof ThemeProvider).toBe('function');
    expect(typeof useThemeContext).toBe('function');
  });

  it('verifies default dark palette maintains cinnabar red accent and ink dark values', () => {
    expect(DEFAULT_DARK_PALETTE.polish).toBe('#B8402C');
    expect(DEFAULT_DARK_PALETTE.ink).toBe('#14100D');
    expect(DEFAULT_DARK_PALETTE.parchment).toBe('#1F1914');
    expect(DEFAULT_DARK_PALETTE.textMain).toBe('#DCD1BC');
  });

  it('verifies default light palette maintains cinnabar red accent and ivory paper values', () => {
    expect(DEFAULT_LIGHT_PALETTE.polish).toBe('#B8402C');
    expect(DEFAULT_LIGHT_PALETTE.ink).toBe('#FFFFFF');
    expect(DEFAULT_LIGHT_PALETTE.parchment).toBe('#F7F2E9');
    expect(DEFAULT_LIGHT_PALETTE.textMain).toBe('#3A2E22');
  });

  it('verifies default sepia palette maintains cinnabar red accent and vintage manuscript values', () => {
    expect(DEFAULT_SEPIA_PALETTE.polish).toBe('#B8402C');
    expect(DEFAULT_SEPIA_PALETTE.ink).toBe('#EBE0C9');
    expect(DEFAULT_SEPIA_PALETTE.parchment).toBe('#F4ECD8');
    expect(DEFAULT_SEPIA_PALETTE.textMain).toBe('#5B4636');
  });
});
