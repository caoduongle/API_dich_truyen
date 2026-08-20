# API & Service Contract: Single Scheduler Authority

**Feature**: `040-single-scheduler-authority`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Giao Diện Service Interface (`IQuotaSchedulerAuthority`)

```typescript
export interface IQuotaSchedulerAuthority {
  /**
   * Cấp phép thực thi cho 1 attempt gọi API:
   * - Đánh giá eligibility của các QuotaGroup liên quan
   * - Chọn group tối ưu và key tối ưu
   * - Tính toán pacing delay và đặt chỗ thời gian an toàn một cách nguyên tử
   */
  scheduleAttempt(
    candidateKeys: string[],
    modelName: string,
    estimatedTokens?: number,
    now?: number
  ): ScheduleLease;

  /**
   * Ghi nhận lượt gọi thành công của một attempt
   */
  recordGroupUsage(
    groupId: string,
    key: string,
    modelName: string,
    status: 'success' | 'rate_limited' | 'quota_exceeded' | 'overloaded' | 'error',
    timestamp?: number,
    tokenUsage?: { promptTokens: number; outputTokens: number; totalTokens: number },
    latencyMs?: number
  ): void;

  /**
   * Ghi nhận lỗi có phân loại để kích hoạt Cooldown tập trung
   */
  recordCategorizedError(
    key: string,
    modelName: string,
    error: AIErrorNormalized,
    timestamp?: number,
    latencyMs?: number
  ): void;
}
```

---

## 2. Hợp Đồng Chấp Hành Tại `geminiService`

```typescript
// Luồng thực thi tại geminiService:
async function executeAttemptWithScheduler(candidateKeys: string[], modelName: string, prompt: any) {
  // Bước 1: Xin cấp phép từ Single Scheduler Authority
  const lease = quotaService.scheduleAttempt(candidateKeys, modelName, 2500);

  if (!lease.isEligible) {
    throw new AIError(
      AIErrorCode.RATE_LIMITED,
      lease.rejectReason || 'Toàn bộ hạn ngạch và khóa API hiện không khả dụng.',
      { retryAfterSec: Math.ceil((lease.earliestAvailableInMs || 5000) / 1000) }
    );
  }

  // Bước 2: Sleep đúng 1 lần duy nhất nếu Scheduler chỉ định delay
  if (lease.delayMs > 0) {
    await sleep(lease.delayMs);
  }

  const startTime = Date.now();
  try {
    // Bước 3: Thực thi gọi Google GenAI với key được chỉ định
    const result = await callGoogleGenAI(lease.selectedKey!, modelName, prompt);
    const latency = Date.now() - startTime;

    // Bước 4: Báo cáo thành công về Scheduler
    quotaService.recordGroupUsage(
      lease.selectedGroupId!,
      lease.selectedKey!,
      modelName,
      'success',
      Date.now(),
      result.tokenUsage,
      latency
    );
    return result;
  } catch (rawError: any) {
    const latency = Date.now() - startTime;
    const normalizedError = normalizeAIError(rawError);

    // Bước 5: Báo cáo lỗi về Scheduler để kích hoạt Cooldown tự động
    quotaService.recordCategorizedError(lease.selectedKey!, modelName, normalizedError, Date.now(), latency);
    throw normalizedError;
  }
}
```
