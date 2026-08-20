# Quickstart: State Ownership & Storage Consistency Verification

**Feature**: State Ownership & Storage Cleanup  
**Directory**: `specs/026-state-ownership-cleanup/`  

---

## 1. Prerequisites

- Node.js 18+
- Active development server or test harness running Vitest

---

## 2. Validation Scenarios

### Scenario 1: Storage Integrity Audit Test
Run automated storage consistency test to assert that `localStorage` contains zero manuscript texts and zero plain API keys.

```bash
npx vitest run src/utils/__tests__/credentialStorage.test.ts
```

**Expected Outcome**:
- Legacy keys in `localStorage` are automatically migrated to `sessionStorage` and purged from `localStorage`.
- No raw keys persist in `localStorage`.

---

### Scenario 2: IndexedDB Transaction & Chapter Separation
Verify that large chapter bodies are stored in the `chapters` object store and not duplicated in the `projects` store or in `localStorage`.

```bash
npx vitest run src/services/__tests__/db.test.ts
```

**Expected Outcome**:
- Project metadata and chapter text are saved atomically in separate IndexedDB stores.
- 0 KB of chapter content leaks into `localStorage`.

---

### Scenario 3: Server Quota & Cooldown Authority
Verify that key health and rate-limiting pacing states are authoritative on the server.

```bash
npx vitest run server/services/__tests__/schedulerObservability.test.ts
```

**Expected Outcome**:
- Quota metrics, attempt traces, and health states are maintained on the server without client overrides.

---

### Scenario 4: Full Quality Gate Check
Run all standard repository quality gates:

```bash
npm run lint    # tsc --noEmit
npm test        # vitest run
npm run build   # vite build + esbuild server
```
