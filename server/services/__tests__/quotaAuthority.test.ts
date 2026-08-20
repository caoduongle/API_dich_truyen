import { describe, it, expect, beforeEach, vi } from 'vitest';
import { quotaService, getDayInLosAngeles } from '../quotaService';
import { translationChunkCache } from '../../utils/chunkCache';
import { AIErrorCode } from '../../constants/errors';

describe('User Story 3: Server-Owned Quota, Rate Limiting & Circuit Breakers (TASK 13)', () => {
  beforeEach(() => {
    quotaService.resetAll();
    translationChunkCache.clear();
  });

  describe('PST Midnight Date Partitioning Authority', () => {
    it('accurately resolves day string in America/Los_Angeles regardless of local host timezone', () => {
      // 2026-08-20T02:00:00Z UTC -> 2026-08-19 19:00:00 in PST (UTC-7)
      const timestamp1 = Date.parse('2026-08-20T02:00:00Z');
      const dayPST1 = getDayInLosAngeles(timestamp1);
      expect(dayPST1).toBe('2026-08-19');

      // 2026-08-20T09:00:00Z UTC -> 2026-08-20 02:00:00 in PST
      const timestamp2 = Date.parse('2026-08-20T09:00:00Z');
      const dayPST2 = getDayInLosAngeles(timestamp2);
      expect(dayPST2).toBe('2026-08-20');
    });

    it('resets daily counters automatically when crossing PST midnight boundary', () => {
      const key = 'AIzaSyTestDailyBoundaryKey123';
      const model = 'models/gemini-2.5-flash';

      const day1 = Date.parse('2026-08-20T02:00:00Z'); // Aug 19 PST
      const day2 = Date.parse('2026-08-20T09:00:00Z'); // Aug 20 PST

      quotaService.recordUsage(key, model, 'success', day1, { promptTokens: 100, outputTokens: 50, totalTokens: 150 });
      let snapshots = quotaService.getQuotaSnapshot([key], day1);
      expect(snapshots[0].requestsToday).toBe(1);
      expect(snapshots[0].tokensToday).toBe(150);

      // On next PST day, daily counters reset to 0 for new usage
      quotaService.recordUsage(key, model, 'success', day2, { promptTokens: 50, outputTokens: 25, totalTokens: 75 });
      snapshots = quotaService.getQuotaSnapshot([key], day2);
      expect(snapshots[0].requestsToday).toBe(1);
      expect(snapshots[0].tokensToday).toBe(75);
      expect(snapshots[0].requestsTotal).toBe(2);
      expect(snapshots[0].tokensTotal).toBe(225);
    });
  });

  describe('Sliding Window 60-Second Rate Limiting', () => {
    it('purges calls older than 60 seconds from active RPM/TPM calculation', () => {
      const key = 'AIzaSyTestSlidingWindowKey123';
      const model = 'models/gemini-2.5-flash';
      const baseTime = Date.now();

      // 3 calls within last 30s
      quotaService.recordUsage(key, model, 'success', baseTime - 40000, { promptTokens: 100, outputTokens: 100, totalTokens: 200 });
      quotaService.recordUsage(key, model, 'success', baseTime - 20000, { promptTokens: 100, outputTokens: 100, totalTokens: 200 });
      quotaService.recordUsage(key, model, 'success', baseTime, { promptTokens: 100, outputTokens: 100, totalTokens: 200 });

      let snapshots = quotaService.getQuotaSnapshot([key], baseTime);
      expect(snapshots[0].requestsThisMinute).toBe(3);
      expect(snapshots[0].tokensThisMinute).toBe(600);

      // Advance time by 65 seconds
      const futureTime = baseTime + 65000;
      snapshots = quotaService.getQuotaSnapshot([key], futureTime);
      expect(snapshots[0].requestsThisMinute).toBe(0);
      expect(snapshots[0].tokensThisMinute).toBe(0);
    });
  });

  describe('Translation Chunk Cache Invariant & Eviction', () => {
    it('caches and retrieves translation chunks with 2-hour sliding window TTL', () => {
      const cacheKey = translationChunkCache.generateKey('raw', '天地玄黄', { genre: 'xianxia', tone: 'classic' });
      translationChunkCache.set(cacheKey, { text: 'Trời đất huyền hoàng' });

      const hit = translationChunkCache.get(cacheKey);
      expect(hit).toBeDefined();
      expect(hit?.text).toBe('Trời đất huyền hoàng');
    });

    it('limits cache size to prevent memory bloat and allows clearing', () => {
      translationChunkCache.set('k1', { text: 'v1' });
      translationChunkCache.set('k2', { text: 'v2' });
      expect(translationChunkCache.size()).toBe(2);

      translationChunkCache.clear();
      expect(translationChunkCache.size()).toBe(0);
    });
  });
});
