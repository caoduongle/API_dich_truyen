# Implementation Plan: CI Runtime Parity & Container Integrity Hardening

**Branch**: `152-ci-runtime-audit-fixes` | **Date**: 2026-09-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/152-ci-runtime-audit-fixes/spec.md`

## Summary

The CI pipeline is blocked by a runtime incompatibility: `jsdom@30.1.0` requires Node ≥22.22.2 but the project standardizes on Node 20 LTS. Additionally, Docker sub-path deployments are broken because Nginx lacks prefix-aware routing, the build config passes unnormalized base paths to Vite, build artifact tests can silently skip when `dist/` is absent, and EPUB compression assertions are permissive. This plan addresses all issues while preserving the Node 20 LTS baseline.

## Technical Context

**Language/Version**: TypeScript ~5.8.2 on Node.js 20 LTS

**Primary Dependencies**: React 19, Vite 6.x, Vitest 4.x, jsdom (test env), JSZip (EPUB generation)

**Storage**: IndexedDB (client-side, unchanged)

**Testing**: Vitest (`vitest run`), with per-file `@vitest-environment jsdom` for DOM tests

**Target Platform**: Browser SPA (production), Node 20 LTS (build/test/CI)

**Project Type**: Pure client-side SPA with Docker containerization

**Constraints**: Must maintain Node 20 LTS as the project-wide baseline; no new runtime dependencies

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Strict Quality Gates | ✅ PASS | This feature's entire purpose is restoring quality gate compliance |
| II. Dependency Minimization | ✅ PASS | Downgrading jsdom, removing @types/jsdom — net reduction in deps |
| III. Strict Concern Separation | ✅ PASS | No service/hook/component boundary changes |
| IV. Immutable Core Schemas | ✅ PASS | No changes to types.ts or IndexedDB schemas |
| V. Atomic Commits & Doc Sync | ✅ PASS | Each phase is independently testable; bookkeeping reconciliation included |

**Post-Phase 1 Re-Check**: All gates pass. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/152-ci-runtime-audit-fixes/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── jsdom-compat.contract.ts
│   ├── nginx-subpath.contract.ts
│   └── build-artifacts.contract.ts
└── tasks.md             # Phase 2 output (via /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── config/
│   └── publicOrigin.ts        # MODIFY: harden normalizeOrigin() with URL parsing
├── tests/
│   └── originConfig.test.ts   # MODIFY: remove conditional guards, strict assertions
├── hooks/
│   └── __tests__/
│       └── useEpubExport.test.ts  # MODIFY: binary STORE verification
└── utils/
    └── __tests__/
        └── customDomainAssets.test.ts  # MODIFY: update base: assertion

package.json                   # MODIFY: jsdom 29.1.1, remove @types/jsdom
vite.config.ts                 # MODIFY: base: publicConfig.basePath
Dockerfile                     # MODIFY: template-based Nginx config
nginx/default.conf.template    # NEW: Nginx config template with envsubst
```

**Structure Decision**: Single project (client-side SPA). All modifications are within the existing structure. One new file (`nginx/default.conf.template`) is added for Docker Nginx configuration, keeping it co-located with the Dockerfile.

## Detailed Change Descriptions

### Phase 1: Dependency Fix (P0 — Unblocks CI)

#### [MODIFY] [package.json](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/package.json)

- Change `"jsdom": "^30.1.0"` → `"jsdom": "29.1.1"` (pinned, not caret)
- Remove `"@types/jsdom": "^30.0.0"` from devDependencies
- Regenerate `package-lock.json` via `npm install`

#### Verification
- `npm test -- src/hooks/__tests__/useEpubExport.test.ts` passes without worker crashes

---

### Phase 2: Docker & Nginx Sub-Path Fix (P1)

#### [MODIFY] [Dockerfile](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/Dockerfile)

- Remove the `RUN echo 'server { ... }' > /etc/nginx/conf.d/default.conf` block
- Add `ENV VITE_BASE_URL=${VITE_BASE_URL:-/}` in the runner stage
- `COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template`

#### [NEW] [default.conf.template](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/nginx/default.conf.template)

Nginx configuration template using `${VITE_BASE_URL}` substitution:
- `location ${VITE_BASE_URL}` block with `alias /usr/share/nginx/html/;` and `try_files`
- Falls back to `${VITE_BASE_URL}index.html` for SPA routing
- Root path (`/`) works identically to current behavior

---

### Phase 3: Build Config Alignment (P2)

#### [MODIFY] [vite.config.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/vite.config.ts)

- Line 22: Change `base: process.env.VITE_BASE_URL || '/'` → `base: publicConfig.basePath`
- This ensures Vite receives the normalized base path with guaranteed leading/trailing slashes

#### [MODIFY] [customDomainAssets.test.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/utils/__tests__/customDomainAssets.test.ts)

- Line 28: Update string assertion from `base: process.env.VITE_BASE_URL || '/'` to match the new `base: publicConfig.basePath` code

---

### Phase 4: Build Artifact Test Hardening (P2)

#### [MODIFY] [originConfig.test.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/tests/originConfig.test.ts)

- Replace `if (fs.existsSync(distIndexPath)) { ... }` guards with unconditional assertions:
  ```typescript
  expect(fs.existsSync(distIndexPath)).toBe(true);
  expect(fs.existsSync(distSitemapPath)).toBe(true);
  ```
- Ensures tests fail clearly when build artifacts are missing

---

### Phase 5: EPUB STORE Binary Verification (P3)

#### [MODIFY] [useEpubExport.test.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/hooks/__tests__/useEpubExport.test.ts)

- Replace `expect(compression === 'STORE' || compression === null).toBe(true)` with binary header inspection:
  ```typescript
  const bytes = new Uint8Array(arrayBuffer);
  // ZIP local file header: bytes 8-9 = compression method (little-endian)
  const compressionMethod = bytes[8] | (bytes[9] << 8);
  expect(compressionMethod).toBe(0); // 0 = STORE
  ```

---

### Phase 6: Origin Validation Hardening (P3)

#### [MODIFY] [publicOrigin.ts](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/config/publicOrigin.ts)

- Refactor `normalizeOrigin()` to use `new URL()` for parsing:
  ```typescript
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return DEFAULT_PUBLIC_URL;
    }
    return parsed.origin; // protocol + hostname + port, no trailing slash
  } catch {
    return DEFAULT_PUBLIC_URL;
  }
  ```
- Add corresponding test cases in `originConfig.test.ts` for edge cases:
  - `https://` (empty host) → default
  - `https:///` (triple slash) → default
  - `https://example.com/foo/bar` → `https://example.com`
  - `https://example.com:8080` → `https://example.com:8080`

---

### Phase 7: Bookkeeping Reconciliation (P3)

#### [MODIFY] [specs/151 tasks.md](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/specs/151-audit-verification-hardening/tasks.md)

- Add note to T001 cross-referencing spec 152 dependency correction
- Add note to T021 indicating CI verification was completed after spec 152 fix
