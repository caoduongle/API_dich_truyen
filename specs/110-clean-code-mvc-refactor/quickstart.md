# Quickstart Validation Guide: Clean Code & MVC Refactor

**Feature**: 110-clean-code-mvc-refactor
**Date**: 2026-09-12

## Prerequisites

- Node.js 20+
- `npm ci` completed successfully
- All tests passing before refactor (`npm run lint && npm test && npm run build`)

## Validation Scenarios

### V1: Build Pipeline Integrity

After the refactor, verify the full build pipeline works:

```bash
npm run lint    # tsc --noEmit — must be clean
npm test        # vitest run — must pass all tests
npm run build   # vite build — must produce dist/
```

**Expected**: All three commands exit with code 0. No type errors, no test failures, no build errors.

---

### V2: Dead Code Elimination

Verify no legacy backend references remain in active code:

```bash
# Search for dead backend references (should return 0 results from active code)
grep -r "SERVER_CONFIG" src/ shared/ --include="*.ts" --include="*.tsx"
grep -r "apiFetch" src/ --include="*.ts" --include="*.tsx"
grep -r "express\|ioredis\|REDIS_URL" src/ AGENTS.md SECURITY.md --include="*.ts" --include="*.tsx" --include="*.md"

# Verify deleted directories don't exist
test ! -d shared && echo "PASS: shared/ removed" || echo "FAIL: shared/ still exists"
test ! -d database && echo "PASS: database/ removed" || echo "FAIL: database/ still exists"
test ! -f docs/api.md && echo "PASS: docs/api.md removed" || echo "FAIL: docs/api.md still exists"
```

**Expected**: All greps return empty. All directory checks pass.

---

### V3: `@shared/*` Alias Removal

Verify no code references the old path alias:

```bash
# Should return 0 results
grep -r "@shared/" src/ --include="*.ts" --include="*.tsx"
grep "@shared" tsconfig.json vite.config.ts
```

**Expected**: Zero matches in all searches.

---

### V4: App.tsx Size Verification

```bash
wc -l src/App.tsx
```

**Expected**: Under 200 lines.

---

### V5: MVC Layer Separation — No Hooks in Components

```bash
# Find any hook files still in components/ (should return 0)
find src/components -name "use*.ts" -o -name "use*.tsx" | head -20
```

**Expected**: Zero results (no `use*.ts` files inside `src/components/`).

---

### V6: New Directory Structure Exists

```bash
# Verify new directories were created with content
test -d src/config && ls src/config/
test -d src/services/ai && ls src/services/ai/
test -d src/components/layout && ls src/components/layout/
test -f src/lib/text.ts && echo "PASS" || echo "FAIL"
test -f src/lib/sinoNormalize.ts && echo "PASS" || echo "FAIL"
test -f src/lib/parser.ts && echo "PASS" || echo "FAIL"
```

**Expected**: All directories exist and contain the relocated files.

---

### V7: Import Dependency Direction

Verify no circular imports or wrong-direction imports:

```bash
# Views should NOT import directly from services (only through hooks/contexts)
# This is an advisory check — some direct type imports from services may be acceptable
grep -r "from.*services/" src/components/ --include="*.tsx" | grep -v "type " | head -20

# Services should NEVER import from components
grep -r "from.*components/" src/services/ --include="*.ts" | head -10

# Hooks should NEVER import from components
grep -r "from.*components/" src/hooks/ --include="*.ts" | head -10
```

**Expected**: Services → components and hooks → components return zero results. Components → services may have a small number of type-only imports which are acceptable.

---

### V8: Functional Smoke Test

After all refactoring, manually verify the app still works:

1. Run `npm run dev`
2. Open http://localhost:5173
3. Navigate to each tab: Dịch thuật → Dịch tự động → Từ điển → Lịch sử → Dự án → Hako
4. Verify each tab loads without blank screens or console errors
5. Verify hotkeys work: Alt+1 through Alt+6
6. Verify theme switching (dark/light/sepia)
7. Verify language switching (VI/EN/ZH)

**Expected**: All tabs load. No console errors. All features function as before the refactor.

---

### V9: Test Migration Verification

Verify relocated tests still pass:

```bash
npx vitest run src/config/__tests__/constants.test.ts
npx vitest run src/lib/__tests__/sinoNormalize.test.ts
npx vitest run src/lib/__tests__/text.test.ts
```

**Expected**: All relocated tests pass. Tests for `SERVER_CONFIG` have been removed (dead code).

---

## Rollback Plan

If the refactor introduces breaking changes that cannot be resolved:

1. `git stash` or `git checkout .` to revert all changes
2. Restore `shared/` directory from git history
3. Verify `npm run lint && npm test && npm run build` pass on the reverted state

The refactor is purely structural (file moves + import updates) with no logic changes, so rollback is straightforward.
