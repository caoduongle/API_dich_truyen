# Quickstart & Verification Guide: CI Runtime Parity & Container Integrity Hardening

**Feature Branch**: `152-ci-runtime-audit-fixes`  
**Date**: 2026-09-21  
**Status**: Completed  
**Spec Reference**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## 1. Prerequisites

- Node.js 20 LTS installed.
- Repository dependencies installed via `npm ci` (after dependency changes are applied).
- Docker installed (for Scenario 4 only).

---

## 2. Automated Verification Scenarios

### Scenario 1: Dependency Compatibility Verification (US1)

Verify that jsdom is compatible with Node 20 LTS and all test workers start successfully:

```bash
# Verify jsdom version in package.json
node -e "const p=require('./package.json'); console.log('jsdom:', p.devDependencies.jsdom); console.log('@types/jsdom:', p.devDependencies['@types/jsdom'] ?? 'NOT PRESENT')"

# Run the EPUB test suite (the file that triggered the worker crash)
npm test -- src/hooks/__tests__/useEpubExport.test.ts
```

Expected Outcome:
- `jsdom` reports `29.1.1` (not `^30.x`).
- `@types/jsdom` reports `NOT PRESENT`.
- All test workers launch successfully without `markAsUncloneable` errors.
- All XML well-formedness and EPUB structure assertions pass.

---

### Scenario 2: Normalized Base Path & Build Verification (US3)

Verify that `vite.config.ts` uses the normalized base path and build artifacts are correctly transformed:

```bash
# Build with default configuration
npm run build

# Run the origin config and build artifact tests
npm test -- src/tests/originConfig.test.ts
```

Expected Outcome:
- Build completes cleanly.
- `dist/index.html` exists and contains no `%VITE_PUBLIC_URL%` or `%VITE_CANONICAL_URL%` placeholders.
- `dist/sitemap.xml` exists and contains resolved `<loc>http...` entries.
- Tests fail explicitly if `dist/` files are missing (no silent skip).

---

### Scenario 3: EPUB STORE Compression Binary Verification (US4)

Verify that the EPUB `mimetype` file uses strict STORE compression at the binary level:

```bash
npm test -- src/hooks/__tests__/useEpubExport.test.ts
```

Expected Outcome:
- The test reads bytes 8-9 of the ZIP archive's first local file header.
- Compression method is asserted as `0x0000` (STORE), not `STORE || null`.

---

### Scenario 4: Docker Sub-Path Deployment (US2)

Verify that a Docker container built with a custom sub-path serves assets correctly:

```bash
# Build Docker image with sub-path
docker build --build-arg VITE_BASE_URL=/dichtruyen/ -t test-subpath .

# Run container
docker run -d -p 8080:80 --name test-subpath-container test-subpath

# Test static asset (should return JS/CSS content, not HTML)
curl -s -o /dev/null -w "%{http_code} %{content_type}" http://localhost:8080/dichtruyen/

# Test SPA route fallback
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/dichtruyen/auto-translate

# Cleanup
docker rm -f test-subpath-container
```

Expected Outcome:
- Root URL `/dichtruyen/` returns 200 with `text/html` content.
- SPA route `/dichtruyen/auto-translate` returns 200 with `text/html` content (index.html).
- Static assets under `/dichtruyen/assets/` return 200 with appropriate MIME types.

---

### Scenario 5: Full Quality Gate (Mandatory Pre-Completion)

```bash
npm run lint    # tsc --noEmit (0 type errors)
npm test        # vitest run (100% tests pass, 0 worker crashes, 0 skipped)
npm run build   # tsc && vite build (bundle builds cleanly)
```
