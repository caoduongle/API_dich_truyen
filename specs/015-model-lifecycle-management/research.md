# Research & Model Lifecycle Architecture: Model Lifecycle Management & Shutdown Deactivation

## Phase 0: Outline & Technical Research

### 1. Official Google Gemini Model Lifecycle Audit

Based on official Google AI for Developers release schedules and deprecation timelines as of 2026:

| Model ID | Official Status | Deprecation Date | Shutdown Date | Official Replacement |
|---|---|---|---|---|
| `gemini-1.0-pro` | `shutdown` | 2024-06-01 | 2024-10-01 | `gemini-2.5-flash` |
| `gemini-1.5-flash` | `shutdown` | 2025-06-01 | 2025-10-01 | `gemini-2.5-flash` |
| `gemini-1.5-pro` | `shutdown` | 2025-06-01 | 2025-10-01 | `gemini-2.5-pro` |
| `gemini-2.0-flash` | `shutdown` | 2026-02-01 | 2026-06-01 | `gemini-2.5-flash` |
| `gemini-2.0-flash-lite` | `shutdown` | 2026-02-01 | 2026-06-01 | `gemini-3.1-flash-lite` |
| `gemini-2.5-flash` | `active` | — | — | — |
| `gemini-2.5-pro` | `active` | — | — | — |
| `gemini-3.1-flash-lite` | `active` | — | — | — |
| `gemma-4-31b-it` | `active` | — | — | — |

---

### 2. Architecture Decisions & Design Trade-offs

#### Decision 1: Maintain Shutdown Definitions in Registry for Safe Migration
- **Decision**: Keep shutdown models cataloged in `AVAILABLE_MODELS` with `status: 'shutdown'` and `replacementId`, rather than deleting them entirely from code.
- **Rationale**: If a user has `gemini-2.0-flash` persisted in `localStorage` from an older version, deleting the definition completely would make it an "unknown model" without replacement metadata. Keeping the definition with `status: 'shutdown'` allows `migrateModelSelection` to know exactly what replacement model to transition the user to (`gemini-2.5-flash`), explaining the change clearly.
- **Alternatives Considered**:
  - *Completely remove shutdown model IDs from the code*: Causes the migration handler to treat them as unknown models, falling back to a generic default rather than the model's tailored replacement.

#### Decision 2: Exclude Shutdown Models from Active Selection UI
- **Decision**: In `ApiSettings.tsx`, filter out all models where `status === 'shutdown'` from the primary `<select>` dropdown.
- **Rationale**: Prevents users from accidentally picking a dead model endpoint that will return upstream HTTP 404/400 errors.
- **Alternatives Considered**:
  - *Disable the option in dropdown*: Still clutters the UI with unusable legacy options.

#### Decision 3: Automatic Startup Migration in `useAIConfig`
- **Decision**: In `useAIConfig.ts`, evaluate `migrateModelSelection` on the persisted `gemini_selected_model`. If `wasMigrated === true`, immediately write the new `effectiveModelId` back to `localStorage` and initialize state with it.
- **Rationale**: Guarantees that active translation requests are immediately directed to a functioning model without requiring manual user intervention in the settings modal.
- **Alternatives Considered**:
  - *Block translation and force user to open modal*: Disconnects automated workflows and batch processing.

#### Decision 4: Non-blocking Warnings for Deprecated Models
- **Decision**: Models with status `deprecated` remain selectable and operable, but display a warning badge and recommended replacement model in `ModelSummaryCard`.
- **Rationale**: Honors Google's deprecation grace period, giving users time to transition before hard shutdown.
