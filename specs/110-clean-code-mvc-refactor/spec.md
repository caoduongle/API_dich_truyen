# Feature Specification: Clean Code & MVC Refactor

**Feature Branch**: `110-clean-code-mvc-refactor`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "hiện tại đã chuyển sang thuần client-side; lập kế hoạch clean code và refactor repo sao cho đạt chuẩn MVC"

## User Scenarios & Testing *(mandatory)*

### User Story 1 – Developer Navigates a Clean, Legacy-Free Codebase (Priority: P1)

As a developer opening the repository for the first time, I can understand the project structure within minutes because there are no dead backend references, orphan configuration files, or misleading documentation suggesting a server component or Supabase database that no longer exists.

**Why this priority**: Dead code and stale documentation are the #1 source of confusion for contributors. Removing them is a prerequisite for any structural refactor.

**Independent Test**: Clone the repo, run `npm run build`, and confirm that no file or script references defunct backend infrastructure (Express, ioredis, Redis, Supabase) in executable or configuration paths.

**Acceptance Scenarios**:

1. **Given** the repo has been cleaned, **When** a developer searches config/build files for server references, **Then** zero results are returned from non-historical files (specs archive is excluded).
2. **Given** dead code has been removed, **When** a developer inspects `shared/constants.ts`, **Then** `SERVER_CONFIG` (containing `DEFAULT_PORT`, `BODY_SIZE_LIMIT`, `RATE_LIMIT_MAX_REQUESTS`) no longer exists.
3. **Given** `database/migrations/` has been addressed, **When** a developer inspects the repository root, **Then** no Supabase SQL migration files exist in active code paths.
4. **Given** `src/utils/apiClient.ts` has been cleaned, **When** a developer looks for HTTP client utilities, **Then** the legacy `apiFetch` wrapper that targeted a backend server no longer exists.

---

### User Story 2 – Developer Finds Code in Predictable MVC Layers (Priority: P1)

As a developer working on a bug fix or new feature, I can locate the relevant code by following a clear Model → View → Controller separation where: domain types and data-access live in a model/repository layer, React components live in a view layer, and orchestration/business-logic hooks act as controllers.

**Why this priority**: The current architecture has a 1156-line `App.tsx`, business logic scattered across 21 hooks, 22 services, 3 contexts, and large stateful component files (e.g., `useWorkspaceState.ts` at 37KB inside `components/`). Without clear layering, every change risks unintended side effects.

**Independent Test**: Pick any feature (e.g., "translation") and verify that its data model, UI, and controller logic each reside in a well-defined layer without cross-layer imports violating the dependency rule (Views → Controllers → Models).

**Acceptance Scenarios**:

1. **Given** the MVC refactor is complete, **When** a developer looks for translation data logic, **Then** it is located in a dedicated service/model layer — not scattered across hooks and components.
2. **Given** the MVC refactor is complete, **When** a developer inspects a React component, **Then** it contains only rendering logic and delegates all business decisions to a controller (hook/context) or model (service).
3. **Given** `src/App.tsx` has been decomposed, **When** a developer opens it, **Then** it is under 200 lines and serves only as a top-level provider shell + router — all layout, navigation, modals, and page-level state have been extracted to dedicated components.

---

### User Story 3 – `shared/` Modules Are Properly Relocated Into the Client Source Tree (Priority: P1)

As a developer, I find all shared modules (prompt engineering, model registry, Sino-Vietnamese normalization, text utilities, glossary prompts, parser) organized within `src/` under appropriate MVC layers, because the `shared/` directory name implies client-server code sharing that no longer applies.

**Why this priority**: The `shared/` directory contains 7 actively-used files (`prompts.ts`, `models.ts`, `sinoNormalize.ts`, `text.ts`, `glossaryPrompts.ts`, `parser.ts`, `constants.ts`) that are core to the application. Relocating them into the `src/` tree aligns the directory structure with the actual architecture and removes the misleading "shared" semantics.

**Independent Test**: Confirm `shared/` directory no longer exists, all imports previously referencing `@shared/*` now point to locations within `src/`, and `npm run lint && npm test && npm run build` all pass.

**Acceptance Scenarios**:

1. **Given** `shared/prompts.ts` and `shared/glossaryPrompts.ts` are relocated, **When** a developer searches for prompt engineering code, **Then** they find it in the AI/translation service layer within `src/`.
2. **Given** `shared/models.ts` is relocated, **When** a developer looks for the Gemini model registry, **Then** it lives in a models or config layer within `src/`.
3. **Given** `shared/sinoNormalize.ts`, `shared/text.ts`, and `shared/parser.ts` are relocated, **When** a developer looks for text processing utilities, **Then** they are in `src/lib/` or a dedicated utility layer.
4. **Given** `shared/constants.ts` is relocated, **When** only the actively-used constants (`AI_SERVICE_CONFIG`, `GLOSSARY_LIMITS`, `UI_CONFIG`, `STORAGE_CONFIG`) remain — `SERVER_CONFIG` has been deleted.
5. **Given** the `@shared/*` path alias is removed, **When** `tsconfig.json` and `vite.config.ts` are inspected, **Then** no alias to a `shared/` directory exists.

---

### User Story 4 – `App.tsx` Is a Thin Shell, Not a Monolith (Priority: P2)

As a developer, I can understand the application's top-level architecture by reading a concise `App.tsx` that only sets up providers, routing, and a layout skeleton — all navigation logic, header/footer, modals, hotkeys, and SEO metadata have been extracted to dedicated components.

**Why this priority**: At 1156 lines, the current `App.tsx` is the most complex single file. It handles providers, URL-based routing, hotkeys (Alt+1..6, Escape), header toolbar (theme/i18n/Google account/AI config), tab navigation, lazy loading, footer with policy modals, and mobile drawer. Decomposing it is the highest-impact single refactoring action.

**Independent Test**: Open `App.tsx` and verify it is under 200 lines. Open the extracted layout components and verify each is self-contained with a single responsibility.

**Acceptance Scenarios**:

1. **Given** `App.tsx` is decomposed, **When** a developer opens it, **Then** it contains only the provider stack (`ThemeProvider → I18nProvider → NotificationProvider → AIConfigProvider → ProjectProvider`) and a `<AppShell />` component.
2. **Given** layout components are extracted, **When** a developer looks for the header, **Then** `AppHeader.tsx` exists and handles the toolbar (theme switcher, language selector, Google user button, AI config button).
3. **Given** navigation is extracted, **When** a developer looks for tab routing, **Then** `AppNavigation.tsx` (or `AppRouter.tsx`) handles URL-based routing and lazy-loaded tab rendering.
4. **Given** modals are extracted, **When** a developer looks for the API settings modal or policy modals, **Then** they live in dedicated files, not inline in the shell.

---

### User Story 5 – Documentation Accurately Reflects the Client-Side Architecture (Priority: P2)

As a developer or reviewer reading `README.md`, `AGENTS.md`, or the project constitution, I see an accurate description of the current architecture: a purely client-side React SPA with IndexedDB storage, direct Gemini API calls from the browser, and optional Google Drive sync.

**Why this priority**: Outdated documentation misleads contributors. `AGENTS.md` references `server/` and `esbuild server`. `SECURITY.md` references `REDIS_URL`. The constitution lists Express/ioredis as active technology. `docs/api.md` documents defunct Express endpoints.

**Independent Test**: Read each documentation file and confirm it describes only client-side architecture.

**Acceptance Scenarios**:

1. **Given** `AGENTS.md` is updated, **When** a developer reads it, **Then** it describes a client-side SPA without references to `server/`, Express, or esbuild server builds.
2. **Given** the constitution is updated, **When** a developer references the Technology Stack section, **Then** it lists React 19 + Vite + IndexedDB + `@google/genai` client SDK + Google Drive v3 REST — not Express/ioredis.
3. **Given** `docs/api.md` is addressed, **When** a developer looks for API documentation, **Then** the defunct Express endpoint docs are archived or replaced with client-side service API documentation.
4. **Given** `SECURITY.md` is updated, **When** a developer reads it, **Then** it does not reference `REDIS_URL` or multi-instance backend architecture.

---

### User Story 6 – Stateful Component Logic Is Extracted to Proper Controllers (Priority: P3)

As a developer maintaining the glossary manager or translator workspace, I find the business logic in hook files that live in `src/hooks/` (the controller layer), not embedded inside component directories as `useWorkspaceState.ts` (37KB in `components/translator-workspace/`) or `useGlossaryState.ts` (19KB in `components/glossary-manager/`).

**Why this priority**: Collocating giant state hooks inside component folders violates MVC separation. These hooks contain business logic (IndexedDB operations, glossary merging, audit scoring) that belongs in the controller layer, not the view layer.

**Independent Test**: Confirm no `.ts` hook files exist inside `src/components/` subdirectories — all hooks live in `src/hooks/`.

**Acceptance Scenarios**:

1. **Given** `useWorkspaceState.ts` is relocated, **When** a developer looks in `src/hooks/`, **Then** they find the workspace orchestration hook there.
2. **Given** `useGlossaryState.ts` is relocated, **When** a developer looks in `src/hooks/`, **Then** they find the glossary state management hook there.
3. **Given** the relocations are complete, **When** `npm run lint && npm test && npm run build` run, **Then** they all pass with zero errors.

---

### Edge Cases

- What happens when relocating `shared/` modules — do all `@shared/*` imports across 22+ service files get updated correctly?
- What happens when `useWorkspaceState.ts` (37KB) is moved — does the relative import structure of `translator-workspace/` components still resolve?
- How do we handle `merge.py` — it references old `server.ts` and `server/` paths. Delete it, update it, or archive it?
- What about `y-websocket` dependency — is it still used for CRDT collaboration, or is it dead after the server removal?
- What about `esbuild` in devDependencies — is anything else using it, or is it purely a server-build remnant?
- What about the `Dockerfile` — it's already correct for static SPA (Nginx Alpine), but should it be kept or removed given Vercel deployment?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST remove all dead code artifacts: `SERVER_CONFIG` from `shared/constants.ts`, legacy `apiFetch` wrapper from `src/utils/apiClient.ts`, `database/migrations/` Supabase SQL files, and `docs/api.md` defunct endpoint documentation.
- **FR-002**: System MUST relocate all 7 files from `shared/` into appropriate locations within `src/` (e.g., prompt files → service layer, utility files → `src/lib/`, model registry → config layer, constants → config layer) and remove the `shared/` directory and its `@shared/*` path alias.
- **FR-003**: System MUST decompose `src/App.tsx` (1156 lines) into a thin shell (< 200 lines) by extracting layout components: `AppHeader`, `AppNavigation`/`AppRouter`, `AppFooter`, and modal containers.
- **FR-004**: System MUST move collocated state hooks (`useWorkspaceState.ts`, `useGlossaryState.ts`) from inside `src/components/` subdirectories to `src/hooks/` to enforce View/Controller separation.
- **FR-005**: System MUST update all documentation (`README.md`, `AGENTS.md`, `SECURITY.md`, `.specify/memory/constitution.md`) to accurately reflect the current client-side-only architecture.
- **FR-006**: System MUST preserve all existing functionality — translation (3-phase pipeline), reading, hako quality checking, glossary management, Google Drive sync, CRDT collaboration, ZumiNovel publishing, export, settings, i18n — with zero behavioral regression.
- **FR-007**: All existing tests MUST continue to pass after the refactor (`npm run lint && npm test && npm run build`).
- **FR-008**: System MUST audit whether `y-websocket` and `esbuild` dependencies are still actively used and remove them if dead.
- **FR-009**: System MUST ensure dependency direction follows Views → Controllers → Models with no circular imports between layers.
- **FR-010**: System MUST update all import paths affected by file relocations — particularly the ~20+ files importing from `@shared/*`.

### Key Entities

- **Model/Data Layer**: Services (`src/services/`), domain types (`src/types.ts`, `src/types/`), and data-access modules (`db.ts`, `dbMigration.ts`) — responsible for IndexedDB operations, Gemini API calls, Google Drive API calls, quota tracking, and CRDT sync.
- **View Layer**: React components (`src/components/`) — responsible for rendering UI and handling user interactions. Organized by feature domain (translator-workspace, glossary-manager, hako-checker, etc.) with shared primitives in `src/components/ui/`.
- **Controller Layer**: Custom hooks (`src/hooks/`) and context providers (`src/context/`) — responsible for orchestrating business logic, bridging models and views, managing application state.
- **Shared Utilities**: Pure stateless functions (`src/lib/`, `src/utils/`) — available to all layers without introducing coupling.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero references to `express`, `ioredis`, `redis`, `REDIS_URL`, `server/`, `build-server.js`, or Supabase exist in executable code, configuration files, or active documentation (historical specs excluded).
- **SC-002**: `src/App.tsx` is under 200 lines of code.
- **SC-003**: The `shared/` directory no longer exists; its actively-used modules live within `src/` under appropriate MVC layers.
- **SC-004**: `npm run lint`, `npm test`, and `npm run build` all pass cleanly after the refactor.
- **SC-005**: No hook files (`.ts` files defining React hooks) exist inside `src/components/` subdirectories — all hooks reside in `src/hooks/`.
- **SC-006**: The `database/` directory no longer contains active migration files (archived or deleted).
- **SC-007**: No circular import chains exist between the Model, View, and Controller layers.
- **SC-008**: A new developer can identify which MVC layer to modify for any given task within 2 minutes by following the directory structure and reading `README.md`.

## Assumptions

- The backend server (`server/` directory) has already been physically removed; only legacy references remain in documentation, scripts, and the `shared/` directory name.
- The `shared/` directory contains 7 actively-used files (`constants.ts`, `glossaryPrompts.ts`, `models.ts`, `parser.ts`, `prompts.ts`, `sinoNormalize.ts`, `text.ts`) plus tests — these must be relocated, not deleted.
- `shared/constants.ts` exports both dead (`SERVER_CONFIG`) and live (`AI_SERVICE_CONFIG`, `GLOSSARY_LIMITS`, `UI_CONFIG`, `STORAGE_CONFIG`) constants — only the dead ones should be removed.
- The `Dockerfile` is already correct for static SPA deployment (Nginx Alpine, no Node runtime) — it may be kept as-is.
- The `vite.config.ts` is already clean (no proxy, no server plugin) — no changes needed there.
- The `package.json` build script is already clean (`tsc && vite build`) — no changes needed there.
- The MVC refactor will reorganize files within `src/` but will NOT change the public API of any service, hook, or component — internal restructuring only.
- The project deploys as a static SPA on Vercel; the refactor will not change the deployment model.
- `src/constants/models.ts` re-exports from `@shared/models` and will need its import path updated after `shared/` relocation.
