# Quickstart & Verification Guide: Remove Server Fallback

**Feature Directory**: `specs/050-remove-server-fallback`
**Date**: 2026-08-22

---

## 1. Automated Verification Commands

```bash
# 1. Typecheck (Must be 100% clean)
npm run lint

# 2. Unit Tests (All tests pass)
npm test

# 3. Production Build
npm run build
```

---

## 2. Manual End-to-End Scenarios

### Scenario A: Uncredentialed User (0 API keys)
1. Clear all Gemini API keys in the AI Configuration modal (`ApiSettings.tsx`).
2. Open **Translator Workspace** or **Auto Translator**.
3. Observe the header and notice indicating personal API key is mandatory.
4. Click **Translate Raw** or **Auto-translate**.
5. **Expected Outcome**: Action is blocked with a clear toast/notification; 0 network requests are sent to `/api/translate-raw`.

### Scenario B: Credentialed User (Direct Client Translation)
1. Add a valid Gemini API key (`AQ...` or `AIzaSy...`) in **Cấu hình AI**.
2. Translate a chapter.
3. Open browser Network DevTools.
4. **Expected Outcome**: Outbound POST requests go directly to `https://generativelanguage.googleapis.com/v1beta/models/...:generateContent`. Zero requests are sent to `/api/translate-raw` or `/api/polish-translation`. Chapter translates and saves to IndexedDB.

### Scenario C: Server API Direct Probe Without Key
1. Dispatch `curl -X POST http://localhost:3000/api/translate-raw -H "Content-Type: application/json" -d '{"text":"test"}'`.
2. **Expected Outcome**: HTTP 400 Bad Request with `"error": "Vui lòng cấu hình API key cá nhân của bạn trong phần 'Cấu hình AI' trước khi sử dụng. Máy chủ không hỗ trợ dịch qua key mặc định."`.
