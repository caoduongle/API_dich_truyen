---
description: "Task list for Feature 168: RPM Cooldown Wait & Bulk Glossary Scan Recovery"
---

# Tasks: Chá» Phá»¥c Há»“i Háº¡n Má»©c Táº¡m Thá»i (RPM Cooldown) & Tá»± Äá»™ng Tiáº¿p Tá»¥c Khi QuÃ©t Thuáº­t Ngá»¯ / Xá»­ LÃ½ HÃ ng Loáº¡t

**Input**: Design documents from `/specs/168-rate-limit-cooldown-wait-recovery/`  
**Prerequisites**: [plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/168-rate-limit-cooldown-wait-recovery/plan.md), [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/168-rate-limit-cooldown-wait-recovery/spec.md), [research.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/168-rate-limit-cooldown-wait-recovery/research.md), [data-model.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/168-rate-limit-cooldown-wait-recovery/data-model.md), [rate-limit-recovery-contracts.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/168-rate-limit-cooldown-wait-recovery/contracts/rate-limit-recovery-contracts.md), [quickstart.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/168-rate-limit-cooldown-wait-recovery/quickstart.md)

**Organization**: CÃ¡c tÃ¡c vá»¥ chia theo User Story (`US1`â€“`US3`), tÃ­ch há»£p sáºµn 6 chá»‘t an toÃ n tá»« láº§n rÃ  soÃ¡t kiáº¿n trÃºc (abort tá»©c thÃ¬ khi báº¥m Dá»«ng, truyá»n HTTP header `Retry-After`, vÃ²ng `while` retry ná»™i bá»™ khÃ´ng nhiá»…u log, giá»¯ nguyÃªn giÃ¡ trá»‹ tráº£ vá» cá»§a `getDynamicPacingInterval`, giá»¯ `callGemini` khÃ´ng sleep ngáº§m Ä‘á»ƒ báº£o toÃ n test cÅ©, vÃ  test hook tháº­t báº±ng `jsdom` + fake timers).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: CÃ³ thá»ƒ cháº¡y song song (khÃ¡c tá»‡p, khÃ´ng phá»¥ thuá»™c tÃ¡c vá»¥ chÆ°a hoÃ n thÃ nh)
- **[Story]**: Ãnh xáº¡ tá»›i User Story tÆ°Æ¡ng á»©ng (`[US1]`, `[US2]`, `[US3]`)

---

## Phase 1: Setup & Shared Recovery Constants

**Purpose**: Khai bÃ¡o ngÆ°á»¡ng há»“i phá»¥c RPM vÃ  má»Ÿ rá»™ng kiá»ƒu lá»—i dá»‹ch vá»¥ ná»™i bá»™ (khÃ´ng cháº¡m `src/types.ts` vÃ  schema DB)

- [X] T001 Add `RATE_LIMIT_RECOVERY_CONFIG` (`MAX_AUTO_WAIT_COOLDOWN_MS = 120_000`, `MAX_COOLDOWN_WAITS_PER_CHAPTER = 2`, `RETRY_DELAY_SAFETY_BUFFER_MS = 1_500`) in `src/config/constants.ts`
- [X] T002 [P] Add optional readonly `retryAfterMs?: number` property and constructor option to `GeminiRequestError` in `src/services/gemini/types.ts`

---

## Phase 2: User Story 1 - PhÃ¢n biá»‡t RPM vs. RPD, trÃ­ch xuáº¥t `retryDelay` & phÃ¢n tÃ­ch há»“i phá»¥c Pool KhÃ³a (Priority: P1) ðŸŽ¯ MVP

**Goal**: PhÃ¢n loáº¡i chÃ­nh xÃ¡c lá»—i 429 gÃ³i Free Tier 15 RPM (kÃ¨m `Please retry in 36.58s`, `RetryInfo`, `Retry-After`) thÃ nh `RATE_LIMIT_RPM` vá»›i thá»i gian cooldown Ä‘á»™ng thay vÃ¬ khÃ³a cá»©ng `QuotaExhausted` tá»›i ná»­a Ä‘Ãªm PST, vÃ  gáº¯n `retryAfterMs` lÃªn lá»—i khi toÃ n bá»™ pool chá»‰ Ä‘ang táº¡m nghá»‰ ngáº¯n háº¡n.

**Independent Test**: MÃ´ phá»ng payload lá»—i 429 thá»±c táº¿ cá»§a Google (`generate_content_free_tier_requests`, `limit: 15`, `Please retry in 36.580235449s`) Ä‘i qua `classifyGeminiError`, `localQuotaTracker.recordFailure`, `getPoolCooldownAnalysis` vÃ  `callGemini`; xÃ¡c nháº­n tráº¡ng thÃ¡i lÃ  `RateLimited` (~38s) vÃ  `GeminiRequestError` tráº£ vá» `category: 'RATE_LIMIT_RPM'`, `isRetryable: true`, `retryAfterMs > 0` trong khi lá»—i RPD ngÃ y váº«n giá»¯ `QUOTA_EXHAUSTED_RPD`, `isRetryable: false`.

### Implementation for User Story 1

- [X] T003 [US1] Implement `extractRetryDelayMs(message, details, retryAfterHeader)` and update `classifyGeminiError(httpStatus, responseBody, rawError, retryAfterHeader)` to prioritize RPM/per-minute/`retryDelay` detection over generic `quota` fallback while preserving RPD classification in `src/services/gemini/geminiErrorClassifier.ts`
- [X] T004 [US1] Update `LocalQuotaTracker.recordFailure` to accept optional `retryAfterMs?: number` and apply dynamic `recommendedCooldownMs` for `RateLimited`/`Cooldown`, and implement `getPoolCooldownAnalysis(keys, customLimits, now)` returning `PoolCooldownAnalysis` in `src/services/localQuotaTracker.ts`
- [X] T005 [US1] Update `initKeySchedule` (and export `inspectKeyPoolCooldown`) to throw `GeminiRequestError` with `category: 'RATE_LIMIT_RPM'`, `isRetryable: true`, and `retryAfterMs` when all keys are temporarily in recoverable cooldown (`<= MAX_AUTO_WAIT_COOLDOWN_MS`), or `QUOTA_EXHAUSTED_RPD` when permanently exhausted in `src/services/gemini/geminiKeyScheduler.ts`
- [X] T006 [US1] Pass `response.headers?.get?.('retry-after')` to `classifyGeminiError`, forward `retryAfterMs` into `localQuotaTracker.recordFailure`, and use `getPoolCooldownAnalysis` when emitting `ALL_KEYS_EXHAUSTED` (keeping `callGemini` non-sleeping for existing test compatibility) in `src/services/gemini/geminiClient.ts`

### Tests for User Story 1

- [X] T007 [P] [US1] Add unit tests for `extractRetryDelayMs` and `classifyGeminiError` covering Google Free Tier 15 RPM (`36.580235449s`), `RetryInfo`, HTTP `Retry-After` header, and RPD vs RPM separation in `src/services/gemini/__tests__/geminiErrorClassifier.test.ts`
- [X] T008 [P] [US1] Add unit tests for dynamic `cooldownUntil`, `getPoolCooldownAnalysis`, and recoverable `RATE_LIMIT_RPM` vs terminal `QUOTA_EXHAUSTED_RPD` errors in `src/services/__tests__/localQuotaTracker.test.ts`, `src/services/gemini/__tests__/geminiKeyScheduler.test.ts`, and `src/services/gemini/__tests__/geminiClient.test.ts`

**Checkpoint**: User Story 1 hoÃ n chá»‰nh vÃ  kiá»ƒm thá»­ Ä‘á»™c láº­p á»Ÿ táº§ng service Gemini & Quota Tracker.

---

## Phase 3: User Story 2 & User Story 3 - Chá» há»“i phá»¥c an toÃ n, thá»­ láº¡i Ä‘Ãºng chÆ°Æ¡ng, giÃ£n nhá»‹p & dá»«ng sáº¡ch trong `useGlossaryScan` (Priority: P1/P2)

**Goal**: Luá»“ng quÃ©t thuáº­t ngá»¯ sá»‰ tá»± Ä‘á»™ng chá» háº¿t thá»i gian há»“i phá»¥c RPM rá»“i quÃ©t tiáº¿p Ä‘Ãºng chÆ°Æ¡ng Ä‘ang dá»Ÿ (khÃ´ng bá» qua 28 chÆ°Æ¡ng phÃ­a sau), giÃ£n nhá»‹p chá»§ Ä‘á»™ng trÃ¡nh cháº¡m tráº§n 15 RPM, há»§y tá»©c thÃ¬ (< 500ms) khi ngÆ°á»i dÃ¹ng báº¥m Dá»«ng, vÃ  dá»«ng ngay láº­p tá»©c (lÆ°u toÃ n bá»™ chÆ°Æ¡ng cÃ²n láº¡i vÃ o `failedIds`, khÃ´ng in `"ÄÃƒ HOÃ€N Táº¤T THÃ€NH CÃ”NG"` sai) khi háº¿t háº¡n má»©c thá»±c sá»±.

**Independent Test**: Cháº¡y `useGlossaryScan` trong mÃ´i trÆ°á»ng `jsdom` vá»›i fake timers: (1) chÆ°Æ¡ng 2/4 gáº·p `RATE_LIMIT_RPM` vá»›i `retryAfterMs: 38000` â†’ log táº¡m chá», Ä‘á»£i xong quÃ©t thÃ nh cÃ´ng Ä‘á»§ 4/4 chÆ°Æ¡ng; (2) chÆ°Æ¡ng 2/4 gáº·p `QUOTA_EXHAUSTED_RPD` â†’ dá»«ng ngay táº¡i chÆ°Æ¡ng 2 (0 láº§n gá»i chÆ°Æ¡ng 3â€“4, khÃ´ng cháº¡y VÃ²ng 2), lÆ°u chÆ°Æ¡ng 2â€“4 vÃ o `failedIds` vÃ  log dá»«ng do háº¿t háº¡n má»©c; (3) báº¥m Dá»«ng trong lÃºc Ä‘ang chá» 38s â†’ há»§y ngay láº­p tá»©c.

### Implementation for User Stories 2 & 3

- [X] T009 [US2] Add abort-safe `waitForCooldownWithAbort(waitMs, signal)` helper and update `handleAutoExtractGlossary` Stop handler to call `abortControllerRef.current?.abort()` for immediate cancellation during cooldown/pacing waits in `src/hooks/useGlossaryScan.ts`
- [X] T010 [US2] Implement inner per-chapter RPM cooldown wait & retry loop (`MAX_COOLDOWN_WAITS_PER_CHAPTER = 2`, `<= MAX_AUTO_WAIT_COOLDOWN_MS`), proactive abortable inter-chapter pacing scaled by available key count (without mutating `getDynamicPacingInterval`), and `newlyFailedIds` cleanup on retry success in `src/hooks/useGlossaryScan.ts`
- [X] T011 [US3] Fix terminal `ALL_KEYS_EXHAUSTED` detection (`err?.code === 'ALL_KEYS_EXHAUSTED'` and message check), break both chapter and `extractionLoops` loops immediately, persist all remaining uncompleted chapters (`scopedChaps.slice(i)`) into `glossaryScanQueueState.failedIds`, and log distinct waiting vs quota-stopped statuses (never false success banner) in `src/hooks/useGlossaryScan.ts`

### Tests for User Stories 2 & 3

- [X] T012 [US2] Expand `src/hooks/__tests__/useGlossaryScan.test.ts` using `jsdom` + `createRoot` + `act` + `vi.useFakeTimers()` verifying RPM cooldown wait & same-chapter resume, terminal RPD immediate halt with remaining chapters saved in `failedIds`, and immediate Stop abort during cooldown

**Checkpoint**: ToÃ n bá»™ 3 User Story (`US1`â€“`US3`) hoáº¡t Ä‘á»™ng Ä‘á»“ng bá»™ tá»« phÃ¢n loáº¡i lá»—i Ä‘áº¿n vÃ²ng láº·p quÃ©t thuáº­t ngá»¯ hÃ ng loáº¡t.

---

## Phase 4: Polish & Cross-Cutting Verification

**Purpose**: Äáº£m báº£o khÃ´ng gÃ¢y há»“i quy cho báº¥t ká»³ caller hay test nÃ o khÃ¡c vÃ  xÃ¡c nháº­n Ä‘á»§ 3 cá»•ng cháº¥t lÆ°á»£ng báº¯t buá»™c

- [X] T013 [P] Run targeted regression suites (`geminiErrorClassifier.test.ts`, `localQuotaTracker.test.ts`, `geminiKeyScheduler.test.ts`, `geminiClient.test.ts`, `useGlossaryScan.test.ts`, `modelRegistry.test.ts`, `ApiSettingsModelFlow.test.ts`)
- [X] T014 Run full mandatory quality gates (`npm run lint`, `npm test`, `npm run build`) and confirm exit code `0`
- [X] T015 Review `git status -s` and `git diff --stat` confirming `src/types.ts` and IndexedDB schema are untouched, and validate against `specs/168-rate-limit-cooldown-wait-recovery/quickstart.md`

---

## Dependencies & Execution Order

- **Phase 1 (`T001`â€“`T002`)**: KhÃ´ng phá»¥ thuá»™c â€” cÃ³ thá»ƒ cháº¡y song song ngay.
- **Phase 2 (`T003`â€“`T008`, US1 MVP)**: `T003` â†’ `T004` â†’ `T005` â†’ `T006`; sau Ä‘Ã³ `T007` vÃ  `T008` cháº¡y song song.
- **Phase 3 (`T009`â€“`T012`, US2 & US3)**: Phá»¥ thuá»™c Phase 2 (`T009` â†’ `T010` â†’ `T011` tuáº§n tá»± trÃªn `useGlossaryScan.ts`, sau Ä‘Ã³ `T012`).
- **Phase 4 (`T013`â€“`T015`)**: Cháº¡y sau khi hoÃ n táº¥t Phase 3.

### Parallel Opportunities

```text
T001 (src/config/constants.ts) || T002 (src/services/gemini/types.ts)
T007 (geminiErrorClassifier.test.ts) || T008 (localQuotaTracker/geminiKeyScheduler/geminiClient tests)
```

## Implementation Strategy

- **MVP First**: HoÃ n táº¥t Phase 1 + Phase 2 (`T001`â€“`T008`) Ä‘á»ƒ sá»­a gá»‘c rá»… phÃ¢n loáº¡i sai 15 RPM thÃ nh RPD vÃ  tráº£ vá» `retryAfterMs`.
- **Full Recovery**: HoÃ n táº¥t Phase 3 (`T009`â€“`T012`) Ä‘á»ƒ `useGlossaryScan` tá»± chá» há»“i phá»¥c, tiáº¿p tá»¥c Ä‘Ãºng chÆ°Æ¡ng dá»Ÿ vÃ  dá»«ng sáº¡ch khi háº¿t háº¡n má»©c tháº­t.
- **Verification**: Cháº¡y trá»n bá»™ `T013`â€“`T015` trÆ°á»›c khi káº¿t thÃºc.
