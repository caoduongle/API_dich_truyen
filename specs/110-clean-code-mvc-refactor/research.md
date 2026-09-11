# Research: Clean Code & MVC Refactor

**Feature**: 110-clean-code-mvc-refactor
**Date**: 2026-09-12

## R1: `shared/` Module Relocation Strategy

### Decision
Relocate all 7 `shared/` files into `src/` following a domain-driven placement strategy. The `@shared/*` path alias will be replaced with standard `@/` relative imports.

### Rationale
The `shared/` directory was created for client-server code sharing. With the server removed, the name is misleading. Each file should live in the layer it logically belongs to.

### Target mapping

| Source | Target | Reason |
|--------|--------|--------|
| `shared/prompts.ts` | `src/services/ai/prompts.ts` | Prompt engineering is AI service logic |
| `shared/glossaryPrompts.ts` | `src/services/ai/glossaryPrompts.ts` | Same — AI prompt construction |
| `shared/models.ts` | `src/config/models.ts` | Model registry is application config |
| `shared/constants.ts` | `src/config/constants.ts` | App-wide constants are config |
| `shared/text.ts` | `src/lib/text.ts` | Pure text utility functions |
| `shared/sinoNormalize.ts` | `src/lib/sinoNormalize.ts` | Pure text normalization utility |
| `shared/parser.ts` | `src/lib/parser.ts` | Pure parsing utility |

### Import update scope
- 20 files in `src/` import from `@shared/*`
- 3 files in `shared/` have internal cross-references
- Total: ~23 files need import path updates
- `@shared/models` has the highest fan-in (8 importers)
- `@shared/text` has 5 importers
- `@shared/constants` has 4 importers

### Alternatives considered
1. **Rename `shared/` to `src/shared/`** — Rejected: still carries misleading "shared" semantics
2. **Merge everything into existing `src/lib/`** — Rejected: prompt engineering files are not generic utilities, they're domain-specific service logic
3. **Keep `shared/` but rename to `core/`** — Rejected: doesn't solve the MVC layering goal

---

## R2: `App.tsx` Decomposition Strategy

### Decision
Extract 6 inline sub-components from `App.tsx` (1156 lines) into `src/components/layout/`, keeping `App.tsx` as a ~100-line provider-stack + `<AppShell />`.

### Rationale
`App.tsx` already has clear internal sections that are effectively inline components. Each section has a single responsibility and minimal shared state. Extraction is straightforward cut-and-paste with import adjustments.

### Extraction plan

| Section (approx lines) | Target file | Responsibility |
|------------------------|-------------|----------------|
| Lines 182–350: `AppHeader` | `src/components/layout/AppHeader.tsx` | Toolbar: theme, i18n, Google account, AI config, mobile menu |
| Lines 352–480: `AppTabBar` | `src/components/layout/AppTabBar.tsx` | Tab navigation, scroll overflow, keyboard nav, active indicator |
| Lines 482–620: `TabContent` | `src/components/layout/TabContent.tsx` | Lazy-loaded page panels with Suspense + ErrorBoundary |
| Lines 622–900: `AppFooter` + policy content | `src/components/layout/AppFooter.tsx` | Footer, copyright, policy modals |
| Lines 902–1000: `ApiSettingsModal` | `src/components/layout/ApiSettingsModal.tsx` | Modal wrapper for API settings |
| Lines 1002–1100: `GoogleSyncSection` | `src/components/layout/GoogleSyncSection.tsx` | Drive sync orchestration |

### Shared state interface
The extracted components need ~5 props from the parent shell:
- `activeTab` / `setActiveTab`
- `showApiSettings` / `setShowApiSettings`
- `googleAuthState`

This can be passed via props or a lightweight layout context.

### Alternatives considered
1. **Feature-based routing with React Router** — Rejected: adds a new dependency (violates Constitution II), current URL routing is simple and works
2. **Single monolithic extraction to one `AppShell.tsx`** — Rejected: doesn't solve the size problem, just moves it

---

## R3: Collocated Hook Relocation

### Decision
Move `useWorkspaceState.ts` (921 lines) and `useGlossaryState.ts` (487 lines) from their component directories to `src/hooks/`.

### Rationale
These hooks are full-featured controllers with business logic (IndexedDB operations, CRDT sync, audit scoring, glossary merging). Placing them in `src/components/` violates MVC separation — the View layer should not contain controller logic.

### Impact analysis
- `useWorkspaceState.ts`: Imported by `TranslatorWorkspace.tsx` and `BilingualEditor.tsx` in `src/components/translator-workspace/`. Relative imports (`./useWorkspaceState`) will change to `../../hooks/useWorkspaceState` or `@/src/hooks/useWorkspaceState`.
- `useGlossaryState.ts`: Imported by `GlossaryManager.tsx` in `src/components/glossary-manager/`. Same import path adjustment.

### Alternatives considered
1. **Keep collocated but add a barrel re-export from `src/hooks/`** — Rejected: doesn't solve the structural issue, creates confusing dual locations
2. **Split hooks into smaller pieces** — Deferred: valuable but out of scope for this refactor; the immediate goal is correct placement, not internal redesign

---

## R4: Dead Code Audit Results

### Decision
Remove all confirmed dead artifacts in a single cleanup pass before the structural refactor.

### Dead code inventory

| Artifact | Status | Evidence | Action |
|----------|--------|----------|--------|
| `shared/constants.ts` → `SERVER_CONFIG` | Dead | Only imported by `shared/__tests__/constants.test.ts` | Delete export + update test |
| `src/utils/apiClient.ts` | Partially dead | Only exports `QuotaStatusResponse` type | Check if type is used; if not, delete file |
| `database/migrations/001_rls_policies.sql` | Dead | Supabase schema never used by any `src/` code | Archive to `docs/archive/` or delete |
| `docs/api.md` | Dead | Documents Express endpoints that don't exist | Archive to `docs/archive/` |
| `merge.py` | Partially dead | Dev utility with stale server refs (lines 39-40) | Update paths or archive |
| `esbuild` in `devDependencies` | Dead | No references outside `package.json` | Remove from `package.json` |
| `README.md` backend sections | Stale | References Express, REDIS_URL, port 3001 | Rewrite |
| `SECURITY.md` backend sections | Stale | References server-side sessions, Redis, server validation | Rewrite |
| `AGENTS.md` backend references | Stale | References `server/`, esbuild server | Already noted for update |
| Constitution backend refs | Stale | Lists Express/ioredis in tech stack | Rewrite tech stack section |

### `y-websocket` dependency
**NOT dead.** Used in `src/hooks/useChapterCRDT.ts` for WebSocket-based CRDT collaboration via the Yjs public demo server (`wss://demos.yjs.dev/ws`). Must be retained.

### `esbuild` dependency
**Dead.** No `build-server.js` exists. No script references it. Safe to remove.

---

## R5: `QuotaStatusResponse` Type Usage

### Decision
Needs verification during implementation. If `QuotaStatusResponse` from `src/utils/apiClient.ts` is still imported by `QuotaPanel.tsx`, move the type to `src/types/quota.ts`. If no importers remain, delete the file.

### Rationale
The research showed the file only exports a type interface. The actual `apiFetch` function was already removed. The type may have been migrated to `localQuotaTracker.ts` types already.

---

## R6: Test Relocation Strategy

### Decision
Move `shared/__tests__/` tests alongside their relocated source files following the project's existing test convention.

### Mapping
| Source test | Target |
|-------------|--------|
| `shared/__tests__/constants.test.ts` | `src/config/__tests__/constants.test.ts` |
| `shared/__tests__/sinoNormalize.test.ts` | `src/lib/__tests__/sinoNormalize.test.ts` |
| `shared/__tests__/text.test.ts` | `src/lib/__tests__/text.test.ts` |

Tests for `SERVER_CONFIG` in `constants.test.ts` will be removed (dead code). Remaining assertions for `AI_SERVICE_CONFIG`, `GLOSSARY_LIMITS`, etc. will be preserved.
