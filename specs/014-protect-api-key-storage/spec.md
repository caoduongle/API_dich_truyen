# Feature Specification: Protect API Key Storage and Secure Credential Lifecycle

**Feature Branch**: `014-protect-api-key-storage`

**Created**: 2026-08-19

**Status**: Draft

**Input**: User description: "TASK 01 — BẢO VỆ API KEY STORAGE: Loại bỏ việc lưu API key ở dạng plaintext trong localStorage nếu không thực sự cần thiết, đồng thời thiết kế credential lifecycle an toàn hơn. Audit client/server storage, session lifecycle, credential migration, threat modeling, zero plaintext leakage in responses/logs/URLs, maintain add/remove/validate/translate capabilities."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure Ephemeral Credential Lifecycle & Session Isolation (Priority: P1)

As a translator using the application, I want my Gemini API keys to be securely held in ephemeral memory and exchanged via server-side session tokens rather than lingering indefinitely in plaintext in permanent browser storage, so that my sensitive API credentials are protected from unauthorized access, cross-session leaks, and accidental exposure.

**Why this priority**: Protecting user credentials from exposure is the core security boundary of the application. Unprotected persistent storage creates severe risks of key leakage across shared computers or compromised browser environments.

**Independent Test**: Can be tested by configuring API keys in the settings dialog, performing translation operations using the generated session token, verifying that session tokens authenticate requests without plaintext keys in general request bodies, and observing that clearing or expiring the session cleanly invalidates access without leaving plaintext credentials behind.

**Acceptance Scenarios**:

1. **Given** a user enters one or more valid API keys in the AI Configuration modal, **When** the keys are submitted, **Then** the application establishes an authenticated server session, receives a secure session identifier, and uses that session identifier for subsequent translation and quota requests without sending raw keys in routine payloads.
2. **Given** an active session with registered API keys, **When** the server session expires or becomes invalid, **Then** the application gracefully notifies or re-authenticates the session seamlessly from active memory without interrupting the user or failing silently.
3. **Given** a user explicitly removes or clears their API keys in the UI, **When** the user confirms the action, **Then** the server session is immediately revoked, client in-memory credentials and session tokens are purged, and subsequent requests require new credentials.

---

### User Story 2 - Seamless Migration from Legacy Storage (Priority: P2)

As an existing user who previously configured API keys in an older version of the application, I want the system to safely detect and migrate my existing configuration into the secure lifecycle without losing my keys or crashing the application due to corrupted or malformed data.

**Why this priority**: Existing users should experience zero downtime or breakage upon updating. Legacy data must be cleanly imported and sanitized, preventing crashes while eliminating deprecated insecure storage.

**Independent Test**: Can be tested by seeding the browser's persistent storage with legacy key formats (arrays, single strings, malformed JSON, empty arrays), reloading the app, and verifying that valid keys are loaded into active state, deprecated keys in legacy storage are purged or migrated safely, and malformed entries are ignored with user-friendly warnings.

**Acceptance Scenarios**:

1. **Given** legacy plaintext API keys stored in the browser's persistent storage from a previous version, **When** the application initializes, **Then** the keys are safely imported into the active credential manager, sanitized, synchronized with a new server session, and legacy persistent keys are securely cleared.
2. **Given** corrupted or non-JSON data in legacy storage keys, **When** the application starts up, **Then** it gracefully discards the malformed data without throwing uncaught exceptions or interrupting app rendering.

---

### User Story 3 - Complete Redaction and Zero Key Exposure Across UI, Network, Logs, and URLs (Priority: P3)

As a security-conscious user, I want full assurance that my API keys never appear in plaintext in server logs, API responses, error dialogs, or URL query parameters, so that keys cannot be extracted through network inspection, logging aggregators, or screen captures.

**Why this priority**: Defense-in-depth requires that even in cases of unexpected exceptions or inspection, credentials remain masked and redacted across all system boundaries.

**Independent Test**: Can be tested by triggering quota lookups, model discovery calls, simulated error responses, and checking network payloads, server structured logs, and UI displays to confirm only masked representations (e.g. `AIzaSy...4xAb`) or cryptographic hashes are exposed.

**Acceptance Scenarios**:

1. **Given** an API request for quota status or model capability inspection, **When** the server responds, **Then** the response contains only masked key labels and cryptographic identifiers, never the plaintext key strings.
2. **Given** an error or diagnostic event during translation or key validation, **When** log entries or user-facing error messages are generated, **Then** all API key patterns and query tokens are automatically redacted with placeholders.
3. **Given** any HTTP GET or POST request to backend endpoints, **When** the request URL is constructed, **Then** API keys are never passed as URL search/query parameters.

---

### Edge Cases

- **Missing Credentials**: When a user attempts translation or quota inspection with zero keys configured and server fallback disabled, the system MUST return a clear, localized message prompting key entry without failing or throwing unhandled errors.
- **Invalid / Revoked Credentials**: When an API key is rejected by the upstream AI provider (e.g. 400/403/invalid key), the system MUST mark that specific key as authentication-failed, isolate it from rotation, and notify the user without exposing the raw key in the alert.
- **Server Restart / Session Loss**: When the backend restarts or Redis state is flushed, active frontend tabs holding in-memory credentials MUST automatically re-establish a valid session upon the next user interaction without requiring manual re-entry.
- **Simultaneous Multiple Browser Tabs**: When multiple tabs are open on the same origin, credential updates in one tab MUST synchronize cleanly without causing race conditions or invalidating valid sessions unexpectedly.
- **Offline / Local Mode**: When the application is operated in a standalone client-only environment, credential management MUST retain key addition, deletion, validation, and editing capabilities within client-controlled memory/session boundaries.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support client-to-server credential delegation where the browser transmits credentials during session establishment and references subsequent operations via an opaque session identifier (`SessionToken`).
- **FR-002**: System MUST NOT store API keys in permanent browser plaintext storage (`localStorage`) by default, instead managing keys in active memory and session-scoped storage during the user's working session.
- **FR-003**: System MUST provide an automatic, fault-tolerant migration mechanism that reads legacy persistent storage on startup, imports valid API keys into the secure session lifecycle, cleans up legacy keys, and handles malformed or empty payloads without crashing.
- **FR-004**: System MUST ensure that server-side session stores enforce a sliding time-to-live (TTL) expiration policy and provide an explicit session revocation endpoint.
- **FR-005**: System MUST ensure that no backend endpoint ever returns plaintext API keys in response bodies, diagnostic endpoints, or quota status responses; only masked keys and non-reversible hashes may be returned.
- **FR-006**: System MUST ensure that API keys are never included as URL query parameters or search parameters in any HTTP request between frontend and backend.
- **FR-007**: System MUST automatically redact API keys, access tokens, and passwords from all server logs, diagnostic traces, and client-side error notifications.
- **FR-008**: System MUST preserve full user control over credentials, including adding new keys, updating existing keys, deleting individual keys, batch pasting from clipboard, and manually clearing all stored keys.
- **FR-009**: System MUST support automatic session recovery: when a request fails due to an expired or missing server session (401 `sessionExpired`), the client MUST automatically re-synchronize active credentials and transparently retry the operation once.
- **FR-010**: System MUST support key rotation and quota tracking while maintaining the masking guarantee across all dashboard and status components.

### Key Entities *(include if feature involves data)*

- **Session Credential Record**: Represents an active, server-managed credential session containing an array of valid API keys, creation timestamp, last accessed timestamp, and expiration timestamp.
- **Session Identifier (`SessionToken`)**: An opaque, cryptographically random token (UUIDv4) that uniquely references a Session Credential Record without exposing key material.
- **Masked Key Representation**: A privacy-preserving string displaying only the prefix and suffix of an API key (e.g., `AIzaSy...1234`) alongside its non-reversible cryptographic hash (`keyHash`), used for UI identification and per-key usage tracking.
- **Credential Migration Record**: An internal descriptor tracking the status and outcome of migrating legacy persistent keys to session-based credential storage.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of standard translation, glossary extraction, and quota requests execute without plaintext API keys in request bodies (using session identifiers instead).
- **SC-002**: 0 instances of plaintext API keys appear in server log outputs, network response payloads, or URL query parameters across all test suites.
- **SC-003**: 100% of legacy persistent storage formats (valid arrays, empty lists, malformed strings) are safely migrated or discarded on startup without application runtime exceptions.
- **SC-004**: All existing core features—adding keys, editing keys, deleting keys, clipboard importing, model selection, translation, and quota tracking—remain 100% functional with all test suites passing.
- **SC-005**: Session expiration and re-synchronization flows complete transparently within 1 automated retry cycle without requiring user intervention during an active session.

## Assumptions

- The primary operational model is a user interacting with the Web UI served by the local/remote backend server.
- Browser memory (`useAIConfig` / React state / `sessionStorage`) is sufficient to maintain user credentials during an active browser session.
- Users who intentionally refresh or reopen their browser session can either leverage session storage for the active browser session or re-enter credentials if complete ephemeral security is required.
- The server session store operates with an in-memory fallback if Redis is not configured or unavailable.
- Upstream Google Gemini API endpoints still require valid API keys supplied by the backend execution service.
