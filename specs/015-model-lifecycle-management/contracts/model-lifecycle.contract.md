# Contract: Model Lifecycle & Preset Registry Interface

## 1. Model Registry Exports (`shared/models.ts` & `src/utils/modelRegistry.ts`)

### Functions & Constants

```typescript
export const AVAILABLE_MODELS: ModelDefinition[];
export const ALLOWED_MODEL_IDS: string[];
export const DEFAULT_MODEL_ID: string;

export function getPresetModels(): RegisteredModelDef[];
export function getRegisteredModels(): RegisteredModelDef[];
export function getModelDefinition(modelId: string): RegisteredModelDef | undefined;
export function getModelDisplayName(modelId: string): string;
```

### Invariants
1. `AVAILABLE_MODELS` contains definitions for both active presets and cataloged historical/shutdown models.
2. `getPresetModels()` maps `AVAILABLE_MODELS` with preserved status tags.
3. `getRegisteredModels()` merges presets, discovered models, and custom models with strict deduplication (Presets > Custom > Discovered).
4. `ALLOWED_MODEL_IDS` contains the set of valid model IDs accepted by the server backend router.
