# Phase 0: Research & Feasibility Analysis

**Feature**: `098-hako-quota-estimation-warning`  
**Date**: 2026-09-10

## 1. Gemini AI Call Ratio in `runAiQualityScan`

### Finding
Inspection of `src/services/hakoQualityEngine.ts` (lines 150–250) confirms:
- The quality engine loops sequentially through the provided chapters: `for (let idx = 0; idx < chapters.length; idx++)`.
- For each chapter, exactly one prompt is assembled containing literary guidelines and Vietnamese text (plus raw Chinese if available), and evaluated via `callGeminiDirect({ apiKeys, model, prompt, ... })`.
- There is no chapter chunking or multi-call splitting per chapter in the review pipeline.
- Therefore, exactly 1 Gemini API call is executed per chapter:
  $$\text{AI Calls} = N = \text{selectedChapterIds.length}$$

### Decision
Render the estimate as `"~N lượt gọi AI"` whenever $N > 0$. When $N = 0$, the annotation is omitted.

---

## 2. Quota & Health Status Inspection via `localQuotaTracker.ts`

### Finding
- `src/services/localQuotaTracker.ts` provides client-side, zero-network quota monitoring via:
  - `localQuotaTracker.getQuotaStatus(keys: string[])`: Returns `QuotaStatusResponse` containing `keys: KeyQuotaFullSnapshot[]`.
  - `localQuotaTracker.getKeyHealth(key: string)`: Returns `{ state, circuitBreaker, cooldownRemainingMs, transitionReason, isAvailable }`.
- In `KeyQuotaFullSnapshot`:
  - `healthState`: `'Healthy' | 'Degraded' | 'RateLimited' | 'QuotaExhausted' | 'AuthFailed' | 'Cooldown'`.
  - `runtime.isBlacklisted`: boolean (true if key is not available).
  - `requestsToday`: number of requests executed today in Los Angeles (PST) day boundary.
- If custom limits exist in `localStorage.getItem('gemini_quota_custom_limits')`, or default RPD limit (1500 calls/day), the remaining quota for a key can be estimated as `Math.max(0, maxRpd - requestsToday)`.
- If key is marked `QuotaExhausted` (or `AuthFailed`), remaining quota is 0.
- If no keys are configured, or if all configured keys have `healthState === 'QuotaExhausted'` or are unavailable, or if total available quota $< N$, an advisory situation exists.

### Decision
`HakoChapterSelector` will:
1. Accept an optional `apiKeys?: string[]` prop (maintaining backwards compatibility if not provided by falling back to `migrateAndLoadApiKeys()`).
2. Evaluate key health and remaining quota from `localQuotaTracker.getQuotaStatus(keys)`.
3. If $N > 0$ and any of the following holds:
   - Any configured key has `healthState === 'QuotaExhausted'`.
   - All configured keys are blacklisted or unavailable.
   - Total remaining estimated daily quota across available keys is less than $N$.
   - No API keys are detected.
   Show the advisory warning: `"Quota khả dụng có thể không đủ cho toàn bộ N chương đã chọn"`.

---

## 3. Non-Blocking CTA Contract

### Finding
- Reviewers may have keys that recover shortly or may want to proceed anyway with whatever quota is left.
- Blocking or disabling the start button based on quota estimation would disrupt moderator autonomy.

### Decision
- The CTA button disabled state remains STRICTLY: `isAnalyzing || selectedChapterIds.length === 0`.
- The warning is rendered visually distinct as an informational alert (`AlertTriangle` icon with amber tones), and the user can click "Bắt đầu kiểm định" without interruption.

---

## 4. Design System Compliance

### Finding
- Rule in `.agents/rules/design-system.md` prohibits arbitrary new color classes or red/rose outside `polish`.
- Pre-approved amber tokens:
  - Text: `text-amber-300`, `text-amber-400`
  - Background: `bg-amber-950/30`
  - Border: `border-amber-800/50`
  - Icon: `AlertTriangle` (`text-amber-400 w-3.5 h-3.5`)
- Shape: `rounded-[3px]` matching panels.
- Font: `font-sans` or `font-mono text-xs`.
