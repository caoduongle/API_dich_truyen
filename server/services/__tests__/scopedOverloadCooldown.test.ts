import { describe, it, expect, beforeEach } from 'vitest';
import { quotaService } from '../quotaService';
import { AIErrorCode } from '../../constants/errors';

describe('Scoped Overload Cooldown & Failure Domain Isolation (TASK 04)', () => {
  beforeEach(() => {
    quotaService.resetAll();
  });

  // 1. model A overloaded
  it('model A overloaded: puts only the overloaded model into cooldown', () => {
    const key = 'AIzaSyKeyModelTest111';
    quotaService.ensureKeyGroup(key, 'group_proj_a');
    const now = 1000000;

    // Kích hoạt lỗi 503 Overload cho Model A
    quotaService.recordCategorizedError(
      key,
      'models/gemini-2.5-pro',
      {
        code: AIErrorCode.OVERLOADED,
        message: 'The model is overloaded',
        isRetryable: true,
        recommendedAction: 'cooldown_key',
        httpStatus: 503,
        retryAfterSec: 4,
      },
      now
    );

    // Model A phải ở trạng thái Cooldown
    const modelAStatus = quotaService.getModelCooldownStatus('models/gemini-2.5-pro', now);
    expect(modelAStatus.inCooldown).toBe(true);
    expect(modelAStatus.remainingMs).toBeGreaterThan(0);

    // Khi yêu cầu cấp quyền cho Model A -> Bị từ chối do Model Cooldown
    const leaseModelA = quotaService.scheduleAttempt([key], 'models/gemini-2.5-pro', 2000, now);
    expect(leaseModelA.isEligible).toBe(false);
    expect(leaseModelA.rejectReason).toContain('quá tải');
  });

  // 2. model B remains usable
  it('model B remains usable: allows immediate execution of unaffected models during model A cooldown', () => {
    const key = 'AIzaSyKeyModelTest222';
    quotaService.ensureKeyGroup(key, 'group_proj_a');
    const now = 1000000;

    // Model A bị 503 Overload
    quotaService.triggerModelCooldown('models/gemini-2.5-pro', 5000, '503 Overloaded', now);

    // Model A bị chặn
    const leaseA = quotaService.scheduleAttempt([key], 'models/gemini-2.5-pro', 2000, now);
    expect(leaseA.isEligible).toBe(false);

    // Nhưng Model B (Flash) trên CÙNG Key và CÙNG QuotaGroup vẫn HOÀN TOÀN KHẢ DỤNG và cấp phép tức thì (delayMs = 0)
    const leaseB = quotaService.scheduleAttempt([key], 'models/gemini-2.5-flash', 2000, now);
    expect(leaseB.isEligible).toBe(true);
    expect(leaseB.delayMs).toBe(0);
    expect(leaseB.selectedKey).toBe(key);
  });

  // 3. project A overloaded
  it('project A overloaded: puts only project A into group cooldown', () => {
    const keyA = 'AIzaSyKeyProjA333';
    const keyB = 'AIzaSyKeyProjB444';
    quotaService.ensureKeyGroup(keyA, 'group_proj_a');
    quotaService.ensureKeyGroup(keyB, 'group_proj_b');
    const now = 1000000;

    // Project A bị 429 Rate Limit / Quota Exceeded
    quotaService.triggerGroupCooldown('group_proj_a', 5000, '429 Rate Limit', now);

    // Group A đang trong Cooldown
    const groupA = quotaService.getQuotaGroup('group_proj_a');
    expect(groupA?.cooldownUntilMs).toBe(now + 5000);

    // Khi chỉ có key của Group A -> Bị từ chối
    const leaseA = quotaService.scheduleAttempt([keyA], 'models/gemini-2.5-flash', 2000, now);
    expect(leaseA.isEligible).toBe(false);
  });

  // 4. project B remains usable
  it('project B remains usable: allows immediate execution of independent project B during project A cooldown', () => {
    const keyA = 'AIzaSyKeyProjA555';
    const keyB = 'AIzaSyKeyProjB666';
    quotaService.ensureKeyGroup(keyA, 'group_proj_a');
    quotaService.ensureKeyGroup(keyB, 'group_proj_b');
    const now = 1000000;

    // Group A bị Cooldown
    quotaService.triggerGroupCooldown('group_proj_a', 5000, '429 Rate Limit', now);

    // Khi danh sách candidate gồm cả keyA và keyB -> Scheduler tự động chuyển qua Group B và cấp phép ngay tức thì (delayMs = 0)
    const lease = quotaService.scheduleAttempt([keyA, keyB], 'models/gemini-2.5-flash', 2000, now);
    expect(lease.isEligible).toBe(true);
    expect(lease.selectedGroupId).toBe('group_proj_b');
    expect(lease.selectedKey).toBe(keyB);
    expect(lease.delayMs).toBe(0);
  });

  // 5. provider-wide outage
  it('provider-wide outage: activates provider backoff only when multiple distinct models and groups fail simultaneously', () => {
    const key1 = 'AIzaSyKeyOutage1';
    const key2 = 'AIzaSyKeyOutage2';
    quotaService.ensureKeyGroup(key1, 'group_outage_1');
    quotaService.ensureKeyGroup(key2, 'group_outage_2');
    const now = 1000000;

    // Lỗi 1 model trên 1 group -> Chưa kích hoạt Provider Outage
    const triggered1 = quotaService.recordUpstreamFailureEvent('models/gemini-2.5-flash', 'group_outage_1', now);
    expect(triggered1).toBe(false);
    expect(quotaService.getProviderOutageStatus(now).isOutage).toBe(false);

    // Cùng model đó trên group khác -> Chưa đủ 2 distinct models
    const triggered2 = quotaService.recordUpstreamFailureEvent('models/gemini-2.5-flash', 'group_outage_2', now + 1000);
    expect(triggered2).toBe(false);
    expect(quotaService.getProviderOutageStatus(now + 1000).isOutage).toBe(false);

    // Model thứ 2 (gemini-2.5-pro) trên group_outage_2 đồng thời lỗi -> ĐỦ điều kiện 2 models & 2 groups -> Kích hoạt Provider Outage!
    const triggered3 = quotaService.recordUpstreamFailureEvent('models/gemini-2.5-pro', 'group_outage_2', now + 2000);
    expect(triggered3).toBe(true);
    const outageStatus = quotaService.getProviderOutageStatus(now + 2000);
    expect(outageStatus.isOutage).toBe(true);
    expect(outageStatus.remainingMs).toBeGreaterThan(0);

    // Mọi attempt lúc này đều bị hoãn bởi Provider Outage
    const lease = quotaService.scheduleAttempt([key1, key2], 'models/gemini-2.5-flash', 2000, now + 2000);
    expect(lease.isEligible).toBe(false);
    expect(lease.rejectReason).toContain('Provider Outage');
  });

  // 6. recovery
  it('recovery: automatically restores availability across all tiers once cooldown TTL expires', () => {
    const key = 'AIzaSyKeyRecovery777';
    quotaService.ensureKeyGroup(key, 'group_recovery');
    const now = 1000000;

    // Model Cooldown 3000ms
    quotaService.triggerModelCooldown('models/gemini-2.5-pro', 3000, '503 Overload', now);
    // Group Cooldown 4000ms
    quotaService.triggerGroupCooldown('group_recovery', 4000, '429 Cooldown', now);

    // Tại now + 1000ms: Vẫn đang trong Cooldown
    expect(quotaService.getModelCooldownStatus('models/gemini-2.5-pro', now + 1000).inCooldown).toBe(true);
    const leaseDuring = quotaService.scheduleAttempt([key], 'models/gemini-2.5-pro', 2000, now + 1000);
    expect(leaseDuring.isEligible).toBe(false);

    // Tại now + 3500ms: Model đã hết Cooldown, nhưng Group còn Cooldown 500ms
    expect(quotaService.getModelCooldownStatus('models/gemini-2.5-pro', now + 3500).inCooldown).toBe(false);
    const leaseMid = quotaService.scheduleAttempt([key], 'models/gemini-2.5-pro', 2000, now + 3500);
    expect(leaseMid.isEligible).toBe(false);

    // Tại now + 4001ms: Cả Model và Group đều đã HẾT Cooldown -> TỰ ĐỘNG PHỤC HỒI THÀNH CÔNG!
    const leaseAfter = quotaService.scheduleAttempt([key], 'models/gemini-2.5-pro', 2000, now + 4001);
    expect(leaseAfter.isEligible).toBe(true);
    expect(leaseAfter.selectedKey).toBe(key);
    expect(leaseAfter.delayMs).toBe(0);
  });
});
