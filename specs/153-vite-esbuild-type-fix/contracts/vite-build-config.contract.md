# Interface Contract: Vite Build Configuration

**Branch**: `153-vite-esbuild-type-fix`  
**Date**: 2026-09-21  
**Target File**: `vite.config.ts`  

---

## 1. Export Interface Contract

`vite.config.ts` serves as the primary build configuration interface consumed by:
1. **TypeScript Type Checker** (`tsc --noEmit` via `npm run lint`)
2. **Vite Development Server** (`vite` via `npm run dev`)
3. **Vite Production Bundler** (`vite build` via `npm run build`)
4. **Vite Preview Server** (`vite preview` via `npm run preview`)

### 1.1 Type Signature

```typescript
import { defineConfig, loadEnv, type UserConfig, type ESBuildOptions } from 'vite';

export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
  // configuration body
  return {
    base: string,
    plugins: PluginOption[],
    resolve: {
      alias: Record<string, string>,
    },
    esbuild: ESBuildOptions,
    build: BuildOptions,
    server: ServerOptions,
    preview: PreviewOptions,
  };
});
```

### 1.2 Overload Resolution Contract

```typescript
// From node_modules/vite/dist/node/index.d.ts
type UserConfigFnObject = (env: ConfigEnv) => UserConfig;

declare function defineConfig(config: UserConfigFnObject): UserConfigFnObject;
```
The exported function MUST match `UserConfigFnObject` directly.

---

## 2. Invariant Contracts

| Property | Invariant / Requirement | Enforcing Test / Mechanism |
|---|---|---|
| `base` | MUST evaluate to `publicConfig.basePath` | `src/utils/__tests__/customDomainAssets.test.ts` (`expect(content).toContain('base: publicConfig.basePath')`) |
| `build.outDir` | MUST be `'dist'` | `src/utils/__tests__/customDomainAssets.test.ts` (`expect(content).toContain("outDir: 'dist'")`) |
| `esbuild.drop` | MUST evaluate to `('console' \| 'debugger')[]` with production values `['console', 'debugger']` and non-production `[]` | `tsc --noEmit` + `npm run build` |
| `server.headers['Content-Security-Policy']` | MUST match static CSP across `render.yaml`, `vercel.json`, and `public/_headers` | `src/tests/cspParity.test.ts` |
| `preview.headers['Content-Security-Policy']` | MUST match static CSP across `render.yaml`, `vercel.json`, and `public/_headers` | `src/tests/cspParity.test.ts` |

---

## 3. Breaking Change Safety

- No changes to plugin interfaces.
- No changes to output directories or asset hashing.
- No changes to runtime or client bundle public paths.
