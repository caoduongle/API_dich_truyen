<!--
Sync Impact Report:
- Version: 0.0.0 → 1.0.0 (Initial Ratification)
- Added Sections: Core Principles, Technology Stack & Architecture Boundaries, Quality Assurance & Verification Workflow, Governance
- Modified Principles: N/A (Initial creation)
- Deferred Items: None
-->

# AI Dịch Truyện Trung-Việt Constitution

## Core Principles

### I. Strict Quality Gates & Verification (NON-NEGOTIABLE)
All quality checks—specifically `tsc --noEmit`, `vitest run`, and `vite build`—MUST pass cleanly without any errors before any task is considered complete. Deleting, disabling, or skipping tests to bypass failures is strictly PROHIBITED.

### II. Dependency Minimization & Existing Library Reuse
DO NOT add new NPM dependencies if equivalent packages or utilities already exist in the codebase (e.g., `clsx`, `tailwind-merge`, `motion`, `lucide-react`, `ioredis`). Existing modules and components MUST be reused.

### III. Strict Concern Separation & Domain Boundary Preservation
Frontend UI tasks MUST NOT modify backend Gemini API calling logic or the 2-stage translation pipeline (raw translation → polishing). Conversely, translation pipeline or backend tasks MUST NOT modify UI presentation components unless explicitly tasked.

### IV. Immutable Core Schemas & Storage Stability
Core TypeScript interfaces in `src/types.ts` and IndexedDB storage schemas MUST NOT be mutated without explicit user instructions. Vietnamese user interface copy and text labels MUST remain unchanged unless text customization is the explicit target of the prompt.

### V. Atomic Commits & Documentation Synchronization
Code modifications MUST be small, modular, and individually reviewable. NEVER bundle changes to unrelated modules into a single pull request or diff. The project `README.md` and the actual active endpoints in `server/routes` MUST be maintained in strict 1:1 synchronization.

## Technology Stack & Architecture Boundaries

The application is built on the following designated technology stack:
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS with `clsx` / `tailwind-merge`, `motion`, `lucide-react`.
- **Backend & Caching**: Express.js server, Node.js, `ioredis` for caching and state management.
- **AI Integration**: Google Gemini API running a strict 2-phase workflow (Phase 1: Raw Translation + Term Extraction; Phase 2: Contextual Polishing).

## Quality Assurance & Verification Workflow

Before marking any task resolved or submitting code changes:
1. Run `npx tsc --noEmit` to verify type safety.
2. Run `npx vitest run` to verify test suite pass status.
3. Run `npm run build` (or `npx vite build`) to verify production bundle buildability.
4. Ensure no test assertions were removed or muted during the fix.

## Governance

- **Supremacy**: This Constitution supersedes all conflicting informal practices or temporary guidelines.
- **Amendments**: Any change to these principles requires an explicit version bump, updated rationale, and approval.
- **Compliance**: Every proposed diff must be verifiable against the 5 Core Principles outlined above.

**Version**: 1.0.0 | **Ratified**: 2026-08-18 | **Last Amended**: 2026-08-18
