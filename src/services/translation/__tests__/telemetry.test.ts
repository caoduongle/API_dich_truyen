import { describe, it, expect } from 'vitest';
import {
  createEmptyTelemetry,
  mergeBranchTelemetry,
  recordSplitEvent,
} from '../telemetry';

describe('Split Branch Telemetry (Spec 162 US5)', () => {
  it('creates empty telemetry with zeroed metrics and SUCCESS outcome', () => {
    const t = createEmptyTelemetry();
    expect(t.totalSplits).toBe(0);
    expect(t.retriedBranches).toBe(0);
    expect(t.fallbackBranches).toBe(0);
    expect(t.failedBranchKeys).toEqual([]);
    expect(t.executionDurationMs).toBe(0);
    expect(t.outcome).toBe('SUCCESS');
  });

  it('merges branch telemetry from parallel/recursive executions', () => {
    const branch1 = {
      totalSplits: 1,
      retriedBranches: 1,
      fallbackBranches: 0,
      failedBranchKeys: ['branch-1'],
      executionDurationMs: 120,
      outcome: 'SUCCESS' as const,
    };

    const branch2 = {
      totalSplits: 2,
      retriedBranches: 1,
      fallbackBranches: 1,
      failedBranchKeys: ['branch-2'],
      executionDurationMs: 250,
      outcome: 'PARTIAL' as const,
    };

    const merged = mergeBranchTelemetry(branch1, branch2);
    expect(merged.totalSplits).toBe(3);
    expect(merged.retriedBranches).toBe(2);
    expect(merged.fallbackBranches).toBe(1);
    expect(merged.failedBranchKeys).toContain('branch-1');
    expect(merged.failedBranchKeys).toContain('branch-2');
    expect(merged.outcome).toBe('PARTIAL');
  });

  it('records split event and sets outcome to PARTIAL when fallback occurs', () => {
    const initial = createEmptyTelemetry();
    const withRetry = recordSplitEvent(initial, { failedKey: 'leaf-0' });
    expect(withRetry.totalSplits).toBe(1);
    expect(withRetry.retriedBranches).toBe(1);
    expect(withRetry.fallbackBranches).toBe(0);
    expect(withRetry.failedBranchKeys).toEqual(['leaf-0']);
    expect(withRetry.outcome).toBe('SUCCESS');

    const withFallback = recordSplitEvent(withRetry, { isFallback: true, failedKey: 'leaf-1' });
    expect(withFallback.totalSplits).toBe(2);
    expect(withFallback.fallbackBranches).toBe(1);
    expect(withFallback.failedBranchKeys).toEqual(['leaf-0', 'leaf-1']);
    expect(withFallback.outcome).toBe('PARTIAL');
  });

  it('attaches telemetry to polishTranslationDirect result on successful call', async () => {
    const { polishTranslationDirect } = await import('../polishTranslation');
    const directGeminiClient = await import('../../directGeminiClient');
    const { vi } = await import('vitest');
    vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
      text: JSON.stringify({
        polishedTranslation: 'Thị trấn thanh bình dưới ánh hoàng hôn.',
        discoveredEntities: [],
      }),
      successKeyIndex: 0,
    });

    const result = await polishTranslationDirect({
      sourceText: '夕阳下的小镇格外宁静。',
      rawTranslation: 'Thị trấn dưới ánh hoàng hôn đặc biệt yên bình.',
      genre: 'Tiên Hiệp',
      tone: 'Hào hùng',
      glossary: [],
      apiKeys: ['TEST_API_KEY'],
      model: 'gemini-2.5-flash',
    });

    expect(result.polishedTranslation).toBe('Thị trấn thanh bình dưới ánh hoàng hôn.');
    expect(result.telemetry).toBeDefined();
    expect(result.telemetry?.totalSplits).toBe(0);
    expect(result.telemetry?.outcome).toBe('SUCCESS');
    expect(result.telemetry?.executionDurationMs).toBeGreaterThanOrEqual(0);
  });
});

