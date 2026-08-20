# API & Service Contract: Project ID Verification & Metadata Tracking

**Feature**: `048-verify-project-id`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Giao Diện Service Trong `quotaService.ts`

```typescript
export interface IProjectVerificationService {
  /**
   * Đăng ký Quota Group kèm phân định metadata dự án
   */
  registerQuotaGroup(input: QuotaGroupConfigInput): QuotaGroup;

  /**
   * Xác thực và nâng cấp trạng thái dự án của một Quota Group thành provider-verified
   */
  verifyGroupProject(groupId: string, verifiedProjectId: string, verifiedAtMs?: number): boolean;

  /**
   * Kiểm tra xem 2 API keys có chắc chắn thuộc cùng một Provider Quota Bucket hay không
   */
  areKeysInSameVerifiedBucket(keyA: string, keyB: string): boolean;
}
```
