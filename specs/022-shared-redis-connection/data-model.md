# Data Model: Shared Redis Connection Manager & Lifecycle Engine

## 1. Entities & Type Definitions

### 1.1 `RedisConnectionStatus`

```typescript
export type RedisConnectionStatus = 'connected' | 'degraded' | 'disconnected' | 'closed';
```

---

### 1.2 `RedisManagerTelemetry`

```typescript
export interface RedisManagerTelemetry {
  status: RedisConnectionStatus;
  urlConfigured: boolean;
  activeListenersCount: number;
  lastError?: string;
  lastTransitionAt: number;
}
```
