# Quickstart: Error Taxonomy & Smart Retry Engine

## 1. Test Verification

```bash
# 1. Type check
npm run lint

# 2. Test suite run (covers all 12 error taxonomy categories and smart retry decisions)
npm test

# 3. Production bundle build
npm run build
```

---

## 2. Validation Scenarios

### Scenario 1: All 12 Categories Normalization
- Test normalization for each enum in `AIErrorCode`.
- Verify `isRetryable`, `recommendedAction`, and `httpStatus` match contract table.

### Scenario 2: Smart Retry on Overloaded (503)
- Trigger 503 Overloaded error.
- Verify exponential backoff is applied on the current key up to `MAX_OVERLOAD_RETRIES`, then rotates to the next key.

### Scenario 3: Fast Fail on Safety / ModelNotFound
- Trigger Safety blocked or Model not found error.
- Verify request aborts immediately with 0 unnecessary retries across other keys.
