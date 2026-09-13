# Implementation Plan: Harden Security Headers in Render Blueprint and Refine ZumiNovel Network Error Diagnostics

**Branch**: `126-harden-security-headers` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/126-harden-security-headers/spec.md`

## Summary

This implementation plan delivers two targeted security and reliability improvements:
1. **Infrastructure Security Hardening (`render.yaml`)**:
   - Prepend `upgrade-insecure-requests;` to the `Content-Security-Policy` header to automatically rewrite any insecure HTTP subresource requests to HTTPS at the browser level.
   - Introduce `Cross-Origin-Resource-Policy: same-origin` to block other websites from reading or embedding the application's static assets (scripts, styles, images).
   - Expand `Permissions-Policy` to explicitly deny sensitive, unused hardware and browser APIs: `payment=(), usb=(), screen-wake-lock=()` in addition to existing restrictions on camera, microphone, and geolocation.
2. **Diagnostic Error Refactor (`src/services/zuminovel/zuminovelRestClient.ts`)**:
   - Remove misleading error messaging claiming that ZumiNovel blocks direct browser requests requiring a server proxy due to CORS.
   - Update `ZuminovelNetworkError`'s message and JSDoc documentation to cite actual transport issues: network disconnection, DNS failure, adblocker/privacy extension blocks, or Content-Security-Policy restrictions.
   - Maintain full backwards compatibility with existing consumers (e.g. `useZuminovelPublish.ts`) and unit test suites.

---

## Technical Context

**Language/Version**: TypeScript 5.7+ / Node.js 18+  
**Primary Dependencies**: React 19, Vite, `@google/genai` client SDK, `lucide-react`, `clsx`, `tailwind-merge`  
**Configuration & Deployment**: Render Blueprint (`render.yaml`, static runtime, version "1")  
**Storage**: Client-side IndexedDB (`src/services/db.ts`)  
**Testing**: Vitest (`npm test`), TypeScript type checking (`tsc --noEmit`), Vite build (`npm run build`)  
**Target Platform**: Pure Client-Side SPA deployed to Render  
**Project Type**: Single Page Web Application (Client-Side SPA)  
**Performance Goals**: Zero runtime latency overhead; zero bundle size impact; sub-millisecond error handling.  
**Constraints**: Pure client-side architecture; zero backend server dependencies; immutable schemas in `src/types.ts`.  
**Scale/Scope**: 2 files modified (`render.yaml` and `src/services/zuminovel/zuminovelRestClient.ts`).

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I: Strict Quality Gates & Verification**: `npm run lint`, `npm test`, and `npm run build` must all pass cleanly without skipping or disabling tests. $\rightarrow$ **PASS**
- **Principle II: Dependency Minimization & Existing Library Reuse**: No new NPM dependencies added; changes leverage existing YAML config and TypeScript standard error constructs. $\rightarrow$ **PASS**
- **Principle III: Strict Concern Separation & MVC Domain Boundary**: Infrastructure headers stay in `render.yaml`; service logic and error types remain in `src/services/zuminovel/`. Views and Controllers are untouched. $\rightarrow$ **PASS**
- **Principle IV: Immutable Core Schemas & Storage Stability**: No modifications to IndexedDB schemas or `src/types.ts`. $\rightarrow$ **PASS**
- **Principle V: Atomic Commits & Documentation Synchronization**: All artifacts (`spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, `plan.md`) are maintained in strict sync with code changes. $\rightarrow$ **PASS**

---

## Project Structure

### Documentation (this feature)

```text
specs/126-harden-security-headers/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan
├── research.md          # Technical research and decisions
├── data-model.md        # Security headers and error entities
├── quickstart.md        # Step-by-step verification commands
├── checklists/
│   └── requirements.md  # Quality checklist validation
└── contracts/
    └── security-headers-and-client.contract.md # Interface & configuration contracts
```

### Source Code (repository root)

```text
/
├── render.yaml                                        # [MODIFY] Update CSP, add CORP, expand Permissions-Policy
└── src/
    └── services/
        └── zuminovel/
            ├── zuminovelRestClient.ts                 # [MODIFY] Refactor ZuminovelNetworkError message and JSDoc
            └── __tests__/
                └── zuminovelRestClient.test.ts        # [VERIFY] Validate error handling tests pass
```

**Structure Decision**: Static site blueprint configuration in project root (`render.yaml`) paired with client service update in `src/services/zuminovel/`.

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| *None* | *N/A* | *Standard YAML header configuration and class message refactoring* |

