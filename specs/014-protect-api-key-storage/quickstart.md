# Quickstart & Verification Guide: Protect API Key Storage

## Prerequisites
- Node.js environment (v18+)
- Repository dependencies installed (`npm install`)

---

## Runnable Verification Scenarios

### Scenario 1: Automated Test Suite Execution
Execute unit, integration, and security regression tests:

```bash
# 1. Type check
npm run lint

# 2. Test suite run (all 274+ tests must pass)
npm test

# 3. Production build test
npm run build
```

---

### Scenario 2: Legacy Credential Migration Verification
1. Open developer console in browser on `http://localhost:5173`.
2. Seed legacy key into `localStorage`:
   ```javascript
   localStorage.setItem('gemini_api_keys', JSON.stringify(['AIzaSyFakeKey1234567890abcdef1234567890a']));
   ```
3. Reload page (`location.reload()`).
4. Verify:
   - `localStorage.getItem('gemini_api_keys')` is `null` (legacy key purged).
   - `sessionStorage.getItem('gemini_api_keys')` contains the migrated key.
   - `localStorage.getItem('gemini_session_token')` contains a valid UUIDv4.
   - AI Configuration modal displays "1 key đã cấu hình".

---

### Scenario 3: Corrupted / Malformed Storage Resilience
1. Seed malformed string into `localStorage`:
   ```javascript
   localStorage.setItem('gemini_api_keys', 'CORRUPTED_NON_JSON_DATA{{{{');
   ```
2. Reload page.
3. Verify:
   - Application loads without crashing or uncaught JSON parse errors.
   - Corrupted item is cleanly removed.

---

### Scenario 4: Zero Plaintext Key in Outgoing Network Payloads
1. Open DevTools Network Tab.
2. Start translation or click "Quota & Hạn mức" tab in AI Configuration modal.
3. Inspect `/api/quota-status` or `/api/translate-raw` request:
   - Headers contain `X-Session-Token: <uuid>`.
   - Body does NOT contain `apiKeys` array.
   - Response contains only `maskedKey` and `keyHash`.

---

### Scenario 5: Session Expiration & Transparent Re-sync
1. Clear server-side session in test or backend.
2. Trigger a translation request from the client.
3. Observe:
   - Server returns 401 `sessionExpired: true`.
   - Client `apiFetch` catches 401, re-syncs active keys via `POST /api/session-keys`, receives new `SessionToken`, and retries request automatically.
   - Translation succeeds without user error alert.
