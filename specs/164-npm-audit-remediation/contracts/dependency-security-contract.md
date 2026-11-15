# Dependency Security & Build Gate Contracts (`164-npm-audit-remediation`)

**Feature**: `164-npm-audit-remediation`  
**Date**: 2026-11-15  
**Spec**: [spec.md](./spec.md)

## 1. CI Security Gate Contract (`.github/workflows/ci.yml`)

The CI security step (`npm audit --audit-level=high`) and full vulnerability audit MUST satisfy:

1. `npm audit --audit-level=high`:
   - **Exit Code**: `0`
   - **High / Critical Vulnerabilities**: `0`
2. `npm audit`:
   - **Exit Code**: `0`
   - **Total Vulnerabilities**: `0` (`0 low`, `0 moderate`, `0 high`, `0 critical`)

## 2. Resolved Package Version Contract

All previously reported vulnerable nodes MUST resolve strictly inside their patched semver bounds without breaking major bumps:

| Package | Required Resolved Version Constraint |
|---|---|
| `vite` | `>= 6.4.6 < 7.0.0` |
| `undici` | `>= 7.30.1 < 8.0.0` |
| `vitest` | `>= 4.1.12 < 5.0.0` |
| `@vitest/mocker` (and `@vitest/{expect,pretty-format,runner,snapshot,spy,utils}`) | `>= 4.1.12 < 5.0.0` (must match `vitest` exact version in lockstep; do not override `@vitest/mocker` in isolation) |

## 3. Zero New Feature Dependencies Contract (Constitution Principle II)

- The set of direct package names declared under `dependencies` and `devDependencies` in `package.json` MUST remain identical before and after remediation.
- No runtime source files under `src/` may be altered just to work around a dependency advisory when a compatible patch release exists.

## 4. Regression & Build Gate Contract (Constitution Principle I)

Following lockfile and manifest synchronization, all baseline quality checks MUST pass with zero errors and zero disabled/skipped tests:

1. `npm ci --dry-run` -> exit code `0` (verifies `package.json` and `package-lock.json` `packages[""]` are 100% synchronized for CI `npm ci`)
2. `npm run lint` (`tsc --noEmit`) -> exit code `0`
3. `npm test` (`vitest run`) -> exit code `0` (all 109 test files passing)
4. `npm run build` (`tsc && vite build`) -> exit code `0`
