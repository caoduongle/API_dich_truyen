# Data Model & Dependency Configuration Entities (`164-npm-audit-remediation`)

**Feature**: `164-npm-audit-remediation`  
**Date**: 2026-11-15  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Runtime Schema Impact

- **Application TypeScript Models (`src/types.ts`)**: Unchanged (100% immutable per Constitution Principle IV).
- **IndexedDB Storage Schema (`src/services/db.ts`)**: Unchanged (no object stores, indexes, or migrations touched).

## Configuration & Lockfile Entities

### 1. Dependency Manifest (`package.json`)

Represents direct runtime dependencies, development dependencies, and transitive resolution overrides.

| Field | Current State | Target State | Validation Rules |
|---|---|---|---|
| `dependencies.vite` | `^6.2.3` | `^6.4.6` | Must remain on Vite 6.x major line (`>=6.4.6 <7.0.0`); preserves compatibility with `@vitejs/plugin-react@^5.0.4` and `@tailwindcss/vite@^4.1.14`. |
| `devDependencies.vitest` | `^4.1.11` | `^4.1.12` | Must remain on Vitest 4.1.x line (`>=4.1.12 <5.0.0`) patching `@vitest/mocker` advisories. |
| `overrides` | `{ "browserslist": "^4.28.7", "qs": "^6.15.4" }` | Preserve existing entries; add `"undici": "^7.30.1"` only if transitive resolution fails to stay `>=7.30.1` | Must not downgrade existing overrides or introduce new feature packages. |
| Direct package names | Fixed baseline set | Identical set | Zero new dependencies added (`FR-005`, Constitution Principle II). |

### 2. Dependency Lockfile (`package-lock.json`)

Represents deterministic resolved package versions and integrity hashes used by `npm ci`.

| Lockfile Node | Vulnerable Version | Required Patched Range | Resolves Advisories |
|---|---|---|---|
| `node_modules/vite` | `6.4.3` | `>=6.4.6 <7.0.0` | `GHSA-698v-4r3x-3vcv`, `GHSA-r825-w8mm-5pxw`, `GHSA-587h-7wmj-h5pm`, `GHSA-9jrq-w75r-8gcw`, `GHSA-rq7h-c2jc-7f22` |
| `node_modules/undici` | `7.29.1` | `>=7.30.1 <8.0.0` (`7.30.2`) | `GHSA-4qv8-2p9j-2685`, `GHSA-f72v-6w45-q472`, `GHSA-xjj6-f33q-929c`, `GHSA-4w7w-5xrc-9h26`, `GHSA-2m5v-pch6-74hx`, `GHSA-qrxm-fqhp-jwvm`, `GHSA-9fm3-97px-rjf6`, `GHSA-55wc-3pg8-jfw6` |
| `node_modules/vitest` | `4.1.11` | `>=4.1.12 <5.0.0` | Cascades from `@vitest/mocker` |
| `node_modules/@vitest/mocker` (& sibling `@vitest/*` cohort: `expect`, `pretty-format`, `runner`, `snapshot`, `spy`, `utils`) | `4.1.11` | `>=4.1.12 <5.0.0` (must match `vitest` version in lockstep) | `GHSA-qxg6-89mg-rqv8`, `GHSA-xp26-3454-mjgp` |
| `packages[""]` (root lockfile manifest snapshot) | `vite: ^6.2.3`, `vitest: ^4.1.11` | `vite: ^6.4.6`, `vitest: ^4.1.12` | Ensures 1:1 parity with `package.json` so `npm ci` never fails with `EUSAGE` lockfile drift |

## Synchronization State Transitions

1. **Vulnerable Lockfile** -> (`npm audit fix` + floor updates in `package.json`) -> **Patched & Synchronized**.
2. **Patched & Synchronized** -> (`npm ci` / `npm audit --audit-level=high` / `npm audit`) -> **CI Security Verified (Exit 0)**.
3. **CI Security Verified** -> (`npm run lint` / `npm test` / `npm run build`) -> **Release Ready**.
