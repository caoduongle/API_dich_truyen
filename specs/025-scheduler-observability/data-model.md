# Data Model: Scheduler Observability & Telemetry

## 1. Entities & Type Definitions

### 1.1 RequestAttemptLog (Attempt Trace Record)

Represents an individual physical upstream call dispatched to a Gemini API key within the context of a logical request.

```typescript
export interface RequestAttemptLog {
  requestId: string;              // Correlation ID shared across all attempts in this logical request
  modelId: string;                // Model identifier (e.g. "models/gemini-2.5-flash")
  keyIdentifier: string;          // Masked API key (e.g. "AIzaSy...ABCD") or keyHash
  keyIndex: number;               // 0-indexed position in configured key array
  attempt: number;                // 1-based attempt index (1, 2, 3...)
  status: 'success' | 'failure';  // Execution status of this attempt
  errorCode: string | null;       // Standardized AIErrorCode (e.g. "RATE_LIMITED", "OVERLOADED") or null
  latencyMs: number;              // Wall-clock execution time of this attempt in milliseconds
  queueWaitMs: number;            // Pacing delay or queue wait time before dispatching this attempt
  timestamp: number;              // Epoch timestamp when attempt completed
}
```

---

### 1.2 SchedulerTelemetry (Scheduler Decision Metrics)

Tracks key evaluation counts, queue wait times, and rejection reason categorization.

```typescript
export type KeyRejectionReason =
  | 'in_cooldown'
  | 'circuit_breaker_open'
  | 'rate_limited_pacing'
  | 'unsupported_model'
  | 'quota_exhausted'
  | 'disabled';

export interface SchedulerTelemetry {
  selectionCount: number;                        // Total key evaluation / candidate scoring passes
  queueWaitTotalMs: number;                      // Total time (ms) requests spent waiting in pacing / queue
  queueWaitAvgMs: number;                        // Average queue wait time per request
  rejectedTotal: number;                         // Total key candidate rejections during scheduling
  rejectedByReason: Record<string, number>;      // Rejection tallies keyed by KeyRejectionReason
}
```

---

### 1.3 ModelObservabilityMetrics (Per-Model Performance & Latency)

Maintains granular performance and latency distribution per model ID.

```typescript
export interface ModelObservabilityMetrics {
  requestsTotal: number;       // Total provider attempts dispatched to this model
  requestsToday: number;       // Attempts today
  errorsTotal: number;         // Errors encountered by this model
  errorsToday: number;         // Errors today
  totalLatencyMs: number;      // Cumulative latency of all attempts
  avgLatencyMs: number;        // Average latency per attempt
  minLatencyMs: number;        // Minimum recorded latency
  maxLatencyMs: number;        // Maximum recorded latency
  tokensTotal: number;         // Cumulative tokens processed
  tokensToday: number;         // Tokens processed today
}
```

---

### 1.4 KeyObservabilityMetrics (Per-Key Health & Quota Event Telemetry)

Enriches the key snapshot with quota limit triggers and cooldown state transition counters.

```typescript
export interface KeyObservabilityMetrics {
  attemptsTotal: number;        // Total attempts made using this key
  attemptsToday: number;        // Attempts today
  errorsTotal: number;          // Total errors encountered
  quotaEventsTotal: number;     // Total 429 / RPM / RPD quota events triggered
  cooldownEventsTotal: number;  // Total times this key entered Cooldown or Degraded state
}
```

---

### 1.5 Enhanced QuotaStatusResponse (API Response Payload)

Aggregates logical summary, scheduler telemetry, per-model telemetry, and per-key snapshots.

```typescript
export interface QuotaStatusResponse {
  keys: KeyQuotaSnapshot[];
  summary: LogicalSummaryStats;
  scheduler: SchedulerTelemetry;
  byModel: Record<string, ModelObservabilityMetrics>;
  recentAttempts?: RequestAttemptLog[]; // Bounded rolling window of recent attempts (e.g. last 50)
  timestamp: number;
}
```
