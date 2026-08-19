import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getKeyRuntimeStatus, _testMaps } from '../geminiService';
import { quotaService } from '../quotaService';

describe('Circuit Breaker Runtime & States', () => {
  beforeEach(() => {
    _testMaps.blacklistedKeys.clear();
    _testMaps.nextAllowedTimeByKey.clear();
    quotaService.resetAll();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should reflect initial clean status for healthy key', () => {
    const status = getKeyRuntimeStatus('AIzaSyHealthyKey123');
    expect(status.isBlacklisted).toBe(false);
    expect(status.blacklistRemainingMs).toBe(0);
    expect(status.isRateLimited).toBe(false);
    expect(status.nextAllowedRemainingMs).toBe(0);
  });

  it('should reflect blacklist / circuit breaker open status when key is cooled down', () => {
    const key = 'AIzaSyKeyTrip123';
    const now = Date.now();
    _testMaps.blacklistedKeys.set(key, now + 60000); // 60s cooldown

    const status = getKeyRuntimeStatus(key);
    expect(status.isBlacklisted).toBe(true);
    expect(status.blacklistRemainingMs).toBeGreaterThan(0);
  });

  it('should reflect rate limit pending status when pacing interval is active', () => {
    const key = 'AIzaSyKeyPacing123';
    const now = Date.now();
    _testMaps.nextAllowedTimeByKey.set(key, now + 3000); // 3s interval

    const status = getKeyRuntimeStatus(key);
    expect(status.isRateLimited).toBe(true);
    expect(status.nextAllowedRemainingMs).toBeGreaterThan(0);
  });
});
