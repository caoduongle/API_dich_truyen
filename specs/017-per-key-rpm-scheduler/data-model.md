# Data Model: Quota-Aware Per-Key RPM Scheduler & Rotation Pipeline

## 1. Entities & Type Definitions

### 1.1 KeyPacingConfig

```typescript
export interface KeyPacingConfig {
  key: string;                      // Raw or hashed key identifier
  rpm: number;                      // Effective RPM limit (e.g. 15, 60, 120)
  maxTpm: number;                   // Effective TPM limit (default: 1,000,000)
  maxRpd?: number;                  // Effective daily request limit (default: 1,500)
  intervalMs: number;               // Safety dispatch interval (ms)
  nextAllowedTimestamp: number;     // Monotonic timestamp when key is next ready
}
```

---

### 1.2 CandidateKeyEvaluation

```typescript
export interface CandidateKeyEvaluation {
  key: string;
  originalIndex: number;
  isEligible: boolean;
  rejectReason?: string;
  pacingDelayMs: number;
  score: number;
  scoreBreakdown: {
    rpmCapacityScore: number;
    tpmCapacityScore: number;
    idleTimeScore: number;
    pacingReadinessBonus: number;
    errorPenalty: number;
    modelSupportBonus: number;
  };
}
```

---

### 1.3 KeySchedulerResult

```typescript
export interface KeySchedulerResult {
  selectedKey: string;
  selectedKeyIndex: number;
  pacingDelayMs: number;
  sortedCandidates: CandidateKeyEvaluation[];
  exhaustedCandidates: CandidateKeyEvaluation[];
}
```

---

## 2. Decision Tree & Filtering Pipeline

```mermaid
flowchart TD
    Req([Incoming Dispatch Request]) --> Pool[Candidate Key Pool]
    
    Pool --> F1{1. Disabled / AuthFailed?}
    F1 -- Yes --> R1[Reject: Invalid / Disabled]
    F1 -- No --> F2{2. Active Cooldown / Circuit Breaker?}
    
    F2 -- Yes --> R2[Reject: Cooldown / Breaker Open]
    F2 -- No --> F3{3. Model Supported?}
    
    F3 -- Incompatible --> R3[Reject: Model Unsupported]
    F3 -- Yes / Uninspected --> F4{4. Within 60s RPM Limit?}
    
    F4 -- No --> R4[Reject: Minute RPM Exhausted]
    F4 -- Yes --> F5{5. Within 60s TPM Limit?}
    
    F5 -- No --> R5[Reject: Minute TPM Exhausted]
    F5 -- Yes --> F6{6. Within Daily RPD Limit?}
    
    F6 -- No --> R6[Reject: Daily RPD Exhausted]
    F6 -- Yes --> Scoring[Score Key: Capacity + Idle + Readiness - Errors]
    
    Scoring --> Rank[Sort Eligible Keys by Score Descending]
    Rank --> PickBest[Select Top Key & Reserve Per-Key Interval]
    PickBest --> Dispatch([Execute Request])
```
