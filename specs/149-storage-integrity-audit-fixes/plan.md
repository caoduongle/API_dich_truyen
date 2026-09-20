# Implementation Plan: Storage Integrity, Security Parity & Hygiene Remediation

**Branch**: `149-storage-integrity-audit-fixes` | **Date**: 2026-09-20 | **Spec**: [`spec.md`](./spec.md)

**Input**: Feature specification from `specs/149-storage-integrity-audit-fixes/spec.md`

## Summary

This plan executes the remediation of 14 audit findings across storage concurrency, database integrity, credential policies, SEO/metadata origin decoupling, documentation parity, EPUB export testing, CSP parity, compiler guards, and repository hygiene:
1. **P1 Storage Queue Consolidation**: Refactor `enqueueProjectSave` and `enqueueProjectDelete` in `projectStorageQueue.ts` to execute lazily in strict sequence, establishing `projectWriteChains` in `db.ts` as the single source of truth for queueing and removing dead imports.
2. **P1 Atomic In-Transaction Validation**: Eliminate TOCTOU gaps in `executeSaveProjectToDB` and `executeAtomicSaveProjectBundle` by moving chapter ownership validation inside the single locked `readwrite` IndexedDB transaction.
3. **P1 Credential Storage Alignment**: Preserve `rememberKeys = true` (default) for seamless UX, align `README.md`, `SECURITY.md`, and `docs/architecture.md` with reality, and add a clear shared-device warning in the API Settings UI.
4. **P1 Domain & Canonical Decoupling**: Decouple `index.html` and `public/robots.txt` from hardcoded Render URLs using `VITE_PUBLIC_URL`.
5. **P1 Documentation & Route Parity**: Remove nonexistent DOCX claims in `public/llms.txt` and synchronize route definitions with `VALID_TABS`.
6. **P1/P2 EPUB Real Exporter Tests & Batch Fetching**: Write comprehensive integration tests for `handleExportEpub` verifying the generated ZIP archive structure; implement bounded batch chapter loading in `useEpubExport.ts`.
7. **P2 Multi-Platform CSP Parity**: Add an automated test asserting 100% CSP directive equality across Render, Vercel, Netlify headers, and Vite preview.
8. **P2/P3 Compiler Guards & Spec Hygiene**: Enable `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch` in `tsconfig.json`; standardize on Node 20 LTS; fix mojibake in `specs/147/tasks.md`; index historical specs in `specs/README.md`.

## Technical Context

**Language/Version**: TypeScript 5.8 / Node.js 20 LTS  
**Primary Dependencies**: React 19, Vite, Tailwind CSS v4, Lucide React, Motion, JSZip, `@google/genai`  
**Storage**: Client-side IndexedDB (`novel_translator_db` with `projects`, `chapters`, `crdt_states`), `sessionStorage`, `localStorage`  
**Testing**: Vitest (`npm test`), TypeScript compiler (`npm run lint`), Vite build (`npm run build`)  
**Target Platform**: Evergreen desktop & mobile browsers (Chrome, Firefox, Safari, Edge)  
**Project Type**: Pure Client-side SPA  
**Performance Goals**: <5ms queue overhead; 0% project resurrection; bounded batch chapter reads (concurrency 8); 100% CSP parity  
**Constraints**: Pure Client-side SPA (no backend server); strict adherence to project design system and Constitution; zero schema alterations; no plain API keys in `localStorage` when `rememberKeys === false`  
**Scale/Scope**: Local projects up to thousands of chapters  

## Constitution Check

*GATE: Must pass before implementation. Re-evaluated post-design.*

| Principle | Status | Evaluation |
| :--- | :---: | :--- |
| **I. Strict Quality Gates & Verification** | **PASS** | `npm run lint`, `npm test`, `npm run build` will be executed and must pass with 100% success. No tests will be skipped. |
| **II. Dependency Minimization** | **PASS** | No new dependencies. Uses existing JSZip, native Web APIs, and Node test tools. |
| **III. Strict Concern Separation (MVC)** | **PASS** | Database logic remains strictly within `src/services/db.ts`. Queue boundary resides in `src/services/projectStorageQueue.ts`. Presentation components remain decoupled. |
| **IV. Immutable Core Schemas & Storage Stability** | **PASS** | No IndexedDB schema modifications. Core entity interfaces in `src/types.ts` remain unchanged. Existing Vietnamese labels are preserved. |
| **V. Atomic Commits & Documentation Sync** | **PASS** | All technical specs (`spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, `plan.md`) are created and kept in strict 1:1 sync with the codebase. |

## Project Structure

### Documentation (this feature)

```text
specs/149-storage-integrity-audit-fixes/
├── spec.md              # Feature specification
├── plan.md              # This file (Implementation architectural plan)
├── research.md          # Phase 0 architectural decisions
├── data-model.md        # Phase 1 storage lifecycle & schemas
├── quickstart.md        # Phase 1 verification & test guide
├── contracts/           # Phase 1 interface contracts
│   ├── storage-queue.contract.ts
│   ├── epub-export.contract.ts
│   └── csp-parity.contract.ts
├── checklists/
│   └── requirements.md  # Quality verification checklist
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
├── components/
│   └── api-settings/
│       └── KeyListSection.tsx       # Shared device warning label
├── hooks/
│   ├── useAIConfig.ts               # Key persistence & scrub logic
│   ├── useEpubExport.ts             # Bounded concurrency chapter loading
│   └── __tests__/
│       └── useEpubExport.test.ts    # Real EPUB ZIP package integration tests
├── services/
│   ├── db.ts                        # In-transaction validation & single queue authority
│   ├── projectStorageQueue.ts       # Lazy serialization & clean forwarding
│   └── __tests__/
│       ├── projectStorageQueue.test.ts
│       └── projectDeleteQueue.test.ts
├── tests/
│   └── cspParity.test.ts            # Automated CSP parity verification
public/
├── llms.txt                         # Accurate client routes & export format claims
└── robots.txt                       # Decoupled sitemap URL
index.html                           # VITE_PUBLIC_URL interpolation for SEO & OG
README.md                            # Node 20 LTS & API key storage disclosure
SECURITY.md                          # API key storage policy reconciliation
docs/architecture.md                 # Updated storage architecture documentation
tsconfig.json                        # Strict compiler flags (noUnusedLocals, etc.)
specs/147-crdt-atomic-manifest-hardening/tasks.md # UTF-8 encoding fix
specs/README.md                      # Historical specs lifecycle index
```

## Proposed Changes by Component

### 1. Storage Concurrency & DB Integrity (`src/services/`)
- **`projectStorageQueue.ts`**:
  - Replace eager promise instantiation with lazy chained execution or direct forwarder to `saveProjectToDB` / `deleteProjectFromDB`.
  - Remove unused import `enqueueProjectWrite`.
  - Ensure `waitForQueueIdle` awaits `waitForProjectWrites`.
- **`db.ts`**:
  - In `executeSaveProjectToDB`: Move `normalizedChaptersMeta` foreign key validation into the single `readwrite` transaction.
  - In `executeAtomicSaveProjectBundle`: Move chapter foreign key check into the single `readwrite` multi-store transaction.
  - Abort transaction on invariant failure to eliminate TOCTOU race windows.

### 2. Credential Security & UI Disclosure (`src/`, `README.md`, `SECURITY.md`, `docs/`)
- **`KeyListSection.tsx`**: Add shared workstation caution text below `rememberKeys` toggle.
- **`README.md`, `SECURITY.md`, `docs/architecture.md`**: Clarify that `rememberKeys === true` persists keys in `localStorage['app_ui_prefs'].savedKeys`, while `rememberKeys === false` keeps them strictly ephemeral in `sessionStorage`.

### 3. SEO, Canonical Origin & Documentation Parity (`index.html`, `public/`, `README.md`)
- **`index.html`**: Replace hardcoded `https://api-dich-truyen.onrender.com/` with `%VITE_PUBLIC_URL%` or dynamic origin interpolation with fallback.
- **`public/robots.txt`**: Decouple sitemap URL from Render domain.
- **`public/llms.txt`**: Remove DOCX mention, correct route list to match `VALID_TABS`, describe Export and Settings as modals/actions.

### 4. EPUB Export Hardening (`src/hooks/`)
- **`useEpubExport.ts`**: Replace sequential `for ... await getChapterFromDB` loop with bounded batch chapter loading (concurrency = 8).
- **`useEpubExport.test.ts`**: Remove unused `vi` and `beforeEach` imports; add integration tests verifying the generated `.epub` ZIP archive structure (`mimetype`, `container.xml`, `content.opf`, `nav.xhtml`, `toc.ncx`, `style.css`, chapter XHTMLs).

### 5. Multi-Platform CSP Parity (`src/tests/cspParity.test.ts`)
- Add automated test parsing and validating CSP across `render.yaml`, `vercel.json`, `public/_headers`, and `vite.config.ts`.

### 6. Compiler Guards & Spec Hygiene (`tsconfig.json`, `specs/`)
- **`tsconfig.json`**: Enable `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`. Clean up any compiler errors.
- **`specs/147-crdt-atomic-manifest-hardening/tasks.md`**: Repair UTF-8 mojibake (`â€”`, `ðŸŽ¯`).
- **`specs/README.md`**: Create index classifying historical specs (001–092) as `Superseded (Legacy Backend)`.

## Complexity Tracking

No constitution violations or unjustified architectural complexities.
Single queue authority and in-transaction validation actually reduce existing concurrency complexity.
