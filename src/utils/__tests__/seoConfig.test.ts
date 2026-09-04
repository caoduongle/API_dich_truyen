import { describe, it, expect, afterEach } from 'vitest';
import { SEO_CONFIG } from '../seoConfig';

describe('SEO_CONFIG Utility Suite', () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  it('should have standard branding metadata defined', () => {
    expect(SEO_CONFIG.siteName).toContain('AI Dịch Truyện Trung - Việt');
    expect(SEO_CONFIG.shortName).toBe('Bản Thảo Chu Sa');
    expect(SEO_CONFIG.defaultDescription).toContain('tiểu thuyết Trung - Việt');
    expect(SEO_CONFIG.themeColor).toBe('#141210');
  });

  it('should resolve fallback URL when window is undefined', () => {
    delete (globalThis as unknown as { window?: unknown }).window;
    expect(SEO_CONFIG.getBaseUrl()).toBe('https://dich-truyen.example.com');
  });

  it('should resolve getBaseUrl from window.location.origin when present', () => {
    globalThis.window = {
      location: {
        origin: 'https://dich-truyen.custom-domain.com',
      },
    } as unknown as Window & typeof globalThis;

    expect(SEO_CONFIG.getBaseUrl()).toBe('https://dich-truyen.custom-domain.com');
  });

  it('should correctly format getCanonicalUrl with and without leading slash', () => {
    globalThis.window = {
      location: {
        origin: 'https://dich-truyen.custom-domain.com',
      },
    } as unknown as Window & typeof globalThis;

    expect(SEO_CONFIG.getCanonicalUrl('')).toBe('https://dich-truyen.custom-domain.com');
    expect(SEO_CONFIG.getCanonicalUrl('/')).toBe('https://dich-truyen.custom-domain.com');
    expect(SEO_CONFIG.getCanonicalUrl('translate')).toBe('https://dich-truyen.custom-domain.com/translate');
    expect(SEO_CONFIG.getCanonicalUrl('/projects')).toBe('https://dich-truyen.custom-domain.com/projects');
  });
});


