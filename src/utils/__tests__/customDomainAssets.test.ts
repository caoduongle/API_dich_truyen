import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Custom Domain Assets Integrity Suite', () => {
  it('should ensure index.html uses root-relative paths for all assets', () => {
    const indexPath = path.join(process.cwd(), 'index.html');
    const content = fs.readFileSync(indexPath, 'utf-8');

    // Không chứa đường dẫn tuyệt đối localhost
    expect(content).not.toContain('http://localhost');
    expect(content).not.toContain('http://127.0.0.1');

    // Không dùng relative path ./ có nguy cơ lỗi khi deep-linking
    expect(content).not.toContain('href="./');
    expect(content).not.toContain('src="./');

    // Chứa root-relative links
    expect(content).toContain('href="/favicon.svg"');
    expect(content).toContain('src="/theme-init.js"');
    expect(content).toContain('src="/src/main.tsx"');
  });

  it('should verify vite.config.ts base configuration', () => {
    const viteConfigPath = path.join(process.cwd(), 'vite.config.ts');
    const content = fs.readFileSync(viteConfigPath, 'utf-8');

    expect(content).toContain('base: process.env.VITE_BASE_URL || \'/\'');
    expect(content).toContain("outDir: 'dist'");
  });

  it('should verify static security headers config in public/_headers and vercel.json', () => {
    const headersPath = path.join(process.cwd(), 'public', '_headers');
    const vercelPath = path.join(process.cwd(), 'vercel.json');
    expect(fs.existsSync(headersPath)).toBe(true);
    expect(fs.existsSync(vercelPath)).toBe(true);
    const headersContent = fs.readFileSync(headersPath, 'utf-8');
    expect(headersContent).toContain('Cross-Origin-Opener-Policy: same-origin-allow-popups');
    const vercelContent = fs.readFileSync(vercelPath, 'utf-8');
    expect(vercelContent).toContain('"Cross-Origin-Opener-Policy"');
  });
});

