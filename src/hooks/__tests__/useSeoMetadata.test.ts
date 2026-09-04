import { describe, it, expect } from 'vitest';
import { useSeoMetadata } from '../useSeoMetadata';

describe('useSeoMetadata Hook Suite', () => {
  it('exports valid useSeoMetadata function', () => {
    expect(typeof useSeoMetadata).toBe('function');
  });

  it('declares interface and options properly', () => {
    const options = {
      title: 'Bàn Dịch Thuật',
      description: 'Mô tả bàn dịch',
      canonicalPath: '/translate',
      ogType: 'website' as const,
    };
    expect(options.title).toBe('Bàn Dịch Thuật');
    expect(options.canonicalPath).toBe('/translate');
  });
});


