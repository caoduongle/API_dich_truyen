# Feature Specification: Storage Integrity, Security Parity & Hygiene Remediation

**Feature Branch**: `149-storage-integrity-audit-fixes`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User audit report on commit `0170d63` highlighting 14 improvement points:
1. `projectStorageQueue.ts` Promise created before queue sequencing (P1)
2. `db.ts` TOCTOU gaps between check and transaction (P1)
3. API key `rememberKeys` default policy contradiction with security docs (P1)
4. Hard-coded Render domain in `index.html` & `public/robots.txt` (P1)
5. README vs `public/llms.txt` DOCX and route mismatch (P1)
6. Real EPUB export validation test suite (P1)
7. EPUB batch chapter retrieval optimization (P2)
8. Storage queue consolidation & single queue authority (P2)
9. `tsconfig.json` strict compiler guards (P2)
10. Standardize Node.js 20 LTS across docs and CI (P2)
11. Multi-platform CSP parity verification (P2)
12. Historical specs archival / status metadata tagging (P2)
13. UTF-8 mojibake encoding fix in `specs/147/tasks.md` (P3)
14. End-to-end browser-level smoke test strategy (P3/P2)

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Storage Write Queue Consolidation & Strict FIFO Sequencing (Priority: P1)

As an active reader and editor working with multiple novel chapters,
I want all project save and delete operations to be sequenced through a single, strictly ordered FIFO queue per project,
So that asynchronous writes never race, execute out of order, or resurrect deleted projects.

**Why this priority**:
In `projectStorageQueue.ts`, `saveProjectToDB(project)` and `deleteProjectFromDB(id)` were being invoked immediately upon entering `enqueueProjectSave` and `enqueueProjectDelete` rather than inside the queued promise callback. This caused operations to start before prior queued writes finished. Furthermore, having a global `writeChain` on top of `db.ts`'s per-project queue creates architectural duplication and makes serialization proofs difficult.

**Independent Test**:
Enqueue multiple concurrent project saves and deletions with artificial latency. Verify that:
1. Operations execute strictly in FIFO sequence per `projectId`.
2. A save operation queued after a delete operation never completes before the delete.
3. Unused imports (`enqueueProjectWrite`) in `projectStorageQueue.ts` are removed.
4. `waitForQueueIdle(projectId)` resolves only after all queued writes for the given project have settled.

**Acceptance Scenarios**:
1. **Given** two concurrent calls to `enqueueProjectSave(proj)` with revision 1 and revision 2, **When** both are dispatched, **Then** revision 1 always completes before revision 2 begins execution.
2. **Given** a call to `enqueueProjectDelete(id)` followed immediately by `enqueueProjectSave(proj)` for the same ID, **When** executed, **Then** the delete executes first and finishes before the save begins, preventing any out-of-order race.
3. **Given** multiple projects being saved concurrently, **Then** operations across different project IDs do not block each other, while operations on the same project ID are strictly serialized.

---

### User Story 2 - Atomic In-Transaction Validation & TOCTOU Elimination (Priority: P1)

As a system auditor and maintainer,
I want all database relational invariant checks (such as foreign key ownership and cross-project chapter re-parenting checks) to execute inside the exact same database transaction as the mutations,
So that there is zero time-of-check to time-of-use (TOCTOU) gap where records can be modified by concurrent operations between validation and write.

**Why this priority**:
Currently, `executeSaveProjectToDB` and `executeAtomicSaveProjectBundle` perform pre-validation (checking whether chapters in the project metadata belong to another project) using separate `readonly` transactions, close them, and only then open a `readwrite` transaction. In a concurrent or multi-tab environment, this leaves an integrity window.

**Independent Test**:
Perform concurrent operations where a chapter is re-parented or deleted during an ongoing bundle save. Verify that all validations are executed inside the active `readwrite` transaction and abort atomically on invariant violations without leaving partial writes.

**Acceptance Scenarios**:
1. **Given** a project save with chapter references, **When** validated against the database, **Then** the check for existing chapter ownership and the actual project/chapter write occur within a single `readwrite` IndexedDB transaction.
2. **Given** `executeAtomicSaveProjectBundle` receives a bundle containing chapters and CRDT states, **When** verifying that chapters are not re-parented from another project, **Then** the verification reads from `CHAPTERS_STORE` within the single locked `readwrite` transaction encompassing `PROJECTS_STORE`, `CHAPTERS_STORE`, and `CRDT_STATES_STORE`.
3. **Given** any validation check fails within the transaction, **Then** the transaction aborts automatically, leaving the database state completely unchanged.

---

### User Story 3 - Gemini API Key Storage Policy Reconciliation (Priority: P1)

As a privacy-conscious user or user on a shared workstation,
I want clear, truthful, and consistent behavior regarding how my Gemini API keys are persisted,
So that the application UI, security documentation, and storage audit rules speak with one unified voice.

**Clarification Resolution (Option B - UX-First with Transparency)**:
Default `rememberKeys = true` is retained for seamless single-user UX, while updating all documentation (`README.md`, `SECURITY.md`, `docs/architecture.md`) to explicitly document persistent storage in `localStorage['app_ui_prefs'].savedKeys`, and displaying a warning in the UI: *"Không nên bật trên thiết bị dùng chung"*.

**Why this priority**:
`README.md`, `docs/architecture.md`, and `SECURITY.md` currently describe API keys as ephemeral (session-only, not stored in plaintext in persistent storage). However, `useAIConfig.ts` defaults `rememberKeys` to `true` (saving keys to `localStorage['app_ui_prefs'].savedKeys`). This contradiction creates security compliance confusion and misleads users about data retention on shared devices.

**Independent Test**:
Inspect `localStorage` and `sessionStorage` under both enabled and disabled `rememberKeys` settings. Verify that:
1. The documented policy matches code behavior exactly.
2. If `rememberKeys` is active, the UI displays a clear warning for shared computer usage.
3. If `rememberKeys` is toggled off, `savedKeys` is immediately scrubbed from persistent storage.
4. `storageAudit.ts` (`verifyStorageIntegrity`) evaluates compliance against the single reconciled policy.

**Acceptance Scenarios**:
1. **Given** the application is loaded for the first time, **When** examining API key persistence, **Then** the policy adheres to the agreed configuration (Option A: default `false` for security-first; or Option B: default `true` with explicit persistent storage disclosure and UI warning).
2. **Given** `README.md`, `SECURITY.md`, `docs/architecture.md`, and `src/utils/storageAudit.ts`, **When** reviewed, **Then** all four documents state identical rules regarding where keys are stored and under what conditions.
3. **Given** the API Settings modal, **When** `rememberKeys` is visible, **Then** a warning label alerts the user: "Không nên bật trên máy tính công cộng hoặc thiết bị dùng chung".

---

### User Story 4 - Public URL & Canonical Origin Decoupling (Priority: P1)

As a user deploying the application to Vercel, Netlify, Cloudflare Pages, Docker, or a custom domain,
I want OpenGraph, canonical URLs, JSON-LD schema, and robots/sitemap references to dynamically resolve to the actual deployment origin,
So that search engines, social media previews, and link crawlers do not incorrectly point back to Render.

**Why this priority**:
`index.html` and `public/robots.txt` currently hardcode `https://api-dich-truyen.onrender.com/` for `og:url`, `og:image`, `WebApplication.@id`, `WebSite.url`, and `Sitemap`. Deploying on any platform other than Render generates invalid canonical metadata.

**Independent Test**:
Configure `VITE_PUBLIC_URL=https://custom-domain.example` during build. Verify that generated HTML metadata, JSON-LD, and robots/sitemap entries reflect the configured domain, while preserving `VITE_BASE_URL` for relative path routing.

**Acceptance Scenarios**:
1. **Given** a deployment with `VITE_PUBLIC_URL` set, **When** `index.html` is rendered, **Then** `og:url`, `canonical`, and JSON-LD schema IDs use `VITE_PUBLIC_URL`.
2. **Given** `VITE_PUBLIC_URL` is omitted, **When** building, **Then** the build gracefully falls back to relative paths or the official default without breaking local development.
3. **Given** `public/robots.txt`, **When** served, **Then** the sitemap URL aligns with the public origin or uses a relative sitemap directive.

---

### User Story 5 - Documentation & Route Feature Parity (Priority: P1)

As an AI crawler, automated agent, or developer reading project documentation,
I want `public/llms.txt` and `README.md` to accurately reflect only existing features and valid client routes,
So that agents do not attempt to invoke non-existent export formats (like DOCX) or navigate to non-existent route paths.

**Why this priority**:
`public/llms.txt` currently advertises "Xuất TXT, DOCX, EPUB" and lists routes like `/workspace`, `/memory`, `/export`, `/settings`. In reality, the codebase only exports TXT and EPUB, and valid routes defined in `src/config/tabMetadata.ts` are `/translate`, `/auto-translate`, `/glossary`, `/history`, `/projects`, and `/hako-checker`. Export and Settings are modal dialogs, not standalone URL routes.

**Independent Test**:
Run an automated verification comparing all claims in `public/llms.txt` against `VALID_TABS` in `src/config/tabMetadata.ts` and supported export formats in `src/hooks/`.

**Acceptance Scenarios**:
1. **Given** `public/llms.txt`, **When** inspecting export features, **Then** only TXT and EPUB are listed.
2. **Given** `public/llms.txt`, **When** inspecting navigation routes, **Then** only real routes (`/translate`, `/auto-translate`, `/glossary`, `/history`, `/projects`, `/hako-checker`) are documented, and Settings / Export are clearly designated as modals/toolbars.
3. **Given** `README.md`, **When** reviewed, **Then** feature lists and architecture descriptions match `public/llms.txt` and code capabilities.

---

### User Story 6 - Real EPUB Artifact Verification & Concurrency Optimization (Priority: P1 / P2)

As an author exporting an edited novel to EPUB format,
I want the EPUB exporter to be backed by comprehensive automated tests that validate actual generated zip archives,
And I want chapter loading during export to utilize bounded concurrency so that large novels export smoothly without sequential stalls.

**Why this priority**:
Currently, `useEpubExport.test.ts` only verifies string escaping in `escapeHtml` and imports unused test utilities (`vi`, `beforeEach`). It never executes `handleExportEpub` or validates the generated `.epub` ZIP archive structure (`mimetype`, `container.xml`, `content.opf`, `nav.xhtml`, `toc.ncx`, `style.css`). Furthermore, `useEpubExport.ts` fetches chapters sequentially one-by-one from IndexedDB (`for ... await getChapterFromDB(...)`), causing performance bottlenecks on projects with hundreds of chapters.

**Independent Test**:
1. Mock IndexedDB and trigger `handleExportEpub(project)`. Parse the generated JSZip instance and verify that:
   - `mimetype` is uncompressed at the archive root with content `application/epub+zip`.
   - `META-INF/container.xml` points to `OEBPS/content.opf`.
   - `OEBPS/content.opf` contains valid package metadata, manifest, and spine.
   - `OEBPS/nav.xhtml` and `OEBPS/toc.ncx` match chapter entries.
   - Chapter XHTML files contain well-formed escaped content.
2. Benchmark chapter retrieval with 100 mock chapters: verify that bounded concurrent fetching (e.g. concurrency of 5-10) completes significantly faster than sequential iteration without exhausting IndexedDB connections.

**Acceptance Scenarios**:
1. **Given** a project with multiple chapters, **When** `handleExportEpub` completes, **Then** the downloaded archive is a structurally valid EPUB 3 document that passes standard XML/container verification.
2. **Given** a novel project with many chapters, **When** export is initiated, **Then** chapters are loaded in parallel batches (bounded concurrency) rather than strictly one-by-one.
3. **Given** `src/hooks/__tests__/useEpubExport.test.ts`, **When** executed with `npm test`, **Then** all tests pass and no unused imports remain.

---

### User Story 7 - Multi-Platform Content Security Policy Parity (Priority: P2)

As a security engineer and DevOps maintainer,
I want the Content Security Policy (CSP) to be verified for strict parity across all deployment targets (Render, Vercel, Netlify `_headers`, and Vite preview),
So that security directives do not silently drift between platforms when new APIs or CDNs are integrated.

**Why this priority**:
The exact CSP string is manually copy-pasted across `render.yaml`, `vercel.json`, `public/_headers`, and `vite.config.ts`. Any future update to Google APIs, font sources, or connect domains risks being applied to one platform while leaving others broken or insecure.

**Independent Test**:
Add an automated parity test that parses the CSP headers from `render.yaml`, `vercel.json`, `public/_headers`, and `vite.config.ts`, asserting that directives (`script-src`, `style-src`, `connect-src`, `frame-src`, `img-src`, `font-src`, `object-src`, `base-uri`, `frame-ancestors`) are 100% identical.

**Acceptance Scenarios**:
1. **Given** the configuration files `render.yaml`, `vercel.json`, `public/_headers`, and `vite.config.ts`, **When** the parity test runs, **Then** all security directives match character-for-character or normalized token-for-token.
2. **Given** a future modification adds a domain to one config without updating the others, **When** running `npm test`, **Then** the parity test immediately fails with a descriptive diff.

---

### User Story 8 - Compiler Discipline, Runtime Environment, and Repository Hygiene (Priority: P2 / P3)

As a contributor maintaining high code quality across the codebase,
I want compiler safety guards enabled, runtime documentation standardized to Node 20 LTS, and historical specification artifacts cleaned up,
So that dead code, unused parameters, encoding corruption, and obsolete architecture docs do not degrade developer or AI agent productivity.

**Clarification Resolution (Option A - Non-Destructive Metadata Tagging)**:
Historical specification files are preserved in their existing paths to avoid breaking references and Git history. An architectural index in `specs/README.md` and clear status headers (`Status: Superseded (Legacy Backend)`) categorize historical specs (001–092) so AI agents immediately recognize obsolete server-side patterns without file movement.

**Why this priority**:
- `tsconfig.json` lacks common guards like `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`, which allowed unused imports (`enqueueProjectWrite`, `vi`, `beforeEach`) to slip in unnoticed.
- `README.md` states "Node.js 18+" while CI (`ci.yml`) and `Dockerfile` strictly use Node 20 LTS.
- `specs/147-crdt-atomic-manifest-hardening/tasks.md` contains mojibake encoding errors (`â€”`, `ðŸŽ¯`).
- Over 140 historical specs in `specs/` include obsolete backend architectures (Express, Redis, WebSocket) that can cause AI agents to hallucinate legacy patterns.

**Independent Test**:
1. Verify `tsconfig.json` compiles cleanly with the new guard flags.
2. Verify `README.md` specifies Node 20 LTS.
3. Verify `specs/147/tasks.md` contains valid UTF-8 symbols without garbled characters.
4. Verify historical specs contain unambiguous status metadata.

**Acceptance Scenarios**:
1. **Given** `tsconfig.json`, **When** `npm run lint` is run, **Then** unused variables and parameter warnings are caught by the compiler.
2. **Given** `README.md`, **When** reading system requirements, **Then** Node 20 LTS is designated as the supported runtime version.
3. **Given** `specs/147-crdt-atomic-manifest-hardening/tasks.md`, **When** inspected, **Then** all mojibake symbols are restored to standard markdown dashes (`—`) and emojis (`🎯`).
4. **Given** legacy specification files, **When** inspected by developers or AI agents, **Then** their header status metadata clearly distinguishes active vs superseded/archived specs.

---

## Edge Cases

1. **Storage queue rejection during project deletion**: If a prior write fails while queued ahead of a project deletion, the deletion must still proceed cleanly rather than remaining stuck behind a rejected promise chain.
2. **Empty or missing `VITE_PUBLIC_URL`**: When building in local development or preview environments without a public domain set, metadata tags must fall back gracefully to window origin or relative paths without creating malformed URLs.
3. **EPUB export for zero-chapter projects**: The exporter must detect empty projects immediately and display a descriptive warning toast without attempting to build a broken empty zip.
4. **Offline / restricted network during EPUB generation**: Bounded concurrent chapter loading from IndexedDB must handle any individual corrupted chapter record gracefully, either skipping or aborting with a clean user notification.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `enqueueProjectSave` and `enqueueProjectDelete` in `src/services/projectStorageQueue.ts` MUST sequence the execution of `saveProjectToDB` and `deleteProjectFromDB` lazily inside the queue chain rather than initiating the promise before queueing.
- **FR-002**: Unused imports in `projectStorageQueue.ts` (such as `enqueueProjectWrite`) MUST be removed, and queue serialization MUST rely on a unified queue authority to eliminate dual-queue redundancy.
- **FR-003**: `executeSaveProjectToDB` in `src/services/db.ts` MUST perform chapter ownership verification and project persistence within the SAME single `readwrite` IndexedDB transaction.
- **FR-004**: `executeAtomicSaveProjectBundle` in `src/services/db.ts` MUST perform chapter foreign key verification and bundle persistence within the SAME single `readwrite` IndexedDB transaction.
- **FR-005**: API key persistence policy MUST be reconciled across `src/hooks/useAIConfig.ts`, `src/components/api-settings/KeyListSection.tsx`, `README.md`, `SECURITY.md`, and `docs/architecture.md`. If keys are persisted in `localStorage`, an explicit shared-workstation warning MUST be shown in the UI.
- **FR-006**: `index.html` MUST decouple canonical URL, OpenGraph URL, OpenGraph image URL, and JSON-LD structured data from hardcoded Render URLs, utilizing `VITE_PUBLIC_URL` with appropriate fallback.
- **FR-007**: `public/robots.txt` MUST not hardcode the Render domain for its Sitemap directive.
- **FR-008**: `public/llms.txt` MUST remove references to DOCX export and MUST update route definitions to match actual client tabs (`/translate`, `/auto-translate`, `/glossary`, `/history`, `/projects`, `/hako-checker`), noting Export and Settings as toolbar/modal actions.
- **FR-009**: `src/hooks/__tests__/useEpubExport.test.ts` MUST execute `handleExportEpub` against mock projects and validate the resulting ZIP package structure, entry names, and XML schemas.
- **FR-010**: `useEpubExport.ts` MUST use bounded concurrency (batching) when loading chapters from IndexedDB instead of sequential `for ... await` loops.
- **FR-011**: A CSP parity test MUST be added to verify that `render.yaml`, `vercel.json`, `public/_headers`, and `vite.config.ts` maintain identical Content-Security-Policy directives.
- **FR-012**: `tsconfig.json` MUST be enhanced with compiler safety guards (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`) without breaking existing functional code.
- **FR-013**: `README.md` MUST designate Node.js 20 LTS as the supported runtime, aligning with CI and Dockerfile configurations.
- **FR-014**: Corrupted UTF-8 mojibake characters in `specs/147-crdt-atomic-manifest-hardening/tasks.md` MUST be corrected.

### Key Entities

- **Storage Queue**: Per-project serialization pipeline guaranteeing strict FIFO persistence order and preventing project resurrection.
- **Atomic Storage Transaction**: Single IndexedDB `readwrite` transaction locking `projects`, `chapters`, and `crdt_states` stores for atomic validation and commit.
- **API Key Persistence Policy**: Explicit contract defining whether Gemini API keys are persisted across browser sessions or restricted to ephemeral session storage.
- **Public Domain Configuration**: Environment-driven URL configuration separating origin (`VITE_PUBLIC_URL`) from subpath routing (`VITE_BASE_URL`).
- **EPUB Document Package**: Conforming EPUB 3 zip archive containing `mimetype`, `container.xml`, `content.opf`, `nav.xhtml`, `toc.ncx`, and formatted chapter XHTML files.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of concurrent project save and delete operations execute in strictly serial FIFO order per project, with 0 project resurrections.
- **SC-002**: 100% of relational invariant checks during project and bundle saves execute within the active `readwrite` transaction, eliminating TOCTOU race windows.
- **SC-003**: 100% documentation consistency regarding API key persistence across `README.md`, `SECURITY.md`, `docs/architecture.md`, and code.
- **SC-004**: Zero hardcoded `https://api-dich-truyen.onrender.com` URLs in `index.html` and `public/robots.txt`.
- **SC-005**: 100% route and export feature parity between `public/llms.txt`, `src/config/tabMetadata.ts`, and actual codebase capabilities.
- **SC-006**: Automated test suite validates full EPUB ZIP structure, MIME type compliance, and manifest/spine alignment across 100% of test cases.
- **SC-007**: 100% character/directive consistency verified by automated CSP parity test across Render, Vercel, Netlify headers, and Vite preview.
- **SC-008**: Zero mojibake characters remain in `specs/147/tasks.md`, and `npm run lint`, `npm test`, and `npm run build` pass cleanly.

---

## Assumptions

- We assume that `saveProjectToDB` and `deleteProjectFromDB`'s internal `projectWriteChains` in `src/services/db.ts` provides the foundational per-project serialization, allowing `projectStorageQueue.ts` to act as a clean forwarder or consolidated queue boundary.
- We assume that browser-level smoke tests can be outlined as a foundational test specification and implemented using Vitest/Playwright or browser testing harnesses in subsequent phases.
- We assume that updating `tsconfig.json` compiler guards will be executed carefully to resolve any existing unused variables without altering runtime behavior.
