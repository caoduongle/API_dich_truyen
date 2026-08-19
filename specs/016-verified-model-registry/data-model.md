# Data Model: Verified Model Registry

**Branch**: `016-verified-model-registry` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

## Entities

### 1. `ModelDefinition` (Unified Registry Entry)

Represents a model in the registry, whether preset, discovered via API key, or added as a verified custom model.

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
  id: string;                       // Normalized model ID (e.g. 'gemini-2.5-flash')
  label: string;                    // User-facing display title
  source: ModelSource;              // 'preset' | 'discovered' | 'custom'
  status: ModelStatus;              // 'active' | 'deprecated' | 'shutdown'
  verified: boolean;                // true if verified translation-compatible
  lastVerifiedAt?: string;          // ISO 8601 timestamp
  capabilities: ModelCapabilities;  // Supported features (generateContent MUST be true)
  limits?: ModelLimits;             // Rate limits (RPM, TPM, RPD)
  replacementId?: string;           // Recommended active model if deprecated/shutdown
  description?: string;             // Detailed description
  inputTokenLimit?: number;         // Context window size
  outputTokenLimit?: number;        // Max generation tokens
  addedAt?: string;                 // ISO 8601 timestamp of registration
  deprecatedAt?: string;            // ISO 8601 timestamp
  shutdownAt?: string;              // ISO 8601 timestamp
}
```

### 2. `ModelVerificationRequest` & `ModelVerificationResponse`

Data contracts for invoking backend model verification.

```typescript
export interface ModelVerificationRequest {
  modelId: string;
  apiKeys?: string[];
  sessionToken?: string;
}

export interface ModelVerificationResponse {
  success: boolean;
  verified: boolean;
  model?: ModelDefinition;
  error?: string;
  errorCode?: 'MODEL_NOT_FOUND' | 'UNSUPPORTED_METHODS' | 'NO_API_KEY' | 'API_ERROR' | 'INVALID_FORMAT';
  checkedAt: string;
}
```

---

## Validation Rules

1. **Format Validation**:
   - `id` must match `/^[a-zA-Z0-9_\-\.\/]{1,128}$/`.
   - Cannot contain `..` (path traversal prevention) or control characters (`\x00-\x1F\x7F`).
2. **Translation Compatibility Criteria**:
   - `capabilities.generateContent` MUST be `true`.
   - `status` must not be `'shutdown'`.
   - `verified` must be `true`.
3. **Preset Authority**:
   - Models with `source === 'preset'` are permanently `verified: true` and cannot be removed.
4. **Custom Model Verification**:
   - Must be verified via upstream Google AI Studio endpoint before being saved with `verified: true`.
   - If verification fails or model lacks `generateContent`, addition is rejected.

---

## State Transition Diagram

```text
[User inputs Custom ID] ──> [Format Validation] 
                                    │ (valid format)
                                    ▼
                         [Backend Verification]
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
          [generateContent: true]             [404 / Non-generative]
                  │                                   │
                  ▼                                   ▼
    [Register with verified: true]           [Reject + Vietnamese Reason]
                  │
                  ▼
   [Persist in Registry Storage]
```
