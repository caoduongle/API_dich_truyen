# Contract: Session Security & API Key Encryption

## 1. Create Encrypted Session Endpoint

- **Endpoint**: `POST /api/session-keys`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "apiKeys": ["AIzaSyKey1...", "AIzaSyKey2..."],
    "ttlMs": 86400000
  }
  ```
- **Response Format (`200 OK`)**:
  ```json
  {
    "success": true,
    "sessionToken": "session_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "keyCount": 2,
    "expiresAt": "2026-08-21T06:00:00.000Z"
  }
  ```
- **Security Invariant**: API keys stored in Redis or memory MUST be encrypted with AES-256-GCM. Querying raw Redis keys directly MUST only yield ciphertexts, never plaintext `AIzaSy...`.

---

## 2. Session-First Authentication Middleware

- **Header**: `X-Session-Token: session_a1b2c3d4...`
- **Behavior**:
  1. Valid session: Resolves keys from `SessionStore` (decrypted on demand in memory).
  2. Expired session without direct keys: Returns `HTTP 401 Unauthorized` with `{ "error": "Session expired", "sessionExpired": true }`.
  3. Direct keys (`body.apiKeys`): Allowed as legacy fallback with warning log; rejected if `MAX_API_KEYS_PER_REQUEST` exceeded.
