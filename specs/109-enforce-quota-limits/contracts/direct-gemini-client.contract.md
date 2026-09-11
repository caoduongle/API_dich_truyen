# Contract: Direct Gemini Client Pre-Call Key Selection

**Module**: `src/services/directGeminiClient.ts`

---

## 1. Storage Access Helper

```typescript
import { CustomLimit } from '../components/quota-panel/CustomLimitsPanel';

/**
 * Loads stored user custom limits from localStorage safely with fallback to defaults.
 */
export function getStoredCustomLimits(): Record<string, CustomLimit>;
```

---

## 2. Dispatch Function Pre-Call Guarantees

```typescript
export interface DirectGeminiRequestOptions {
  apiKeys: string[];
  model?: string;
  prompt: string;
  systemInstruction?: string;
  schema?: Record<string, any>;
  temperature?: number;
  startKeyIndex?: number;
  signal?: AbortSignal;
}

export async function callGeminiDirect(
  options: DirectGeminiRequestOptions
): Promise<DirectGeminiResponse>;
```

### Pre-Call Verification Workflow:

1. **Clean & Validate Keys**: Normalize non-empty API keys from `options.apiKeys`. If empty, throw immediately.
2. **Load Limits**: Retrieve `customLimits = getStoredCustomLimits()`.
3. **Filter Available Keys**:
   - Determine the active starting key index using `localQuotaTracker.findNextAvailableKeyIndex(rawKeys, startIdx, customLimits)`.
   - If `findNextAvailableKeyIndex` returns `-1`, all keys are unavailable. Throw `ALL_KEYS_EXHAUSTED` error immediately **without issuing any fetch request**.
4. **Execution Loop**:
   - Iterate over only eligible keys (or advance through keys verifying `getKeyHealth` before each attempt).
   - If an eligible key receives a runtime 429 / 503 / network failure from Google, record failure via `localQuotaTracker.recordFailure`.
   - Advance to the next eligible key.
5. **Non-Increment Invariant**:
   - Keys skipped prior to network dispatch MUST NOT have `recordProviderAttempt()` or `recordFailure()` invoked on them.
   - Their `errorsTotal` counter MUST NOT increase.
