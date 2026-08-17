import { describe, it, expect } from 'vitest';
import { vi } from '../locales/vi';
import { en } from '../locales/en';
import { zh } from '../locales/zh';
import { SUPPORTED_LOCALES } from '../types';

describe('i18n Internationalization System', () => {
  it('defines 3 supported locales with valid metadata', () => {
    expect(SUPPORTED_LOCALES).toHaveLength(3);
    const codes = SUPPORTED_LOCALES.map((l) => l.code);
    expect(codes).toContain('vi');
    expect(codes).toContain('en');
    expect(codes).toContain('zh');
  });

  it('has consistent keys across vi, en, and zh locales', () => {
    expect(vi.common.appTitle).toBeDefined();
    expect(en.common.appTitle).toBeDefined();
    expect(zh.common.appTitle).toBeDefined();

    expect(vi.nav.translate).toBeDefined();
    expect(en.nav.translate).toBe('Translation Workspace');
    expect(zh.nav.translate).toBe('翻译工作台');

    expect(vi.workspace.translateRawBtn).toBeDefined();
    expect(en.workspace.translateRawBtn).toBe('Translate Draft (Stage 1)');
    expect(zh.workspace.translateRawBtn).toBe('初译 (阶段 1)');
  });

  it('supports parameterized placeholder strings', () => {
    const template = vi.projects.chaptersCount;
    expect(template).toContain('{count}');
    const formatted = template.replace('{count}', '10');
    expect(formatted).toBe('10 chương');
  });
});
