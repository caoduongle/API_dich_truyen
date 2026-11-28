---

description: "Actionable, dependency-ordered task list for Feature 173: Cô lập Hạn mức theo Mô hình, Khôi phục Trạng thái Khóa & Minh bạch Nguyên nhân Cạn Quota"
---

# Tasks: Cô lập Hạn mức theo Mô hình, Khôi phục Trạng thái Khóa & Minh bạch Nguyên nhân Cạn Quota

**Input**: Design documents from `/specs/173-per-model-quota-key-recovery/`  
**Prerequisites**: [plan.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/173-per-model-quota-key-recovery/plan.md), [spec.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/173-per-model-quota-key-recovery/spec.md), [research.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/173-per-model-quota-key-recovery/research.md), [data-model.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/173-per-model-quota-key-recovery/data-model.md), [quota-recovery-contracts.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/173-per-model-quota-key-recovery/contracts/quota-recovery-contracts.md)

**Organization**: Tasks are grouped by user story (`US1`–`US4`) so each story can be implemented, tested, and verified independently while keeping strict MVC separation and zero mutations to `src/types.ts` or IndexedDB (`src/services/db.ts`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps task to its User Story phase (`US1`, `US2`, `US3`, `US4`); Setup, Foundational, and Polish phases omit story labels

---

## Phase 1: Setup & Shared Types/Reference Config

**Purpose**: Extend quota snapshot contracts and accurate model reference limits without altering core schemas (`src/types.ts`, `src/services/db.ts`)

- [X] T001 [P] Extend optional per-model health/diagnostic fields (`healthState?`, `circuitBreakerState?`, `cooldownRemainingMs?`, `transitionReason?`, `isLowUsageDailyExhaustion?`) on `ModelUsageStats` and `isLowUsageDailyExhaustion?` on `KeyRuntimeStatus` in `src/types/quota.ts`
- [X] T002 [P] Update Flash Lite preset reference limits (`defaultTpm: 250000`, `defaultRpd: 500`) and aligned Free Tier defaults in `src/config/models.ts`
- [X] T003 [P] Add `getModelReferenceLimits(modelId?: string): CustomLimit` helper (`15 RPM / 250K TPM / 500 RPD` for `*flash-lite*` and `*flash*`, `10 RPM / 250K TPM / 100 RPD` for `*pro*`, fallback to model `limits` / `DEFAULT_CUSTOM_LIMIT`) in `src/utils/modelRegistry.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core error classification & per-model storage state structures required before any user story can run cleanly

**⚠️ CRITICAL**: No user story work should begin until Phase 2 is complete

- [X] T004 [P] Extend `parseDurationTokenToMs` and `extractRetryDelayMs` in `src/services/gemini/geminiErrorClassifier.ts` to parse compound durations (`12h5m53.421929668s`, `2h30m`, `1h15s`, `45m10s`) and attach `recommendedCooldownMs: extractedRetryDelayMs ?? -1` on `QUOTA_EXHAUSTED_RPD` responses (`FR-006`)
- [X] T005 Extend `InternalModelStats` with per-model health fields (`healthState`, `circuitBreakerStatus`, `cooldownUntil`, `transitionReason`, `lastTransitionAt`, `consecutiveErrors`, `consecutiveSuccesses`, `consecutiveAmbiguous429`, `isLowUsageDailyExhaustion`), normalize all `byModel` keys via `normalizeModelId` (merging legacy duplicates on load), and reset per-model health/error flags on PST day rollover in both `loadFromStorage` and `getOrCreateModelStats` inside `src/services/localQuotaTracker.ts` (`FR-001`, `FR-011`)

**Checkpoint**: Foundation ready — `US1`–`US4` can now be implemented cleanly on top of normalized per-model state and compound retry delay parsing

---

## Phase 3: User Story 1 — Cô lập trạng thái hạn mức theo từng cặp (Khóa, Mô hình) (Priority: P1) 🎯 MVP

**Goal**: Cô lập hoàn toàn trạng thái giới hạn tốc độ/ngày (`RateLimited`, `Cooldown`, `Degraded`, `QuotaExhausted`) theo từng cặp `(Key, Model)` trong khi giữ `AuthFailed` (`401/403`) khóa toàn cục, giúp chuyển sang mô hình AI khác hoạt động ngay lập tức (`FR-001`, `FR-002`).

**Independent Test**: Đánh dấu Khóa #1 ở trạng thái `QuotaExhausted` trên `gemini-3.5-flash-lite`, sau đó gọi `getKeyHealth(..., { model: 'gemini-2.5-flash' })` và chạy luồng điều phối sang `gemini-2.5-flash` trên chính Khóa #1; xác nhận request gửi thành công, trong khi `AuthFailed` (`401/403`) vẫn chặn trên mọi model và dữ liệu `sessionStorage` cũ tải lên không bị mất bộ đếm (`SC-001`, `FR-011`).

### Implementation & Tests for User Story 1

- [X] T006 [US1] Add `model?: string` to `KeyHealthOptions` and update `recordSuccess`, `recordFailure`, `getKeyHealth`, `findNextAvailableKeyIndex` (using per-model `recentAttempts`/`recentTokens` for proactive gating and coldest-key ranking when `options.model` is set), `getPoolCooldownAnalysis`, and `getQuotaStatus(..., selectedModel?)` in `src/services/localQuotaTracker.ts`
- [X] T007 [P] [US1] Propagate `options?: KeyHealthOptions` (carrying `model`) across `initKeySchedule`, `isKeyAvailable`, `findNextKey`, `inspectKeyPoolCooldown`, and `buildAllKeysUnavailableError` in `src/services/gemini/geminiKeyScheduler.ts`
- [X] T008 [US1] Normalize `modelName` at the top of `executeLogicalGeminiCallWithRecovery` and include `model: modelName` in `keyHealthOptions` for all scheduling, retry, and pool cooldown inspection calls in `src/services/gemini/geminiClient.ts`
- [X] T009 [P] [US1] Pass `{ model: paramsRef.current.selectedModel }` into all 4 `localQuotaTracker.findNextAvailableKeyIndex(...)` call sites in `src/hooks/useTranslationProcess.ts`, and forward `selectedModel` (if available) to `localQuotaTracker.getQuotaStatus(...)` in `src/components/hako-checker/HakoChapterSelector.tsx`
- [X] T010 [P] [US1] Add optional `selectedModel?: string` option to `useModelObservability` in `src/hooks/useModelObservability.ts` (forwarding `selectedModel` to `localQuotaTracker.getQuotaStatus` and refreshing on model change) and pass `selectedModel` from `src/components/ApiSettings.tsx` and `src/components/QuotaPanel.tsx`
- [X] T011 [P] [US1] Add unit tests for cross-model isolation (`Model A` exhausted while `Model B` healthy, `AuthFailed` global across models, PST per-model reset, `byModel` key normalization, legacy `sessionStorage` migration) in `src/services/__tests__/localQuotaTracker.test.ts` and `src/services/gemini/__tests__/geminiClient.test.ts`

**Checkpoint**: User Story 1 is independently testable — switching models on an exhausted key works immediately without false cross-model blocks

---

## Phase 4: User Story 2 — Chống khóa oan theo ngày, minh bạch nguyên nhân & nút Mở khóa trực tiếp (Priority: P1)

**Goal**: Chặn đứng việc tự nâng cấp oan lỗi `429` mơ hồ (`MessageFallback_AmbiguousQuota`) thành `QuotaExhausted` sau lần lỗi thứ 2 liên tiếp khi chưa chạm ngưỡng ngày (`FR-009`), hiển thị lý do khóa + đếm ngược chính xác (`FR-003`, `FR-006`), và cung cấp nút **Mở khóa** / **Mở khóa tất cả** ngay trên Bảng điều khiển Quota với bảo vệ giới hạn tự đặt (`FR-004`, `FR-005`).

**Independent Test**: Mô phỏng khóa mới chạy `16/500` lượt nhận 2–3 lỗi `429` mơ hồ liên tiếp và xác minh khóa chỉ vào `RateLimited` tạm nghỉ ngắn (`50s -> 60s -> <= 120s`), không bị gắn `QuotaExhausted`; kiểm tra lỗi `12h5m53.421929668s` đếm ngược đúng giờ (`12g 5p`); bấm nút **Mở khóa** trên thẻ khóa bị khóa lỗi để đưa về `Hoạt động` ngay lập tức, đồng thời bảo toàn `requestsToday` khi khóa chạm `maxRpd` tự đặt (`SC-002`, `SC-003`).

### Implementation & Tests for User Story 2

- [X] T012 [US2] Update `recordFailure` in `src/services/localQuotaTracker.ts` to: (a) keep `MessageFallback_AmbiguousQuota` in bounded `RateLimited` cooldown (`50s -> 60s -> 120s`, capped at `MAX_AUTO_WAIT_COOLDOWN_MS`) whenever `effectiveRequestsToday < dailyReference` (using `customMaxRpd ?? getModelReferenceLimits(model).maxRpd`), never escalating to `QuotaExhausted`; (b) use valid provider long `retryDelay` (`60s < delay <= 48h`) for `cooldownUntil` before falling back to `getNextPstMidnight(now)`; and (c) set `isLowUsageDailyExhaustion = true` with diagnostic Vietnamese guidance when explicit `QUOTA_EXHAUSTED_RPD` occurs at `< 25%` of `dailyReference` (`FR-006`, `FR-009`)
- [X] T013 [US2] Implement `unlockKey(key, model?, options?)` and `unlockAllKeys(keys, model?, customLimits?, now?)` with immediate `flushToStorage` and `requestsToday` preservation in `src/services/localQuotaTracker.ts`, and expose `unlockKey` / `unlockAllKeys` actions on `useModelObservability` in `src/hooks/useModelObservability.ts` (`FR-004`, `FR-005`)
- [X] T014 [P] [US2] Extend `formatRemainingTime` in `src/components/quota-panel/CountdownBadge.tsx` to format durations `>= 60` minutes with hours and minutes (`Xg Yp`, e.g. `12g 5p`) (`FR-003`, `FR-006`)
- [X] T015 [US2] Update `src/components/quota-panel/KeyCardItem.tsx` to read `item.runtime?.isCustomLimitReached` exclusively from service state (removing View-side `item.requestsToday >= safeLimit.maxRpd` inference), display `keyModelStats` on `RPM/TPM/RPD` gauges, render the amber lock-reason callout strip with countdown, add the per-key **Mở khóa** `Button` with custom `maxRpd` guidance, and display per-model status badges in the `byModel` accordion (`FR-003`, `FR-004`, `FR-005`)
- [X] T016 [US2] Wire `onUnlockKey` and add the header **"Mở khóa tất cả"** `Button` (visible when `>= 1` key is locked on `selectedModel`) in `src/components/QuotaPanel.tsx`, adhering strictly to `.agents/rules/design-system.md`
- [X] T017 [P] [US2] Update the existing 2nd-ambiguous-429 test in `src/services/__tests__/rpmProactiveGateAndRecovery.test.ts` to assert bounded `RateLimited` backoff (`<= 120s`, never `QuotaExhausted` below daily ref), add compound duration parser tests (`12h5m53.421929668s`) in `src/services/gemini/__tests__/geminiErrorClassifier.test.ts`, and add unlock & reason-callout UI tests in `src/components/__tests__/QuotaPanelHealthBadges.test.ts`

**Checkpoint**: Both US1 and US2 work cleanly — ambiguous `429` errors never cause false daily lockouts and locked keys recover in 1 click

---

## Phase 5: User Story 3 — Chuẩn hóa ngưỡng tham chiếu mô hình & báo trạng thái sẵn sàng trước khi dịch (Priority: P1)

**Goal**: Hiển thị đúng hạn mức tham chiếu mặc định sát thực tế của mô hình đang chọn (`15 RPM / 250K TPM / 500 RPD` cho Flash Lite thay vì `1M TPM`) và tính đúng số khóa thực sự khả dụng trên model hiện tại ngay trên banner Bảng điều khiển Quota (`FR-007`, `FR-008`).

**Independent Test**: Chọn `gemini-3.5-flash-lite` khi chưa đặt custom limit, mở `QuotaPanel` & `CustomLimitsPanel` xác nhận hiển thị `250k` TPM / `500` RPD (`SC-004`), và xác nhận banner báo đúng `X / N key khả dụng` (hoặc cảnh báo `0 / N key khả dụng` kèm gợi ý chuyển model/mở khóa khi toàn bộ khóa cạn ngày trên model đó).

### Implementation & Tests for User Story 3

- [X] T018 [US3] Enhance `computeModelStatsSummary` in `src/utils/modelRegistry.ts` to compute `runtimeAvailableKeyCount` and `runtimeBlockedKeyCount` for `selectedModel` directly from `snapshotKeys` runtime availability (`FR-008`)
- [X] T019 [P] [US3] Use `getModelReferenceLimits(selectedModel)` as the uncustomized limit fallback in `src/components/QuotaPanel.tsx`, `src/components/quota-panel/KeyCardItem.tsx`, and `src/components/quota-panel/CustomLimitsPanel.tsx`, and render the runtime-aware `X / N key khả dụng` badge and actionable `0 / N` warning banner in `src/components/QuotaPanel.tsx` (`FR-007`, `FR-008`)
- [X] T020 [P] [US3] Add unit and UI tests verifying `getModelReferenceLimits` (`250K TPM / 500 RPD` for Flash Lite) and runtime-aware `computeModelStatsSummary` in `src/utils/__tests__/modelRegistry.test.ts` and `src/components/__tests__/QuotaPanelMetrics.test.ts`

**Checkpoint**: User Story 3 verified — UI gauges and availability banners accurately reflect the active model's real Free Tier limits and remaining usable keys

---

## Phase 6: User Story 4 — Giảm tiêu hao RPD từ chia nhỏ GĐ1 & kiểm chứng chẩn đoán cạn ngày thấp (Priority: P2)

**Goal**: Giảm các lượt gọi RPD bị nhân 2–3 lần ở GĐ1 do sai khác tách/gộp đoạn nhẹ trên chương dài khi bản dịch sạch chữ Hán, giữ tiêu đề và đủ độ dài (`FR-010`), đồng thời kiểm chứng chẩn đoán nguồn dùng ngoài khi gặp `per day` tường minh ở mức `< 25%` RPD.

**Independent Test**: Kiểm thử bản dịch GĐ1 sạch chữ Hán trên chương dài >= 12 đoạn (giữ đủ tiêu đề và độ dài >= 80%) bị lệch 2 đoạn so với nguồn xác nhận vượt qua `validateStrictStructureParity` an toàn không kích hoạt chia nhỏ cấp 1, trong khi bản dịch sót chữ Hán, hụt độ dài, hoặc mất tiêu đề vẫn bị chặn đúng quy trình (`SC-005`).

### Implementation & Tests for User Story 4

- [X] T021 [US4] Expand `canTolerateMinorVariance` in `src/services/translation/rawTranslation.ts` (`srcCount >= 12 && delta <= 2`, `srcCount >= 15 && delta <= Math.min(3, Math.floor(srcCount * 0.08))`) strictly gated on `countChineseCharacters(finalRawTranslation) === 0`, `length >= minHealthyLength`, and chapter title preservation (`isChapterTitleLine`) (`FR-010`)
- [X] T022 [P] [US4] Add regression tests for GĐ1 minor paragraph variance tolerance (including title preservation, Han-leftover rejection, and short-output rejection) in `src/services/translation/__tests__/rawTranslationSplitGuard.test.ts` and low-usage explicit `per day` diagnostic (`< 25%` RPD) in `src/services/__tests__/rpmProactiveGateAndRecovery.test.ts`

**Checkpoint**: User Story 4 verified — fewer wasted RPD splits in Phase 1 while keeping full content & title integrity

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: Final security audit (`SC-006`), schema immutability check, and full baseline quality gates

- [X] T023 Audit all modified messages/UI labels for zero raw API key leakage (`SC-006`), confirm `src/types.ts` and `src/services/db.ts` have zero diff, review `.agents/rules/design-system.md` compliance across `QuotaPanel`/`KeyCardItem`/`CustomLimitsPanel`/`CountdownBadge`, and execute `npm run lint`, `npm test`, and `npm run build` cleanly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: `T001`–`T003` have no dependencies and can run in parallel immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 (`T005` uses `getModelReferenceLimits` / updated `ModelUsageStats`); `T004` can run in parallel with Phase 1.
- **Phase 3 (`US1`, P1 — MVP)**: Depends on `T005`; enables per-model health isolation across tracker -> scheduler -> client -> hooks/UI.
- **Phase 4 (`US2`, P1)**: Depends on `T004` and `T005` (specifically `T012`–`T016` layer smoothly on top of `T006`/`T010` in `localQuotaTracker.ts` and `QuotaPanel.tsx`).
- **Phase 5 (`US3`, P1)**: Depends on `T003`, `T006` (`T018` uses per-model snapshot runtime state), and `T016` cleanly for `QuotaPanel.tsx`.
- **Phase 6 (`US4`, P2)**: `T021` is completely independent of UI/tracker tasks (only touches `src/services/translation/rawTranslation.ts`) and can start any time after Phase 2.
- **Phase 7 (Polish)**: Depends on all desired stories `T001`–`T022`.

### Parallel Opportunities

- **Within Phase 1**: `T001`, `T002`, `T003` modify distinct files -> execute in parallel.
- **Within Phase 2**: `T004` (`geminiErrorClassifier.ts`) runs in parallel with Phase 1 / `T005` (`localQuotaTracker.ts`).
- **Within US1**: After `T006`, `T007` (`geminiKeyScheduler.ts`), `T009` (`useTranslationProcess.ts`, `HakoChapterSelector.tsx`), and `T010` (`useModelObservability.ts`, `ApiSettings.tsx`) modify separate files and can run in parallel.
- **Within US2**: `T014` (`CountdownBadge.tsx`) and `T017` (classifier/recovery tests) can run in parallel with tracker unlock wiring.
- **Within US3 & US4**: `T019` UI limit defaults, `T020` metric tests, `T021` `rawTranslation.ts`, and `T022` split-guard tests touch disjoint files and execute cleanly in parallel.

---

## Parallel Example: User Story 1

```bash
# After T006 completes in src/services/localQuotaTracker.ts:
Task: "T007 Propagate options.model in src/services/gemini/geminiKeyScheduler.ts"
Task: "T009 Pass model to findNextAvailableKeyIndex & HakoChapterSelector in src/hooks/useTranslationProcess.ts and src/components/hako-checker/HakoChapterSelector.tsx"
Task: "T010 Pass selectedModel through useModelObservability in src/hooks/useModelObservability.ts"
```

---

## Implementation Strategy

### MVP First (Phase 1 + Phase 2 + US1 + Core US2 Anti-Lockout)

1. Complete **Phase 1** (`T001`–`T003`) and **Phase 2** (`T004`–`T005`).
2. Complete **Phase 3 (`US1`)** (`T006`–`T011`) to unblock cross-model fallback immediately.
3. Complete **Phase 4 (`US2`)** (`T012`–`T017`) to stop false daily quota lockouts on ambiguous `429`s and expose direct Unlock recovery buttons.
4. **STOP & VALIDATE**: Run targeted Vitest suites (`localQuotaTracker`, `geminiErrorClassifier`, `rpmProactiveGateAndRecovery`, `QuotaPanelHealthBadges`).

### Incremental Delivery

1. Deliver **Phase 5 (`US3`)** (`T018`–`T020`) for accurate `250K TPM / 500 RPD` gauges and model-aware availability banners.
2. Deliver **Phase 6 (`US4`)** (`T021`–`T022`) to curb Phase 1 minor paragraph split RPD waste.
3. Finish **Phase 7 (`T023`)** for security audit + full `npm run lint`, `npm test`, and `npm run build`.
