import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { QuotaPanel } from '../QuotaPanel';
import { KeyCardItem } from '../quota-panel/KeyCardItem';
import type { KeyQuotaFullSnapshot } from '../../types/quota';
import type { ModelObservabilityState } from '../../hooks/useModelObservability';

const normalizeHtmlText = (html: string) =>
  html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('Feature 173: QuotaPanel & KeyCardItem UI Recovery & Reference Limits', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders 250k TPM / 500 RPD reference limits, lock reason callout, Unlock buttons, and per-model availability banner', () => {
    const snapshots: KeyQuotaFullSnapshot[] = [
      {
        index: 0,
        keyHash: 'hash-k1',
        maskedKey: 'AQ.Ab8...7CtQ',
        requestsTotal: 16,
        requestsToday: 16,
        requestsThisMinute: 0,
        errorsTotal: 2,
        tokensTotal: 92400,
        tokensToday: 47500,
        tokensThisMinute: 0,
        byModel: {
          'gemini-3.5-flash-lite': {
            requestsTotal: 16,
            requestsToday: 16,
            requestsThisMinute: 0,
            errorsTotal: 2,
            tokensTotal: 47500,
            tokensToday: 47500,
            tokensThisMinute: 0,
            healthState: 'QuotaExhausted',
            transitionReason: '429: Máy chủ báo cạn hạn mức ngày (16/500)',
            cooldownRemainingMs: 12 * 3600_000 + 5 * 60_000,
          },
        },
        runtime: {
          isBlacklisted: true,
          blacklistRemainingMs: 12 * 3600_000 + 5 * 60_000,
          isRateLimited: false,
          nextAllowedRemainingMs: 0,
          healthState: 'QuotaExhausted',
          transitionReason: '429: Máy chủ báo cạn hạn mức ngày (16/500)',
          isCustomLimitReached: false,
          isLowUsageDailyExhaustion: true,
        },
        healthState: 'QuotaExhausted',
      },
      {
        index: 1,
        keyHash: 'hash-k2',
        maskedKey: 'AQ.Ab8...46DQ',
        requestsTotal: 510,
        requestsToday: 510,
        requestsThisMinute: 0,
        errorsTotal: 1,
        tokensTotal: 2000000,
        tokensToday: 2000000,
        tokensThisMinute: 0,
        byModel: {
          'gemini-3.5-flash-lite': {
            requestsTotal: 510,
            requestsToday: 510,
            requestsThisMinute: 0,
            errorsTotal: 1,
            tokensToday: 2000000,
            tokensThisMinute: 0,
            healthState: 'QuotaExhausted',
          },
          'gemini-2.5-flash': {
            requestsTotal: 0,
            requestsToday: 0,
            requestsThisMinute: 0,
            errorsTotal: 0,
            healthState: 'Healthy',
          },
        },
        runtime: {
          isBlacklisted: true,
          blacklistRemainingMs: 0,
          isRateLimited: false,
          nextAllowedRemainingMs: 0,
          healthState: 'QuotaExhausted',
          transitionReason: 'Đã chạm ngưỡng giới hạn cá nhân trong ngày (510/500 RPD)',
          isCustomLimitReached: true,
        },
        healthState: 'QuotaExhausted',
        isCustomLimitReached: true,
      },
    ];

    const obs: ModelObservabilityState = {
      snapshotKeys: snapshots,
      groups: [],
      summary: null,
      loadingQuota: false,
      quotaError: null,
      inspectResults: {},
      inspectLoadingKeyIndex: null,
      inspectErrors: {},
      timezone: 'America/Los_Angeles',
      currentDayPST: '2026-11-28',
      lastUpdated: null,
      loadQuotaStatus: vi.fn().mockResolvedValue(undefined),
      inspectKeyModels: vi.fn().mockResolvedValue(undefined),
      clearInspectResult: vi.fn(),
      unlockKey: vi.fn().mockReturnValue({ unlocked: true }),
      unlockAllKeys: vi.fn().mockReturnValue({ unlockedCount: 2, customBlockedCount: 1 }),
    };

    const html = renderToString(
      React.createElement(QuotaPanel, {
        apiKeys: ['KEY_RAW_SECRET_ONE_123456', 'KEY_RAW_SECRET_TWO_789012'],
        selectedModel: 'gemini-3.5-flash-lite',
        observability: obs,
      })
    );

    const text = normalizeHtmlText(html);

    // Reference limits: 250k TPM & 500 RPD (never 1M for flash-lite)
    expect(text).toContain('/ 250k');
    expect(text).toContain('/ 500');
    expect(text).not.toContain('/ 1M');

    // Per-model availability & actionable warning
    expect(text).toContain('0 / 2 key khả dụng');
    expect(text).toContain('Mở khóa tất cả (2)');
    expect(text).toContain('Mở khóa');

    // Explicit reason + hour countdown formatting (12g 5p) & custom limit distinction
    expect(text).toContain('12g 5p');
    expect(text).toContain('Đạt giới hạn ngày (Tự đặt)');
    expect(text).toContain('Ngưỡng cá nhân');

    // Security SC-006: raw API keys never leak into rendered output
    expect(html).not.toContain('KEY_RAW_SECRET_ONE_123456');
    expect(html).not.toContain('KEY_RAW_SECRET_TWO_789012');
  });

  it('uses per-model stats on KeyCardItem gauges so exhausted Model A does not taint Model B gauges', () => {
    const snapshot: KeyQuotaFullSnapshot = {
      index: 0,
      keyHash: 'hash-k',
      maskedKey: 'AQ.Ab8...46DQ',
      requestsTotal: 510,
      requestsToday: 510,
      requestsThisMinute: 3,
      errorsTotal: 10,
      tokensTotal: 2000000,
      tokensToday: 2000000,
      tokensThisMinute: 120000,
      byModel: {
        'gemini-3.5-flash-lite': {
          requestsTotal: 510,
          requestsToday: 510,
          requestsThisMinute: 3,
          errorsTotal: 10,
          tokensToday: 2000000,
          tokensThisMinute: 120000,
          healthState: 'QuotaExhausted',
        },
        'gemini-2.5-flash': {
          requestsTotal: 0,
          requestsToday: 0,
          requestsThisMinute: 0,
          errorsTotal: 0,
          tokensToday: 0,
          tokensThisMinute: 0,
          healthState: 'Healthy',
        },
      },
      runtime: {
        isBlacklisted: false,
        blacklistRemainingMs: 0,
        isRateLimited: false,
        nextAllowedRemainingMs: 0,
        healthState: 'Healthy',
        isCustomLimitReached: false,
      },
      healthState: 'Healthy',
    };

    const html = renderToString(
      React.createElement(KeyCardItem, {
        item: snapshot,
        idx: 0,
        selectedModel: 'gemini-2.5-flash',
        selectedModelDisplayName: 'Gemini 2.5 Flash',
        isExpanded: true,
        isInspecting: false,
        onInspect: vi.fn(),
        onClearInspect: vi.fn(),
        onToggleExpand: vi.fn(),
        onUnlockKey: vi.fn(),
      })
    );

    const text = normalizeHtmlText(html);

    expect(text).toContain('Hoạt động');
    expect(text).toContain('Hết ngày'); // Inside byModel accordion for gemini-3.5-flash-lite
    expect(text).not.toContain('Đạt giới hạn ngày (Tự đặt)');
    // Model 2.5 Flash gauge reflects 0 / 500 instead of leaking 510 / 500 from Flash Lite
    expect(text).toContain('0 / 500');
    expect(text).toContain('0 / 250k');
  });
});
