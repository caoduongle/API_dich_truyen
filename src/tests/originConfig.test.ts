import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { PublicOriginResolver } from '../../specs/150-post-audit-hardening/contracts/origin-config.contract';

export const originResolver: PublicOriginResolver = {
  resolveOrigin(env: Record<string, string | undefined>, defaultFallback = 'https://api-dich-truyen.onrender.com'): string {
    const raw = env.VITE_PUBLIC_URL || defaultFallback;
    return raw.replace(/\/+$/, '');
  },

  transformHtml(html: string, origin: string): string {
    return html.replaceAll('%VITE_PUBLIC_URL%', origin);
  },

  transformSitemap(sitemapXml: string, origin: string): string {
    return sitemapXml
      .replaceAll('%VITE_PUBLIC_URL%', origin)
      .replaceAll('https://api-dich-truyen.onrender.com', origin);
  },
};

describe('Public Origin Portability & Sitemap Decoupling Suite', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const indexHtmlPath = path.join(rootDir, 'index.html');
  const sitemapXmlPath = path.join(rootDir, 'public/sitemap.xml');
  const envExamplePath = path.join(rootDir, '.env.example');

  it('verifies that index.html, public/sitemap.xml, and .env.example exist on disk', () => {
    expect(fs.existsSync(indexHtmlPath)).toBe(true);
    expect(fs.existsSync(sitemapXmlPath)).toBe(true);
    expect(fs.existsSync(envExamplePath)).toBe(true);
  });

  it('verifies .env.example documents VITE_PUBLIC_URL with default fallback', () => {
    const envExample = fs.readFileSync(envExamplePath, 'utf8');
    expect(envExample).toContain('VITE_PUBLIC_URL=');
    expect(envExample).toContain('https://api-dich-truyen.onrender.com');
  });

  it('verifies public/sitemap.xml contains %VITE_PUBLIC_URL% placeholder for all loc entries', () => {
    const sitemap = fs.readFileSync(sitemapXmlPath, 'utf8');
    expect(sitemap).not.toContain('https://api-dich-truyen.onrender.com');
    expect(sitemap).toContain('<loc>%VITE_PUBLIC_URL%/</loc>');
    expect(sitemap).toContain('<loc>%VITE_PUBLIC_URL%/auto-translate</loc>');
    expect(sitemap).toContain('<loc>%VITE_PUBLIC_URL%/glossary</loc>');
    expect(sitemap).toContain('<loc>%VITE_PUBLIC_URL%/history</loc>');
    expect(sitemap).toContain('<loc>%VITE_PUBLIC_URL%/projects</loc>');
    expect(sitemap).toContain('<loc>%VITE_PUBLIC_URL%/hako-checker</loc>');
  });

  it('verifies index.html uses %VITE_PUBLIC_URL% placeholder for canonical and OG metadata', () => {
    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
    expect(indexHtml).toContain('%VITE_PUBLIC_URL%');
    expect(indexHtml).not.toContain('https://api-dich-truyen.onrender.com');
  });

  describe('Origin Resolution & Template Transformation', () => {
    it('normalizes custom public URLs by trimming trailing slashes', () => {
      expect(originResolver.resolveOrigin({ VITE_PUBLIC_URL: 'https://my-domain.vercel.app///' })).toBe(
        'https://my-domain.vercel.app'
      );
      expect(originResolver.resolveOrigin({ VITE_PUBLIC_URL: 'https://custom.org' })).toBe('https://custom.org');
    });

    it('falls back to Render domain when VITE_PUBLIC_URL is undefined or empty', () => {
      expect(originResolver.resolveOrigin({})).toBe('https://api-dich-truyen.onrender.com');
      expect(originResolver.resolveOrigin({ VITE_PUBLIC_URL: '' })).toBe('https://api-dich-truyen.onrender.com');
    });

    it('transforms sitemap.xml with custom deployment origin dynamically', () => {
      const template = fs.readFileSync(sitemapXmlPath, 'utf8');
      const transformed = originResolver.transformSitemap(template, 'https://sub.domain.io');

      expect(transformed).not.toContain('%VITE_PUBLIC_URL%');
      expect(transformed).not.toContain('https://api-dich-truyen.onrender.com');
      expect(transformed).toContain('<loc>https://sub.domain.io/</loc>');
      expect(transformed).toContain('<loc>https://sub.domain.io/auto-translate</loc>');
      expect(transformed).toContain('<loc>https://sub.domain.io/glossary</loc>');
    });

    it('transforms index.html with custom deployment origin dynamically', () => {
      const template = fs.readFileSync(indexHtmlPath, 'utf8');
      const transformed = originResolver.transformHtml(template, 'https://sub.domain.io');

      expect(transformed).not.toContain('%VITE_PUBLIC_URL%');
      expect(transformed).toContain('content="https://sub.domain.io/');
    });
  });
});
