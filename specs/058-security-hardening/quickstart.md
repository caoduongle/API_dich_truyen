# Quickstart & Verification Guide: Security Hardening

**Feature**: [`specs/058-security-hardening`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/058-security-hardening)  
**Date**: 2026-08-22  

---

## 1. Automated Verification Commands

Run the full project Quality Gates:

```bash
# 1. Typecheck validation
npm run lint

# 2. Complete test suite execution
npm test

# 3. Production bundle build
npm run build

# 4. Dependency security audit
npm audit --audit-level=low
```

---

## 2. WebSocket Authentication Test Scenario

Verify that unauthenticated connection attempts to `/ws/sync` are rejected:

```typescript
// Test: Attempt connection to /ws/sync without token
// Expect: Connection rejected with HTTP 401 Unauthorized
```

---

## 3. Production Startup Security Banner Scenario

Verify that `server.ts` displays a security warning in production mode when `ACCESS_PASSWORD` is absent:

```bash
NODE_ENV=production node dist/server.cjs
# Verify warning banner is output to stdout
```
