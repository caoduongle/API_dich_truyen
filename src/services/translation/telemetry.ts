/**
 * Translation Split Branch Telemetry Tracker
 * Thu thập và cộng dồn các chỉ số đo lường phân đoạn, nhánh thử lại và cứu nguy tất định
 */

import { SplitBranchTelemetry } from './types';

export function createEmptyTelemetry(): SplitBranchTelemetry {
  return {
    totalSplits: 0,
    retriedBranches: 0,
    fallbackBranches: 0,
    failedBranchKeys: [],
    executionDurationMs: 0,
    outcome: 'SUCCESS',
  };
}

export function mergeBranchTelemetry(
  parent?: SplitBranchTelemetry,
  child?: SplitBranchTelemetry
): SplitBranchTelemetry {
  const p = parent || createEmptyTelemetry();
  const c = child || createEmptyTelemetry();

  const combinedFailedKeys = Array.from(new Set([...p.failedBranchKeys, ...c.failedBranchKeys]));
  const combinedOutcome: 'SUCCESS' | 'PARTIAL' =
    p.outcome === 'PARTIAL' || c.outcome === 'PARTIAL' ? 'PARTIAL' : 'SUCCESS';

  return {
    totalSplits: p.totalSplits + c.totalSplits,
    retriedBranches: p.retriedBranches + c.retriedBranches,
    fallbackBranches: p.fallbackBranches + c.fallbackBranches,
    failedBranchKeys: combinedFailedKeys,
    executionDurationMs: p.executionDurationMs + c.executionDurationMs,
    outcome: combinedOutcome,
  };
}

export function recordSplitEvent(
  telemetry: SplitBranchTelemetry,
  options: {
    isFallback?: boolean;
    failedKey?: string;
  } = {}
): SplitBranchTelemetry {
  return {
    ...telemetry,
    totalSplits: telemetry.totalSplits + 1,
    retriedBranches: telemetry.retriedBranches + (options.isFallback ? 0 : 1),
    fallbackBranches: telemetry.fallbackBranches + (options.isFallback ? 1 : 0),
    failedBranchKeys: options.failedKey && !telemetry.failedBranchKeys.includes(options.failedKey)
      ? [...telemetry.failedBranchKeys, options.failedKey]
      : telemetry.failedBranchKeys,
    outcome: options.isFallback ? 'PARTIAL' : telemetry.outcome,
  };
}
