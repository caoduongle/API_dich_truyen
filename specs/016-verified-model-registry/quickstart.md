# Quickstart Validation Guide: Verified Model Registry

**Branch**: `016-verified-model-registry` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

This guide details scenarios to validate the **Verified Model Registry** and **Translation Compatibility Gate** end-to-end.

---

## Prerequisites

1. Active development server running (`npm run dev`) or test environment.
2. Valid Google AI Studio API Key (or mocked provider in unit/integration tests).

---

## Scenario 1: Verify and Register a Valid Custom Model

1. **Action**: Open AI Settings (`Cấu hình AI`), navigate to "Mô hình tùy chỉnh (Custom)".
2. **Input**: Enter Model ID `gemini-2.5-flash` with display label `Gemini 2.5 Flash Tùy Chỉnh`.
3. **Execute**: Click "Thêm & Xác minh" ("Add & Verify").
4. **Expected Outcome**:
   - Backend calls verification endpoint and queries model capabilities.
   - Model receives a green `Đã xác minh` (Verified) badge with verified timestamp.
   - Model appears in the selectable list and can be chosen as the active translation model.

---

## Scenario 2: Reject Incompatible or Non-Existent Custom Model

1. **Action**: Attempt to add a non-existent model ID (e.g. `gemini-999-fake-model`) or an embedding model (e.g. `text-embedding-004`).
2. **Execute**: Click "Thêm & Xác minh".
3. **Expected Outcome**:
   - Verification fails on backend.
   - An explanatory Vietnamese error message is displayed (e.g. "Không tìm thấy mô hình" or "Mô hình không hỗ trợ sinh nội dung").
   - Model is NOT added to the verified registry.

---

## Scenario 3: Reject Unverified Model in Translation Endpoints

1. **Action**: Send a direct HTTP POST request to `/api/translate-raw` with body:
   ```json
   {
     "text": "你好世界",
     "model": "unverified-arbitrary-model"
   }
   ```
2. **Expected Outcome**:
   - Backend `validateModelMiddleware` intercepts the request.
   - Request is rejected with HTTP 400/422 and JSON response indicating the model is unverified.
   - No Gemini translation API call is dispatched.

---

## Scenario 4: Fast Cached UI Rendering

1. **Action**: Re-open and toggle the AI Configuration modal 5 times.
2. **Expected Outcome**:
   - Model registry is read synchronously from client storage / cached memory.
   - Zero outbound requests to Google Generative Language API are dispatched for already-verified models.

---

## Automated Test Commands

```bash
# Typecheck
npx tsc --noEmit

# Run all unit and integration tests
npm test

# Build production bundle
npm run build
```
