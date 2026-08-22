# Verification Quickstart: Zero-Knowledge Session Sync

**Feature Directory**: `specs/060-zero-knowledge-session-sync`  
**Feature Branch**: `060-zero-knowledge-session-sync`  

---

## 1. Automated Verification Commands

```bash
# 1. TypeScript typecheck verification (must be completely clean with 0 errors)
npm run lint

# 2. Run unit test suite (including sessionStore, apiClient, quota, and translation tests)
npm test

# 3. Production bundle build
npm run build
```

---

## 2. Manual Browser Network Verification

1. Start dev server: `npm run dev`.
2. Open Chrome DevTools (`F12`), switch to **Network** tab, and filter by `Fetch/XHR`.
3. Open application at `http://localhost:3000`.
4. Go to **AI Settings** and enter a personal Gemini API Key (`AIzaSy...`).
5. Observe the request to `POST /api/session-keys`:
   - Inspect Request Payload: Verify it sends `{ "keyHashes": ["<64-hex-chars>"] }` and contains **NO** plaintext `AIzaSy...` string.
6. Open **Quota Panel**:
   - Inspect Request Payload to `POST /api/quota-status`: Verify it sends `{ "keyHashes": [...] }`.
7. Go to **Translate Workspace** and click **Thêm nhanh thuật ngữ**:
   - Translate a term: Verify request connects directly to `https://generativelanguage.googleapis.com/...` and **NOT** through the application backend.
8. Filter network logs by searching for the raw API key string `AIzaSy...`:
   - Verify that **0 requests** sent to the application domain contain the key string (outside of explicit ephemeral analysis requests with opt-in flag).
