# Contract: Model Selection Migration & Deprecation Warning

## 1. Migration Signature (`src/utils/modelRegistry.ts`)

```typescript
export function migrateModelSelection(currentModelId: string): ModelMigrationResult;
```

### Behavior Matrix

| Input `currentModelId` | Registry State | `effectiveModelId` | `wasMigrated` | `isDeprecated` | `isShutdown` |
|---|---|---|---|---|---|
| `""` or invalid string | N/A | `DEFAULT_MODEL_ID` | `true` | `false` | `false` |
| `'gemini-3.1-flash-lite'` | `active` | `'gemini-3.1-flash-lite'` | `false` | `false` | `false` |
| `'gemini-2.5-flash'` | `active` | `'gemini-2.5-flash'` | `false` | `false` | `false` |
| `'gemini-2.0-flash'` | `shutdown` (repl: `gemini-2.5-flash`) | `'gemini-2.5-flash'` | `true` | `false` | `true` |
| `'gemini-2.0-flash-lite'`| `shutdown` (repl: `gemini-3.1-flash-lite`) | `'gemini-3.1-flash-lite'` | `true` | `false` | `true` |
| `'gemini-1.5-flash'` | `shutdown` (repl: `gemini-2.5-flash`) | `'gemini-2.5-flash'` | `true` | `false` | `true` |
| `'deprecated-model'` | `deprecated` (repl: `new-model`) | `'deprecated-model'` | `false` | `true` | `false` |
| `'unregistered-custom'` | Not in registry | `'unregistered-custom'` | `false` | `false` | `false` |

---

## 2. UI Dropdown Options Contract (`src/components/ApiSettings.tsx`)

### Filtering Invariant
The `<optgroup label="Mô hình khuyên dùng (Presets)">` MUST only render presets that are NOT `shutdown`:
```typescript
const presets = availableModels.filter(m => m.source === 'preset' && m.status !== 'shutdown');
```
This guarantees that shutdown models are never presented to the user as viable options.
