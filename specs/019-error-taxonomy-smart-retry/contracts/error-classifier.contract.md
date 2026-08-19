# Contract: Error Classifier & Smart Retry Normalization

## 1. Normalization Function Contract (`server/utils/errorClassifier.ts`)

```typescript
export function normalizeUpstreamError(
  err: unknown,
  redactKeys?: string[]
): AIErrorNormalized;

export function isRetryableError(err: unknown): boolean;
export function isSafetyOrEmptyError(err: unknown): boolean;
export function isOverloadError(err: unknown): boolean;
```

### Invariants
1. `normalizeUpstreamError(null | undefined)` always returns a structured `AIErrorNormalized` object with `code: AIErrorCode.SERVER_ERROR`.
2. 100% of API keys passed in `redactKeys` are masked in `message` and `details`.
3. If `recommendedAction === 'fail_immediately'`, `isRetryable` MUST be `false`.
4. If `code === AIErrorCode.OVERLOADED`, `httpStatus` is `503`, `isRetryable` is `true`, `recommendedAction` is `'retry'`.
5. If `code === AIErrorCode.AUTH_FAILED`, `httpStatus` is `401`, `isRetryable` is `false`, `recommendedAction` is `'disable_key'`.
