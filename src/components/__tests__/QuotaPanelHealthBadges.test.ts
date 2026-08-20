import { describe, it, expect } from 'vitest';
import { KeyQuotaFullSnapshot, KeyHealthState } from '../../utils/apiClient';

describe('QuotaPanel Health Badges & Key Health State Verification', () => {
  const createMockSnapshot = (
    healthState: KeyHealthState,
    isAvailable: boolean,
    cooldownMs: number = 0,
    reason?: string
  ): KeyQuotaFullSnapshot => ({
    index: 0,
    keyHash: 'hash-12345',
    maskedKey: 'AIzaSy...7890',
    requestsTotal: 10,
    requestsToday: 5,
    requestsThisMinute: 1,
    errorsTotal: healthState === 'Healthy' ? 0 : 2,
    byModel: {},
    runtime: {
      isBlacklisted: !isAvailable,
      blacklistRemainingMs: cooldownMs,
      isRateLimited: healthState === 'RateLimited',
      nextAllowedRemainingMs: healthState === 'RateLimited' ? cooldownMs : 0,
      healthState,
      transitionReason: reason,
    },
  });

  it('should format healthy key snapshot with Healthy state', () => {
    const item = createMockSnapshot('Healthy', true, 0, 'Khởi tạo trạng thái ban đầu');
    expect(item.runtime.healthState).toBe('Healthy');
    expect(item.runtime.isBlacklisted).toBe(false);
  });

  it('should format rate-limited key snapshot with cooldown timer', () => {
    const item = createMockSnapshot('RateLimited', false, 4500, '429: Đã chạm giới hạn tốc độ (RPM/TPM)');
    expect(item.runtime.healthState).toBe('RateLimited');
    expect(item.runtime.isRateLimited).toBe(true);
    expect(item.runtime.nextAllowedRemainingMs).toBe(4500);
    expect(item.runtime.transitionReason).toContain('429');
  });

  it('should format auth-failed key snapshot with AuthFailed state', () => {
    const item = createMockSnapshot('AuthFailed', false, 0, '401/403: API key không hợp lệ');
    expect(item.runtime.healthState).toBe('AuthFailed');
    expect(item.runtime.isBlacklisted).toBe(true);
    expect(item.runtime.transitionReason).toContain('401/403');
  });

  it('should format quota-exhausted key snapshot with QuotaExhausted state', () => {
    const item = createMockSnapshot('QuotaExhausted', false, 0, '429: Hạn mức ngày đã hết (RPD)');
    expect(item.runtime.healthState).toBe('QuotaExhausted');
    expect(item.runtime.isBlacklisted).toBe(true);
  });

  it('should format degraded key snapshot with Degraded state', () => {
    const item = createMockSnapshot('Degraded', true, 0, 'Gặp lỗi tạm thời');
    expect(item.runtime.healthState).toBe('Degraded');
    expect(item.runtime.isBlacklisted).toBe(false);
  });

  it('should format cooldown key snapshot with Cooldown state', () => {
    const item = createMockSnapshot('Cooldown', false, 3000, '503: Mô hình quá tải');
    expect(item.runtime.healthState).toBe('Cooldown');
    expect(item.runtime.blacklistRemainingMs).toBe(3000);
    expect(item.runtime.isBlacklisted).toBe(true);
  });

  it('should format disabled key snapshot with Disabled state', () => {
    const item = createMockSnapshot('Disabled', false, 0, 'Vô hiệu hóa thủ công bởi người dùng');
    expect(item.runtime.healthState).toBe('Disabled');
    expect(item.runtime.isBlacklisted).toBe(true);
  });
});
