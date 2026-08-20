import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getKeyRuntimeStatus, _testMaps } from '../geminiService';
import { quotaService } from '../quotaService';
import { normalizeUpstreamError } from '../../utils/errorClassifier';

describe('Circuit Breaker Runtime & States', () => {
  beforeEach(() => {
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
    expect(status.healthState).toBe('Healthy');
  });

  it('should reflect cooldown / circuit breaker open status when key encounters error', () => {
    const key = 'AIzaSyKeyTrip123';
    const err = normalizeUpstreamError({ status: 503, message: 'Model overloaded' });
    quotaService.recordCategorizedError(key, 'gemini-2.5-flash', err);

    const status = getKeyRuntimeStatus(key);
    expect(status.isBlacklisted).toBe(true);
    expect(status.blacklistRemainingMs).toBeGreaterThan(0);
    expect(status.healthState).toBe('Cooldown');
    expect(status.transitionReason).toContain('503');
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

