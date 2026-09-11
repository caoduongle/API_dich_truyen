# Implementation Plan: Clean Code & MVC Refactor

**Branch**: `110-clean-code-mvc-refactor` | **Date**: 2026-09-12 | **Spec**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/110-clean-code-mvc-refactor/spec.md)

**Input**: Feature specification from `specs/110-clean-code-mvc-refactor/spec.md`

## Summary

The project has migrated to a purely client-side SPA but retains significant legacy artifacts (dead backend references, misleading `shared/` directory, 1156-line `App.tsx`, collocated controller hooks in view directories). This plan reorganizes the codebase into clear MVC layers: **Model** (services, types, config), **View** (components), **Controller** (hooks, contexts), and **Shared Utilities** (lib, utils) — while removing all dead code and updating outdated documentation.

## Technical Context

**Language/Version**: TypeScript 5.8 (strict mode), React 19, ES2022 target

**Primary Dependencies**: `@google/genai`, `dexie` (IndexedDB), `yjs`/`y-websocket`/`y-indexeddb` (CRDT), `motion`, `clsx`/`tailwind-merge`, `lucide-react`, `opencc-js`, `jszip`

**Storage**: IndexedDB (browser-local via `src/services/db.ts`), Google Drive v3 REST (optional cloud sync)

**Testing**: Vitest (unit tests in `src/__tests__/` and `shared/__tests__/`)

**Target Platform**: Browser SPA, deployed as static files on Vercel (Nginx in Docker as fallback)

**Project Type**: Client-side web application (SPA)

**Performance Goals**: Standard SPA expectations — instant tab switching, < 2s initial load

**Constraints**: No new dependencies (Constitution II). No schema changes to `src/types.ts` or IndexedDB (Constitution IV). No changes to Vietnamese UI text (Constitution IV).

**Scale/Scope**: ~95 components, 21 hooks, 22 services, ~23 files needing import updates

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Strict Quality Gates** | ✅ PASS | Plan requires `npm run lint && npm test && npm run build` after every phase |
| **II. Dependency Minimization** | ✅ PASS | No new dependencies added. `esbuild` will be *removed* (dead dep). `y-websocket` *retained* (actively used) |
| **III. Strict Concern Separation** | ✅ PASS | This refactor *implements* concern separation — it's the explicit goal |
| **IV. Immutable Core Schemas** | ✅ PASS | `src/types.ts` and IndexedDB schema are NOT modified. Vietnamese UI text unchanged |
| **V. Atomic Commits & Doc Sync** | ✅ PASS | Plan is divided into 5 atomic phases. Documentation is updated to match new architecture |

**Post-Phase 1 re-check**: The constitution itself references Express/ioredis in the Technology Stack section. This is a **justified amendment** — the constitution must be updated to reflect reality (version bump 1.0.0 → 2.0.0). The amendment is explicitly called for by the spec (FR-005).

## Project Structure

### Documentation (this feature)

```text
specs/110-clean-code-mvc-refactor/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 research findings
├── data-model.md        # Phase 1 target architecture
├── quickstart.md        # Validation guide
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (target architecture after refactor)

```text
src/
├── App.tsx                    # Thin shell: providers + <AppShell /> (~100–150 lines)
├── main.tsx                   # Entry point (unchanged)
├── index.css                  # Styles (unchanged)
├── types.ts                   # Core domain types (unchanged)
├── vite-env.d.ts
│
├── config/                    # [NEW] Application configuration
│   ├── constants.ts           # ← shared/constants.ts (minus SERVER_CONFIG)
│   └── models.ts              # ← shared/models.ts
│
├── types/                     # Extended domain types (unchanged)
│
├── services/                  # Model layer: business engines
│   ├── ai/                    # [NEW] AI prompt engineering
│   │   ├── prompts.ts         # ← shared/prompts.ts
│   │   └── glossaryPrompts.ts # ← shared/glossaryPrompts.ts
│   ├── [22 existing service files unchanged]
│   ├── google-drive/
│   └── zuminovel/
│
├── hooks/                     # Controller layer: all React hooks
│   ├── useWorkspaceState.ts   # ← components/translator-workspace/
│   ├── useGlossaryState.ts    # ← components/glossary-manager/
│   └── [21 existing hooks unchanged]
│
├── context/                   # Controller layer: context providers (unchanged)
│
├── components/                # View layer
│   ├── layout/                # [NEW] App shell components
│   │   ├── AppHeader.tsx
│   │   ├── AppTabBar.tsx
│   │   ├── TabContent.tsx
│   │   ├── AppFooter.tsx
│   │   ├── ApiSettingsModal.tsx
│   │   └── GoogleSyncSection.tsx
│   ├── ui/                    # Design primitives (unchanged)
│   ├── common/                # Shared components (unchanged)
│   └── [feature directories — unchanged, minus extracted hooks]
│
├── lib/                       # Shared utilities
│   ├── cn.ts                  # (unchanged)
│   ├── text.ts                # ← shared/text.ts
│   ├── sinoNormalize.ts       # ← shared/sinoNormalize.ts
│   └── parser.ts              # ← shared/parser.ts
│
├── utils/                     # Application utilities (minus apiClient.ts)
├── i18n/                      # Internationalization (unchanged)
├── data/                      # Static data (unchanged)
├── constants/                 # [DELETED] — replaced by src/config/
└── workers/                   # Web workers (unchanged)
```

**Structure Decision**: Single-project SPA with 4 clear MVC layers (Model: `services/` + `config/` + `types/`, View: `components/`, Controller: `hooks/` + `context/`, Utilities: `lib/` + `utils/`). No structural options needed — the project is a monolithic SPA.

**Directories deleted from repo root**:
- `shared/` — all content relocated into `src/`
- `database/` — dead Supabase migration archived or deleted
- `src/constants/` — replaced by `src/config/`

## Execution Phases

### Phase A: Dead Code Removal (P1 — do first, smallest blast radius)

**Goal**: Remove all confirmed dead artifacts before any structural changes.

1. Delete `SERVER_CONFIG` export from `shared/constants.ts` and its test assertions in `shared/__tests__/constants.test.ts`
2. Delete `src/utils/apiClient.ts` (verify `QuotaStatusResponse` type is unused first; if still imported, move type to `src/types/quota.ts`)
3. Delete `database/` directory (archive `001_rls_policies.sql` to `docs/archive/` if desired)
4. Delete or archive `docs/api.md` (Express endpoint docs)
5. Remove `esbuild` from `devDependencies` in `package.json`
6. Run `npm run lint && npm test && npm run build` — must pass

### Phase B: `shared/` → `src/` Relocation (P1 — highest import impact)

**Goal**: Relocate all 7 shared modules + 3 test files into the `src/` tree.

1. Create new directories: `src/config/`, `src/services/ai/`, `src/lib/__tests__/`, `src/config/__tests__/`
2. Move files per [data-model.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/110-clean-code-mvc-refactor/data-model.md) file movement table
3. Update internal cross-references within the moved files (3 files: `prompts.ts`, `text.ts`, `glossaryPrompts.ts`)
4. Update all 20 importers in `src/` from `@shared/*` to new paths
5. Delete `src/constants/models.ts` barrel (replaced by `src/config/models.ts`)
6. Update `src/constants/` importers to use `src/config/` 
7. Remove `@shared/*` alias from `tsconfig.json` and `vite.config.ts`
8. Delete `shared/` directory
9. Run `npm run lint && npm test && npm run build` — must pass

### Phase C: `App.tsx` Decomposition (P2 — contained, no external import changes)

**Goal**: Extract 6 inline components from `App.tsx` into `src/components/layout/`.

1. Create `src/components/layout/` directory
2. Extract `AppHeader` → `src/components/layout/AppHeader.tsx`
3. Extract `AppTabBar` → `src/components/layout/AppTabBar.tsx`
4. Extract `TabContent` → `src/components/layout/TabContent.tsx`
5. Extract `AppFooter` (including policy modal content) → `src/components/layout/AppFooter.tsx`
6. Extract `ApiSettingsModal` → `src/components/layout/ApiSettingsModal.tsx`
7. Extract `GoogleSyncSection` → `src/components/layout/GoogleSyncSection.tsx`
8. Refactor `App.tsx` to import and compose the extracted components
9. Verify `App.tsx` is under 200 lines
10. Run `npm run lint && npm test && npm run build` — must pass

### Phase D: Collocated Hook Extraction (P3 — simple moves)

**Goal**: Move `useWorkspaceState.ts` and `useGlossaryState.ts` to `src/hooks/`.

1. Move `src/components/translator-workspace/useWorkspaceState.ts` → `src/hooks/useWorkspaceState.ts`
2. Update imports in `TranslatorWorkspace.tsx`, `BilingualEditor.tsx`, and any other importers
3. Move `src/components/glossary-manager/useGlossaryState.ts` → `src/hooks/useGlossaryState.ts`
4. Update imports in `GlossaryManager.tsx` and any other importers
5. Run `npm run lint && npm test && npm run build` — must pass

### Phase E: Documentation Update (P2 — safe to do last)

**Goal**: Update all documentation to reflect the client-side-only architecture.

1. Update `AGENTS.md`: Remove `server/` references, update build commands, update deny-list
2. Update `SECURITY.md`: Rewrite to describe client-side security model (API keys in sessionStorage, CSP headers, Google OAuth PKCE)
3. Update `README.md`: Remove Express/Redis architecture, describe SPA architecture, update setup instructions
4. Update `.specify/memory/constitution.md`:
   - Remove Express/ioredis from Technology Stack
   - Add IndexedDB, `@google/genai` client SDK, Google Drive v3 REST
   - Update AI Integration description (now 3-phase: raw → polish → QA critique)
   - Remove `server/routes` reference from Principle V
   - Bump version 1.0.0 → 2.0.0
5. Clean up `merge.py` server references (update or archive)
6. Run `npm run lint && npm test && npm run build` — must pass (final validation)

## Complexity Tracking

No constitution violations. No complexity justifications needed.

The refactor is purely structural — all changes are file moves, import updates, and documentation rewrites. Zero logic changes to any service, hook, or component.
