# Quickstart & Verification Guide: Post-Audit Integrity & Quality Hardening

**Feature Branch**: `150-post-audit-hardening`  
**Date**: 2026-09-20  
**Status**: Completed  
**Spec Reference**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## 1. Prerequisites

- Node.js 20 LTS installed.
- Local repository dependencies installed via `npm ci`.

---

## 2. Automated Verification Scenarios

### Scenario 1: Public Origin & Sitemap Substitution (US1)

Prove that `.env` environment variables are read by `vite.config.ts` via `loadEnv` and properly injected into `index.html` and `sitemap.xml`.

```bash
# 1. Build the production bundle
npm run build

# 2. Verify dist/index.html does not contain unreplaced %VITE_PUBLIC_URL% tokens
node -e "const html = require('fs').readFileSync('dist/index.html', 'utf8'); if (html.includes('%VITE_PUBLIC_URL%')) throw new Error('Unreplaced placeholder found in index.html');"

# 3. Verify dist/sitemap.xml does not contain unreplaced %VITE_PUBLIC_URL% tokens and has valid URLs
node -e "const sm = require('fs').readFileSync('dist/sitemap.xml', 'utf8'); if (sm.includes('%VITE_PUBLIC_URL%')) throw new Error('Unreplaced placeholder found in sitemap.xml');"
```

Expected Outcome:
- Build completes cleanly.
- Canonical link in `dist/index.html` and `<loc>` links in `dist/sitemap.xml` resolve cleanly to the configured public origin.

---

### Scenario 2: EPUB XML Well-Formedness & Package Integrity (US2)

Verify that the EPUB export produces compliant archives where all descriptors parse as valid XML and `mimetype` satisfies entry #0 + STORE compression.

```bash
npx vitest run src/hooks/__tests__/useEpubExport.test.ts
```

Expected Outcome:
- All 5+ test cases pass cleanly.
- `DOMParser` / XML structural verification asserts 0 `parsererror` elements.
- `zip.files['mimetype']` is confirmed as index 0 with `STORE` compression.

---

### Scenario 3: Database Write Queue FIFO Serialization (US3)

Verify that concurrent writes and deletes are strictly serialized per project ID in FIFO order without out-of-order execution.

```bash
npx vitest run src/services/__tests__/db.test.ts
```

Expected Outcome:
- Interleaved execution sequence (`save A1 -> save A2 -> delete A -> save A3`) executes strictly in order.
- No project resurrection or orphan records.
- In-memory `validateBundleInput` and in-transaction `assertChapterOwnership` execute as distinct validation phases.

---

### Scenario 4: Content Security Policy Quad-Parity (US3)

Verify that a single canonical CSP test suite asserts byte-for-byte and AST directive parity across all 4 targets.

```bash
npx vitest run src/tests/cspParity.test.ts
```

Expected Outcome:
- Confirms equality across `render.yaml`, `vercel.json`, `public/_headers`, and `vite.config.ts`.
- `src/config/__tests__/cspParity.test.ts` is deleted and no longer executed.

---

### Scenario 5: Full Quality Gate (Mandatory Pre-Completion)

Run the full non-negotiable project quality gate:

```bash
npm run lint    # tsc --noEmit (0 type errors)
npm test        # vitest run (100% tests pass, 0 skipped)
npm run build   # tsc && vite build (bundle builds cleanly)
```
