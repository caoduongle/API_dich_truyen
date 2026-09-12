# Research: AI Configuration Modal Performance & API Key Lifecycle

**Feature**: `118-fix-api-key-config-lag`  
**Date**: 2026-09-12  
**Status**: Completed  

---

## 1. Root Cause Analysis: Severe Lag on Modal Open & Key Typing

### Problem
- Whenever the AI configuration modal is open, typing an API key character-by-character suffers from extreme UI freezing, dropped characters, and unresponsive inputs.
- Rapid typing often results in characters being skipped or dropped entirely ("nhập API key vào thì nhiều lúc còn không nhận").

### Findings
1. **Application-Wide Render Storm**:
   - `apiKeys` state is managed at the root in `useAIConfig` (`AIConfigProvider`).
   - `AppShell` and `TabContent` subscribe to `useAIConfigContext()`.
   - On every keystroke, `onUpdateKeyIndex(idx, val)` triggers `setApiKeys([...updated])`.
   - This re-renders `AppShell`, `TabContent`, and any active/visited workspaces (e.g., `TranslatorWorkspace`, chapter editors with thousands of lines, and glossary sidebars).
2. **Network Request Spam During Typing**:
   - In `useModelDiscovery.ts`, `refresh` has `apiKeys` in its dependency array.
   - When `apiKeys` reference changes on each keystroke, the `useEffect` fires if discovery cache is stale or uninitialized.
   - This calls `fetchFn` -> `listModelsDirect(key)` using whatever partial key is currently typed (e.g., `A`, `AI`, `AIzaSy...`).
   - The network request immediately fails or hangs, toggles `isRefreshing`, and blocks the browser main thread with fetch microtasks, freezing the input field and dropping user keystrokes.
3. **Duplicate Quota Tracker Evaluations**:
   - `ApiSettings.tsx` calls `useModelObservability(apiKeys)`.
   - Inside `QuotaPanel.tsx`, line 59 unconditionally calls `useModelObservability(apiKeys)` again, meaning when QuotaPanel renders, quota calculations and local storage lookups run twice simultaneously.

### Decision
1. **Local Buffered State for Key Inputs**:
   - `KeyListSection` will maintain local draft key state. Typing updates local input state at 60 FPS without touching parent context.
   - Debounce sync to `useAIConfig` (300ms) or commit on `blur`/paste/submit.
2. **Key Validation Guard in Model Discovery**:
   - In `useModelDiscovery`, never trigger background model discovery if the keys are incomplete (e.g., length < 20 or matching incomplete patterns).
   - Only trigger discovery on stabilized, sanitized keys.
3. **Memoized Key Array Equality**:
   - In `useAIConfig`, avoid recreating `apiKeys` array reference if the sanitized values haven't actually changed.

---

## 2. Root Cause Analysis: "Mặc dù có API key rồi mà vẫn báo không có cái nào"

### Problem
- Users configure 2 valid keys (as seen in the screenshot header: "Đã cấu hình 2 key"), yet the UI displays contradictory messages:
  - Badge says "Chưa kiểm tra key".
  - Warning banner says: "Model đang chọn hiện không có API key nào hỗ trợ."
  - Or upon reopening the app later, all keys have vanished and the Quota tab says "Chưa có API key nào".

### Findings
1. **False Incompatibility Warning in `ModelSummaryCard.tsx`**:
   - `computeModelStatsSummary` computes `hasChecked = checkedKeyCount > 0` and `isUnavailable = hasChecked && availableKeyCount === 0`.
   - In `inspectResults`, keys are only populated if the user navigates to the Quota tab and clicks "Kiểm tra model hỗ trợ" for individual keys.
   - If one key was inspected and did not return the selected model, or if model names don't match exactly, `availableKeyCount` is 0 while `checkedKeyCount` is > 0, triggering `isUnavailable = true`.
   - When `isUnavailable` is true, line 120 renders:
     `Model đang chọn hiện không có API key nào hỗ trợ.`
   - For preset models (e.g. Gemini 2.5 Flash, Gemini 3.1 Flash Lite), they are globally supported by Google Gemini API keys by default. Displaying "0 key hỗ trợ" or "không có API key nào hỗ trợ" when keys are simply uninspected is a severe UX bug.
2. **Session Storage Volatility**:
   - In `useAIConfig.ts`, keys are stored exclusively in `sessionStorage` and actively removed from `localStorage`.
   - When users close the tab/browser and return, `sessionStorage` is empty. The user is confused because they had previously entered keys, but the app now reports no keys.

### Decision
1. **Fix Model Availability Assessment**:
   - In `computeModelStatsSummary` and `ModelSummaryCard.tsx`:
     - Preset models (status !== 'shutdown') must be treated as supported by default when valid keys are present (`availableKeyCount = totalKeys` for presets unless explicitly proven invalid by a live 404/NOT_FOUND call).
     - Never show the amber banner "Model đang chọn hiện không có API key nào hỗ trợ" if keys have not been explicitly inspected for that specific model.
     - Change "Chưa kiểm tra key" to a more informative status: "Sẵn sàng sử dụng" (Ready for presets) or display verified badge.
2. **Provide One-Click Key Validation**:
   - In `KeyListSection`, add a lightweight "Kiểm tra kết nối" (Test Connection) action for each key.
   - Calling `verifyModelDirect` on demand immediately updates key health status to "Đã xác minh" or reports the exact error if invalid.
3. **Reliable Storage Options**:
   - Keep `sessionStorage` default for strict ephemeral security, while providing an explicit user option "Ghi nhớ khóa trên thiết bị này" (Remember on this device) stored securely, ensuring compatibility with all `storageAudit.test.ts` and `credentialStorage.test.ts` rules.

---

## 3. Technology Choices & Best Practices

| Area | Choice | Rationale | Alternatives Considered |
|---|---|---|---|
| Input State Management | Local state with debounced sync (300ms) | Guarantees 60 FPS typing latency (< 16ms), eliminates input locking and dropped characters | Uncontrolled inputs (harder to validate), Direct global update (causes render storm) |
| Discovery Guard | Minimum length threshold (>= 25 chars) & debounced key dependency | Prevents firing HTTP requests while typing incomplete keys | Disabling discovery entirely (breaks model auto-discovery) |
| Model Availability Display | Default presumed compatibility for presets | Standard Gemini models are universally supported by valid Gemini keys | Requiring full inspection before allowing translation (slow and unnecessary) |
| Key Verification | On-demand lightweight ping (`verifyModelDirect`) | Direct user control, instant feedback without blocking dialog open | Automatic verification of all keys on mount (causes network burst and lag) |
