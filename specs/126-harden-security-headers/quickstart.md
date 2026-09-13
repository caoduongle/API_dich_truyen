# Quickstart: Security Headers & Error Diagnostics Validation

This quickstart guide provides step-by-step verification procedures to validate the implementation of hardened security headers in `render.yaml` and refined error handling in `zuminovelRestClient.ts`.

---

## 1. Prerequisites

Ensure dependencies are installed and the current working tree is clean:

```bash
git status
```

---

## 2. Validation Scenario A: Security Headers Configuration in `render.yaml`

### Objective
Verify that `render.yaml` contains syntactically valid YAML and declares the 3 required security hardening directives:
1. `upgrade-insecure-requests` in CSP.
2. `Cross-Origin-Resource-Policy: same-origin`.
3. `Permissions-Policy` containing `camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=()`.

### Verification Steps
Run the verification command in PowerShell:

```powershell
powershell -Command "
\$yaml = Get-Content 'render.yaml' -Raw;
if (\$yaml -match 'upgrade-insecure-requests; default-src') { Write-Host '[PASS] CSP upgrade-insecure-requests directive is configured' } else { Write-Error 'CSP missing upgrade-insecure-requests' };
if (\$yaml -match 'name:\s*Cross-Origin-Resource-Policy\s*\r?\n\s*value:\s*same-origin') { Write-Host '[PASS] Cross-Origin-Resource-Policy same-origin is configured' } else { Write-Error 'Missing Cross-Origin-Resource-Policy' };
if (\$yaml -match 'name:\s*Permissions-Policy\s*\r?\n\s*value:\s*camera=\(\), microphone=\(\), geolocation=\(\), payment=\(\), usb=\(\), screen-wake-lock=\(\)') { Write-Host '[PASS] Permissions-Policy is expanded correctly' } else { Write-Error 'Permissions-Policy is incomplete' };
"
```

Expected Output:
```text
[PASS] CSP upgrade-insecure-requests directive is configured
[PASS] Cross-Origin-Resource-Policy same-origin is configured
[PASS] Permissions-Policy is expanded correctly
```

---

## 3. Validation Scenario B: `ZuminovelNetworkError` Diagnostics & Unit Tests

### Objective
Verify that `ZuminovelNetworkError`:
1. Throws with the new helpful Vietnamese message.
2. Contains no references to "CORS cần proxy" in code or comments.
3. Passes all unit test assertions in `src/services/zuminovel/__tests__/zuminovelRestClient.test.ts`.

### Verification Steps

1. Check for legacy CORS proxy mentions across `src/services/zuminovel/`:
```bash
git grep -i "cần một proxy" src/services/zuminovel/
```
Expected Output: Empty (0 matches found).

2. Run the ZumiNovel client unit tests:
```bash
npx vitest run src/services/zuminovel/__tests__/zuminovelRestClient.test.ts
```
Expected Output: All tests pass cleanly.

---

## 4. Validation Scenario C: Full Quality Gate Verification

Execute the mandatory constitutional quality verification suite:

```bash
npm run lint
npm test
npm run build
```

Expected Results:
- `npm run lint`: `tsc --noEmit` exits with 0 errors.
- `npm test`: 100% of tests pass across all test suites.
- `npm run build`: `tsc && vite build` succeeds, generating bundle in `dist/`.
