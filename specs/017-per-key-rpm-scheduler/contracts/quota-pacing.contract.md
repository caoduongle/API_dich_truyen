# Contract: Quota Pacing & Variable Interval Formula

## 1. Pacing Calculation Formula

```typescript
export function computePerKeyIntervalMs(
  rpm?: number,
  modelId?: string,
  safetyFloorMs: number = 400
): number {
  if (typeof rpm === 'number' && rpm > 0) {
    return Math.max(safetyFloorMs, Math.ceil(60000 / (rpm * 0.9)));
  }
  const norm = modelId ? modelId.toLowerCase() : '';
  if (norm.includes('pro')) return 6000;      // 10 RPM
  if (norm.includes('flash-lite')) return 3500; // 17 RPM
  if (norm.includes('gemma')) return 2000;    // 30 RPM
  return 4445;                                // 15 RPM standard Free tier
}
```

### Invariants
1. Backend pacing enforces a hard minimum safety floor of `400ms` (`PACING_SAFETY_FLOOR_SERVER_MS`).
2. Client pacing enforces a safety floor of `500ms` (`PACING_SAFETY_FLOOR_CLIENT_MS`).
3. Advancing one key's `nextAllowedTime` does not mutate other keys' timestamps.
