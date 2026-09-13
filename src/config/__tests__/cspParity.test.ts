import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Security Headers Triple Parity', () => {
  const rootDir = path.resolve(__dirname, '../../..');

  const renderPath = path.join(rootDir, 'render.yaml');
  const vercelPath = path.join(rootDir, 'vercel.json');
  const headersPath = path.join(rootDir, 'public/_headers');

  it('verifies all three configuration files exist', () => {
    expect(fs.existsSync(renderPath)).toBe(true);
    expect(fs.existsSync(vercelPath)).toBe(true);
    expect(fs.existsSync(headersPath)).toBe(true);
  });

  it('extracts identical Content-Security-Policy values across render.yaml, vercel.json, and public/_headers', () => {
    const renderContent = fs.readFileSync(renderPath, 'utf8');
    const vercelContent = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
    const headersContent = fs.readFileSync(headersPath, 'utf8');

    // Extract from render.yaml
    const renderMatch = renderContent.match(/name:\s*Content-Security-Policy\s*\r?\n\s*value:\s*"([^"]+)"/);
    expect(renderMatch).not.toBeNull();
    const renderCsp = renderMatch![1].trim();

    // Extract from vercel.json
    const vercelHeader = vercelContent.headers[0].headers.find(
      (h: { key: string; value: string }) => h.key === 'Content-Security-Policy'
    );
    expect(vercelHeader).toBeDefined();
    const vercelCsp = vercelHeader.value.trim();

    // Extract from public/_headers
    const headersMatch = headersContent.match(/Content-Security-Policy:\s*(.+)/);
    expect(headersMatch).not.toBeNull();
    const headersCsp = headersMatch![1].trim();

    // Byte-for-byte character equality assertions
    expect(renderCsp).toBe(vercelCsp);
    expect(renderCsp).toBe(headersCsp);
    expect(vercelCsp).toBe(headersCsp);

    // Structural assertions for hardened policy
    expect(renderCsp).not.toContain('ws:');
    expect(renderCsp).not.toContain('wss:');
    expect(renderCsp).toMatch(/script-src 'self' https:\/\/apis\.google\.com https:\/\/accounts\.google\.com;/);
    expect(renderCsp).toMatch(/style-src 'self' 'unsafe-inline'/);
  });
});
