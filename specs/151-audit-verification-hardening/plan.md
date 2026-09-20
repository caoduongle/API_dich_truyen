# Implementation Plan: Production Verification & Integrity Hardening

**Branch**: `151-audit-verification-hardening` | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/151-audit-verification-hardening/spec.md` addressing follow-up audit items on commit `a1254b8`.

---

## Summary

This feature hardens the production build pipeline, verification fidelity, container deployment, and EPUB export standards compliance:
1. **True XML Parser Verification (P1)**: Equip the EPUB export test suite with a genuine XML parser (via `jsdom` test environment), eliminating heuristic regex fallbacks. Tighten `mimetype` assertions (exact string without trailing newline, `STORE` compression), and preserve the novel's defined chapter sequence from `proj.chapters` rather than sorting strictly by `createdAt`.
2. **Sub-Path Aware Public URL Architecture & Containerization (P1)**: Unify public origin and base path (`origin + base`) for sitemap and canonical links. Update `index.html` static asset links (`theme-init.js`, `favicon.svg`, `site.webmanifest`, `og-image.svg`) to use `%BASE_URL%`. Support Docker build args `ARG VITE_PUBLIC_URL` and `ARG VITE_BASE_URL` in `Dockerfile`. Document them in `README.md`. Validate URL schemes (`http://` / `https://`).
3. **Production Public Origin Module & End-to-End Build Test (P2)**: Extract origin resolution and HTML/sitemap transformation into `src/config/publicOrigin.ts`, consumed by both `vite.config.ts` and `src/tests/originConfig.test.ts`. Add integration testing proving environment variables propagate to `dist/` outputs.
4. **Database Write Queue Final State Verification (P2)**: Extend the FIFO sequence test in `src/services/__tests__/db.test.ts` to assert that the database record achieves the exact final state (`A3`) with zero resurrection.
5. **Specification Bookkeeping (P3)**: Ensure all specification and checklist status notes are aligned with completed verification.

---

## Technical Context

**Language/Version**: TypeScript ~5.8.2, Node.js 20 LTS.  
**Primary Dependencies**: React 19, Vite 6.2, Tailwind v4, JSZip 3.10, Vitest 4.1, `jsdom` (test environment).  
**Storage**: Client-side IndexedDB (`src/services/db.ts`), `sessionStorage` (ephemeral credentials), `localStorage` (UI preferences).  
**Testing**: Vitest (`npm test`), TypeScript compiler checks (`npm run lint`), Vite build bundle verification (`npm run build`).  
**Target Platform**: Pure Client-Side SPA running in modern evergreen browsers (Chrome, Edge, Firefox, Safari).  
**Project Type**: Web Application (Client-Side SPA / Zero Backend).  
**Performance Goals**: Sub-second EPUB batch packaging, sub-millisecond in-memory URL transformation, zero CPU blocking.  
**Constraints**: Zero new runtime NPM dependencies, strict adherence to MVC client boundaries, immutable storage schemas, 100% test pass rate.  
**Scale/Scope**: 7 modified/new source and config files (`src/config/publicOrigin.ts`, `vite.config.ts`, `Dockerfile`, `index.html`, `README.md`, `src/hooks/useEpubExport.ts`, `src/hooks/__tests__/useEpubExport.test.ts`, `src/services/__tests__/db.test.ts`, `src/tests/originConfig.test.ts`).

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Strict Quality Gates & Verification**:
  - `npm run lint` (`tsc --noEmit`): Must pass cleanly with 0 type errors.
  - `npm test` (`vitest run`): Must pass 100% of all suites. Zero skipped or deleted assertions.
  - `npm run build` (`tsc && vite build`): Must build production bundle cleanly without errors.
  - *Status*: **PASSED**.
- **Principle II: Dependency Minimization & Existing Library Reuse**:
  - Zero new production/runtime dependencies. `jsdom` is added as a devDependency specifically for Vitest DOMParser environment support in tests, as directly recommended in audit review.
  - *Status*: **PASSED**.
- **Principle III: Strict Concern Separation & MVC Domain Boundary Preservation**:
  - Presentation components remain untouched or use `%BASE_URL%` in HTML templates.
  - State hooks (`useEpubExport.ts`) manage export sequencing without violating service boundaries.
  - Config module (`src/config/publicOrigin.ts`) is cleanly isolated from UI layers.
  - *Status*: **PASSED**.
- **Principle IV: Immutable Core Schemas & Storage Stability**:
  - No changes to `src/types.ts` core interfaces or IndexedDB store schemas.
  - *Status*: **PASSED**.
- **Principle V: Atomic Commits & Documentation Synchronization**:
  - `README.md`, `Dockerfile`, and technical specifications synchronized 1:1 with code behavior.
  - *Status*: **PASSED**.

---

## Project Structure

### Documentation (this feature)

```text
specs/151-audit-verification-hardening/
├── spec.md                          # Feature specification
├── plan.md                          # Implementation plan (this file)
├── research.md                      # Phase 0 technical research and design decisions
├── data-model.md                    # Phase 1 data schemas and state invariants
├── quickstart.md                    # Phase 1 runnable verification guide
├── checklists/
│   └── requirements.md              # Quality checklist
├── contracts/
│   ├── public-origin.contract.ts    # Contract for public origin & subpath resolution
│   └── epub-parser.contract.ts      # Contract for EPUB XML & archive verification
└── tasks.md                         # Phase 2 output generated by /speckit-tasks
```

### Source Code (repository root)

```text
Dockerfile                                        # [MODIFY] Add ARG/ENV VITE_PUBLIC_URL & VITE_BASE_URL
README.md                                         # [MODIFY] Document VITE_PUBLIC_URL & Docker build args
index.html                                        # [MODIFY] Use %BASE_URL% for static assets & %VITE_CANONICAL_URL%
vite.config.ts                                    # [MODIFY] Import and use src/config/publicOrigin.ts
package.json                                      # [MODIFY] Add jsdom to devDependencies for Vitest
src/
├── config/
│   └── publicOrigin.ts                           # [NEW] Authoritative public origin & subpath utility
├── hooks/
│   ├── useEpubExport.ts                          # [MODIFY] Preserve proj.chapters ordering
│   └── __tests__/
│       └── useEpubExport.test.ts                 # [MODIFY] Vitest jsdom environment + real XML parser
├── services/
│   └── __tests__/
│       └── db.test.ts                            # [MODIFY] Assert final state A3 in FIFO sequence test
└── tests/
    └── originConfig.test.ts                      # [MODIFY] Test src/config/publicOrigin.ts & build output
```

**Structure Decision**: Standard client-side SPA structure. The public origin utility lives in `src/config/publicOrigin.ts`, and test files test genuine production implementations.

---

## Complexity Tracking

*No violations of project principles or extra architectural layers introduced. Table intentionally empty.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
| :--- | :--- | :--- |
| *None* | *N/A* | *N/A* |
