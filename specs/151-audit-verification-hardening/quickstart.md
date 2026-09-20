# Quickstart & Verification Guide: Production Verification & Integrity Hardening

**Feature Branch**: `151-audit-verification-hardening`  
**Date**: 2026-09-20  
**Status**: Completed  
**Spec Reference**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## 1. Prerequisites

- Node.js 20 LTS installed.
- Repository dependencies installed via `npm ci`.

---

## 2. Automated Verification Scenarios

### Scenario 1: Sub-Path URL & Public Origin Resolution (US1, US3)

Verify that `src/config/publicOrigin.ts` correctly validates protocols, normalizes subpaths, and transforms `index.html` and `sitemap.xml`:

```bash
npm test -- src/tests/originConfig.test.ts
```

Expected Outcome:
- All test cases pass cleanly.
- Tests exercise production code directly from `src/config/publicOrigin.ts`.
- Validates protocol scheme enforcement (rejects invalid schemes like `ftp://` or `not-a-url`).
- Validates subpath join: `https://example.com` + `/dichtruyen/` = `https://example.com/dichtruyen/`.

---

### Scenario 2: Real XML Parser & EPUB Chapter Order (US2)

Verify that EPUB export tests run with a genuine XML parser (DOMParser), enforce exact `mimetype` without trailing newline, assert `STORE` compression, and preserve `proj.chapters` sequence:

```bash
npm test -- src/hooks/__tests__/useEpubExport.test.ts
```

Expected Outcome:
- Test suite executes in jsdom/DOMParser environment with 0 regex fallback.
- `assertXmlWellFormed` parses all descriptors without syntax errors.
- `mimetype` is asserted as byte-exact `application/epub+zip` with `STORE` compression.
- Chapters created out of order chronologically are verified to be exported in `proj.chapters` index order.

---

### Scenario 3: Database Write Queue Final State Verification (US4)

Verify that concurrent interleaved operations (`save A1 -> save A2 -> delete A -> save A3`) leave the database in the deterministic final state `A3`:

```bash
npm test -- src/services/__tests__/db.test.ts
```

Expected Outcome:
- Chronological execution log matches `['save:A1', 'save:A2', 'delete:proj_seq', 'save:A3']`.
- Final stored project query asserts `finalProject.title === 'A3'`.
- Confirms zero project resurrection.

---

### Scenario 4: Docker Configuration & README Alignment (US1, US5)

Verify that `Dockerfile` includes build arguments and `README.md` documents `VITE_PUBLIC_URL`:

```bash
# Check Dockerfile ARG definitions
grep -E "ARG VITE_PUBLIC_URL" Dockerfile
grep -E "ARG VITE_BASE_URL" Dockerfile

# Check README.md documentation
grep -E "VITE_PUBLIC_URL" README.md
```

Expected Outcome:
- `Dockerfile` declares `ARG VITE_PUBLIC_URL` and `ARG VITE_BASE_URL=/`.
- `README.md` contains `VITE_PUBLIC_URL` in the environment variables list and explains Docker build arguments.

---

### Scenario 5: Full Quality Gate (Mandatory Pre-Completion)

```bash
npm run lint    # tsc --noEmit (0 type errors)
npm test        # vitest run (100% tests pass, 0 skipped)
npm run build   # tsc && vite build (bundle builds cleanly)
```
