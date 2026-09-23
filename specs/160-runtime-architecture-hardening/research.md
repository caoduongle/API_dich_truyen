# Research & Technical Decisions: Runtime Architecture & Security Hardening

**Feature**: [Runtime Architecture & Security Hardening](spec.md)
**Branch**: `160-runtime-architecture-hardening`
**Date**: 2026-09-23

## 1. Nginx Security Headers & Multi-Platform Parity

### Problem
`render.yaml`, `vercel.json`, `public/_headers`, and `vite.config.ts` enforce strict browser protections (CSP, X-Frame-Options, MIME sniffing protection, COOP, CORP, Permissions-Policy, HSTS). However, `nginx/default.conf.template` only defined basic routing and omitted all security headers. This created an inconsistent security posture where containerized self-hosted deployments lacked protections against clickjacking, token leakage, and cross-site framing.

### Decision
1. Add standard `add_header ... always;` directives in `nginx/default.conf.template` matching all 8 security headers in `public/_headers` and `render.yaml`.
2. Expand `src/tests/cspParity.test.ts` to a Penta-Parity suite verifying byte-for-byte and AST equality across:
   - `render.yaml`
   - `vercel.json`
   - `public/_headers`
   - `vite.config.ts`
   - `nginx/default.conf.template`
3. Assert both CSP directives and non-CSP security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, `Referrer-Policy`) across all web configs.

### Alternatives Considered
- *Separate Nginx snippet file (`include security_headers.conf`)*: Adds unnecessary indirection and Docker COPY layer for a single template. Kept directly in `default.conf.template` to maintain simplicity and transparent CI verification.
- *Rely on reverse-proxy outside Docker*: Fails the "secure by default" principle for users running standard `docker run` or `docker-compose`.

---

## 2. Quota Sliding Window State Persistence Across Tab Reloads

### Problem
`LocalQuotaTracker` tracks request attempts in `keyStats.recentAttempts` and tokens in `keyStats.recentTokens` over a 60-second rolling window to compute RPM (requests per minute) and TPM (tokens per minute). However, `saveToStorage()` completely stripped `recentAttempts` and `recentTokens` before calling `sessionStorage.setItem()`, and `loadFromStorage()` reset both to `[]`. Consequently, reloading the tab wiped the 60-second history, resetting local counters to 0 and causing the scheduler to misjudge capacity and trigger upstream 429 errors.

### Decision
1. In `saveToStorage()`, preserve recent attempts and tokens filtered to `timestamp > now - 60_000` for each key and model.
2. In `loadFromStorage()`, deserialize and hydrate `recentAttempts` and `recentTokens`, pruning any records older than 60 seconds (or beyond current timestamp + 5000ms clock skew buffer).
3. Keep the payload compact: store only `{ timestamp }` and `{ timestamp, tokens }` arrays. With typical 15–30 requests/minute, the payload addition is < 1 KB, well within sessionStorage quotas.

### Alternatives Considered
- *Persist raw full event logs*: Unbounded growth risks exceeding storage quotas and slowing down serialization.
- *Bucketed ring buffer (e.g. 6 x 10s buckets)*: Loses fine-grained precision for exact 60s sliding window without significant storage advantage over compact timestamp arrays.

---

## 3. Asynchronous Quota Persistence Debouncing

### Problem
`saveToStorage()` was called synchronously on every API lifecycle event (`recordProviderAttempt`, `recordSuccess`, `recordRetry`, `recordFailure`, `recordLogicalStart`, `recordLogicalFailure`). In high-frequency bulk translation runs, repeatedly stringifying the entire stats map and calling synchronous `sessionStorage.setItem` created synchronous I/O in the translation hot path.

### Decision
1. Decouple in-memory state updates from disk/storage serialization using an internal dirty flag and a 300ms debounce timer (`scheduleSave`).
2. Implement `flushToStorage()` to immediately write pending state when required.
3. Attach window lifecycle listeners (`pagehide`, `visibilitychange` when hidden) to invoke `flushToStorage()` synchronously before the page is unloaded, ensuring zero lost metrics.

### Alternatives Considered
- *IndexedDB storage*: IndexedDB is asynchronous, but querying and restoring it during synchronous client initialization complicates cold start and doesn't provide cross-tab isolation like sessionStorage.
- *No persistence at all (in-memory only)*: Wipes metrics on tab reload, directly violating User Story 2.

---

## 4. Content Moderation / Safety Filter Error Classification & Key Rotation Prevention

### Problem
When Gemini rejects a prompt due to AI safety filters (`finishReason === 'SAFETY'`, `blockReason === 'SAFETY'`, or 400/403 safety rejection), `geminiClient.ts` caught the error and rotated to subsequent API keys. Because content blocks are deterministic prompt-level rejections, repeating the identical blocked prompt across alternative keys burned daily quotas (RPD) and rate limits (RPM) without any possibility of success.

### Decision
1. In `geminiErrorClassifier.ts`, enhance classification to identify `CONTENT_BLOCKED` from response candidates (`finishReason === 'SAFETY'`), prompt feedback (`blockReason === 'SAFETY'`), and error text. Mark `isRetryable: false`.
2. In `geminiClient.ts`, define a dedicated error class `GeminiRequestError` with explicit `category`, `code: 'CONTENT_BLOCKED'`, and `status`.
3. In `executeLogicalGeminiCall`, immediately detect `CONTENT_BLOCKED` and throw without rotating to subsequent keys or calling `localQuotaTracker.recordRetry()`.

### Alternatives Considered
- *Treat as bad request 400*: Lacks distinct UX messaging (users need to know the specific reason was content moderation rather than malformed syntax).
- *Continue rotating with temperature change*: Unlikely to bypass strict safety filters and still wastes user API quotas.

---

## 5. QA Critique Stale Issue Erasure on Successful Pass

### Problem
In `chapterTranslationService.ts`, the assignment `qaIssues: detectedQaIssues.length > 0 ? detectedQaIssues : chapter.qaIssues` caused a logic defect: when a subsequent QA critique ran successfully and found zero issues (`detectedQaIssues = []`), the ternary fell back to `chapter.qaIssues`, permanently retaining outdated errors even though the user had corrected the text.

### Decision
1. Track whether the QA critique execution completed successfully (`qaRunSucceeded = true`).
2. When QA is enabled and runs successfully, update chapter QA issues to `detectedQaIssues` (even if empty, representing a clean pass).
3. If QA was disabled or failed due to an exception (network/quota failure), preserve existing `chapter.qaIssues` to prevent accidental data loss.

### Alternatives Considered
- *Clear QA issues unconditionally before running*: If the QA call fails halfway due to a network glitch, user loses existing audit findings.
- *Remove QA critique entirely*: Undermines the 3-phase translation pipeline (Raw -> Polish -> QA critique).

---

## 6. Bounded Concurrency for Recursive Glossary Splitting

### Problem
In `directGlossaryEngine.ts`, when glossary extraction exceeded length limits or failed, `analyzeGlossaryWithContentSplitDirect` split text into parts and ran `await Promise.all(parts.map(...))`. All parts fired concurrently against the scheduler and shared the same `startKeyIndex`, triggering simultaneous requests against the same key and causing 429 rate limit spikes.

### Decision
1. Reuse the existing, battle-tested `mapWithConcurrencyLimit` utility from `src/lib/concurrency.ts`.
2. Cap concurrency at `limit = 2` for recursive splits.
3. Ensure results are collected in original chunk order.

### Alternatives Considered
- *Fully sequential execution (`for ... of`)*: Doubles or triples latency for multi-chunk extraction.
- *Concurrency limit of 4*: Too high for free-tier Gemini keys with 5–15 RPM limits. Concurrency 2 provides the optimal balance between throughput and safety.
