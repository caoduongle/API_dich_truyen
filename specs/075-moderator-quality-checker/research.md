# Research & Architectural Decisions: Moderator Project Quality Checker Workspace

**Feature**: `075-moderator-quality-checker`
**Date**: 2026-08-27
**Status**: Completed

---

## 1. Architectural Decisions

### Decision 1: Direct Project Integration (No Web Scraping)

- **Context**: The previous implementation attempted to fetch novel and chapter content by scraping `ln.hako.vn` / `docln.net` via a server-side proxy. This introduced network dependencies, rate-limiting (429), and bot challenges (Cloudflare), while the application already contains the translated chapters directly in the user's `StoryProject` database.
- **Decision**: Read chapters directly from the user's active/selected `StoryProject` (stored in IndexedDB/`ProjectContext`).
  - `sourceText` is automatically used as the Chinese raw text.
  - `polishedTranslation` (priority) or `rawTranslation` (fallback) is used as the Vietnamese translated text.
  - A drawer remains available to let moderators paste a custom raw text if they want to compare variant manuscripts.
- **Rationale**:
  - Instant loading (< 0.5s) with zero network latency.
  - 100% offline-capable and immune to third-party anti-bot / rate-limiting issues.
  - Aligns with the moderator workflow of checking manuscripts *before* publishing them to Hako.
- **Alternatives Considered**:
  - *Keep Hako URL scraper as a secondary option*: Rejected. Adds unnecessary maintenance burden, backend routes, and external failure points.

---

### Decision 2: Removal of Server-Side Hako Proxy & Endpoints

- **Context**: Server routes `server/routes/hako.ts`, `server/controllers/hakoController.ts`, and `server/services/hakoScraperService.ts` were created solely for Hako scraping.
- **Decision**: Completely delete these files and remove `router.use('/hako', hakoRouter)` from `server/routes/api.ts`. Also delete `src/services/hakoApiService.ts`.
- **Rationale**: Clean codebase without dead endpoints, keeping the backend minimal and eliminating unused proxy attack surfaces.

---

### Decision 3: Hybrid Heuristic + AI Semantic Quality Engine (Retained)

- **Context**: Quality inspection requires both instantaneous rule-based checks and deep literary critique.
- **Decision**:
  - **Heuristic Engine**: Rule-based regex scanning for CJK character leaks (`[\u4e00-\u9fa5]`), duplicate consecutive paragraphs, and editor placeholder tags (`[chưa dịch]`, `TODO`, `FIXME`). Runs in < 50ms per chapter.
  - **AI Engine**: Calls Gemini via `callGeminiDirect()` with structured JSON schema. Analyzes character name continuity, pronoun/gender consistency, terminology drift, and bilingual raw-translation fidelity (mistranslations, omissions, hallucinations).
  - Uses existing API key and model selection from `AIConfigContext` without prompting the moderator.
- **Rationale**: Best combination of instant feedback for common typos and intelligent critique for nuanced translation errors.

---

### Decision 4: Isolated Session Store for Quality Reviews (Retained)

- **Context**: Moderator reviews must be persistent across page reloads and tab navigation.
- **Decision**: Retain `hakoSessionStore.ts` utilizing a dedicated IndexedDB database (`HakoQualityCheckerDB`) with object store `hako_quality_sessions`.
- **Rationale**: Zero interference with `StoryProject` or `Chapter` schema, ensuring total isolation and safety for translation project data.

---

### Decision 5: Formatted Markdown Quality Report Export (Retained)

- **Context**: Moderators need to communicate confirmed issues to translators and editors clearly.
- **Decision**: Generate structured Markdown report grouped by chapter with severity markers, evidence quotes, raw comparison snippets, and moderator notes. Provide 1-click copy to clipboard with toast notification.
- **Rationale**: Standard, universal text format easily shared via Discord, Facebook groups, or Hako forums.
