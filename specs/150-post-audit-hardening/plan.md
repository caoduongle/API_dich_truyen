# Implementation Plan: Post-Audit Integrity & Quality Hardening

**Branch**: `150-post-audit-hardening` | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/150-post-audit-hardening/spec.md` addressing follow-up audit items on commit `8351259`.

---

## Summary

This feature resolves the remaining integrity, portability, and validation gaps identified during the comprehensive audit of commit `8351259`:
1. **Public Origin & Sitemap Decoupling (P1)**: Update `vite.config.ts` to call `loadEnv(mode, process.cwd(), '')`, document `VITE_PUBLIC_URL` in `.env.example`, and decouple `public/sitemap.xml` so build outputs dynamically inject the configured origin.
2. **EPUB XML Parser & Archive Integrity (P2)**: Replace simple substring tests with actual XML parsing (via DOMParser / structural validator asserting 0 `parsererror` nodes), test that `mimetype` is entry index 0 and stored uncompressed (`STORE`), and defer `URL.revokeObjectURL(url)` in `useEpubExport.ts` to protect asynchronous browser file downloads.
3. **Test Consolidation & DB Write Queue Invariant (P2)**: Remove the duplicate test `src/config/__tests__/cspParity.test.ts` in favor of canonical `src/tests/cspParity.test.ts`, add an explicit FIFO sequence integration test (`save A1 -> save A2 -> delete A -> save A3`) in `src/services/__tests__/db.test.ts`, and extract in-memory `validateBundleInput` helper in `src/services/db.ts`.
4. **UX Copy Realignment & Bookkeeping (P3)**: Update `KeyListSection.tsx` copy to accurately reflect rate limits as belonging to Project / Quota Groups with keys providing failover health pools, remove outdated IndexedDB encryption claims from `docs/architecture.md`, reconcile task `T032` in `specs/147/tasks.md`, and update `specs/149/` status to `Completed`.

---

## Technical Context

**Language/Version**: TypeScript ~5.8.2, Node.js 20 LTS.  
**Primary Dependencies**: React 19, Vite 6.2, Tailwind v4, JSZip 3.10, Vitest 4.1.  
**Storage**: Client-side IndexedDB (primary database via `src/services/db.ts`), `sessionStorage` (ephemeral API keys), `localStorage` (UI preferences & persistent keys when enabled).  
**Testing**: Vitest (`npm test`), TypeScript compiler checks (`npm run lint`), Vite build bundle verification (`npm run build`).  
**Target Platform**: Pure Client-Side SPA running in modern evergreen browsers (Chrome, Edge, Firefox, Safari).  
**Project Type**: Web Application (Client-Side SPA / Zero Backend).  
**Performance Goals**: Sub-second EPUB batch packaging, sub-millisecond in-memory bundle validation, zero CPU blocking during idle state.  
**Constraints**: Zero new NPM dependencies, strict adherence to MVC client boundaries, immutable storage schemas, 100% test pass rate.  
**Scale/Scope**: 5 modified source/config files (`vite.config.ts`, `.env.example`, `public/sitemap.xml`, `useEpubExport.ts`, `KeyListSection.tsx`, `db.ts`, `docs/architecture.md`), 1 deleted duplicate test, 2 enhanced test files (`useEpubExport.test.ts`, `db.test.ts`).

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Strict Quality Gates & Verification**:
  - `npm run lint` (`tsc --noEmit`): Must pass cleanly with 0 type errors.
  - `npm test` (`vitest run`): Must pass 100% of all suites. No skipped or deleted assertions.
  - `npm run build` (`tsc && vite build`): Must build production bundle cleanly without errors.
  - *Status*: **PASSED**.
- **Principle II: Dependency Minimization & Existing Library Reuse**:
  - No new NPM packages added. XML validation implemented using standard `DOMParser` and native parser helpers; environment loading uses built-in Vite `loadEnv`.
  - *Status*: **PASSED**.
- **Principle III: Strict Concern Separation & MVC Domain Boundary Preservation**:
  - Presentation components (`KeyListSection.tsx`) only adjust user-facing copy without importing services directly.
  - State hooks (`useEpubExport.ts`) manage download lifecycle without violating service boundaries.
  - Storage engine (`db.ts`) cleanly separates in-memory validation (`validateBundleInput`) from transaction-bound stored checks (`assertChapterOwnership`).
  - *Status*: **PASSED**.
- **Principle IV: Immutable Core Schemas & Storage Stability**:
  - No changes to `src/types.ts` core interfaces or IndexedDB store names/schema versions.
  - *Status*: **PASSED**.
- **Principle V: Atomic Commits & Documentation Synchronization**:
  - All documentation (`README.md`, `docs/architecture.md`, `specs/`) synchronized 1:1 with code behavior.
  - *Status*: **PASSED**.

---

## Project Structure

### Documentation (this feature)

```text
specs/150-post-audit-hardening/
├── spec.md                          # Feature specification
├── plan.md                          # Implementation plan (this file)
├── research.md                      # Technical research and design decisions
├── data-model.md                    # Data schemas, state invariants, and entity definitions
├── quickstart.md                    # Runnable verification guide
├── checklists/
│   └── requirements.md              # Quality checklist
├── contracts/
│   ├── origin-config.contract.ts    # Contract for public origin resolution
│   ├── epub-validation.contract.ts  # Contract for EPUB XML & archive verification
│   └── bundle-validation.contract.ts# Contract for bundle input validation helper
└── tasks.md                         # Task list (Phase 2 output generated by /speckit-tasks)
```

### Source Code (repository root)

```text
.env.example                                      # [MODIFY] Document VITE_PUBLIC_URL
vite.config.ts                                    # [MODIFY] Add loadEnv, sitemap build transform
public/
├── sitemap.xml                                   # [MODIFY] Use %VITE_PUBLIC_URL% origin placeholder
docs/
└── architecture.md                               # [MODIFY] Remove obsolete IndexedDB encryption claim
src/
├── components/
│   └── api-settings/
│       └── KeyListSection.tsx                    # [MODIFY] Update rate limit copy to neutral phrasing
├── hooks/
│   ├── useEpubExport.ts                          # [MODIFY] Defer URL.revokeObjectURL
│   └── __tests__/
│       └── useEpubExport.test.ts                 # [MODIFY] Add XML parser & mimetype STORE test checks
├── services/
│   ├── db.ts                                     # [MODIFY] Extract validateBundleInput helper
│   └── __tests__/
│       └── db.test.ts                            # [MODIFY] Add FIFO interleaved sequence test
├── config/
│   └── __tests__/
│       └── cspParity.test.ts                     # [DELETE] Remove duplicate test suite
└── tests/
    └── cspParity.test.ts                         # [RETAIN] Authoritative quad-parity test
specs/
├── 147-crdt-atomic-manifest-hardening/
│   └── tasks.md                                  # [MODIFY] Mark [x] T032
└── 149-storage-integrity-audit-fixes/
    ├── spec.md                                   # [MODIFY] Mark Status: Completed
    └── quickstart.md                             # [MODIFY] Mark Status: Completed
```

**Structure Decision**: Retains the single project client-side layout. Deletes the duplicate test `src/config/__tests__/cspParity.test.ts` to leave `src/tests/cspParity.test.ts` as the sole canonical authority.

---

## Complexity Tracking

*No violations of project principles or extra architectural layers introduced. Table intentionally empty.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
| :--- | :--- | :--- |
| *None* | *N/A* | *N/A* |
