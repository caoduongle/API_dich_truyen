# Data Model & Configuration Schemas: Fix CSP Gemini Model Discovery & Pacing Interval Delay

## 1. Security Headers Configuration

### Content-Security-Policy Directives (Production)

```typescript
export interface HelmetCspDirectives {
  defaultSrc: string[];
  scriptSrc: string[];
  styleSrc: string[];
  fontSrc: string[];
  imgSrc: string[];
  connectSrc: string[];
  frameSrc: string[];
  objectSrc: string[];
  baseUri: string[];
  formAction: string[];
  frameAncestors: string[];
}
```

#### Production `connectSrc` Values:
- `'self'`
- `ws:`
- `wss:`
- `https://generativelanguage.googleapis.com` *(Mới thêm - phục vụ Gemini API)*
- `https://*.googleapis.com` *(Wildcard dự phòng mở rộng cho các API Google)*
- `https://www.googleapis.com`
- `https://accounts.google.com`
- `https://content.googleapis.com`
- `https://oauth2.googleapis.com`
- `https://apis.google.com`

---

## 2. Quota Group Scheduling & Pacing Display

### Scheduling Hint & Pacing Structure

```typescript
export interface GroupSchedulingHint {
  effectiveIntervalMs: number;
  safetyFloorMs: number;
  estimatedThroughputRpm: number;
  source: 'configured' | 'provider' | 'fallback';
}

export interface QuotaGroupDisplayItem {
  id: string;
  name: string;
  projectId?: string;
  healthState: 'Available' | 'InCooldown' | 'Degraded';
  pacingDelayMs?: number;
  schedulingHint?: GroupSchedulingHint;
  keys: Array<{
    keyHash: string;
    maskedKey: string;
    healthState: string;
  }>;
  observedUsage?: {
    requestsThisMinute: number;
    tokensThisMinute: number;
    requestsToday: number;
  };
  configuredLimits?: {
    configuredRpm?: number;
    configuredTpm?: number;
    configuredRpd?: number;
  };
  providerQuota?: {
    rpm?: number;
    tpm?: number;
    rpd?: number;
  };
}
```

### Pacing Display Formatting Function Logic:

```typescript
export function formatGroupPacingLabel(pacingDelayMs?: number, effectiveIntervalMs?: number): string {
  const rawDelay = pacingDelayMs !== undefined ? pacingDelayMs : (effectiveIntervalMs ?? 0);
  const safeDelay = Math.max(0, rawDelay);
  return safeDelay > 0 ? `~${safeDelay}ms/call` : 'Sẵn sàng';
}
```

---

## 3. Direct Gemini Client & Model Inspection Error Model

### Model Inspection Result & Error State

```typescript
export interface ModelInspectResult {
  keyIndex: number;
  models: ModelInfoItem[];
  error?: string;
  errorCode?: 'NO_KEY' | 'CSP_OR_NETWORK_ERROR' | 'API_ERROR' | 'EMPTY_RESPONSE' | 'RATE_LIMITED';
  checkedAt: string;
}
```
