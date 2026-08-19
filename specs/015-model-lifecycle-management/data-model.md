# Data Model: Model Lifecycle & Registry Management

## 1. Entities & Schema Definitions

### 1.1 ModelDefinition (`shared/models.ts`)

```typescript
export type ModelSource = 'preset' | 'discovered' | 'custom';
export type ModelStatus = 'active' | 'deprecated' | 'shutdown';

export interface ModelCapabilities {
  generateContent: boolean;
  structuredOutput?: boolean;
  vision?: boolean;
  thinking?: boolean;
}

export interface ModelLimits {
  defaultRpm: number;
  defaultTpm: number;
  defaultRpd?: number;
}

export interface ModelDefinition {
  id: string;                       // Unique model identifier (e.g. 'gemini-2.5-flash')
  label: string;                    // Human-readable title
  source: ModelSource;              // 'preset' | 'discovered' | 'custom'
  status: ModelStatus;              // 'active' | 'deprecated' | 'shutdown'
  capabilities: ModelCapabilities;  // Supported modalities
  replacementId?: string;           // Target model when deprecated/shutdown
  limits?: ModelLimits;             // Default rate limits
  description?: string;             // Detailed model description
  inputTokenLimit?: number;         // Context window size (tokens)
  outputTokenLimit?: number;        // Max generation tokens
  addedAt?: string;                 // ISO date added
  deprecatedAt?: string;            // ISO date deprecated
  shutdownAt?: string;              // ISO date shutdown
}
```

---

### 1.2 ModelMigrationResult (`src/utils/modelRegistry.ts`)

```typescript
export interface ModelMigrationResult {
  effectiveModelId: string;         // Resulting valid active model ID
  wasMigrated: boolean;             // True if the original ID had to be changed
  isDeprecated: boolean;            // True if model is in deprecation window
  isShutdown: boolean;              // True if model was decommissioned
  replacementId?: string;           // Designated successor ID
  reason?: string;                  // Localized explanation of migration
}
```

---

## 2. Model Catalog Matrix

```text
AVAILABLE_MODELS Catalog:
┌─────────────────────────┬──────────┬──────────┬─────────────────────────┐
│ Model ID                │ Status   │ Source   │ Replacement ID          │
├─────────────────────────┼──────────┼──────────┼─────────────────────────┤
│ gemini-3.1-flash-lite   │ active   │ preset   │ (DEFAULT_MODEL_ID)      │
│ gemini-2.5-flash        │ active   │ preset   │ —                       │
│ gemini-2.5-pro          │ active   │ preset   │ —                       │
│ gemma-4-31b-it          │ active   │ preset   │ —                       │
│ gemini-2.0-flash        │ shutdown │ preset   │ gemini-2.5-flash        │
│ gemini-2.0-flash-lite   │ shutdown │ preset   │ gemini-3.1-flash-lite   │
│ gemini-1.5-flash        │ shutdown │ preset   │ gemini-2.5-flash        │
│ gemini-1.5-pro          │ shutdown │ preset   │ gemini-2.5-pro          │
└─────────────────────────┴──────────┴──────────┴─────────────────────────┘
```

---

## 3. Migration Resolution Flow

```mermaid
flowchart TD
    Start([Input: currentModelId]) --> ValidCheck{Valid format?}
    ValidCheck -- No --> FallbackDefault[effectiveModelId = DEFAULT_MODEL_ID<br>wasMigrated = true]
    ValidCheck -- Yes --> DefCheck{Found in registry?}
    
    DefCheck -- No --> KeepUnknown[effectiveModelId = currentModelId<br>wasMigrated = false]
    DefCheck -- Yes --> StatusCheck{def.status}
    
    StatusCheck -- "active" --> ActiveState[effectiveModelId = currentModelId<br>wasMigrated = false]
    StatusCheck -- "deprecated" --> DeprecatedState[effectiveModelId = currentModelId<br>isDeprecated = true<br>wasMigrated = false]
    StatusCheck -- "shutdown" --> ShutdownState[effectiveModelId = def.replacementId || DEFAULT_MODEL_ID<br>wasMigrated = true<br>isShutdown = true]
    
    FallbackDefault --> SaveStorage[Update localStorage if wasMigrated]
    ShutdownState --> SaveStorage
    ActiveState --> End([Return Result])
    DeprecatedState --> End
    KeepUnknown --> End
    SaveStorage --> End
```
