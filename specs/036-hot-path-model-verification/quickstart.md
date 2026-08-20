# Quickstart & Verification Guide: Hot Path Model Verification

## Testing Verification Scenarios

### 1. Cache Hit (Preset Model)
```bash
# Valid preset model should pass validation immediately with 0 Google API network calls
curl -X POST http://localhost:3000/api/translate-raw \
  -H "Content-Type: application/json" \
  -d '{"model": "gemini-2.5-flash", "rawText": "Hello", "apiKeys": ["dummy-key"]}'
```

### 2. Cache Miss in Hot Path (Immediate Rejection)
```bash
# Unverified custom model in translation request should immediately return 400 MODEL_UNVERIFIED
curl -X POST http://localhost:3000/api/translate-raw \
  -H "Content-Type: application/json" \
  -d '{"model": "unverified-novel-model", "rawText": "Hello", "apiKeys": ["dummy-key"]}'
# Response: 400 Bad Request { "code": "MODEL_UNVERIFIED" }
```

### 3. Explicit Verification & Concurrent Deduplication
```bash
# Explicitly verify the custom model
curl -X POST http://localhost:3000/api/verify-model \
  -H "Content-Type: application/json" \
  -d '{"modelId": "tunedModels/my-novel-v1", "apiKeys": ["VALID_API_KEY"]}'
```

### 4. Running Automated Tests
```bash
# Run backend model verification and hot path validation tests
npx vitest run server/services/__tests__/modelInfoService.test.ts server/services/__tests__/modelValidation.test.ts
```
