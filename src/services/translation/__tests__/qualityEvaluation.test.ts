import { describe, it, expect } from 'vitest';
import {
  evaluateTranslationQualitySample,
  runQualityEvaluationSuite,
} from '../qualityEvaluator';
import {
  BASELINE_EVAL_SAMPLES,
  UPLIFTED_EVAL_SAMPLES,
} from './fixtures/qualityEvalCorpus';

describe('Translation Quality Evaluation Suite (US6 / SC-001 - SC-011)', () => {
  it('produces 100% deterministic, byte-identical metrics across repeated runs (FR-020)', () => {
    const run1 = runQualityEvaluationSuite(UPLIFTED_EVAL_SAMPLES, BASELINE_EVAL_SAMPLES);
    const run2 = runQualityEvaluationSuite(UPLIFTED_EVAL_SAMPLES, BASELINE_EVAL_SAMPLES);

    expect(run1).toEqual(run2);
    expect(run1.samples).toHaveLength(UPLIFTED_EVAL_SAMPLES.length);
  });

  it('meets SC-001 & SC-002: >= 98% glossary compliance and 0 false compound-word substitutions', () => {
    const report = runQualityEvaluationSuite(UPLIFTED_EVAL_SAMPLES, BASELINE_EVAL_SAMPLES);

    expect(report.summary.avgGlossaryComplianceRate).toBeGreaterThanOrEqual(0.98);
    expect(report.summary.totalFalseSubstitutionCount).toBe(0);
    expect(report.baselineComparison?.falseSubstitutionReduction).toBeGreaterThanOrEqual(1);
    expect(report.baselineComparison?.glossaryComplianceDelta).toBeGreaterThan(0);

    // Sample 1 specifically verifies 1-char surname "林" preserves 森林 / 林海 / 林立
    const s1 = report.samples.find((s) => s.sampleId === 'sample-1-single-char-compound');
    expect(s1?.falseSubstitutionCount).toBe(0);
    expect(s1?.glossaryComplianceRate).toBe(1);
  });

  it('meets SC-003: >= 50% reduction in character pronoun errors vs baseline', () => {
    const report = runQualityEvaluationSuite(UPLIFTED_EVAL_SAMPLES, BASELINE_EVAL_SAMPLES);

    expect(report.summary.avgPronounConsistencyRate).toBe(1);
    expect(report.baselineComparison?.pronounErrorReductionRate).toBeGreaterThanOrEqual(0.5);
  });

  it('meets SC-004: 0 ungrounded proper nouns after polish and >= 50% reduction vs baseline', () => {
    const report = runQualityEvaluationSuite(UPLIFTED_EVAL_SAMPLES, BASELINE_EVAL_SAMPLES);

    expect(report.summary.totalUngroundedProperNounCount).toBe(0);
    expect(report.baselineComparison?.ungroundedProperNounReductionRate).toBeGreaterThanOrEqual(0.5);
  });

  it('meets SC-005: >= 25% prompt glossary char reduction on 250-item glossary while preserving compliance', () => {
    const upliftedScaleSample = UPLIFTED_EVAL_SAMPLES.find(
      (s) => s.id === 'sample-2-scale-250-glossary'
    )!;
    const baselineScaleSample = BASELINE_EVAL_SAMPLES.find(
      (s) => s.id === 'sample-2-scale-250-glossary'
    )!;

    const upliftedMetrics = evaluateTranslationQualitySample(upliftedScaleSample);
    const baselineMetrics = evaluateTranslationQualitySample(baselineScaleSample);

    const charReductionRatio =
      (baselineMetrics.promptGlossaryCharCount - upliftedMetrics.promptGlossaryCharCount) /
      baselineMetrics.promptGlossaryCharCount;

    expect(charReductionRatio).toBeGreaterThanOrEqual(0.25);
    expect(upliftedMetrics.glossaryComplianceRate).toBe(1);
  });

  it('verifies zero Han leftovers and 100% paragraph parity across all uplifted samples', () => {
    const report = runQualityEvaluationSuite(UPLIFTED_EVAL_SAMPLES);

    expect(report.summary.avgChineseLeftoverRatio).toBe(0);
    expect(report.summary.paragraphParityPassRate).toBe(1);
  });
});
