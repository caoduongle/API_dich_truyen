# Research & Architectural Decisions: Security & Reliability Hardening

**Feature**: [spec.md](./spec.md) | **Branch**: `154-security-reliability-hardening`

## Overview

This research document analyzes the technical problems identified in the codebase hardening review and establishes the architecture decisions for Phase 1 (Security & Correctness Hardening), setting clear foundations for subsequent Phase 2 (Architecture Decomposition) and Phase 3 (Quality Gates).

---

## 1. In-Memory Key Caching & Secret Heap Retention

### Decision
Eliminate plaintext API keys from long-lived module-level caches (`keyHashCache` in `src/utils/apiKeyHash.ts`). Compute SHA-256 digests synchronously on demand using `sha256Sync` without caching raw secrets as dictionary keys. Retain an empty/stub `keyHashCache` map export for interface backwards compatibility without populating plaintext keys.

### Rationale
- `sha256Sync` executes in under 0.05ms for standard API keys (~39 characters). The performance overhead of computing SHA-256 on demand during quota tracking or key lookup is negligible.
- Storing `keyHashCache.set(trimmed, digest)` kept raw API keys alive in the JavaScript V8 heap indefinitely, even after users removed keys from UI or destroyed the tab session.
- Removing raw key caching ensures zero secret retention in heap memory once the active credential reference is discarded.

### Alternatives Considered
- **LRU Cache with TTL**: Retains raw keys for a bounded time window. Rejected because computing SHA-256 is already microsecond-fast, making any secret caching an unnecessary security risk.
- **Bi-directional keyed WeakMap**: Requires object wrappers instead of primitive strings. Rejected as overly complex compared to stateless synchronous hashing.

---

## 2. Default Credential Storage Mode & Migration Policy

### Decision
Default `rememberKeys` to `false` across `useAIConfig.ts` and `KeyListSection.tsx`. Maintain keys strictly in `sessionStorage` by default. Preserve persistent storage in `localStorage['app_ui_prefs'].savedKeys` strictly when the user explicitly opts in (`rememberKeys: true`).

### Rationale
- Shared and public computers (libraries, internet cafes, shared office workstations) expose users to credential theft if keys are silently persisted across browser restarts.
- Changing `prefs?.rememberKeys !== false` to `prefs?.rememberKeys === true` guarantees that any fresh browser installation or unconfigured profile keeps secrets strictly within the active browser tab session (`sessionStorage`).
- Existing users with explicitly configured `rememberKeys: true` will have their preferences preserved without data loss.

### Alternatives Considered
- **Forced wipe of all localStorage credentials**: Would disrupt existing legitimate individual users who rely on saved keys on their private machines.
- **Master password encryption in localStorage**: Web Crypto subtle key derivation from user password. Considered for a future cryptographic enhancement, but out of scope for Phase 1 baseline hardening.

---

## 3. Model Catalog Discovery Timeout Deadline

### Decision
Enhance `listModelsDirect(apiKey: string, options?: { signal?: AbortSignal; timeoutMs?: number })` in `src/services/directGeminiClient.ts` with an internal `AbortController` enforcing a 15-second timeout (`15_000ms`).

### Rationale
- Network stalls or intermediate proxy hangs during `fetch("https://generativelanguage.googleapis.com/v1beta/models")` can leave the UI in an indefinite loading state without error reporting.
- A 15-second deadline ensures deterministic termination with a clear, user-friendly error message, matching specifications established across model discovery subsystems.
- Supporting both an optional caller-provided `signal` and an internal timer ensures clean cancellation if the user navigates away or closes the dialog.

### Alternatives Considered
- **Browser default fetch timeout**: Modern browsers often keep connections open for 60–120 seconds, leading to a degraded user experience.
- **Short 5-second timeout**: Too aggressive for cellular or congested mobile hotspot connections when downloading the full model catalog list.

---

## 4. Standardized Structured AI Response Parsing & Validation

### Decision
Implement `parseGeminiStructuredResponse<T>(text: string, validator?: (data: unknown) => data is T, fallback?: T): T` in `src/lib/text.ts`. Replace raw `JSON.parse(res.text)` in `directGeminiClient.ts` and `hakoQualityEngine.ts` with this robust parser.

### Rationale
- External AI responses may include unexpected markdown code fences (````json ... ````), conversational preambles, or truncated JSON.
- `safeParseJson` in `src/lib/text.ts` already handles markdown fences and balanced brace extraction. Wrapping it with type validation and fallback handling unifies parsing across quick terms, Hako QA, glossary extraction, and sentence rewriting.
- Raw `JSON.parse()` throws uncaught syntax errors that can freeze the review interface or abort translation batch processing.

### Alternatives Considered
- **Third-party schema validator (Zod)**: Adds external dependency weight violating Constitution Principle II (Dependency Minimization & Existing Library Reuse).
- **Ad-hoc regex extraction per call site**: Inconsistent and error-prone compared to a centralized parser.

---

## 5. Vite Build Configuration & Environment Scoping

### Decision
In `vite.config.ts`:
1. Use `mode === 'production'` instead of `process.env.NODE_ENV === 'production'` to govern esbuild console/debugger stripping.
2. Restrict environment variable ingestion using `loadEnv(mode, process.cwd(), 'VITE_')`.
3. Update `label` of `gemma-4-31b-it` in `src/config/models.ts` from `"Gemma 4 31B IT (Local)"` to `"Gemma 4 31B IT (API)"`.

### Rationale
- Vite's configuration function receives `{ mode }` as its first argument. Relying on `process.env.NODE_ENV` fails when builds run via custom modes (e.g. `vite build --mode staging`).
- Passing an empty prefix `''` to `loadEnv` loads all host environment variables into Vite's config object. Restricting to `'VITE_'` conforms to the principle of least privilege.
- Labeling a cloud-hosted Gemini model as "Local" misleads users into believing the model runs on on-device WebGPU/WASM.

---

## 6. Privacy & Security Documentation Synchronization

### Decision
Update `docs/privacy-policy.md` and `SECURITY.md` to reflect true data flow:
1. Clearly differentiate between **"Zero Application Backend"** and **"Zero External Transmission"**.
2. Explicitly disclose that manuscript source text is transmitted directly from the client browser to Google Gemini API via HTTPS when AI features are invoked.
3. Explicitly state that Google Drive sync communicates directly with Google servers.
4. Replace references to "Our servers log IP addresses" with "Static hosting platforms and CDNs may log standard HTTP access metadata".
