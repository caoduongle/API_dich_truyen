# Quickstart & Validation Guide: Feature 173 Quota Isolation & Key Recovery

**Feature**: `173-per-model-quota-key-recovery`  
**Artifacts**: [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/173-per-model-quota-key-recovery/spec.md) | [data-model.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/173-per-model-quota-key-recovery/data-model.md) | [quota-recovery-contracts.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/173-per-model-quota-key-recovery/contracts/quota-recovery-contracts.md)

---

## 1. Prerequisites

- Node.js / npm environment already configured (`npm ci` if `node_modules` out of sync).
- Baseline verification commands:
  - Typecheck: `npm run lint` (`tsc --noEmit`)
  - Unit & UI test suite: `npm test` (`vitest run`)
  - Production build: `npm run build` (`tsc && vite build`)

---

## 2. End-to-End Validation Scenarios

### Scenario 1 — Cross-Model Isolation (`US1`, `SC-001`)
1. Record a `429 RESOURCE_EXHAUSTED` with explicit `per day` message on `Key #1` for model `gemini-3.5-flash-lite`.
2. Verify `getKeyHealth(key1, now, undefined, { model: 'gemini-3.5-flash-lite' })` returns `isAvailable: false`, `state: 'QuotaExhausted'`.
3. Verify `getKeyHealth(key1, now, undefined, { model: 'gemini-2.5-flash' })` returns `isAvailable: true`, `state: 'Healthy'`.
4. Call Gemini client orchestration targeting `gemini-2.5-flash` using `[key1]` and verify the request dispatches cleanly on the next call without being blocked.
5. Verify `401/403` `AuthFailed` still blocks `key1` across all models.

### Scenario 2 — No False Daily Lockouts on Ambiguous `429` (`US2`, `US4`, `FR-009`, `SC-003`)
1. Record `16` successful calls today for `Key #1` on `gemini-3.5-flash-lite` (well below `500` RPD).
2. Send 2 consecutive ambiguous `429` errors (`Quota exceeded`, no `per day` / `RPD` token).
3. Verify `Key #1` enters `RateLimited` with bounded short cooldown (`>= 60s` on 2nd failure, capped `<= 120s` on 3rd+) and **never** transitions to `QuotaExhausted`.
4. Advance mock clock past cooldown and confirm `Key #1` becomes recoverable (`HalfOpen` -> `Healthy` after successes).
5. Send an explicit `per day` `429` while `requestsToday = 16` (`< 25%` of 500) and verify `isLowUsageDailyExhaustion === true` and diagnostic message advises checking external usage / shared project.

### Scenario 3 — Accurate Long `retryDelay` & Manual Unlock (`FR-003`, `FR-004`, `FR-005`, `FR-006`, `SC-002`)
1. Classify an error with `Please retry in 12h5m53.421929668s.` and daily quota metadata; verify `cooldownUntil` matches `now + extractedDelayMs` (~12h5m54s).
2. In `QuotaPanel`, verify the locked card renders the Vietnamese reason callout + remaining cooldown + **Mở khóa** button (and header renders **Mở khóa tất cả**).
3. Click **Mở khóa** on an error-locked key (`16/500`) and verify the card immediately flips to `Hoạt động` and persists across `sessionStorage` reload.
4. Click **Mở khóa** on a custom-limit-capped key (`510/500` with `maxRpd = 500`) and verify `requestsToday` stays `510` while UI clearly guides raising `Max RPD` in `Ngưỡng cá nhân`.

### Scenario 4 — Accurate Reference Limits & GĐ1 RPD Conservation (`US3`, `US4`, `FR-007`, `FR-008`, `FR-010`, `SC-004`, `SC-005`)
1. Open `QuotaPanel` with `selectedModel = 'gemini-3.5-flash-lite'` and no custom limits saved; verify `TPM (60s)` shows `/ 250k` (not `/ 1M`) and `Lượt gọi API Hôm nay` shows `/ 500`.
2. When all keys are `QuotaExhausted` on the active model, verify the banner shows `0 / N key khả dụng` and displays the actionable alert suggesting switching models or unlocking.
3. Run GĐ1 raw translation validation on a clean 14-paragraph Chinese chapter (0 leftover Han characters, full length >= 80%, chapter title preserved) whose output varies by 2 merged/split paragraphs; verify `validateStrictStructureParity` tolerance prevents an unnecessary divide-and-conquer split retry (`RPD` saved).

---

## 3. Quality Gate Execution

After implementation tasks complete, run sequentially and verify exit code `0` on all three:

```bash
npm run lint && npm test && npm run build
```
