import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThemeProvider, useThemeContext } from '../ThemeContext';
import {
  DEFAULT_DARK_PALETTE,
  DEFAULT_LIGHT_PALETTE,
  DEFAULT_SEPIA_PALETTE,
  READER_FONT_OPTIONS,
  DEFAULT_READER_FONT,
  DEFAULT_READER_FONT_SIZE,
  MIN_READER_FONT_SIZE,
  MAX_READER_FONT_SIZE,
  ReaderFontId,
} from '../../types/theme';
import { loadGoogleFont } from '../../utils/fontLoader';

describe('ThemeContext and Typography Architecture', () => {
  let mockStorage: Record<string, string> = {};
  let elementsMap: Record<string, any> = {};

  beforeEach(() => {
    mockStorage = {};
    elementsMap = {};

    const storageMock = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };

    const documentMock = {
      getElementById: (id: string) => elementsMap[id] || null,
      createElement: (tag: string) => {
        const el: any = {
          tagName: tag.toUpperCase(),
          id: '',
          rel: '',
          href: '',
        };
        return el;
      },
      head: {
        appendChild: (child: any) => {
          if (child.id) {
            elementsMap[child.id] = child;
          }
          return child;
        },
      },
      querySelectorAll: (selector: string) => {
        const matchId = selector.replace('#', '');
        return elementsMap[matchId] ? [elementsMap[matchId]] : [];
      },
      documentElement: {
        setAttribute: vi.fn(),
        style: {
          setProperty: vi.fn(),
          removeProperty: vi.fn(),
        },
      },
    };

    vi.stubGlobal('localStorage', storageMock);
    vi.stubGlobal('document', documentMock);
    vi.stubGlobal('window', { localStorage: storageMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('verifies 7 predefined reader font options and typography constants', () => {
    expect(READER_FONT_OPTIONS.length).toBe(7);
    const expectedFontIds: ReaderFontId[] = [
      'system',
      'arial',
      'helvetica',
      'roboto',
      'georgia',
      'merriweather',
      'source-serif-4',
    ];
    expectedFontIds.forEach((id) => {
      const match = READER_FONT_OPTIONS.find((f) => f.id === id);
      expect(match).toBeDefined();
      expect(typeof match?.fontFamilyCss).toBe('string');
    });

    expect(DEFAULT_READER_FONT).toBe('merriweather');
    expect(DEFAULT_READER_FONT_SIZE).toBe(22);
    expect(MIN_READER_FONT_SIZE).toBe(14);
    expect(MAX_READER_FONT_SIZE).toBe(50);
  });

  it('dynamically loads Google Font link into document head', () => {
    loadGoogleFont('source-serif-4');
    const linkEl = document.getElementById('google-font-source-serif-4') as HTMLLinkElement | null;
    expect(linkEl).toBeDefined();
    expect(linkEl?.rel).toBe('stylesheet');
    expect(linkEl?.href).toContain('Source+Serif+4');

    // Duplicate call should be idempotent
    loadGoogleFont('source-serif-4');
    const allLinks = document.querySelectorAll('#google-font-source-serif-4');
    expect(allLinks.length).toBe(1);
  });

  it('does not load link for non-Google standard fonts', () => {
    loadGoogleFont('arial');
    const linkEl = document.getElementById('google-font-arial');
    expect(linkEl).toBeNull();
  });
});
