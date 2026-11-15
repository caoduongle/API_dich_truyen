# Phase 0 Research: Khắc Phục Lỗ Hổng Bảo Mật Dependency (`164-npm-audit-remediation`)

**Feature**: `164-npm-audit-remediation`  
**Date**: 2026-11-15  
**Spec**: [spec.md](./spec.md)

## Research Decisions

### 1. Remediation of `vite` (`<=6.4.3`, Severity: `high`)
- **Decision**: Upgrade `vite` within the `^6.2.3` semver range from `6.4.3` to `>=6.4.6` (`6.4.6` is the latest 6.x patch in npm registry) via non-breaking lockfile resolution (`npm audit fix` or `package.json` range/lockfile update).
- **Rationale**: `vite` `<=6.4.3` carries 5 advisories (`GHSA-698v-4r3x-3vcv`, `GHSA-r825-w8mm-5pxw`, `GHSA-587h-7wmj-h5pm` high, `GHSA-9jrq-w75r-8gcw`, `GHSA-rq7h-c2jc-7f22`). Upgrading to `6.4.6` stays within Vite 6.x, preserving 100% compatibility with `@vitejs/plugin-react@5.2.0`, `@tailwindcss/vite@4.3.1`, and `vitest@4.1.x`.
- **Alternatives considered**: Upgrading to Vite 7/8 major (rejected: unnecessary major version bump outside scope); adding `overrides` for `launch-editor` alone (rejected: does not address Vite server middleware/fs advisories `GHSA-9jrq-w75r-8gcw` and `GHSA-rq7h-c2jc-7f22`).

### 2. Remediation of `undici` (`7.0.0 - 7.30.0`, Severity: `high`)
- **Decision**: Upgrade transitive dependency `undici` (pulled in by `jsdom@29.1.1`) from `7.29.1` to `>=7.30.1` (`7.30.2` available in npm registry) via `npm audit fix` (and if needed, a targeted `overrides` entry `"undici": "^7.30.1"` in `package.json` if `npm ci` or transitive resolution ever pins `<7.30.1`).
- **Rationale**: `undici` `<7.30.1` has 8 advisories (`GHSA-4qv8-2p9j-2685`, `GHSA-f72v-6w45-q472`, `GHSA-xjj6-f33q-929c`, `GHSA-4w7w-5xrc-9h26`, `GHSA-2m5v-pch6-74hx`, `GHSA-qrxm-fqhp-jwvm`, `GHSA-9fm3-97px-rjf6`, `GHSA-55wc-3pg8-jfw6`). `jsdom@29.1.1` accepts `undici@^7.x`, so resolving `undici` to `>=7.30.1` is a drop-in patch upgrade.
- **Alternatives considered**: Replacing `jsdom` with `happy-dom` (rejected: violates Constitution Principle II against swapping existing packages); downgrading `jsdom` (rejected: does not fix `undici`).

### 3. Remediation of `vitest` & `@vitest/mocker` (`<=4.1.11`, Severity: `moderate`)
- **Decision**: Upgrade `vitest` and `@vitest/mocker` from `4.1.11` to `>=4.1.12` (`^4.1.12` in `package.json` `devDependencies` + lockfile update).
- **Rationale**: `@vitest/mocker` `<4.1.12` is affected by `GHSA-qxg6-89mg-rqv8` and `GHSA-xp26-3454-mjgp` (which cascades to `vitest` `2.1.0-beta.1 - 4.1.11`). Updating `vitest` to `^4.1.12` and resolving `@vitest/mocker@4.1.12` clears both moderate advisories with zero breaking changes to the existing test suite.
- **Alternatives considered**: Leaving `moderate` vulnerabilities unpatched because CI only gates on `--audit-level=high` (rejected: violates User Story 2 / `FR-002` / `SC-002` and leaves Windows path traversal `GHSA-xp26-3454-mjgp` open on developer machines).

### 4. Lockfile & CI Parity Verification (`npm ci` + `npm audit`)
- **Decision**: After updating `package.json` / `package-lock.json`, verify clean reproducibility with `npm audit --audit-level=high`, `npm audit`, `npm run lint`, `npm test`, and `npm run build` matching `.github/workflows/ci.yml`.
- **Rationale**: `.github/workflows/ci.yml` runs `npm ci` followed immediately by `npm audit --audit-level=high` on Node 24. Ensuring `package.json` and `package-lock.json` are strictly synchronized guarantees CI passes without lockfile drift.
- **Alternatives considered**: Running `npm audit fix --force` (rejected: `--force` installs breaking major versions without control).
