// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalQuotaTracker } from '../localQuotaTracker';

describe('LocalQuotaTracker Debounced Persistence & Lifecycle Flush (User Story 6)', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    vi.useFakeTimers();
    mockStorage = {};
    globalThis.sessionStorage = {
      getItem: (k: string) => mockStorage[k] || null,
      setItem: (k: string, v: string) => {
        mockStorage[k] = String(v);
      },
      removeItem: (k: string) => {
        delete mockStorage[k];
      },
      clear: () => {
        mockStorage = {};
      },
      length: 0,
      key: (_i: number) => null,
    } as any;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces multiple rapid events and flushes after 300ms', () => {
    const tracker = new LocalQuotaTracker();
    const key = 'test-debounce-key-1';
    const model = 'gemini-2.5-flash';
    const now = Date.now();

    // Fire 20 attempts and successes
    for (let i = 0; i < 20; i++) {
      tracker.recordProviderAttempt(key, model, now + i * 5);
      tracker.recordSuccess(key, model, { totalTokens: 10 }, 10, now + i * 5);
    }

    // Immediately after, nothing written to sessionStorage
    expect(mockStorage['gemini_local_quota_tracker_v1']).toBeUndefined();

    // Advance timers by 299ms - still not flushed
    vi.advanceTimersByTime(299);
    expect(mockStorage['gemini_local_quota_tracker_v1']).toBeUndefined();

    // Advance past 300ms - debounce timer triggers flush
    vi.advanceTimersByTime(10);
    expect(mockStorage['gemini_local_quota_tracker_v1']).toBeDefined();

    const data = JSON.parse(mockStorage['gemini_local_quota_tracker_v1']);
    expect(data.summaryStats.providerAttemptsTotal).toBe(20);
    expect(data.summaryStats.successfulAttemptsTotal).toBe(20);
  });

  it('flushes pending state immediately when flushToStorage is called', () => {
    const tracker = new LocalQuotaTracker();
    const key = 'test-debounce-key-2';
    const model = 'gemini-2.5-flash';

    tracker.recordProviderAttempt(key, model);
    expect(mockStorage['gemini_local_quota_tracker_v1']).toBeUndefined();

    tracker.flushToStorage();
    expect(mockStorage['gemini_local_quota_tracker_v1']).toBeDefined();
  });

  it('flushes pending metrics when window receives pagehide event', () => {
    const tracker = new LocalQuotaTracker();
    const key = 'test-debounce-key-3';
    const model = 'gemini-2.5-flash';

    tracker.recordProviderAttempt(key, model);
    expect(mockStorage['gemini_local_quota_tracker_v1']).toBeUndefined();

    // Simulate pagehide event on window
    window.dispatchEvent(new Event('pagehide'));
    expect(mockStorage['gemini_local_quota_tracker_v1']).toBeDefined();
  });

  it('flushes pending metrics when document visibility changes to hidden', () => {
    const tracker = new LocalQuotaTracker();
    const key = 'test-debounce-key-4';
    const model = 'gemini-2.5-flash';

    tracker.recordProviderAttempt(key, model);
    expect(mockStorage['gemini_local_quota_tracker_v1']).toBeUndefined();

    // Mock document.visibilityState
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });

    document.dispatchEvent(new Event('visibilitychange'));
    expect(mockStorage['gemini_local_quota_tracker_v1']).toBeDefined();
  });
});
