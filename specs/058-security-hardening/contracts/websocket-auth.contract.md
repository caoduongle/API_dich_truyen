# WebSocket Relay Authentication Contract

**Endpoint**: `GET /ws/sync`  
**Protocol**: `WebSocket (WSS / WS)`  
**Protocol Version**: `13`  

---

## Handshake Query Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `projectId` | `string` | **Yes** | Identifier of the novel project |
| `chapterId` | `string` | **Yes** | Identifier of the chapter document |
| `token` | `string` | **Yes** | Google OAuth 2.0 Access Token |

---

## Handshake Response Statuses

### 1. Missing Parameters (HTTP 400 Bad Request)
- **Condition**: `projectId` or `chapterId` is empty/missing.
- **Response**: `HTTP/1.1 400 Bad Request\r\n\r\n`

### 2. Missing or Invalid Token (HTTP 401 Unauthorized)
- **Condition**: `token` query param is absent, empty, expired, or invalid according to Google UserInfo verification.
- **Response**: `HTTP/1.1 401 Unauthorized\r\n\r\n`

### 3. IP Rate Limit Exceeded (HTTP 429 Too Many Requests)
- **Condition**: Client IP exceeds `MAX_CONNECTIONS_PER_IP` (20 concurrent sockets).
- **Response**: `HTTP/1.1 429 Too Many Requests\r\n\r\n`

### 4. Successful Upgrade (HTTP 101 Switching Protocols)
- **Condition**: Valid `projectId`, `chapterId`, within rate limit, and Google OAuth token successfully verified.
- **Response**: Standard WebSocket Handshake 101 Switching Protocols.
