# Contract: Health, Liveness & Readiness Endpoints

## 1. Endpoints & Route Mapping

### 1.1 `GET /api/live` (and `GET /live`)
- **Authentication**: None (Public Whitelisted)
- **Response**: `200 OK` `LivenessResponse`

---

### 1.2 `GET /api/ready` (and `GET /ready`)
- **Authentication**: None (Public Whitelisted)
- **Response**:
  - `200 OK` (when `healthy` or `degraded` fallback active)
  - `503 Service Unavailable` (when `unavailable` / shutting down)

---

### 1.3 `GET /api/health` (and `GET /health`)
- **Authentication**: None (Public Whitelisted)
- **Response**: `200 OK` `HealthDiagnosticsResponse`
