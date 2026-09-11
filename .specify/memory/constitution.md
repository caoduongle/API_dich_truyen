<!--
Sync Impact Report:
- Version: 1.0.0 → 2.0.0 (Pure Client-Side Architecture & MVC Refactor Amendment)
- Added Sections: N/A
- Modified Principles:
  - Principle II: Removed `ioredis` from existing libraries.
  - Principle III: Clarified domain boundary between presentation (View/Components), state orchestration (Controller/Hooks), and business logic (Model/Services).
  - Principle V: Removed obsolete reference to `server/routes`.
  - Technology Stack: Replaced Express.js/ioredis backend with Pure Client-Side SPA (IndexedDB, Google Drive v3 REST API, @google/genai client SDK). Updated AI workflow to 3-phase pipeline (Raw -> Polish -> QA critique).
- Rationale: Architecture transitioned from fullstack Express/Redis to pure client-side SPA with local IndexedDB persistence and direct browser-to-Gemini SDK integration.
-->

# AI Dịch Truyện Trung-Việt Constitution

## Core Principles

### I. Strict Quality Gates & Verification (NON-NEGOTIABLE)
All quality checks—specifically `npm run lint` (`tsc --noEmit`), `npm test` (`vitest run`), and `npm run build` (`tsc && vite build`)—MUST pass cleanly without any errors before any task is considered complete. Deleting, disabling, or skipping tests to bypass failures is strictly PROHIBITED.

### II. Dependency Minimization & Existing Library Reuse
DO NOT add new NPM dependencies if equivalent packages or utilities already exist in the codebase (e.g., `clsx`, `tailwind-merge`, `motion`, `lucide-react`). Existing modules and components MUST be reused.

### III. Strict Concern Separation & MVC Domain Boundary Preservation
The application strictly adheres to Model-View-Controller (MVC) separation on the client side:
- **View**: Presentation components (`src/components/`, `src/components/layout/`).
- **Controller**: State orchestration hooks (`src/hooks/`).
- **Model / Service**: Business logic, algorithms, AI communication, and database access (`src/services/`, `src/lib/`, `src/config/`).
Services MUST NOT import from components or hooks; hooks MUST NOT import from components. Translation pipeline logic in `src/services/` MUST NOT be altered when performing UI tasks, and vice versa.

### IV. Immutable Core Schemas & Storage Stability
Core TypeScript interfaces in `src/types.ts` and IndexedDB storage schemas MUST NOT be mutated without explicit user instructions. Vietnamese user interface copy and text labels MUST remain unchanged unless text customization is the explicit target of the prompt.

### V. Atomic Commits & Documentation Synchronization
Code modifications MUST be small, modular, and individually reviewable. NEVER bundle changes to unrelated modules into a single pull request or diff. The project `README.md`, `AGENTS.md`, and technical specifications MUST be maintained in strict 1:1 synchronization with the active codebase.

## Technology Stack & Architecture Boundaries

The application is built on the following designated technology stack:
- **Frontend SPA**: React 19, Vite, TypeScript, Tailwind CSS with `clsx` / `tailwind-merge`, `motion`, `lucide-react`.
- **Storage & Sync**: IndexedDB (client-side single source of truth), Google Drive v3 REST API (optional user-controlled cloud sync via OAuth 2.0 PKCE).
- **AI Integration**: Google Gemini API via `@google/genai` client SDK running a strict 3-phase workflow (Phase 1: Raw Translation + Term Extraction; Phase 2: Contextual Polishing; Phase 3: QA Critique & Consistency Checking).

## Quality Assurance & Verification Workflow

Before marking any task resolved or submitting code changes:
1. Run `npm run lint` (`tsc --noEmit`) to verify type safety.
2. Run `npm test` (`vitest run`) to verify test suite pass status.
3. Run `npm run build` (`tsc && vite build`) to verify production bundle buildability.
4. Ensure no test assertions were removed or muted during the fix.

## Governance

- **Supremacy**: This Constitution supersedes all conflicting informal practices or temporary guidelines.
- **Amendments**: Any change to these principles requires an explicit version bump, updated rationale, and approval.
- **Compliance**: Every proposed diff must be verifiable against the 5 Core Principles outlined above.

**Version**: 2.0.0 | **Ratified**: 2026-08-18 | **Last Amended**: 2026-09-12
