# Research & Technical Decisions: Direct Client Translation for Personal API Keys

## Overview

This document records the architectural and design decisions for enabling direct browser-to-Gemini translation when users provide their own API keys, removing the server-side concurrency bottleneck (`MAX_CONCURRENT_REQUESTS = 50`) while preserving 100% functional continuity for server-fallback users.

---

## Technical Decisions

### Decision 1: Extraction of Platform-Agnostic Translation Logic to `shared/`

* **Context**: Prompt composition, system instructions (`LITERARY_TRANSLATION_FRAMING`), genre style guides, JSON response parsing (`safeParseJson`), adaptive text chunking (`splitTextAdaptively`), token estimation (`estimateTokenCount`), glossary substitution, and entity snapback currently live in `server/controllers/translation/` and `server/utils/text.ts`.
* **Decision**: Extract all pure TypeScript/browser-compatible functions into `@shared` modules:
  * `shared/text.ts`: `sanitizePromptInput`, `countChineseCharacters`, `calculateChineseCharRatio`, `validateTranslationOutput`, `separateChapterTitleAndBody`, `ensureChapterTitlePreserved`, `getGenreStyleGuide`, `safeParseJson`, `findSplitPoint`, `estimateTokenCount`, `splitTextAdaptively`, `escapeRegex`, `LITERARY_TRANSLATION_FRAMING`, `ANTI_INJECTION_DEFENSE_DIRECTIVE`.
  * `shared/prompts.ts`: Shared prompt generation and structured schemas for Raw Translation (Phase 1), Polish Translation (Phase 2), and QA Critique (Phase 3).
* **Rationale**:
  * Guarantees 100% identical prompts, instructions, formatting, and schema definitions between client direct execution and server fallback execution.
  * Node.js and browser runtimes both consume `@shared` aliases seamlessly via `tsconfig.json` and `vite.config.ts`.
  * Server controllers simply import and use the shared prompt builders, eliminating code duplication.
* **Alternatives Considered**:
  * *Duplicate prompt strings in `src/` and `server/`*: Rejected due to high risk of prompt divergence and maintenance overhead.
  * *Keep prompt generation on server via a `/api/build-prompt` endpoint*: Rejected because it introduces unnecessary server HTTP latency and CPU overhead for direct client users.

---

### Decision 2: Direct Browser-to-Gemini HTTP Transport Mechanism

* **Context**: Direct client calls need to communicate with Google Gemini API (`https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`).
* **Decision**: Implement a lightweight, direct HTTP fetch client (`src/services/directGeminiClient.ts`) using standard browser `fetch` and modern `x-goog-api-key` header authentication.
* **Rationale**:
  * Standard `fetch` requires zero additional npm dependencies and has zero bundle overhead.
  * Native support for `AbortSignal` allows immediate request cancellation when users stop or pause translations in the UI.
  * The `x-goog-api-key` header works uniformly for both legacy Standard keys (`AIza...`) and new Auth keys (`AQ...`).
  * Direct fetch directly reaches Google's edge endpoints without any intermediary proxy.
* **Alternatives Considered**:
  * *Importing `@google/genai` inside frontend client code*: Possible, but the SDK includes node/server abstractions and larger bundle footprint compared to a clean, typed fetch client for `:generateContent`.

---

### Decision 3: Client-Side Key Rotation and Fault Resilience

* **Context**: When a user configures multiple personal API keys (1–3 keys), if key #1 encounters a rate limit (HTTP 429) or transient provider error, the client should rotate to key #2 without crashing.
* **Decision**: Implement a lightweight client-side rotation and error handler (`generateWithClientRotation`) in `src/services/directGeminiClient.ts`:
  * Cycles through the user's provided `apiKeys` array starting at `startKeyIndex`.
  * On HTTP 429 / 503 / 500: attempts next available key in the list or short backoff if single key.
  * On non-retryable errors (e.g. 400 invalid argument / 403 unauthorized for all keys): surfaces the specific error message immediately.
  * Does NOT use server-side `quotaService` or Redis state machines.
* **Rationale**:
  * Users in direct mode manage only their own 1–3 personal keys. Shared pool tracking and global RPM/TPM state machines are unnecessary complexity for isolated client sessions.
* **Alternatives Considered**:
  * *Porting Redis / quotaService state machine to client IndexedDB*: Rejected as over-engineering and contrary to project specifications.

---

### Decision 4: Execution Flow Branching in `chapterTranslationService.ts`

* **Context**: `chapterTranslationService.ts` is the central orchestrator for translating chapters in the frontend.
* **Decision**:
  * If `apiKeys` array is non-empty and contains at least one valid key: route translation phases (Raw, Polish, QA Critique) through the direct client translation pipeline (`executeDirectChapterTranslation` / direct client calls).
  * If `apiKeys` array is empty or undefined: retain the exact existing `apiFetch('/api/translate-raw')`, `apiFetch('/api/polish-translation')`, and `apiFetch('/api/qa-critique')` calls to the server.
* **Rationale**:
  * Provides seamless, zero-config switching based on user credentials.
  * Ensures 100% backward compatibility for server-fallback workflows.
* **Alternatives Considered**:
  * *Forcing all users to provide personal keys*: Rejected because server fallback (`ALLOW_SERVER_KEY_FALLBACK`) is a core feature for environments without user keys.

---

### Decision 5: Total Data Isolation & Cache Exclusion for Direct Mode

* **Context**: Shared server cache (`translationChunkCache` or Redis) could theoretically store translated segments, but requirement specifies absolute isolation between users.
* **Decision**: Direct client translations do NOT check, read, or write to any server cache. All translated results are written directly to the client's local IndexedDB (`src/services/db.ts`) for that specific user.
* **Rationale**:
  * Guarantees zero cross-tenant data leakage and zero server CPU/memory/Redis consumption for direct mode users.
  * Each user's translation remains completely private and independent.
