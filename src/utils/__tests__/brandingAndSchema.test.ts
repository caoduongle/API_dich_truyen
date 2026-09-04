import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Branding, Social Share & Structured Data (User Stories 5 & 6)', () => {
  it('should have a valid public/site.webmanifest', () => {
    const manifestPath = path.join(process.cwd(), 'public', 'site.webmanifest');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifestContent.name).toContain('AI Dịch Truyện Trung - Việt');
    expect(manifestContent.short_name).toBe('Bản Thảo Chu Sa');
    expect(manifestContent.theme_color).toBe('#141210');
    expect(manifestContent.background_color).toBe('#F7F4EB');
    expect(manifestContent.display).toBe('standalone');
    expect(Array.isArray(manifestContent.icons)).toBe(true);
    expect(manifestContent.icons.length).toBeGreaterThan(0);
  });

  it('should have a 1200x630 social preview image (public/og-image.svg)', () => {
    const ogImagePath = path.join(process.cwd(), 'public', 'og-image.svg');
    expect(fs.existsSync(ogImagePath)).toBe(true);

    const svg = fs.readFileSync(ogImagePath, 'utf-8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 1200 630"');
    expect(svg).toContain('AI Dịch Truyện Trung - Việt');
  });

  it('should have complete Open Graph and Twitter Card tags in index.html', () => {
    const indexPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(indexPath, 'utf-8');

    expect(html).toContain('<meta property="og:title"');
    expect(html).toContain('<meta property="og:description"');
    expect(html).toContain('<meta property="og:url"');
    expect(html).toContain('<meta property="og:site_name"');
    expect(html).toContain('<meta property="og:image" content="/og-image.svg"');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"');
    expect(html).toContain('<link rel="manifest" href="/site.webmanifest"');
  });

  it('should have valid Schema.org JSON-LD embedded in index.html', () => {
    const indexPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(indexPath, 'utf-8');

    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(jsonLdMatch).not.toBeNull();

    if (jsonLdMatch) {
      const parsed = JSON.parse(jsonLdMatch[1].trim());
      expect(parsed['@context']).toBe('https://schema.org');
      expect(Array.isArray(parsed['@graph'])).toBe(true);

      const webApp = parsed['@graph'].find((item: any) => item['@type'] === 'WebApplication');
      expect(webApp).toBeDefined();
      expect(webApp.name).toBe('AI Dịch Truyện Trung - Việt');
      expect(webApp.applicationCategory).toBe('MultimediaApplication');

      const webSite = parsed['@graph'].find((item: any) => item['@type'] === 'WebSite');
      expect(webSite).toBeDefined();
      expect(webSite.name).toBe('Bản Thảo Chu Sa');
    }
  });
});
