# Data Model: Custom Model Verification & State Governance

**Feature**: `specs/035-custom-model-verification/spec.md`  
**Created**: 2026-08-20  

---

## 1. Type Definitions

### 1.1 `ModelVerificationState` & `ModelDefinition` (`shared/models.ts`)

```typescript
export type ModelSource = 'preset' | 'discovered' | 'custom';
export type ModelStatus = 'active' | 'deprecated' | 'shutdown';

export type ModelVerificationState = 
  | 'unverified' 
  | 'verifying' 
  | 'verified' 
  | 'invalid' 
  | 'deprecated' 
  | 'shutdown';

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
  id: string;
  label: string;
  source: ModelSource;
  status: ModelStatus;
  verified: boolean;
  verificationState?: ModelVerificationState;
  verificationError?: string;
  lastVerifiedAt?: string;
  capabilities: ModelCapabilities;
  replacementId?: string;
  limits?: ModelLimits;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  addedAt?: string;
  deprecatedAt?: string;
  shutdownAt?: string;
}
```

---

## 2. State Machine: Model Verification Lifecycle

```text
               ┌───────────────────────┐
               │   User Inputs Model   │
               └──────────┬────────────┘
                          │ (Syntax Check)
                          ▼
               ┌───────────────────────┐
               │      unverified       │
               └──────────┬────────────┘
                          │ Provider Verification Request
                          ▼
               ┌───────────────────────┐
               │       verifying       │
               └──────┬─────────┬──────┘
                      │         │
        Success +     │         │ Failure / 404 /
    generateContent   │         │ No generateContent / Timeout
                      ▼         ▼
               ┌────────────┐ ┌────────────┐
               │  verified  │ │  invalid   │
               └──────┬─────┘ └────────────┘
                      │ (Over time)
        ┌─────────────┴─────────────┐
        ▼                           ▼
 ┌──────────────┐            ┌──────────────┐
 │  deprecated  │            │   shutdown   │
 └──────────────┘            └──────────────┘
```

### State Definitions:
- **`unverified`**: Model entered into system but not yet checked against provider. Cannot be selected for translation. `verified = false`.
- **`verifying`**: Verification request in-flight to Google AI Studio. UI displays loading indicator.
- **`verified`**: Provider confirmed existence and `generateContent` capability. Model is active, verified, and selectable. `verified = true`.
- **`invalid`**: Verification failed (model does not exist, unsupported methods, or permission denied). Stored with error details. `verified = false`.
- **`deprecated`**: Model verified in the past but marked for deprecation by provider. Usable with warning and replacement suggestion.
- **`shutdown`**: Model permanently turned off by provider. Automatically migrated to `replacementId` or `DEFAULT_MODEL_ID`.

---

## 3. Storage Schema (`localStorage`)

### `CUSTOM_MODELS_STORAGE_KEY` (`gemini_custom_models`)

```json
[
  {
    "id": "tunedModels/my-novel-v1",
    "label": "Mô hình dịch Tiên Hiệp (Tuned)",
    "source": "custom",
    "status": "active",
    "verified": true,
    "verificationState": "verified",
    "lastVerifiedAt": "2026-08-20T06:00:00.000Z",
    "capabilities": {
      "generateContent": true,
      "vision": true,
      "thinking": false
    },
    "limits": {
      "defaultRpm": 15,
      "defaultTpm": 1000000,
      "defaultRpd": 1500
    },
    "description": "Fine-tuned model on literary translations",
    "inputTokenLimit": 1048576,
    "outputTokenLimit": 8192,
    "addedAt": "2026-08-20T06:00:00.000Z"
  }
]
```
