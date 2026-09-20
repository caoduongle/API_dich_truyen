# Technical Research & Architecture Decisions: Post-Audit Integrity & Quality Hardening

**Feature Branch**: `150-post-audit-hardening`  
**Date**: 2026-09-20  
**Status**: Completed  
**Spec Reference**: [spec.md](spec.md)

---

## 1. Public Origin Portability & Build-Time Sitemap Decoupling

### Context
In commit `8351259`, `index.html` was refactored to use `%VITE_PUBLIC_URL%`, and `robots.txt` was made portable via `Sitemap: /sitemap.xml`. However:
1. `vite.config.ts` was evaluating `process.env.VITE_PUBLIC_URL` directly without calling `loadEnv()`. In Vite (v5/v6), variables defined in `.env`, `.env.local`, or `.env.production` are not populated into `process.env` when `vite.config.ts` is evaluated unless explicitly loaded with `loadEnv(mode, process.cwd(), '')`.
2. `.env.example` did not document `VITE_PUBLIC_URL`.
3. `public/sitemap.xml` still hard-coded `https://api-dich-truyen.onrender.com` across all 6 route URLs.

### Decision
- In `vite.config.ts`:
  Use the standard Vite config function signature `defineConfig(({ mode }))`. Call `const env = loadEnv(mode, process.cwd(), '');` and resolve `publicUrl = (env.VITE_PUBLIC_URL || process.env.VITE_PUBLIC_URL || 'https://api-dich-truyen.onrender.com').replace(/\/+$/, '')`.
- For `sitemap.xml`:
  Update `public/sitemap.xml` to use `%VITE_PUBLIC_URL%` as the origin placeholder (or allow dynamic transformation). Add a lightweight Vite build plugin `sitemap-transform-public-url` that:
  - During build `closeBundle()`: Reads `dist/sitemap.xml` (copied by Vite from `public/`) and replaces `%VITE_PUBLIC_URL%` (and fallback domain) with `publicUrl`.
  - During dev `configureServer(server)`: Intercepts `GET /sitemap.xml` to serve the dynamically transformed XML with appropriate `Content-Type: application/xml`.
- In `.env.example`:
  Add clear documentation for `VITE_PUBLIC_URL` specifying its usage for canonical URLs, OpenGraph metadata, JSON-LD, and sitemaps.

### Alternatives Considered
- *Runtime dynamic sitemap endpoint via client router*: Rejected because this is a Pure Client-Side SPA; search engine crawlers expect `/sitemap.xml` as a static XML file without executing client-side React routes.
- *Separate build script `generate-sitemap.js`*: Rejected because Vite plugin hooks (`transformIndexHtml` and `closeBundle`) provide unified, single-command build integration without adding extra NPM build scripts.

---

## 2. EPUB XML Structure Validation & Archive Specification Compliance

### Context
Commit `8351259` added an end-to-end EPUB export test that validates archive contents using `JSZip.loadAsync()` and string matching `expect(xml).toContain(...)`. However:
1. String matching does not prove XML well-formedness; a corrupted or improperly nested XML string containing the expected substring could still pass.
2. The EPUB standard (IDPF EPUB 3.0) mandates that:
   - `mimetype` must be the first entry in the zip archive (`entries[0] === 'mimetype'`).
   - `mimetype` must be stored uncompressed (`STORE` mode, no deflate compression).
3. `useEpubExport.ts` calls `URL.revokeObjectURL(url)` immediately after calling `triggerDownload(url, filename)`. In some modern browsers, revoking the blob URL synchronously on the next statement can race with the browser's asynchronous file save dialog.

### Decision
- **XML Validation in Tests**:
  Implement a dedicated XML well-formedness validator for test suites:
  If `globalThis.DOMParser` is present, parse each XML document (`container.xml`, `content.opf`, `nav.xhtml`, `toc.ncx`, and chapter XHTMLs) with `parser.parseFromString(xml, 'application/xml')` and assert `doc.querySelector('parsererror') === null`.
  To ensure compatibility in headless Node.js Vitest environments where browser DOMParser may not be populated globally, provide a rigorous fallback XML structural validator checking tag balance (LIFO stack), attribute quote integrity, entity validity, and single-root hierarchy.
- **Mimetype Entry Order & Compression Mode**:
  In `useEpubExport.test.ts`, assert:
  `expect(Object.keys(zip.files)[0]).toBe('mimetype')`
  `expect((zip.files['mimetype'] as any).options.compression).toBe('STORE')`
- **Download Blob URL Lifecycle**:
  In `useEpubExport.ts`, defer `URL.revokeObjectURL(url)` using `setTimeout(() => URL.revokeObjectURL(url), 1000)` (or standard download lifecycle delay) so that the browser has sufficient time to initiate the stream.

### Alternatives Considered
- *Adding external XML parser library (e.g., `fast-xml-parser`)*: Rejected per Constitution Principle II (Dependency Minimization). Standard DOMParser or a clean regex/stack well-formedness parser achieves 100% test coverage without new dependencies.
- *Never revoking object URLs*: Rejected because it causes client memory leaks over long translation sessions with multiple exports.

---

## 3. Test Suite Deduplication: Content Security Policy Quad-Parity

### Context
Two separate test files currently test Content Security Policy parity:
1. `src/config/__tests__/cspParity.test.ts`: Older test checking 3 targets (`render.yaml`, `vercel.json`, `public/_headers`) using raw regex matching.
2. `src/tests/cspParity.test.ts`: Newer, comprehensive test checking 4 targets (`render.yaml`, `vercel.json`, `public/_headers`, `vite.config.ts`), parsing CSP directives into AST dictionaries, and verifying directive-level equality.

### Decision
- Remove `src/config/__tests__/cspParity.test.ts` to eliminate duplicate test responsibilities.
- Retain `src/tests/cspParity.test.ts` as the sole canonical authority for CSP Quad-Parity verification.

### Alternatives Considered
- *Keeping both suites*: Rejected because having two tests covering the same invariant with slightly different scopes creates maintenance overhead and confusion when updating security headers.

---

## 4. Database Write Queue Verification & Invariant Validation Separation

### Context
1. `projectStorageQueue.ts` was refactored to forward calls directly to `db.ts`, making `db.ts` (`projectWriteChains`) the single authority for write serialization. However, tests in `projectStorageQueue.test.ts` only verify delegation, not the end-to-end FIFO execution order.
2. In `src/services/db.ts`, `executeAtomicSaveProjectBundle` currently combines in-memory validation of input bundle entities (checking that CRDT states match chapters in the bundle) with in-transaction relational checks against stored IndexedDB records (`assertChapterOwnership`).

### Decision
- **Explicit FIFO Integration Test**:
  Add a dedicated test case in `src/services/__tests__/db.test.ts` that executes an interleaved sequence targeting the same project ID:
  `save A1` -> `save A2` -> `delete A` -> `save A3`
  Verify that:
  - Each step executes strictly after the preceding step settles.
  - Final database state matches A3.
  - Project deletion in the middle does not race ahead or cause state resurrection.
- **Validation Refactoring**:
  Extract the in-memory structural validation in `executeAtomicSaveProjectBundle` into a dedicated helper:
  `export function validateBundleInput(project: StoryProject, chapters: Chapter[], crdtStates?: (CrdtBinaryStateItem | CrdtStateRecord)[]): void`
  Keep in-transaction database checks cleanly categorized under stored state validation (`assertChapterOwnership` / `validateStoredOwnership`).

### Alternatives Considered
- *Moving all validations inside the transaction*: Rejected for in-memory checks; validating malformed bundle parameters before acquiring database transactions avoids opening unnecessary transactions and locks.

---

## 5. UI Quota Copy & Architecture Documentation Alignment

### Context
1. `KeyListSection.tsx` line 327 states: *"Thêm nhiều khóa thuộc các dự án khác nhau để mở rộng dung lượng dịch."* In reality, Gemini quotas (RPM/TPM) are scoped to Google Cloud Project / Quota Groups, not per-key. Adding keys to the same project only adds health rotation and failover redundancy, not linear quota scaling.
2. `docs/architecture.md` line 8 states: *"...lưu tạm thời trong sessionStorage của trình duyệt hoặc mã hóa trong IndexedDB."* The application does not encrypt Gemini API keys in IndexedDB; keys are kept in `sessionStorage` or `localStorage['app_ui_prefs'].savedKeys` (when `rememberKeys = true`).
3. Completed tasks in `specs/147` (`T032`) and status indicators in `specs/149` (`spec.md` Draft, `quickstart.md` Ready for Implementation) have metadata drift despite implementation completion.

### Decision
- Update `KeyListSection.tsx`: Replace with neutral, accurate phrasing:
  `"Hệ thống tự động gom nhóm khóa theo Project / Quota Group và quản lý hạn ngạch RPM/TPM độc lập. Có thể cấu hình nhiều khóa thuộc các Project / Quota Group khác nhau để tăng khả năng dự phòng và điều phối hạn mức."`
- Update `docs/architecture.md`: Remove the obsolete clause `"hoặc mã hóa trong IndexedDB"`, aligning the text with the storage table and security policy.
- Update `specs/147/tasks.md`: Check `[x] T032`.
- Update `specs/149/spec.md` and `quickstart.md`: Set `Status: Completed`.

---

## Summary of Decisions

| Item | Canonical Action | Target Files |
| :--- | :--- | :--- |
| **Vite Env & Origin** | `loadEnv(mode, process.cwd(), '')`, document `VITE_PUBLIC_URL`, sitemap transform plugin | `vite.config.ts`, `.env.example`, `public/sitemap.xml` |
| **EPUB Verification** | XML DOMParser / structural validation, check `mimetype` first + `STORE`, deferred `revokeObjectURL` | `src/hooks/useEpubExport.ts`, `src/hooks/__tests__/useEpubExport.test.ts` |
| **CSP Test Suite** | Remove duplicate older suite, retain quad-parity suite | Delete `src/config/__tests__/cspParity.test.ts`, keep `src/tests/cspParity.test.ts` |
| **DB FIFO & Validation** | Add interleaved sequence test, extract `validateBundleInput` helper | `src/services/db.ts`, `src/services/__tests__/db.test.ts` |
| **Documentation & Copy** | Realign quota copy, scrub IndexedDB encryption claim, update spec statuses | `KeyListSection.tsx`, `docs/architecture.md`, `specs/147/`, `specs/149/` |
