# Contract: Frontend Quota UI & Group Configuration Components

## Component: `QuotaPanel`

### Props Interface

```typescript
export interface QuotaPanelProps {
  groups: QuotaGroupDisplayItem[];
  logicalSummary: LogicalSummaryDisplay;
  schedulerTelemetry: SchedulerTelemetryDisplay;
  selectedModel: string;
  onUpdateGroupLimit: (groupId: string, field: 'configuredRpm' | 'configuredTpm' | 'configuredRpd', value: number) => void;
  onRefresh: () => void;
}

export interface QuotaGroupDisplayItem {
  id: string;
  projectId?: string;
  name: string;
  healthState: GroupHealthState;
  configuredLimits: ConfiguredQuota;
  providerQuota: ProviderQuota;
  observedUsage: GroupObservedUsage;
  schedulingHint: GroupSchedulingHint;
  cooldownRemainingMs: number;
  keys: Array<{
    id: string;
    maskedKey: string;
    healthState: KeyHealthState;
    circuitBreaker: CircuitBreakerStatus;
    cooldownRemainingMs: number;
    lastUsedFormatted: string;
    attemptsToday: number;
  }>;
}
```

### Visual Rendering Requirements
1. **Quota Group Cards**: Each Quota Group displays its aggregated 60-second sliding-window RPM gauge, TPM gauge, and PST midnight RPD gauge.
2. **Strict Metric Classification**: Labels clearly distinguish:
   - `Đã sử dụng (Observed)` vs. `Giới hạn cấu hình (Configured)` vs. `Mặc định theo Tier (Default Tier)`.
   - Explicit disclaimer when provider limits are heuristic vs. provider-confirmed.
3. **Nested Key Status List**: Inside each Quota Group card, member keys are displayed with compact health badges (`Healthy`, `Degraded`, `RateLimited`, `AuthFailed`, `InCooldown`, `Disabled`).
