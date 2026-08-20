# Logging Contract: Telemetry Logger & Redaction Specification

## 1. Scope & Invariants

This contract defines the structured telemetry log format emitted during translation attempt execution.

### Security Invariants (MANDATORY)
1. **Zero Raw Key Leakage**: Raw API key strings MUST NEVER appear in console logs, structured metadata, or error stack traces. Only `maskedKey` (e.g. `AIzaSy...ABCD`) or `keyHash` is permitted.
2. **Zero Session Token Leakage**: Authorization tokens, session cookies, and JWT credentials MUST NEVER be logged.
3. **Zero Prompt Payload Leakage**: Full user prompt manuscripts or translated output strings MUST NEVER be logged in operational telemetry. Only character lengths or token counts are permissible.

---

## 2. Attempt Log Format

Every provider attempt execution emits a structured log event with the following fields:

```typescript
export interface TelemetryAttemptLogPayload {
  level: 'info' | 'warn' | 'error';
  eventType: 'provider_attempt';
  requestId: string;                // e.g. "req_m1a2b3_f4e5"
  modelId: string;                  // e.g. "models/gemini-2.5-flash"
  keyIdentifier: string;            // Masked string, e.g. "AIzaSy...9xK2"
  keyIndex: number;                 // 0, 1, 2...
  attempt: number;                  // 1, 2, 3...
  status: 'success' | 'failure';
  errorCode: string | null;         // e.g. "RATE_LIMITED", "OVERLOADED", null
  latencyMs: number;                // e.g. 1420
  queueWaitMs: number;              // e.g. 50
  timestamp: number;
}
```

### Log Line Examples

**Success Attempt:**
```text
[Telemetry] [req_m1a2b3_f4e5] Attempt 1/3 (Key 1: AIzaSy...9xK2, Model: models/gemini-2.5-flash) -> SUCCESS (Latency: 1420ms, QueueWait: 0ms)
```

**Retry Attempt:**
```text
[Telemetry] [req_m1a2b3_f4e5] Attempt 1/3 (Key 1: AIzaSy...9xK2, Model: models/gemini-2.5-flash) -> FAILED [RATE_LIMITED] (Latency: 350ms, QueueWait: 0ms). Rotating to next candidate.
[Telemetry] [req_m1a2b3_f4e5] Attempt 2/3 (Key 2: AIzaSy...1zM4, Model: models/gemini-2.5-flash) -> SUCCESS (Latency: 1210ms, QueueWait: 450ms)
```
