import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { CspDirectives, CspParityChecker } from '../../specs/149-storage-integrity-audit-fixes/contracts/csp-parity.contract';

export const cspChecker: CspParityChecker = {
  parseCsp(rawCsp: string): CspDirectives {
    const directives: CspDirectives = {};
    const tokens = rawCsp
      .split(';')
      .map(part => part.trim())
      .filter(Boolean);

    for (const token of tokens) {
      const parts = token.split(/\s+/).filter(Boolean);
      const directiveName = parts[0];
      const directiveValues = parts.slice(1);
      // Sort values to ensure comparison is resilient to arbitrary token ordering
      directives[directiveName] = directiveValues.sort();
    }
    return directives;
  },

  assertCspEqual(actual: CspDirectives, expected: CspDirectives, context: string): void {
    const actualKeys = Object.keys(actual).sort();
    const expectedKeys = Object.keys(expected).sort();

    expect(actualKeys, `${context}: directive keys mismatch`).toEqual(expectedKeys);

    for (const key of actualKeys) {
      expect(actual[key], `${context}: directive values mismatch for [${key}]`).toEqual(expected[key]);
    }
  },
};

describe('Multi-Platform Content Security Policy (CSP) Penta-Parity Suite', () => {
  const rootDir = path.resolve(__dirname, '../..');

  const renderPath = path.join(rootDir, 'render.yaml');
  const vercelPath = path.join(rootDir, 'vercel.json');
  const headersPath = path.join(rootDir, 'public/_headers');
  const vitePath = path.join(rootDir, 'vite.config.ts');
  const nginxPath = path.join(rootDir, 'nginx/default.conf.template');

  it('verifies all five configuration files exist on disk', () => {
    expect(fs.existsSync(renderPath)).toBe(true);
    expect(fs.existsSync(vercelPath)).toBe(true);
    expect(fs.existsSync(headersPath)).toBe(true);
    expect(fs.existsSync(vitePath)).toBe(true);
    expect(fs.existsSync(nginxPath)).toBe(true);
  });

  it('extracts identical CSP values and directives across render.yaml, vercel.json, public/_headers, vite.config.ts, and nginx template', () => {
    const renderContent = fs.readFileSync(renderPath, 'utf8');
    const vercelContent = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
    const headersContent = fs.readFileSync(headersPath, 'utf8');
    const viteContent = fs.readFileSync(vitePath, 'utf8');
    const nginxContent = fs.readFileSync(nginxPath, 'utf8');

    // 1. Extract from render.yaml
    const renderMatch = renderContent.match(/name:\s*Content-Security-Policy\s*\r?\n\s*value:\s*"([^"]+)"/);
    expect(renderMatch, 'Content-Security-Policy not found in render.yaml').not.toBeNull();
    const renderCsp = renderMatch![1].trim();

    // 2. Extract from vercel.json
    const vercelHeader = vercelContent.headers[0].headers.find(
      (h: { key: string; value: string }) => h.key === 'Content-Security-Policy'
    );
    expect(vercelHeader, 'Content-Security-Policy not found in vercel.json').toBeDefined();
    const vercelCsp = vercelHeader.value.trim();

    // 3. Extract from public/_headers
    const headersMatch = headersContent.match(/Content-Security-Policy:\s*(.+)/);
    expect(headersMatch, 'Content-Security-Policy not found in public/_headers').not.toBeNull();
    const headersCsp = headersMatch![1].trim();

    // 4. Extract from vite.config.ts
    const viteMatch = viteContent.match(/'Content-Security-Policy':\s*"([^"]+)"/);
    expect(viteMatch, 'Content-Security-Policy not found in vite.config.ts').not.toBeNull();
    const viteCsp = viteMatch![1].trim();

    // 5. Extract from nginx/default.conf.template
    const nginxMatch = nginxContent.match(/add_header\s+Content-Security-Policy\s+"([^"]+)"\s+always;/);
    expect(nginxMatch, 'Content-Security-Policy not found in nginx/default.conf.template').not.toBeNull();
    const nginxCsp = nginxMatch![1].trim();

    // Byte-for-byte character equality assertions across all 5 targets
    expect(renderCsp).toBe(vercelCsp);
    expect(renderCsp).toBe(headersCsp);
    expect(renderCsp).toBe(viteCsp);
    expect(renderCsp).toBe(nginxCsp);
    expect(vercelCsp).toBe(headersCsp);
    expect(vercelCsp).toBe(viteCsp);
    expect(vercelCsp).toBe(nginxCsp);
    expect(headersCsp).toBe(viteCsp);
    expect(headersCsp).toBe(nginxCsp);
    expect(viteCsp).toBe(nginxCsp);

    // Semantic AST directive equality assertions
    const parsedRender = cspChecker.parseCsp(renderCsp);
    const parsedVercel = cspChecker.parseCsp(vercelCsp);
    const parsedHeaders = cspChecker.parseCsp(headersCsp);
    const parsedVite = cspChecker.parseCsp(viteCsp);
    const parsedNginx = cspChecker.parseCsp(nginxCsp);

    cspChecker.assertCspEqual(parsedRender, parsedVercel, 'render.yaml vs vercel.json');
    cspChecker.assertCspEqual(parsedRender, parsedHeaders, 'render.yaml vs public/_headers');
    cspChecker.assertCspEqual(parsedRender, parsedVite, 'render.yaml vs vite.config.ts');
    cspChecker.assertCspEqual(parsedRender, parsedNginx, 'render.yaml vs nginx/default.conf.template');

    // Security assertions: verify critical hardening constraints
    expect(renderCsp).not.toContain('ws:');
    expect(renderCsp).not.toContain('wss:');
    expect(parsedRender['script-src']).toEqual(["'self'", 'https://accounts.google.com', 'https://apis.google.com'].sort());
    expect(parsedRender['style-src']).toContain("'unsafe-inline'");
    expect(parsedRender['object-src']).toEqual(["'none'"]);
    expect(parsedRender['frame-ancestors']).toEqual(["'none'"]);
  });

  it('verifies non-CSP security headers parity across render.yaml, vercel.json, public/_headers, and nginx template', () => {
    const renderContent = fs.readFileSync(renderPath, 'utf8');
    const vercelContent = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
    const headersContent = fs.readFileSync(headersPath, 'utf8');
    const nginxContent = fs.readFileSync(nginxPath, 'utf8');

    const expectedHeaders: Record<string, string> = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    };

    const vercelHeadersMap = new Map<string, string>();
    for (const h of vercelContent.headers[0].headers) {
      vercelHeadersMap.set(h.key, h.value);
    }

    for (const [headerName, expectedValue] of Object.entries(expectedHeaders)) {
      // 1. render.yaml check
      const renderRegex = new RegExp(`name:\\s*${headerName}\\s*\\r?\\n\\s*value:\\s*["']?([^"'\r\n]+)["']?`);
      const renderMatch = renderContent.match(renderRegex);
      expect(renderMatch, `${headerName} missing in render.yaml`).not.toBeNull();
      expect(renderMatch![1].trim()).toBe(expectedValue);

      // 2. vercel.json check
      expect(vercelHeadersMap.get(headerName), `${headerName} missing in vercel.json`).toBe(expectedValue);

      // 3. public/_headers check
      const headersRegex = new RegExp(`${headerName}:\\s*(.+)`);
      const headersMatch = headersContent.match(headersRegex);
      expect(headersMatch, `${headerName} missing in public/_headers`).not.toBeNull();
      expect(headersMatch![1].trim()).toBe(expectedValue);

      // 4. nginx/default.conf.template check
      const nginxRegex = new RegExp(`add_header\\s+${headerName}\\s+"([^"]+)"\\s+always;`);
      const nginxMatch = nginxContent.match(nginxRegex);
      expect(nginxMatch, `${headerName} missing in nginx/default.conf.template`).not.toBeNull();
      expect(nginxMatch![1].trim()).toBe(expectedValue);
    }
  });
});
