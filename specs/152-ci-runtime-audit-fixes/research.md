# Research: CI Runtime Parity & Container Integrity Hardening

**Feature**: `152-ci-runtime-audit-fixes`  
**Date**: 2026-09-21

---

## R1: jsdom Version Compatibility with Node 20 LTS

### Decision
Downgrade `jsdom` from `^30.1.0` to `29.1.1` (pinned, not caret) and remove `@types/jsdom@^30.0.0`.

### Rationale
- `jsdom@30.0.0+` requires Node `^22.22.2 || ^24.15.0 || >=26.0.0` — incompatible with Node 20 LTS.
- `jsdom@30.1.0` transitively depends on `undici@8.10.2`, which requires `>=22.19.0` and uses `webidl.util.markAsUncloneable`, an API absent in Node 20.
- `jsdom@29.1.1` supports `^20.19.0 || ^22.13.0 || >=24.0.0` — fully compatible with Node 20 LTS.
- `@types/jsdom@30` ships type declarations aligned to jsdom 30 internals. Since the project only uses `DOMParser` (a standard DOM API already included in TypeScript's `lib.dom.d.ts`), the separate `@types/jsdom` package is unnecessary and creates a version-alignment hazard.
- Only one test file (`src/hooks/__tests__/useEpubExport.test.ts`) uses the jsdom environment, activated via the `/** @vitest-environment jsdom */` directive. No global vitest config changes are needed.

### Alternatives Considered
1. **Upgrade entire project to Node 22 LTS** — Rejected because it requires synchronized changes across CI workflows, Dockerfile, README, quickstart docs, developer environment specs, and all existing specs that document Node 20. Risk/reward ratio is poor for a single test dependency.
2. **Remove jsdom and use regex-based XML parsing** — Rejected because this was exactly the weak verification approach that spec 151 aimed to replace; reverting undermines audit integrity.
3. **Use `happy-dom` instead of jsdom** — Viable but introduces a new dependency when jsdom 29 solves the problem directly.

---

## R2: Nginx Sub-Path Routing in Docker Deployments

### Decision
Use `nginx:alpine`'s built-in `envsubst`-on-templates mechanism to dynamically generate the Nginx config at container startup, supporting both root (`/`) and custom sub-path (`/dichtruyen/`) deployments.

### Rationale
- The current Dockerfile hardcodes a static Nginx config at build time with `root /usr/share/nginx/html` and `location / { try_files ... }`.
- When `VITE_BASE_URL=/dichtruyen/`, Vite generates HTML referencing `/dichtruyen/assets/...`, but the static files reside at `/usr/share/nginx/html/assets/...` without a `dichtruyen/` subdirectory.
- Nginx interprets `/dichtruyen/assets/foo.js` as filesystem path `/usr/share/nginx/html/dichtruyen/assets/foo.js`, which doesn't exist → falls back to `index.html` → JS/CSS requests receive HTML → app breaks.
- The `nginx:alpine` image includes `/docker-entrypoint.d/20-envsubst-on-templates.sh`, which automatically processes `*.template` files in `/etc/nginx/templates/` at container startup, substituting environment variables.
- Strategy: Create a `nginx.conf.template` using `${VITE_BASE_URL}` as the `location` block prefix and configure `alias` to map the sub-path prefix to the actual document root. At startup, the entrypoint script substitutes the env var to produce the final config.

### Alternatives Considered
1. **Build the dist output into a sub-directory matching the base path** — Rejected because it requires additional build script complexity and doesn't align with Vite's standard output structure.
2. **Use `sed` at build time to rewrite the config** — Fragile and doesn't support changing the base at container runtime.
3. **Declare sub-path as out-of-scope and require a reverse proxy** — Rejected because the spec explicitly claims Docker sub-path support and the Dockerfile already accepts `VITE_BASE_URL`.

---

## R3: Build Artifact Verification Test Design

### Decision
Convert conditional `if (fs.existsSync(...))` guards in `src/tests/originConfig.test.ts` into unconditional assertions (`expect(...).toBe(true)`), and mark the build artifact tests with a `describe.runIf()` tied to a CI environment flag or simply make them always-run with clear failure messages.

### Rationale
- Current conditional checks silently pass when `dist/` doesn't exist, creating false positives.
- Build artifacts should be verified as part of the CI pipeline after `npm run build` executes.
- In CI, the workflow already runs `npm run build` before `npm test`, so `dist/` will exist.
- For local development, tests should still assert and fail clearly if `dist/` is expected but missing, rather than silently skip.

### Alternatives Considered
1. **Move build verification to a separate CI step** — Viable but loses test-as-documentation value.
2. **Use `vitest.skipIf()` with an env flag** — Partially acceptable but still hides failures; the unconditional assertion approach is more transparent.

---

## R4: Vite Base Path Normalization Alignment

### Decision
Change `vite.config.ts` line 22 from `base: process.env.VITE_BASE_URL || '/'` to `base: publicConfig.basePath` so the build tool receives the same normalized value used by HTML/sitemap transformations.

### Rationale
- `publicConfig.basePath` is already computed via `normalizeBasePath()`, guaranteeing leading and trailing slashes.
- The raw `process.env.VITE_BASE_URL` can be `dichtruyen` (no slashes), `/dichtruyen` (no trailing slash), etc.
- Vite requires `base` to have a trailing slash for correct asset path resolution.
- Using the already-normalized value eliminates divergence between the two code paths.

### Impact
- `src/utils/__tests__/customDomainAssets.test.ts` line 28 has a string assertion checking for the exact text `base: process.env.VITE_BASE_URL || '/'`. This assertion must be updated to match the new code.

### Alternatives Considered
1. **Normalize `process.env.VITE_BASE_URL` in-place before passing to `base:`** — Viable but duplicates normalization logic already in `publicOrigin.ts`.

---

## R5: EPUB mimetype STORE Compression Verification

### Decision
Verify ZIP compression method at the binary header level using the ZIP local file header's compression method field (bytes 8-9, offset from local header start), rather than relying on JSZip's `options.compression` property which may be `null` after `loadAsync()`.

### Rationale
- The EPUB/OCF spec (EPUB 3.3, §4.2) requires `mimetype` as the first file in the archive, stored without compression (method 0 / STORE), and without extra field data.
- JSZip, after `loadAsync()`, does not reliably preserve the compression method in the `options.compression` property — it may return `null` even for STORE-compressed files.
- Inspecting the raw ZIP binary at the known local file header position (bytes 8-9 relative to the local header signature `PK\x03\x04`) provides definitive verification.
- The `mimetype` entry is always the first entry, so its local file header starts at byte 0.

### Alternatives Considered
1. **Accept `STORE || null` as valid** — Rejected because this weakens the compliance check and doesn't verify the actual binary representation.
2. **Use a dedicated EPUB validation library** — Overkill for a single field check; raw binary inspection is deterministic and dependency-free.

---

## R6: normalizeOrigin URL Validation Hardening

### Decision
Replace regex-only scheme validation with `new URL()` parsing, extracting only `protocol + hostname + port` and discarding paths, search params, and fragments.

### Rationale
- Current `isValidWebProtocol` only checks `/^https?:\/\//i`, accepting malformed strings like `https://` (empty host), `https:///` (triple slash), or `https://example.com/foo/bar` (origin + path).
- `new URL()` provides built-in parsing that extracts `.origin` as `protocol//host:port`, correctly handling edge cases.
- Invalid URLs cause `new URL()` to throw, which can be caught to fall back to the default.

### Alternatives Considered
1. **Write a more complex regex** — Fragile and hard to maintain compared to the platform's built-in URL parser.
2. **Leave as-is (P3 priority)** — Acceptable risk-wise but since we're already modifying the module, the incremental cost is minimal.

---

## R7: specs/151 Bookkeeping Reconciliation

### Decision
After CI is green on the corrected dependencies, update specs/151 tasks.md to accurately reflect verified status, adding a note that T001 was superseded by the jsdom downgrade in spec 152.

### Rationale
- T021 is currently marked `[x]` but CI was never green with the jsdom@30 dependency.
- Once spec 152 fixes the dependency and CI passes, T021 can legitimately be re-verified and remain `[x]`.
- T001 installed `jsdom@30.1.0` which was the root cause of the CI failure; spec 152 corrects this, so a cross-reference note is appropriate.
