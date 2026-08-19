# Feature Specification: Model Lifecycle Management & Shutdown Model Deactivation

**Feature Branch**: `015-model-lifecycle-management`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "TASK 02 — LOẠI BỎ MODEL ĐÃ SHUTDOWN + MODEL LIFECYCLE: Audit toàn bộ model preset/hard-code trong repo và loại model đã shutdown khỏi trạng thái active. Mỗi model phải có lifecycle: active, deprecated, shutdown; replacementId, deprecatedAt, shutdownAt. Behavior: Active cho chọn/dùng; Deprecated hiện cảnh báo & recommended replacement; Shutdown không cho chọn mới, tự động detect & migrate sang replacement/fallback active model mà không crash app. Kiểm tra lifecycle chính thức từ Google Gemini."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Active Model Selection & Safe Presets Catalog (Priority: P1) 🎯 MVP

As a translator using the application, I want the system's preset model catalog to exclusively offer active, supported Gemini and local models (such as Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 3.1 Flash Lite) for selection, so that all translation jobs succeed without failing on non-existent or decommissioned model endpoints.

**Why this priority**: Offering retired models causes immediate translation failure (404/upstream model not found). Ensuring only active models are selectable is essential for operational reliability.

**Independent Test**: Can be tested by opening the AI Configuration modal, inspecting the model selection dropdown, and verifying that all preset options correspond to active models, with `gemini-3.1-flash-lite` or `gemini-2.5-flash` available and functioning.

**Acceptance Scenarios**:

1. **Given** a user opens the AI Configuration modal, **When** they view the list of available models, **Then** only models with `active` or `deprecated` status appear in the selection menu, and no `shutdown` models are offered for new selection.
2. **Given** a selected active model, **When** a translation job or quota check is executed, **Then** the request successfully routes to the active model endpoint without lifecycle errors.

---

### User Story 2 - Automated Migration & Safe Fallback for Persisted Shutdown Models (Priority: P2)

As an existing user who previously configured a model that has since been decommissioned by Google (such as `gemini-2.0-flash` or `gemini-1.5-flash`), I want the application to automatically detect the shutdown status on startup, transparently migrate my selection to the designated replacement model (or the active default model), update persistent storage, and notify me without crashing the application.

**Why this priority**: Users upgrading from older versions must not experience broken translation runs or runtime crashes due to stale persisted model identifiers.

**Independent Test**: Can be tested by manually setting `localStorage.setItem('gemini_selected_model', 'gemini-2.0-flash')`, initializing the application hook, and confirming that the effective model becomes `gemini-2.5-flash` with a clean migration notification and updated storage.

**Acceptance Scenarios**:

1. **Given** a user has stored a `shutdown` model ID (e.g. `gemini-2.0-flash`), **When** the application initializes or the model registry evaluates the selection, **Then** the system automatically updates the selected model to its `replacementId` (`gemini-2.5-flash`), persists the updated ID, and records a clear migration reason.
2. **Given** a user has stored an invalid, unparseable, or completely unknown model ID, **When** the application initializes, **Then** the system automatically falls back to `DEFAULT_MODEL_ID` (`gemini-3.1-flash-lite`) without throwing unhandled exceptions.

---

### User Story 3 - Visual Lifecycle Indicators & Deprecation Warnings (Priority: P3)

As a user considering model options, I want to see clear lifecycle status badges (Active, Deprecated, Shutdown) and recommended replacements in the UI, so that I can make informed choices before a model reaches its official shutdown date.

**Why this priority**: Providing timely warnings for deprecated models allows translators to transition their workflows and custom prompts smoothly before full decommission.

**Independent Test**: Can be tested by selecting a model marked as `deprecated` and observing the warning badge and recommended replacement advice in the Model Summary Card, while still allowing the translation to proceed.

**Acceptance Scenarios**:

1. **Given** a model marked with status `deprecated`, **When** the user views the model in the AI Configuration modal, **Then** a warning badge and a recommendation pointing to the replacement model are displayed, while retaining operational execution.
2. **Given** a custom or discovered model inspected in the Quota panel, **When** lifecycle attributes are displayed, **Then** the user can clearly distinguish its source and status.

---

### Edge Cases

- **Custom Model with Shutdown ID**: If a user manually added a custom model matching a shutdown Google ID, the migration engine MUST flag the status as `shutdown` and recommend switching to the active alternative.
- **Null / Corrupted Persistent Storage**: If `localStorage['gemini_selected_model']` is empty, corrupted, or non-string, the system MUST default to `DEFAULT_MODEL_ID` (`gemini-3.1-flash-lite`).
- **Discovered Models from API Key**: When API keys discover available models dynamically, models matching decommissioned patterns MUST be filtered out or flagged as `shutdown`.
- **Offline / Local Model**: Models with local execution capability (e.g. `gemma-4-31b-it`) remain active and unaffected by cloud API deprecation schedules.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every model definition across the application (`shared/models.ts`, `server/constants/models.ts`, `src/utils/modelRegistry.ts`) MUST declare a strict lifecycle status: `active`, `deprecated`, or `shutdown`.
- **FR-002**: Every model with status `deprecated` or `shutdown` SHOULD define a `replacementId` specifying the recommended active successor model, alongside optional `deprecatedAt` and `shutdownAt` ISO date strings.
- **FR-003**: The model registry MUST classify `gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-1.5-flash`, and `gemini-1.5-pro` as `shutdown` with official shutdown dates and valid active replacements.
- **FR-004**: The default preset model catalog (`AVAILABLE_MODELS`) MUST only designate active, operational models as primary presets (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3.1-flash-lite`, `gemma-4-31b-it`).
- **FR-005**: The UI model selection dropdown (`ApiSettings.tsx`) MUST NOT include `shutdown` models in the list of selectable options.
- **FR-006**: The migration handler `migrateModelSelection(modelId)` MUST detect if a persisted model is `shutdown` or invalid, automatically resolve the effective model to `replacementId` or `DEFAULT_MODEL_ID`, update persistent storage, and return complete migration diagnostics without crashing.
- **FR-007**: The Model Summary Card in `ApiSettings.tsx` MUST render appropriate visual badges:
  - `deprecated`: Warning badge with recommended replacement link/text.
  - `shutdown`: Danger badge informing the user that the model has been decommissioned.
- **FR-008**: System constants `DEFAULT_MODEL_ID` and `ALLOWED_MODEL_IDS` MUST be synchronized across frontend, backend, and documentation (`README.md`, `shared/models.ts`).

### Key Entities *(include if feature involves data)*

- **ModelDefinition**: Core entity describing a model's ID, display label, source (`preset`, `discovered`, `custom`), lifecycle status (`active`, `deprecated`, `shutdown`), capabilities (content generation, structured output, vision, thinking), rate limits, token limits, and replacement metadata.
- **ModelMigrationResult**: Represents the outcome of evaluating a persisted model ID, containing `effectiveModelId`, `wasMigrated`, `isDeprecated`, `isShutdown`, `replacementId`, and `reason`.
- **ModelLifecycleState**: Enumeration of valid lifecycle stages: `active` (operational), `deprecated` (functioning with pending retirement), `shutdown` (decommissioned and inaccessible).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 shutdown models (`gemini-2.0-flash`, `gemini-1.5-flash`, etc.) appear as selectable options in the UI model dropdown.
- **SC-002**: 100% of persisted legacy or decommissioned model IDs are automatically migrated to active replacement models on startup with 0 runtime crashes.
- **SC-003**: 100% of unit and integration tests covering model selection, validation, and migration pass cleanly.
- **SC-004**: System documentation (`README.md`) and server model whitelists reflect the updated active model family.

## Assumptions

- Google Gemini 2.0 and 1.5 series models have reached official shutdown in 2025/2026.
- Active Gemini 2.5 and 3.1 models provide backward-compatible translation prompt execution without requiring prompt rewrites.
- Model migration is idempotent: running `migrateModelSelection` multiple times on an already migrated ID returns `wasMigrated: false` with the valid active model.
