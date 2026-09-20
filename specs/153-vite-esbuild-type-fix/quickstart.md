# Quickstart & Verification Guide: Vite Esbuild Configuration Overload Resolution Fix

**Branch**: `153-vite-esbuild-type-fix`  
**Date**: 2026-09-21  

---

## 1. Prerequisites

- **Node.js**: `^20.19.0` (LTS baseline)
- **Package Manager**: `npm` (with `package-lock.json` lockfile)
- **Git Branch**: `153-vite-esbuild-type-fix`

---

## 2. Validation Scenarios

### Scenario 1: Static Type Checking (`npm run lint`)

Verifies that TypeScript compiles the repository and `vite.config.ts` without triggering TS2769 overload resolution errors or type mismatch failures.

```bash
npm run lint
```

**Expected Outcome**:
- Exit code `0`.
- Output displays `> tsc --noEmit` and finishes cleanly with 0 errors.
- No `error TS2769: No overload matches this call` on `vite.config.ts`.

---

### Scenario 2: Automated Test Suites Execution (`npm test`)

Verifies that all 92 test files and 845 tests pass without any failures or skipped tests, ensuring no regressions to integrity checkers or existing suites.

```bash
npm test
```

**Expected Outcome**:
- Exit code `0`.
- 92 test files pass.
- 845 tests pass.
- `customDomainAssets.test.ts` passes (asserting `base: publicConfig.basePath` and `outDir: 'dist'`).
- `cspParity.test.ts` passes (asserting CSP parity across configuration targets).

---

### Scenario 3: Production Build Generation (`npm run build`)

Verifies that `vite build` executes successfully with the typed configuration and esbuild drop options, packaging the application into `dist/`.

```bash
npm run build
```

**Expected Outcome**:
- Exit code `0`.
- Directory `dist/` is generated with `index.html` and bundled assets.
- Production bundles have `console` and `debugger` stripped by esbuild as configured.

---

### Scenario 4: Cross-Platform CI Parity Check

Verifies that the configuration passes identically under Linux environment simulation (or on GitHub Actions).

```bash
# In GitHub Actions or Docker / WSL / Linux container
npm run lint && npm test && npm run build
```

**Expected Outcome**:
- Clean zero-error pass across all quality gates.
