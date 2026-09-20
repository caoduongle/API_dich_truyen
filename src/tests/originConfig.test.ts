import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  resolvePublicOrigin,
  normalizeOrigin,
  normalizeBasePath,
  isValidWebProtocol,
  transformIndexHtml,
  transformSitemap,
  DEFAULT_PUBLIC_URL,
} from '../config/publicOrigin';

describe('Public Origin Portability & Subpath Architecture Suite', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const indexHtmlPath = path.join(rootDir, 'index.html');
  const sitemapXmlPath = path.join(rootDir, 'public/sitemap.xml');
  const envExamplePath = path.join(rootDir, '.env.example');
  const distIndexPath = path.join(rootDir, 'dist/index.html');
  const distSitemapPath = path.join(rootDir, 'dist/sitemap.xml');

  it('verifies that index.html, public/sitemap.xml, and .env.example exist on disk', () => {
    expect(fs.existsSync(indexHtmlPath)).toBe(true);
    expect(fs.existsSync(sitemapXmlPath)).toBe(true);
    expect(fs.existsSync(envExamplePath)).toBe(true);
  });

  it('verifies .env.example documents VITE_PUBLIC_URL with default fallback', () => {
    const envExample = fs.readFileSync(envExamplePath, 'utf8');
    expect(envExample).toContain('VITE_PUBLIC_URL=');
    expect(envExample).toContain(DEFAULT_PUBLIC_URL);
  });

  it('verifies public/sitemap.xml contains %VITE_PUBLIC_URL% placeholder for all loc entries', () => {
    const sitemap = fs.readFileSync(sitemapXmlPath, 'utf8');
    expect(sitemap).not.toContain(DEFAULT_PUBLIC_URL);
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
    expect(indexHtml).not.toContain(DEFAULT_PUBLIC_URL);
  });

  describe('Production publicOrigin.ts Unit Tests', () => {
    it('validates web protocol schemes correctly (http/https only)', () => {
      expect(isValidWebProtocol('https://example.com')).toBe(true);
      expect(isValidWebProtocol('http://localhost:3000')).toBe(true);
      expect(isValidWebProtocol('ftp://ftp.example.com')).toBe(false);
      expect(isValidWebProtocol('javascript:alert(1)')).toBe(false);
      expect(isValidWebProtocol('not-a-valid-url')).toBe(false);
      expect(isValidWebProtocol('')).toBe(false);
    });

    it('normalizes custom public URLs by trimming trailing slashes and enforcing scheme', () => {
      expect(normalizeOrigin('https://my-domain.vercel.app///')).toBe('https://my-domain.vercel.app');
      expect(normalizeOrigin('https://custom.org')).toBe('https://custom.org');
      expect(normalizeOrigin('http://insecure.site/')).toBe('http://insecure.site');
      // Invalid scheme falls back safely to default production origin
      expect(normalizeOrigin('invalid-scheme://domain')).toBe(DEFAULT_PUBLIC_URL);
      expect(normalizeOrigin('abc')).toBe(DEFAULT_PUBLIC_URL);
    });

    it('falls back to default production origin when origin is undefined, null, or empty', () => {
      expect(normalizeOrigin(undefined)).toBe(DEFAULT_PUBLIC_URL);
      expect(normalizeOrigin(null)).toBe(DEFAULT_PUBLIC_URL);
      expect(normalizeOrigin('')).toBe(DEFAULT_PUBLIC_URL);
      expect(normalizeOrigin('   ')).toBe(DEFAULT_PUBLIC_URL);
    });

    it('handles origin edge cases with strict URL parsing', () => {
      // Empty host or malformed URL falls back to default
      expect(normalizeOrigin('https://')).toBe(DEFAULT_PUBLIC_URL);
      expect(normalizeOrigin('https:///')).toBe(DEFAULT_PUBLIC_URL);
      expect(isValidWebProtocol('https://')).toBe(false);
      expect(isValidWebProtocol('https:///')).toBe(false);

      // Paths, query strings, and fragments are stripped down to canonical origin
      expect(normalizeOrigin('https://example.com/foo/bar')).toBe('https://example.com');
      expect(normalizeOrigin('https://example.com/foo/bar?query=1#hash')).toBe('https://example.com');

      // Port numbers are preserved
      expect(normalizeOrigin('https://example.com:8080')).toBe('https://example.com:8080');
      expect(normalizeOrigin('http://localhost:3000/app')).toBe('http://localhost:3000');
    });

    it('normalizes base path with leading and trailing slashes', () => {
      expect(normalizeBasePath('/')).toBe('/');
      expect(normalizeBasePath('dichtruyen')).toBe('/dichtruyen/');
      expect(normalizeBasePath('/subpath')).toBe('/subpath/');
      expect(normalizeBasePath('/nested/path/')).toBe('/nested/path/');
      expect(normalizeBasePath('')).toBe('/');
      expect(normalizeBasePath(undefined)).toBe('/');
    });

    it('resolves unified canonicalAppUrl correctly for standard root hosting', () => {
      const config = resolvePublicOrigin('https://my-domain.org', '/');
      expect(config.origin).toBe('https://my-domain.org');
      expect(config.basePath).toBe('/');
      expect(config.canonicalAppUrl).toBe('https://my-domain.org/');
    });

    it('resolves unified canonicalAppUrl correctly for nested sub-path hosting', () => {
      const config = resolvePublicOrigin('https://my-domain.org', '/dichtruyen/');
      expect(config.origin).toBe('https://my-domain.org');
      expect(config.basePath).toBe('/dichtruyen/');
      expect(config.canonicalAppUrl).toBe('https://my-domain.org/dichtruyen/');
    });

    it('transforms sitemap.xml with canonical application URL including sub-path', () => {
      const sitemapTemplate = fs.readFileSync(sitemapXmlPath, 'utf8');
      const config = resolvePublicOrigin('https://sub.domain.io', '/novel-reader/');
      const transformed = transformSitemap(sitemapTemplate, config);

      expect(transformed).not.toContain('%VITE_PUBLIC_URL%');
      expect(transformed).not.toContain(DEFAULT_PUBLIC_URL);
      expect(transformed).toContain('<loc>https://sub.domain.io/novel-reader/</loc>');
      expect(transformed).toContain('<loc>https://sub.domain.io/novel-reader/auto-translate</loc>');
      expect(transformed).toContain('<loc>https://sub.domain.io/novel-reader/glossary</loc>');
    });

    it('transforms index.html with canonical URL, absolute og:image, and adapts static asset links', () => {
      const htmlTemplate = fs.readFileSync(indexHtmlPath, 'utf8');
      const config = resolvePublicOrigin('https://sub.domain.io', '/subapp/');
      const transformed = transformIndexHtml(htmlTemplate, config);

      expect(transformed).not.toContain('%VITE_PUBLIC_URL%');
      expect(transformed).not.toContain(DEFAULT_PUBLIC_URL);
      expect(transformed).toContain('content="https://sub.domain.io/subapp/"');
      expect(transformed).toContain('href="https://sub.domain.io/subapp/"');
      expect(transformed).toContain('content="https://sub.domain.io/subapp/og-image.svg"');
      expect(transformed).toContain('href="/subapp/favicon.svg"');
      expect(transformed).toContain('src="/subapp/theme-init.js"');
      expect(transformed).toContain('href="/subapp/site.webmanifest"');
    });
  });

  describe('Build Artifacts Output Verification', () => {
    it('verifies dist/index.html does not contain unreplaced placeholder tokens', () => {
      expect(fs.existsSync(distIndexPath)).toBe(true);
      const distHtml = fs.readFileSync(distIndexPath, 'utf8');
      expect(distHtml).not.toContain('%VITE_PUBLIC_URL%');
      expect(distHtml).not.toContain('%VITE_CANONICAL_URL%');
    });

    it('verifies dist/sitemap.xml does not contain unreplaced placeholder tokens', () => {
      expect(fs.existsSync(distSitemapPath)).toBe(true);
      const distSitemap = fs.readFileSync(distSitemapPath, 'utf8');
      expect(distSitemap).not.toContain('%VITE_PUBLIC_URL%');
      expect(distSitemap).toContain('<loc>http');
    });
  });
});
