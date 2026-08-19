# Contract: Translation Compatibility Gate

**Applies To**: 
- `POST /api/translate-raw`
- `POST /api/polish-translation`
- `POST /api/qa-critique`
- `POST /api/analyze-glossary`
- `POST /api/analyze-guidelines`
- `POST /api/extract-glossary`
- `POST /api/quick-translate-term`
- `POST /api/align-chapter`

## Validation Flow

1. If `model` is omitted / empty string: Default to `DEFAULT_MODEL_ID` (`gemini-3.1-flash-lite`), which is pre-verified.
2. If `model` is provided:
   - Check format with `isValidModelId(model)`. If fails -> HTTP 400.
   - Check against Pre-verified Presets (`AVAILABLE_MODELS`). If match -> PASS.
   - Check against Server-Side Verified Model Cache (`modelInfoService`). If present with `verified === true` -> PASS.
   - If not cached, trigger on-demand verification using request's API keys / session. If verification confirms `generateContent` -> cache as verified -> PASS.
   - If unverified / verification fails -> REJECT with HTTP 400 / 422.

## Failure Response for Unverified Model (HTTP 400 / 422)

```json
{
  "error": "Mô hình AI \"gemini-unverified-v99\" chưa được xác minh hoặc không tương thích với quy trình dịch thuật. Vui lòng xác minh mô hình trong Cấu hình AI.",
  "code": "MODEL_UNVERIFIED",
  "model": "gemini-unverified-v99"
}
```
