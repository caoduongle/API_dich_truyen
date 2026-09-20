/**
 * Contract: jsdom Runtime Compatibility
 *
 * Constraint: jsdom version MUST support the project's Node 20 LTS baseline.
 *
 * jsdom 29.1.1 engines: "^20.19.0 || ^22.13.0 || >=24.0.0"
 * jsdom 30.0.0+ engines: "^22.22.2 || ^24.15.0 || >=26.0.0" (incompatible with Node 20)
 *
 * Verification:
 *   1. package.json devDependencies.jsdom must resolve to 29.x
 *   2. @types/jsdom should NOT be present (DOMParser types come from lib.dom.d.ts)
 *   3. `npm test` must complete with 0 worker startup failures on Node 20
 */

// Contract assertion (run as part of test suite)
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('jsdom Runtime Compatibility Contract', () => {
  it('package.json specifies jsdom@29.x compatible with Node 20 LTS', () => {
    const pkgPath = path.resolve(__dirname, '../../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    const jsdomVersion = pkg.devDependencies?.jsdom;
    expect(jsdomVersion).toBeDefined();
    // Must be pinned to 29.x (not ^30 or higher)
    expect(jsdomVersion).toMatch(/^29\./);
  });

  it('@types/jsdom is not listed in devDependencies', () => {
    const pkgPath = path.resolve(__dirname, '../../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    expect(pkg.devDependencies?.['@types/jsdom']).toBeUndefined();
  });
});
