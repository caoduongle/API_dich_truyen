# Research: Enforce Personal Quota Limits & Smart Key Selection

**Feature**: `109-enforce-quota-limits`  
**Date**: 2026-09-11  

---

## 1. Research Topics & Key Decisions

### Decision 1: Authority & Storage Location for Personal Limits Enforcement
- **Question**: Where should custom limits (`maxRpd`, `maxRpm`, `maxTpm`) be validated, and how does the client access them during active translation loops?
- **Context**: Currently, `gemini_quota_custom_limits` is stored in browser `localStorage`. `QuotaPanel.tsx` and `CustomLimitsPanel.tsx` manipulate it, but `localQuotaTracker.ts` and `directGeminiClient.ts` do not inspect it during request execution.
- **Decision**: 
  1. Store/read `customLimits` from `localStorage` (`gemini_quota_custom_limits`) using a clean utility helper `getStoredCustomLimits(): Record<string, CustomLimit>`.
  2. Enhance `localQuotaTracker.ts` to support checking key availability against custom limits:
     ```typescript
     public getKeyHealth(
       key: string,
       now?: number,
       customLimit?: CustomLimit
     ): KeyHealthResult;
     ```
  3. When `stats.requestsToday >= (customLimit?.maxRpd ?? 1500)`, `getKeyHealth` marks the key as unavailable with reason `'Đã chạm ngưỡng giới hạn cá nhân trong ngày (Max RPD)'` and `healthState: 'QuotaExhausted'`.
- **Rationale**:
  - `localQuotaTracker` is the single source of truth for runtime quota tracking and key health in the Zero-Backend architecture.
  - Consolidating limit enforcement inside `localQuotaTracker` ensures that `directGeminiClient`, `HakoChapterSelector`, and `QuotaPanel` all share the exact same availability rules without code duplication.
- **Alternatives Considered**:
  - *Hardcoding limit checks inside `directGeminiClient.ts` only*: Rejected because UI panels and estimation warnings would fall out of sync with actual dispatch decisions.
  - *Moving `customLimits` into IndexedDB*: Unnecessary complexity; `localStorage` is already audited, fast, and synchronous, which is required during tight dispatch loops.

---

### Decision 2: Pre-Flight Health Inspection in `callGeminiDirect`
- **Question**: How should `callGeminiDirect` handle keys that are already known to be exhausted, rate-limited, or unauthorized?
- **Context**: In the current implementation ([`directGeminiClient.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/services/directGeminiClient.ts#L83-L130)), the dispatch loop blindly attempts candidate keys in sequence without checking `getKeyHealth`. When Key #1 was exhausted, it attempted Key #1 on every new logical request, resulting in 90 consecutive HTTP 429 failures and 91 retries before falling back to Key #2.
- **Decision**:
  1. Before making any `fetch()` call in `callGeminiDirect`, inspect candidate key availability using `localQuotaTracker.getKeyHealth(candidateKey, Date.now(), customLimits[hash])`.
  2. Filter the candidate list to find healthy/available keys.
  3. If starting at `startKeyIndex`, find the next available healthy key starting from that index.
  4. Bypassing an ineligible key does **not** call `localQuotaTracker.recordProviderAttempt()` or `recordFailure()`, does **not** increment `errorsTotal`, and does **not** increment `failedAttemptsToday`.
  5. If all configured keys are unavailable, throw `ALL_KEYS_EXHAUSTED` immediately without issuing any network request.
- **Rationale**:
  - Eliminates 100% of redundant failing network requests.
  - Reduces latency for the user (no waiting for a guaranteed 429 network response).
  - Keeps error statistics accurate: only true unexpected network/provider errors are counted as failures, not known exhausted keys.
- **Alternatives Considered**:
  - *Catching 429 and blacklisting the key for 1 hour*: Incomplete solution because Key #1 was already recognized as `QuotaExhausted` in `localQuotaTracker`, but the calling function simply ignored that state. Pre-checking is strictly superior.

---

### Decision 3: Smart Starting Index & Key Rotation Memory
- **Question**: When a translation batch processes sequential chapters or chunks, how should `startKeyIndex` be managed across calls?
- **Context**: In [`useTranslationProcess.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/hooks/useTranslationProcess.ts#L347-L355), `lastSuccessKeyIndex` was passed back, but in sub-stages (such as segment translation, glossary scanning, and multi-cycle polishing), sub-calls could revert to index 0 if not threaded properly.
- **Decision**:
  1. `directGeminiClient` will provide a helper function `resolveOptimalKeyIndex(keys, startIndex, customLimits)` to pick the first valid key starting from `startIndex`.
  2. `useTranslationProcess` and `chapterTranslationService` ensure that whenever a key succeeds or fails, the pointer advances to that active key for subsequent stages within the chapter.
- **Rationale**: Prevents bouncing back to exhausted keys between phase 1 (raw translation) and phase 2 (polishing).
- **Alternatives Considered**:
  - *Random key selection*: Undesirable because it makes quota distribution unpredictable and breaks deterministic testing. Sequential round-robin with health filtering is clean and predictable.

---

### Decision 4: UI Distinction between Personal Limit vs Provider 429
- **Question**: How should `QuotaPanel` and `KeyCardItem` present a key that has reached its personal limit versus a key that received an upstream Google 429?
- **Context**: In the user's screenshot, Key #1 shows "Hết hạn mức ngày" with "595 / 500" and "90 lỗi phát sinh". The user was confused because it looked like the key was broken or exceeded limits unexpectedly.
- **Decision**:
  1. In `KeyCardItem.tsx`, check if `requestsToday >= safeLimit.maxRpd` while `healthState === 'QuotaExhausted'` and reason contains "cá nhân".
  2. Display a specific badge: "Đạt ngưỡng ngày" or "Hết hạn mức ngày (Cá nhân)" with neutral/warning tone, clearly indicating that the stop is due to user configuration.
  3. Add tooltip explaining: "Đã đạt giới hạn tối đa người dùng tự đặt trong ngày (Max RPD: X). Sẽ tự phục hồi lúc 00:00 PST hoặc khi tăng giới hạn."
- **Rationale**: Provides immediate reassurance to the user that the system is behaving as commanded.
- **Alternatives Considered**:
  - *Keeping the exact same "Hết hạn mức ngày" badge*: Leaves user guessing whether Google cut them off or their own setting did. Clear distinction enhances UX.

---

## 2. Best Practices & Quality Alignment

- **Constitution Principle I (Strict Quality Gates)**:
  - All modifications must pass `npm run lint` (`tsc --noEmit`), `npm test` (`vitest run`), and `npm run build`.
  - Comprehensive unit tests must be added to verify that `callGeminiDirect` skips exhausted keys with 0 HTTP calls.
- **Constitution Principle II (Dependency Minimization)**:
  - No new libraries added; uses existing `localStorage`, `localQuotaTracker`, and standard TypeScript primitives.
- **Constitution Principle III (Strict Concern Separation)**:
  - Quota accounting remains inside `src/services/localQuotaTracker.ts` and `src/services/directGeminiClient.ts`.
  - UI components in `src/components/quota-panel/` only consume the computed health/limit states.
