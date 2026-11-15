# Quickstart Validation Guide (`164-npm-audit-remediation`)

**Feature**: `164-npm-audit-remediation`  
**Contracts**: [dependency-security-contract.md](./contracts/dependency-security-contract.md) | **Data Model**: [data-model.md](./data-model.md)

## Prerequisites

- Node.js (matches `.github/workflows/ci.yml` Node 24 LTS) and `npm` available on `PATH`.
- Clean or current workspace at repository root (`e:\tailieuhoctap\laptrinhnangcao\th\merged`).

## Step 1: Apply Non-Breaking Security Remediation

During `/speckit-implement`:
1. Run `npm audit fix` (without `--force`) first to resolve `vite` (`6.4.6`), `undici` (`7.30.2`), `vitest` (`4.1.12`), and the `@vitest/*` cohort (`4.1.12`) in `package-lock.json` and `node_modules`.
2. Update the minimum safe semver floors in `package.json` (`"vite": "^6.4.6"`, `"vitest": "^4.1.12"`) while preserving existing `overrides`, then run `npm install --package-lock-only` (or `npm install`) so `packages[""]` in `package-lock.json` matches `package.json` 1:1.
3. Verify lockfile synchronization for CI with `npm ci --dry-run`.

## Step 2: Verify Resolved Dependency Versions

```bash
npm ls vite vitest @vitest/mocker undici --all
```

Expected outcome: Resolved versions match the bounds in [dependency-security-contract.md](./contracts/dependency-security-contract.md) (`vite >= 6.4.6 < 7.0.0`, `undici >= 7.30.1 < 8.0.0`, `vitest >= 4.1.12 < 5.0.0`, `@vitest/mocker >= 4.1.12 < 5.0.0`).

## Step 3: Verify CI Security Audit Gates

```bash
npm audit --audit-level=high
npm audit
```

Expected outcome: Both commands exit with code `0` and report `found 0 vulnerabilities`.

## Step 4: Verify Quality & Build Gates (CI Parity)

```bash
npm run lint
npm test
npm run build
```

Expected outcome:
- `npm run lint` (`tsc --noEmit`) exits `0`.
- `npm test` (`vitest run`) exits `0` with all existing test files passing (`109` test files, zero skipped/weakened tests).
- `npm run build` (`tsc && vite build`) exits `0` and produces `dist/`.
