# Data Model: Project ID Verification & Quota Group Metadata

**Feature**: `048-verify-project-id`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Cấu Trúc Dữ Liệu TypeScript Trong `shared/models.ts`

### 1.1 Project Binding Source & Status
```typescript
export type ProjectBindingSource = 'user' | 'provider' | 'inferred';
export type ProjectVerificationStatus = 'declared' | 'verified' | 'unknown';

export interface ProjectMetadata {
  projectId?: string;
  source: ProjectBindingSource;
  status: ProjectVerificationStatus;
  verifiedAtMs?: number;
}
```

### 1.2 Cập Nhật `QuotaGroup` & `QuotaGroupConfigInput`
```typescript
export interface QuotaGroup {
  id: string;
  projectId?: string;
  projectMetadata?: ProjectMetadata;
  name?: string;
  keyIds: string[];
  configuredLimits: ConfiguredQuota;
  providerQuota?: ProviderQuota;
  observedUsage: GroupObservedUsage;
  schedulingHint: GroupSchedulingHint;
  healthState: GroupHealthState;
  cooldownUntilMs: number;
  nextAllowedTimeMs: number;
  callLog: CallLogEntry[];
}

export interface QuotaGroupConfigInput {
  id?: string;
  projectId?: string;
  projectMetadata?: ProjectMetadata;
  name?: string;
  keyIds?: string[];
  configuredRpm?: number;
  configuredTpm?: number;
  configuredRpd?: number;
  providerQuota?: ProviderQuota;
}
```
