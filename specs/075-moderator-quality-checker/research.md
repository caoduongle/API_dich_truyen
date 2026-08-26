# Research: Moderator Hako Quality Checker Workspace

**Feature**: `075-moderator-quality-checker`
**Date**: 2026-08-27
**Status**: Completed

## 1. Research Objectives & Problem Analysis

### Objective
Provide a dedicated, read-only quality checking workspace for moderators and editors to inspect published chapters from Hako/Docln (https://ln.hako.vn / https://docln.net), detecting common translation and editorial mistakes (inconsistent names, wrong pronouns/gender, terminology drift, raw leaks, duplicate paragraphs, mistranslations) with optional raw Chinese alignment, without altering existing 2-stage translation workflows.

---

## 2. Technical Decisions & Architectural Analysis

### Decision 1: Server-Side Public HTML Fetching & Parsing vs Client-Side Direct Scraping
- **Decision**: Implement a lightweight, dedicated, read-only server endpoint (`/api/hako/novel-info` and `/api/hako/chapter-content`) that fetches public HTML pages from Hako with appropriate user-agent and timeout controls, and parses metadata/chapters into clean JSON.
- **Rationale**:
  - Direct browser `fetch()` to `https://ln.hako.vn` or `https://docln.net` is blocked by browser Cross-Origin Resource Sharing (CORS) security policies.
  - Server-side fetching avoids CORS issues, enables centralized rate-limiting compliance, provides standard header formatting, and accurately captures HTTP status codes (429, 403 Cloudflare, 503).
  - Keeps credentials completely out of scope (no cookies, read-only).
- **Alternatives Considered**:
  - *Browser-only fetch via public CORS proxy*: Unreliable, third-party proxies can log traffic and frequently get blocked by Cloudflare.
  - *Headless browser (Puppeteer/Playwright)*: Heavyweight, requires large binary dependencies and high memory usage, violating dependency minimization. Lightweight HTTP fetch + regex/HTML parsing is sufficient for static public chapters.

---

### Decision 2: Anti-Bot, Cloudflare Challenge & Rate Limit Handling
- **Decision**: Detect HTTP 429, Cloudflare clearance challenges (status 403 with challenge indicators), and network timeouts, returning structured, empathetic error responses:
  - Error code: `HAKO_RATE_LIMITED` / `HAKO_BOT_CHALLENGE` / `HAKO_NOT_FOUND` / `HAKO_NETWORK_ERROR`.
  - Vietnamese user message explaining the exact platform status (e.g. "Hako đang tạm thời giới hạn tần suất truy cập hoặc bật thử thách chống bot. Vui lòng chờ 1-2 phút rồi thử lại.").
  - UI countdown timer and clear retry button.
- **Rationale**: Ensures user-friendly feedback rather than confusing generic HTTP 500 errors, meeting mandatory requirement FR-010.
- **Alternatives Considered**:
  - *Generic error alert*: Leads to confusion and repeatedly hammering the server when rate-limited.

---

### Decision 3: Quality Review Execution Engine (Hybrid Heuristic + Gemini LLM)
- **Decision**: A two-tier inspection approach:
  1. **Fast Heuristic Scans (Client-side immediate)**:
     - Regex detection of un-translated CJK characters (`[\u4e00-\u9fa5]`) in Vietnamese text (Raw Leaks).
     - Identical/near-identical consecutive paragraph repeats (Duplicate content / wrong paste).
     - Excessive punctuation errors or placeholder tags.
  2. **AI Semantic Quality Scan (via `callGeminiDirect`)**:
     - Evaluates character naming consistency across the selected chapters (up to 12).
     - Checks pronoun & gender continuity (e.g., character addressed as "anh" in chapter 1 switching to "cô" without rationale).
     - Checks terminology consistency across chapters.
     - When optional Chinese raw text is provided: runs bilingual fidelity check (detecting mistranslations, skipped sentences, hallucinated sentences).
- **Rationale**:
  - Heuristics give instant feedback for obvious structural errors without burning AI tokens.
  - LLM provides deep context-aware detection of subtleties that regex cannot catch.
  - Using `callGeminiDirect` uses the user's configured AI model and keys from `useAIConfigContext` without needing new settings.
- **Alternatives Considered**:
  - *AI-only scan*: Misses simple raw character leaks or costs unnecessary prompt tokens for obvious syntax repetitions.
  - *Heuristic-only scan*: Incapable of detecting pronoun flips, subtle mistranslations, or terminology drift.

---

### Decision 4: Session State Persistence & Domain Isolation
- **Decision**: Create a dedicated IndexedDB store (`hako_quality_sessions` in `src/services/db.ts` / local storage service) and separate React context/hook (`useHakoReviewSession`).
- **Rationale**:
  - Complete isolation from `StoryProject` and translation database ensures zero regression to translation pipelines (Constitution Principle III & IV).
  - Moderator review state (novel URL, selected chapters, raw texts, detected issues, confirmed/dismissed statuses, moderator notes) persists across tab switches, page reloads, and browser restarts.
- **Alternatives Considered**:
  - *Embedding review data inside StoryProject*: Pollutes translation projects and risks schema migration conflicts.

---

### Decision 5: Export & Copy Reporting Format
- **Decision**: Generate structured Markdown and clean plain-text formats with grouped chapters, issue categories, severity badges, text snippets, and moderator notes. Provide single-click copy to clipboard with toast notification.
- **Rationale**: Meets requirement FR-008 and User Story 4 for seamless sharing with translation groups.

---

## 3. Best Practices & Design System Conformance

- UI adheres to `.agents/rules/design-system.md`:
  - Uses existing primitives: `Button`, `Badge`, `Seal`, `Kbd`, `EmptyState`.
  - Severity color coding aligned with design system:
    - Critical: `seal` / red tone
    - Major: `warning` / amber tone
    - Minor: `neutral` / parchment tone
    - Warning: `sky` / blue tone
  - Keyboard shortcuts integrated (e.g. `Alt+6` for Moderator Workspace tab).
  - Clear Vietnamese terminology and readable typography.
