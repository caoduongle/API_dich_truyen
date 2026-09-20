# Research & Technical Decisions: Production Verification & Integrity Hardening

**Feature**: `151-audit-verification-hardening`  
**Date**: 2026-09-20  
**Spec Reference**: [spec.md](spec.md)

---

## Technical Context & Decisions

### Decision 1: Real XML Parser in Vitest for EPUB Tests
- **Context**: In `src/hooks/__tests__/useEpubExport.test.ts`, tests previously fell back to an internal regex/stack heuristic when `DOMParser` was not present on `globalThis`. Because Vitest runs in Node.js by default, this meant EPUB tests routinely ran the fallback parser rather than genuine XML parser validation.
- **Decision**: Configure Vitest test environment with `jsdom` (`/** @vitest-environment jsdom */` or direct `JSDOM` / `DOMParser` instantiation). Install `jsdom` and `@types/jsdom` as devDependencies. Eliminate the regex/stack fallback entirely from `assertXmlWellFormed`, ensuring any XML syntax error is reported directly by the real DOMParser parsererror element or throws.
- **Rationale**: The user explicitly requested: *"Có hai hướng hợp lý: /** @vitest-environment jsdom */ và bảo đảm jsdom là devDependency trực tiếp... Tôi nghiêng về phương án test environment riêng cho EPUB + parser thực, vì nó sát đúng mục tiêu của test hơn."* Vitest natively integrates with `jsdom` for browser DOM emulation in test files.
- **Alternatives Considered**: 
  - *Regex/stack fallback*: Rejected because it does not validate attributes, namespaces, or entity rules compliant with XML specs.
  - *Custom Node XML parser package*: Rejected because `jsdom` is the official Vitest browser environment standard and directly supplies `DOMParser`.

---

### Decision 2: Production Public Origin Module (`src/config/publicOrigin.ts`)
- **Context**: `src/tests/originConfig.test.ts` defined a local mock `originResolver` that duplicated the logic inside `vite.config.ts`. If `vite.config.ts` were broken, the test would still pass.
- **Decision**: Extract public origin resolution, protocol scheme validation, base path normalization, and HTML/sitemap transformation into `src/config/publicOrigin.ts`. Both `vite.config.ts` and `src/tests/originConfig.test.ts` import and execute this single authoritative module.
- **Rationale**: Adheres to DRY (Don't Repeat Yourself) and guarantees that tests exercise the actual production code that powers Vite builds and dev servers.
- **Alternatives Considered**:
  - *Keep logic in vite.config.ts and export from it*: `vite.config.ts` runs in Node ESM with Vite plugins, making importing it directly into Vitest tests fragile due to plugin references and build lifecycle hooks. A standalone utility in `src/config/` is clean, modular, and directly importable.

---

### Decision 3: Docker Build Arguments for `VITE_PUBLIC_URL` and `VITE_BASE_URL`
- **Context**: `.dockerignore` excludes `.env*`, so `RUN npm run build` inside Docker runs without environment files. Without build args, `VITE_PUBLIC_URL` falls back to the default Render domain, breaking custom-domain Docker deployments.
- **Decision**: Add `ARG VITE_PUBLIC_URL` and `ARG VITE_BASE_URL=/` in `Dockerfile`, and expose them via `ENV VITE_PUBLIC_URL=$VITE_PUBLIC_URL` and `ENV VITE_BASE_URL=$VITE_BASE_URL` before `RUN npm run build`. Document usage in `README.md`.
- **Rationale**: Standard Docker pattern for passing build-time configuration to SPA compilers.
- **Alternatives Considered**:
  - *Copying `.env` into Docker container*: Insecure and pollutes image layers with local secrets.
  - *Runtime container environment variable injection*: Requires server-side templating (like envsubst on Nginx start), which is unnecessarily complex for purely static assets that can be baked at build time.

---

### Decision 4: Sub-Path URL Architecture & Base-Relative Static Assets
- **Context**: When `VITE_BASE_URL` is set to a sub-path (e.g., `/dichtruyen/`), canonical URLs, sitemaps, and public static assets in `index.html` were mismatched:
  - Canonical URL emitted `https://example.com/` instead of `https://example.com/dichtruyen/`.
  - Sitemap entries emitted `https://example.com/auto-translate` instead of `https://example.com/dichtruyen/auto-translate`.
  - Public static assets (`/favicon.svg`, `/theme-init.js`, `/site.webmanifest`, `/og-image.svg`) had hardcoded leading slashes, requesting root assets instead of subpath assets.
- **Decision**:
  1. Define `canonicalAppUrl = origin + basePath` (with normalized slashes).
  2. Transform sitemap `<loc>` elements with `canonicalAppUrl`.
  3. Update `index.html` static asset references to use `%BASE_URL%favicon.svg`, `%BASE_URL%theme-init.js`, `%BASE_URL%site.webmanifest`, `%BASE_URL%og-image.svg`. Vite automatically replaces `%BASE_URL%` with the configured base path at build time.
  4. Replace `%VITE_PUBLIC_URL%/` with `canonicalAppUrl` for canonical and OpenGraph tags.
- **Rationale**: Aligns Vite's official base-path mechanics with SEO and social graph metadata.

---

### Decision 5: FIFO Write Queue Final State Verification in `db.test.ts`
- **Context**: The existing FIFO test logged calls to an array (`['save:A1', 'save:A2', 'delete:proj_seq', 'save:A3']`), but did not verify the actual resulting record in the mock database store.
- **Decision**: Update `mockProjectsStore` in `src/services/__tests__/db.test.ts` to maintain an in-memory `Map<string, StoryProject>`. `put` sets records, `delete` removes records, and `get` retrieves records. At the end of `Promise.all([p1, p2, pDelete, p3])`, query the store or `getProjectFromDB(projectId)` and assert that `storedProjects.get('proj_seq')?.title === 'A3'`.
- **Rationale**: Conclusively proves that the database ended in state `A3`, confirming zero resurrection or race conditions.

---

### Decision 6: EPUB Chapter Manifest Order Preservation
- **Context**: `useEpubExport.ts` sorted chapters exclusively by `createdAt`:
  `[...fullChapters].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())`.
  If a user reordered chapters in a project or imported chapter 2 before chapter 1, sorting by `createdAt` broke the intended chapter sequence.
- **Decision**: Establish `proj.chapters` array order as the primary sort authority:
  ```typescript
  const chapterOrderMap = new Map((proj.chapters || []).map((meta, idx) => [meta.id, idx]));
  const sortedChapters = [...fullChapters].sort((a, b) => {
    const orderA = chapterOrderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const orderB = chapterOrderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  ```
- **Rationale**: Respects author intent while safely falling back to chronological creation date if a chapter ID is not found in `proj.chapters`.

---

### Decision 7: Tightening of EPUB Test Contract Assertions
- **Context**:
  - `expect(mimetypeText.trim()).toBe('application/epub+zip')` allowed trailing newlines (`\n`).
  - `expect(compression === 'STORE' || compression === null).toBe(true)` allowed `null`.
- **Decision**: In `useEpubExport.test.ts`:
  - `expect(mimetypeText).toBe('application/epub+zip')` (exact match without `.trim()`).
  - `expect(zip.files['mimetype'].options.compression).toBe('STORE')` (or explicit uncompressed invariant matching JSZip specifications).
- **Rationale**: Guarantees byte-level compliance with IDPF EPUB standards.
