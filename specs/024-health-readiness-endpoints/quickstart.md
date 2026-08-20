# Quickstart: Real Health, Liveness & Readiness Endpoints

## 1. Test Verification

```bash
# 1. Type check
npm run lint

# 2. Unit and integration tests
npm test

# 3. Production bundle build
npm run build
```

---

## 2. Validation Scenarios

### Scenario 1: Liveness Probe
- Call `GET /api/live`.
- Assert `200 OK` with `{ status: "alive" }`.

### Scenario 2: Readiness Probe with Redis
- Connect Redis, call `GET /api/ready`.
- Assert `200 OK` with `{ status: "healthy", ready: true }`.

### Scenario 3: Degraded Readiness & Diagnostics
- Disconnect Redis, call `GET /api/ready` and `GET /api/health`.
- Assert `status: "degraded"` with `redis.mode: "in-memory-fallback"`.
