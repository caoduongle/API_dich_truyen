/**
 * Deterministic Translation Quality Evaluator (US6 / FR-020)
 * Tính toán các chỉ số chất lượng tất định chạy lặp lại được trên bộ mẫu chuẩn
 * mà không cần gọi Gemini API.
 */

import { GlossaryItem } from '../../types';
import {
  countHanChars,
  normalizeCharacterProfile,
  selectRelevantGlossary,
  substituteGlossaryTermsSafely,
} from '../../lib/glossaryMatch';
import { validateParagraphParity } from '../../lib/text';
import { buildRawTranslationPayload } from '../ai/prompts';
import {
  checkCharacterPronounConsistency,
  checkGlossaryCompliance,
  detectUngroundedProperNouns,
  mapTranslatedParagraphToSourceWindow,
  splitNonEmptyParagraphs,
} from './translationValidation';
import { QualityEvaluationMetrics } from './types';

export interface QualityEvaluationSample {
  id: string;
  description: string;
  sourceText: string;
  glossary: GlossaryItem[];
  candidateTranslation: string;
  previousDraft?: string;
  compoundWords?: string[];
  forbiddenMistranslations?: string[];
  /** Chỉ dùng cho baseline mô phỏng trong bộ kiểm thử (thay vì chuỗi đã nâng cấp) */
  substitutedSourceOverride?: string;
  /** Chỉ dùng cho baseline mô phỏng khi đo kích thước prompt không lọc từ điển */
  useUnfilteredGlossaryForPromptCount?: boolean;
}

export interface QualitySuiteBaselineComparison {
  glossaryComplianceDelta: number;
  falseSubstitutionReduction: number;
  pronounErrorReductionRate: number;
  ungroundedProperNounReductionRate: number;
  promptGlossaryCharReductionRate: number;
}

export interface QualityEvaluationSuiteReport {
  samples: QualityEvaluationMetrics[];
  summary: {
    sampleCount: number;
    avgGlossaryComplianceRate: number;
    totalFalseSubstitutionCount: number;
    avgChineseLeftoverRatio: number;
    paragraphParityPassRate: number;
    avgPronounConsistencyRate: number;
    totalUngroundedProperNounCount: number;
    totalPromptGlossaryCharCount: number;
  };
  baselineComparison?: QualitySuiteBaselineComparison;
}

function countSubstringOccurrences(haystack: string, needle: string): number {
  if (!haystack || !needle) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}

function measurePromptGlossarySectionChars(sample: QualityEvaluationSample): number {
  if (sample.useUnfilteredGlossaryForPromptCount) {
    return sample.glossary
      .map(
        (g) =>
          `- Trung: [${g.chinese}] -> Hán Việt: [${g.pinyin || ''}] -> Việt: [${g.vietnamese}] (Loại: ${g.type || 'other'}, Ghi chú: ${g.note || ''})`
      )
      .join('\n').length;
  }

  const payload = buildRawTranslationPayload({
    text: sample.sourceText,
    genre: 'Tiên Hiệp',
    tone: 'Trang nghiêm',
    glossary: sample.glossary,
  });

  const marker = '--- TỪ ĐIỂN TÊN NHÂN VẬT & THUẬT NGỮ';
  const startIdx = payload.prompt.indexOf(marker);
  if (startIdx < 0) return 0;
  const bodyStart = payload.prompt.indexOf('\n', startIdx);
  if (bodyStart < 0) return 0;
  const endMarker = payload.prompt.indexOf('\n--- ', bodyStart + 1);
  const section =
    endMarker >= 0
      ? payload.prompt.slice(bodyStart + 1, endMarker)
      : payload.prompt.slice(bodyStart + 1);
  return section.trim().length;
}

function estimateTotalGlossaryTermChecks(
  sourceText: string,
  translatedText: string,
  glossary: GlossaryItem[]
): number {
  const srcParas = splitNonEmptyParagraphs(sourceText);
  const transParas = splitNonEmptyParagraphs(translatedText);
  if (srcParas.length === 0 || transParas.length === 0) return 0;

  const { matchedInSource } = selectRelevantGlossary(sourceText, glossary);
  const checkable = matchedInSource.filter((g) => (g.vietnamese || '').trim().length > 0);
  if (checkable.length === 0) return 0;

  const seenPerTerm = new Set<string>();
  for (let pIdx = 0; pIdx < transParas.length; pIdx++) {
    const alignment = mapTranslatedParagraphToSourceWindow(pIdx, srcParas, transParas);
    const primarySrc = srcParas[alignment.primarySourceIndex] || '';
    for (const item of checkable) {
      if (item.chinese && primarySrc.includes(item.chinese)) {
        seenPerTerm.add(`${pIdx}::${item.chinese}`);
      }
    }
  }
  return seenPerTerm.size;
}

function estimateTotalPronounChecks(
  sourceText: string,
  translatedText: string,
  glossary: GlossaryItem[]
): number {
  const srcParas = splitNonEmptyParagraphs(sourceText);
  const transParas = splitNonEmptyParagraphs(translatedText);
  if (srcParas.length === 0 || transParas.length === 0) return 0;

  const profiledChars = glossary.filter((item) => {
    const profile = normalizeCharacterProfile(item.characterProfile);
    return item.type === 'character' && (profile?.gender === 'male' || profile?.gender === 'female');
  });
  if (profiledChars.length === 0) return 0;

  let checks = 0;
  for (let pIdx = 0; pIdx < transParas.length; pIdx++) {
    const transPara = transParas[pIdx];
    const alignment = mapTranslatedParagraphToSourceWindow(pIdx, srcParas, transParas);
    const srcPara = srcParas[alignment.primarySourceIndex] || '';
    for (const charItem of profiledChars) {
      if (
        charItem.vietnamese &&
        transPara.toLowerCase().includes(charItem.vietnamese.toLowerCase()) &&
        (!charItem.chinese || srcPara.includes(charItem.chinese))
      ) {
        checks++;
      }
    }
  }
  return checks;
}

function checkParagraphParityPassed(sourceText: string, candidateTranslation: string): boolean {
  try {
    validateParagraphParity(sourceText, candidateTranslation, 0.25, 3);
    const srcCount = splitNonEmptyParagraphs(sourceText).length;
    const transCount = splitNonEmptyParagraphs(candidateTranslation).length;
    return Math.abs(srcCount - transCount) <= 1;
  } catch {
    return false;
  }
}

/**
 * Đánh giá một mẫu dịch độc lập bằng các kiểm tra tất định hoàn toàn (không gọi AI).
 */
export function evaluateTranslationQualitySample(
  sample: QualityEvaluationSample
): QualityEvaluationMetrics {
  const glossary = sample.glossary || [];
  const sourceText = sample.sourceText || '';
  const translatedText = sample.candidateTranslation || '';

  // 1. Glossary Compliance
  const glossaryViolations = checkGlossaryCompliance({
    sourceText,
    translatedText,
    glossary,
  }).filter((issue) => issue.type === 'terminology');
  const totalTermChecks = estimateTotalGlossaryTermChecks(sourceText, translatedText, glossary);
  const glossaryComplianceRate =
    totalTermChecks === 0
      ? 1
      : Math.max(0, (totalTermChecks - glossaryViolations.length) / totalTermChecks);

  // 2. False Glossary Substitution Count (bảo vệ từ ghép khi gặp mục từ điển 1 ký tự)
  let falseSubstitutionCount = 0;
  const { entries: relevantGlossary } = selectRelevantGlossary(sourceText, glossary);
  const substitutedText =
    sample.substitutedSourceOverride ??
    substituteGlossaryTermsSafely(sourceText, relevantGlossary, {
      minHanLength: 2,
      annotationStyle: 'inline-pair',
    }).substitutedText;

  for (const compound of sample.compoundWords || []) {
    const expectedCount = countSubstringOccurrences(sourceText, compound);
    const preservedCount = countSubstringOccurrences(substitutedText, compound);
    if (preservedCount < expectedCount) {
      falseSubstitutionCount += expectedCount - preservedCount;
    }
  }
  for (const forbidden of sample.forbiddenMistranslations || []) {
    falseSubstitutionCount += countSubstringOccurrences(translatedText, forbidden);
  }

  // 3. Chinese Leftover Ratio
  const hanCount = countHanChars(translatedText);
  const chineseLeftoverRatio = translatedText.length > 0 ? hanCount / translatedText.length : 0;

  // 4. Paragraph Parity
  const paragraphParityPassed = checkParagraphParityPassed(sourceText, translatedText);

  // 5. Pronoun Consistency
  const pronounViolations = checkCharacterPronounConsistency({
    sourceText,
    translatedText,
    glossary,
  });
  const totalPronounChecks = estimateTotalPronounChecks(sourceText, translatedText, glossary);
  const pronounConsistencyRate =
    totalPronounChecks === 0
      ? 1
      : Math.max(0, (totalPronounChecks - pronounViolations.length) / totalPronounChecks);

  // 6. Ungrounded Proper Nouns (hallucinations)
  const ungroundedProperNounCount = detectUngroundedProperNouns({
    sourceText,
    previousDraft: sample.previousDraft ?? translatedText,
    candidatePolished: translatedText,
    glossary,
  }).length;

  // 7. Prompt Glossary Footprint
  const promptGlossaryCharCount = measurePromptGlossarySectionChars(sample);

  return {
    sampleId: sample.id,
    glossaryComplianceRate,
    falseSubstitutionCount,
    chineseLeftoverRatio,
    paragraphParityPassed,
    pronounConsistencyRate,
    ungroundedProperNounCount,
    promptGlossaryCharCount,
  };
}

/**
 * Chạy đánh giá toàn bộ tập mẫu chuẩn và tính toán so sánh với baseline (nếu có).
 */
export function runQualityEvaluationSuite(
  samples: QualityEvaluationSample[],
  baselineSamples?: QualityEvaluationSample[]
): QualityEvaluationSuiteReport {
  const results = samples.map(evaluateTranslationQualitySample);
  const count = Math.max(1, results.length);

  const summary = {
    sampleCount: results.length,
    avgGlossaryComplianceRate:
      results.reduce((acc, r) => acc + r.glossaryComplianceRate, 0) / count,
    totalFalseSubstitutionCount: results.reduce((acc, r) => acc + r.falseSubstitutionCount, 0),
    avgChineseLeftoverRatio:
      results.reduce((acc, r) => acc + r.chineseLeftoverRatio, 0) / count,
    paragraphParityPassRate:
      results.filter((r) => r.paragraphParityPassed).length / count,
    avgPronounConsistencyRate:
      results.reduce((acc, r) => acc + r.pronounConsistencyRate, 0) / count,
    totalUngroundedProperNounCount: results.reduce(
      (acc, r) => acc + r.ungroundedProperNounCount,
      0
    ),
    totalPromptGlossaryCharCount: results.reduce((acc, r) => acc + r.promptGlossaryCharCount, 0),
  };

  if (!baselineSamples || baselineSamples.length === 0) {
    return { samples: results, summary };
  }

  const baseResults = baselineSamples.map(evaluateTranslationQualitySample);
  const baseCount = Math.max(1, baseResults.length);
  const baseAvgCompliance =
    baseResults.reduce((acc, r) => acc + r.glossaryComplianceRate, 0) / baseCount;
  const baseFalseSubs = baseResults.reduce((acc, r) => acc + r.falseSubstitutionCount, 0);
  const basePronounErrRate =
    baseResults.reduce((acc, r) => acc + (1 - r.pronounConsistencyRate), 0) / baseCount;
  const candPronounErrRate =
    results.reduce((acc, r) => acc + (1 - r.pronounConsistencyRate), 0) / count;
  const baseUngrounded = baseResults.reduce((acc, r) => acc + r.ungroundedProperNounCount, 0);
  const basePromptChars = baseResults.reduce((acc, r) => acc + r.promptGlossaryCharCount, 0);

  return {
    samples: results,
    summary,
    baselineComparison: {
      glossaryComplianceDelta: summary.avgGlossaryComplianceRate - baseAvgCompliance,
      falseSubstitutionReduction: baseFalseSubs - summary.totalFalseSubstitutionCount,
      pronounErrorReductionRate:
        basePronounErrRate > 0 ? (basePronounErrRate - candPronounErrRate) / basePronounErrRate : 0,
      ungroundedProperNounReductionRate:
        baseUngrounded > 0
          ? (baseUngrounded - summary.totalUngroundedProperNounCount) / baseUngrounded
          : 0,
      promptGlossaryCharReductionRate:
        basePromptChars > 0
          ? (basePromptChars - summary.totalPromptGlossaryCharCount) / basePromptChars
          : 0,
    },
  };
}
