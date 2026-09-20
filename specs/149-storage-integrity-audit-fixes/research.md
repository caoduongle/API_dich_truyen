# Phase 0 Research: Storage Integrity, Security Parity & Hygiene Remediation

**Feature**: `149-storage-integrity-audit-fixes`  
**Date**: 2026-09-20  
**Status**: Completed  

---

## 1. Storage Queue Consolidation & Lazy Serialization

### Context & Problem
In `src/services/projectStorageQueue.ts`, `savePromise = saveProjectToDB(project)` and `deletePromise = deleteProjectFromDB(id)` were being created **before** being passed to `.then(() => ...)` in `writeChain`.
Because promises begin execution immediately upon instantiation in JavaScript, the underlying database operation began right away without waiting for prior operations in `writeChain` to finish.
Furthermore, `saveProjectToDB` and `deleteProjectFromDB` in `src/services/db.ts` already sequence writes per `projectId` using `projectWriteChains.get(projectId)`. Having two concurrent queue levels (a global `writeChain` in `projectStorageQueue.ts` and a per-project `projectWriteChains` map in `db.ts`) created architectural redundancy and race potential.

### Decision
1. **Single Source of Truth for Serialization**: Designate `projectWriteChains` in `src/services/db.ts` as the sole authority for per-project write serialization.
2. **Lazy Execution in `projectStorageQueue.ts`**: Refactor `enqueueProjectSave` and `enqueueProjectDelete` to forward directly into `saveProjectToDB` and `deleteProjectFromDB` respectively, or sequence them lazily via `.then(() => saveProjectToDB(project))`.
3. **Queue Drainage**: `waitForQueueIdle(projectId?: string)` coordinates with `waitForProjectWrites(projectId)` so callers (such as test suites or page unloads) can reliably await all active writes.
4. **Remove Dead Imports**: Remove unused `enqueueProjectWrite` from `projectStorageQueue.ts`.

### Alternatives Considered
- *Retain two-tier queue with lazy promise chaining*: Would fix the eager start bug, but preserves unnecessary architectural bloat and global serialization blocking across unrelated projects.
- *Eliminate `projectStorageQueue.ts` entirely*: Would require changing import sites across multiple UI hooks and tests. Keeping `projectStorageQueue.ts` as a unified facade delegating to `db.ts` preserves API stability while fixing the underlying concurrency model.

---

## 2. In-Transaction Relational Validation in IndexedDB (TOCTOU Elimination)

### Context & Problem
In `executeSaveProjectToDB` and `executeAtomicSaveProjectBundle` in `src/services/db.ts`:
1. A `readonly` transaction was opened on `CHAPTERS_STORE` to check if referenced chapters belong to another project (preventing re-parenting).
2. The `readonly` transaction completed.
3. Later, a `readwrite` transaction was opened on `[PROJECTS_STORE, CHAPTERS_STORE, ...]` to perform the write.
This created a classic Time-of-Check to Time-of-Use (TOCTOU) window where another concurrent tab or operation could mutate the chapters between check and write.

### Decision
1. **Single Multi-Store `readwrite` Transaction**: Perform both the validation reads and the persistence writes inside the **same** transaction.
2. **Atomic Abort on Invariant Failure**: Inside `executeSaveProjectToDB`:
   - Open `db.transaction([PROJECTS_STORE, CHAPTERS_STORE], 'readwrite')`.
   - Read existing chapter records to verify ownership.
   - If an existing chapter has a different `projectId`, invoke `transaction.abort()` and reject with a `Relational integrity violation` error.
   - If valid, write the chapters and project metadata within the same transaction.
3. Apply identical in-transaction validation logic to `executeAtomicSaveProjectBundle` across `[PROJECTS_STORE, CHAPTERS_STORE, crdtStore]`.

### Alternatives Considered
- *Rely on application-level locks only*: While `projectWriteChains` serializes within a single tab, it does not lock across browser tabs or background sync events. In-transaction validation guarantees database-level atomicity.

---

## 3. Gemini API Key Storage Policy & UI Disclosure

### Context & Problem
`useAIConfig.ts` defaults `rememberKeys` to `true`, persisting keys in `localStorage['app_ui_prefs'].savedKeys`. Meanwhile, `README.md`, `SECURITY.md`, and `docs/architecture.md` state that keys are ephemeral session-only credentials.

### Decision (Option B: UX-First with Explicit Disclosure)
1. **Preserve User Convenience**: Maintain `rememberKeys = true` by default so users on private machines do not need to re-enter API keys every time they close a tab.
2. **Synchronize Security Documentation**: Update `README.md`, `SECURITY.md`, and `docs/architecture.md` to state clearly:
   - When "Ghi nhớ API key" (`rememberKeys`) is enabled (default), API keys are stored in `localStorage['app_ui_prefs'].savedKeys`.
   - When disabled, keys reside strictly in `sessionStorage` and are wiped from persistent storage immediately.
3. **UI Notice**: Add a shared-device warning in `KeyListSection.tsx`: *"Lưu ý: Không nên bật tùy chọn ghi nhớ khi sử dụng trên máy tính công cộng hoặc thiết bị dùng chung."*
4. **Audit Parity**: Ensure `src/utils/storageAudit.ts` (`verifyStorageIntegrity`) continues enforcing this exact contract without flagging false violations.

### Alternatives Considered
- *Default to `rememberKeys = false` (Option A)*: Strictly more secure, but introduces significant friction for primary users who expect their configuration to persist across browser restarts.

---

## 4. Origin & Canonical URL Decoupling

### Context & Problem
`index.html` hardcodes `https://api-dich-truyen.onrender.com/` for `og:url`, `og:image`, `WebApplication.@id`, and `WebSite.url`. `public/robots.txt` also hardcodes the Render sitemap. Deployments to Vercel, Cloudflare Pages, Netlify, or custom domains leak the Render URL into social cards and SEO tags.

### Decision
1. **Environment Variable Separation**:
   - `VITE_BASE_URL`: Defines the subpath routing (e.g. `/` or `/app/`).
   - `VITE_PUBLIC_URL`: Defines the public site origin (e.g. `https://my-domain.com`).
2. **HTML Interpolation**: Use Vite's built-in `%VITE_PUBLIC_URL%` interpolation in `index.html` with a sensible fallback to `https://api-dich-truyen.onrender.com` if unset during build, or dynamic canonical generation via `useSeoMetadata.ts`.
3. **Relative Sitemap in Robots.txt**: Configure `robots.txt` to use a relative or environment-interpolated sitemap directive, or provide a template replacement during build.

---

## 5. Documentation & Route Feature Parity

### Context & Problem
`public/llms.txt` advertises "Xuất TXT, DOCX, EPUB" and routes `/workspace`, `/memory`, `/export`, `/settings`. The app only exports TXT and EPUB, and the client routes in `src/config/tabMetadata.ts` are `/translate`, `/auto-translate`, `/glossary`, `/history`, `/projects`, and `/hako-checker`. Export and Settings are modal dialogs.

### Decision
1. Update `public/llms.txt` to remove DOCX and list exact tabs and actions.
2. Cross-check with `README.md` to ensure feature lists match 1:1.

---

## 6. Real EPUB Exporter Test Suite & Concurrency Optimization

### Context & Problem
1. `src/hooks/__tests__/useEpubExport.test.ts` only tests string escaping in `escapeHtml`. It imports unused utilities (`vi`, `beforeEach`) and never tests EPUB zip generation.
2. `useEpubExport.ts` loads chapters sequentially with `for ... await getChapterFromDB(...)`, causing latency on large books.

### Decision
1. **Real Package Verification**:
   - Write integration tests in `useEpubExport.test.ts` that call `handleExportEpub(mockProject)`.
   - Intercept the generated blob via mocked `triggerDownload`.
   - Use `JSZip.loadAsync(blob)` to inspect the archive.
   - Assert presence of `mimetype` (stored without compression), `META-INF/container.xml`, `OEBPS/content.opf`, `OEBPS/nav.xhtml`, `OEBPS/toc.ncx`, `OEBPS/style.css`, and chapter files `OEBPS/chap_*.xhtml`.
   - Parse XML documents to ensure well-formedness.
2. **Bounded Concurrency Chapter Loading**:
   - Implement bounded batch chapter loading in `useEpubExport.ts` (concurrency limit = 8) using `p-limit` pattern or chunked `Promise.all`.
   - This speeds up export by 5–10x on multi-chapter projects while avoiding IndexedDB queue contention.

---

## 7. Multi-Platform CSP Parity Enforcement

### Context & Problem
Content-Security-Policy headers are defined in:
- `render.yaml`
- `vercel.json`
- `public/_headers`
- `vite.config.ts` (preview headers)
Manual synchronization leads to drift.

### Decision
1. **Automated Parity Test**: Create `src/tests/cspParity.test.ts`.
2. The test reads all 4 config files, extracts the CSP string, parses directives into a normalized map, and asserts that directive values (`script-src`, `style-src`, `connect-src`, etc.) match 100%.

---

## 8. Compiler Discipline, Node 20 LTS, and Spec Hygiene

### Context & Problem
- `tsconfig.json` lacks `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`.
- `README.md` specifies Node 18+ while CI and Docker use Node 20.
- `specs/147/tasks.md` has UTF-8 mojibake (`â€”`, `ðŸŽ¯`).
- Spec history lacks clear status categorization.

### Decision
1. **TypeScript Flags**: Enable `noUnusedLocals: true`, `noUnusedParameters: true`, `noFallthroughCasesInSwitch: true` in `tsconfig.json`. Clean any discovered unused imports.
2. **Node 20 LTS**: Update `README.md` to designate Node.js 20 LTS.
3. **UTF-8 Encoding Fix**: Clean mojibake characters in `specs/147/tasks.md`.
4. **Historical Spec Indexing**: Create `specs/README.md` documenting spec lifecycle phases (Active, Implemented, Superseded/Legacy Backend).
