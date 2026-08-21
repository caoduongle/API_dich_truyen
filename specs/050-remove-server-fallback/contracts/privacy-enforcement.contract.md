# Interface Contract: Privacy Enforcement & Zero Server Fallback

**Feature Directory**: `specs/050-remove-server-fallback`
**Date**: 2026-08-22

---

## 1. Server API Middleware Contract (`resolveApiKeysMiddleware`)

### Endpoint: All protected `/api/*` endpoints
- `/api/translate-raw`
- `/api/polish-translation`
- `/api/qa-critique`
- `/api/analyze-glossary`
- `/api/extract-glossary`
- `/api/models-for-key`
- `/api/verify-model`

### Error Response when Client Credentials Missing

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Vui lòng cấu hình API key cá nhân của bạn trong phần 'Cấu hình AI' trước khi sử dụng. Máy chủ không hỗ trợ dịch qua key mặc định.",
  "code": "NO_PERSONAL_API_KEY_CONFIGURED"
}
```

---

## 2. Client Translation Service Contract (`chapterTranslationService.ts`)

```typescript
export async function executeSingleChapterTranslation(
  params: TranslateChapterParams
): Promise<SingleChapterResult>
```

### Invariant:
- If `params.apiKeys` is empty or contains no non-empty strings:
  - Immediately logs: `"[Error] Chưa cấu hình API Key cá nhân. Không thể thực hiện dịch thuật."`
  - Throws an `Error("Chưa cấu hình API Key cá nhân. Vui lòng thêm ít nhất một Gemini API Key trong phần Cấu hình AI để thực hiện dịch thuật.")`
  - Dispatches **0** HTTP requests to `/api/translate-raw` or `/api/polish-translation`.
