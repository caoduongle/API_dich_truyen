# Data Model: Real Health, Liveness & Readiness Endpoints

## 1. DTOs & Response Contracts

### 1.1 Liveness Response (`/api/live`)

```typescript
export interface LivenessResponse {
  status: 'alive';
  timestamp: string;
  uptimeSeconds: number;
}
```

---

### 1.2 Readiness Response (`/api/ready`)

```typescript
export interface ReadinessResponse {
  status: 'healthy' | 'degraded' | 'unavailable';
  ready: boolean;
  timestamp: string;
  dependencies: {
    redis: 'connected' | 'degraded' | 'disconnected' | 'closed' | 'standalone-in-memory';
    memory: 'ok' | 'high';
  };
}
```

---

### 1.3 Health Diagnostics Response (`/api/health`)

```typescript
export interface HealthDiagnosticsResponse {
  status: 'healthy' | 'degraded' | 'unavailable';
  timestamp: string;
  uptime: string;
  uptimeSeconds: number;
  environment: string;
  memory: {
    rssMB: number;
    heapTotalMB: number;
    heapUsedMB: number;
    externalMB: number;
  };
  redis: {
    enabled: boolean;
    status: string;
    mode: 'redis' | 'in-memory-fallback' | 'standalone-in-memory';
  };
  sessions: {
    activeCount: number;
  };
  models: {
    supported: string[];
  };
}
```
