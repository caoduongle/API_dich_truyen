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

describe('Multi-Platform Content Security Policy (CSP) Quad-Parity Suite', () => {
  const rootDir = path.resolve(__dirname, '../..');

  const renderPath = path.join(rootDir, 'render.yaml');
  const vercelPath = path.join(rootDir, 'vercel.json');
  const headersPath = path.join(rootDir, 'public/_headers');
  const vitePath = path.join(rootDir, 'vite.config.ts');

  it('verifies all four configuration files exist on disk', () => {
    expect(fs.existsSync(renderPath)).toBe(true);
    expect(fs.existsSync(vercelPath)).toBe(true);
    expect(fs.existsSync(headersPath)).toBe(true);
    expect(fs.existsSync(vitePath)).toBe(true);
  });

  it('extracts identical CSP values and directives across render.yaml, vercel.json, public/_headers, and vite.config.ts', () => {
    const renderContent = fs.readFileSync(renderPath, 'utf8');
    const vercelContent = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
    const headersContent = fs.readFileSync(headersPath, 'utf8');
    const viteContent = fs.readFileSync(vitePath, 'utf8');

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

    // Byte-for-byte character equality assertions across all 4 targets
    expect(renderCsp).toBe(vercelCsp);
    expect(renderCsp).toBe(headersCsp);
    expect(renderCsp).toBe(viteCsp);
    expect(vercelCsp).toBe(headersCsp);
    expect(vercelCsp).toBe(viteCsp);
    expect(headersCsp).toBe(viteCsp);

    // Semantic AST directive equality assertions
    const parsedRender = cspChecker.parseCsp(renderCsp);
    const parsedVercel = cspChecker.parseCsp(vercelCsp);
    const parsedHeaders = cspChecker.parseCsp(headersCsp);
    const parsedVite = cspChecker.parseCsp(viteCsp);

    cspChecker.assertCspEqual(parsedRender, parsedVercel, 'render.yaml vs vercel.json');
    cspChecker.assertCspEqual(parsedRender, parsedHeaders, 'render.yaml vs public/_headers');
    cspChecker.assertCspEqual(parsedRender, parsedVite, 'render.yaml vs vite.config.ts');

    // Security assertions: verify critical hardening constraints
    expect(renderCsp).not.toContain('ws:');
    expect(renderCsp).not.toContain('wss:');
    expect(parsedRender['script-src']).toEqual(["'self'", 'https://accounts.google.com', 'https://apis.google.com'].sort());
    expect(parsedRender['style-src']).toContain("'unsafe-inline'");
    expect(parsedRender['object-src']).toEqual(["'none'"]);
    expect(parsedRender['frame-ancestors']).toEqual(["'none'"]);
  });
});
