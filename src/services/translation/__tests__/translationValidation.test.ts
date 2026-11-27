import { describe, it, expect } from 'vitest';
import {
  checkGlossaryCompliance,
  classifyTranslationOutcome,
  isAdaptiveSplitRetryableError,
} from '../translationValidation';
import { GeminiRequestError } from '../../gemini/types';
import { GlossaryItem } from '../../../types';

describe('classifyTranslationOutcome', () => {
  it('returns SUCCESS when there is no error', () => {
    const outcome = classifyTranslationOutcome(null);
    expect(outcome.type).toBe('SUCCESS');
    expect(outcome.isRetryable).toBe(false);
    expect(outcome.canSplitRetry).toBe(false);
    expect(outcome.isContentBlocked).toBe(false);
  });

  describe('GeminiRequestError classification', () => {
    it('classifies CONTENT_BLOCKED as TERMINAL with canSplitRetry=true and isRetryable=false', () => {
      const err = new GeminiRequestError('Prompt was blocked by safety filters', {
        code: 'CONTENT_BLOCKED',
        category: 'CONTENT_BLOCKED',
        isRetryable: false,
      });

      const outcome = classifyTranslationOutcome(err);
      expect(outcome.type).toBe('TERMINAL');
      expect(outcome.isRetryable).toBe(false); // Do not retry same prompt / do not rotate key
      expect(outcome.canSplitRetry).toBe(true); // Can split into smaller segments
      expect(outcome.isContentBlocked).toBe(true);
    });

    it('classifies AUTH_FAILURE as TERMINAL with canSplitRetry=false', () => {
      const err = new GeminiRequestError('API key invalid', {
        code: 'AUTH_FAILURE',
        category: 'AUTH_FAILURE',
        isRetryable: false,
      });

      const outcome = classifyTranslationOutcome(err);
      expect(outcome.type).toBe('TERMINAL');
      expect(outcome.isRetryable).toBe(false);
      expect(outcome.canSplitRetry).toBe(false);
    });

    it('classifies RATE_LIMIT_RPM as RETRYABLE with canSplitRetry=false (infrastructure wait instead of split storm)', () => {
      const err = new GeminiRequestError('Rate limit exceeded', {
        code: 'UNRECOGNIZED',
        category: 'RATE_LIMIT_RPM',
        isRetryable: true,
      });

      const outcome = classifyTranslationOutcome(err);
      expect(outcome.type).toBe('RETRYABLE');
      expect(outcome.isRetryable).toBe(true);
      expect(outcome.canSplitRetry).toBe(false);
    });

    it('classifies SERVICE_OVERLOAD as RETRYABLE with canSplitRetry=false', () => {
      const err = new GeminiRequestError('Backend 503 unavailable', {
        code: 'UNRECOGNIZED',
        category: 'SERVICE_OVERLOAD',
        isRetryable: true,
      });

      const outcome = classifyTranslationOutcome(err);
      expect(outcome.type).toBe('RETRYABLE');
      expect(outcome.isRetryable).toBe(true);
      expect(outcome.canSplitRetry).toBe(false);
    });
  });

  describe('AbortError classification', () => {
    it('classifies AbortError as non-retryable TERMINAL', () => {
      const err = new Error('The user aborted the request.');
      err.name = 'AbortError';

      const outcome = classifyTranslationOutcome(err);
      expect(outcome.type).toBe('TERMINAL');
      expect(outcome.isRetryable).toBe(false);
      expect(outcome.canSplitRetry).toBe(false);
    });
  });

  describe('Domain validation errors', () => {
    it('classifies UNTRANSLATED_CHINESE_LEFTOVER as RETRYABLE split candidate', () => {
      const err = new Error('Tỷ lệ chữ Hán còn sót quá cao: UNTRANSLATED_CHINESE_LEFTOVER');
      const outcome = classifyTranslationOutcome(err);
      expect(outcome.type).toBe('RETRYABLE');
      expect(outcome.canSplitRetry).toBe(true);
      expect(outcome.isContentBlocked).toBe(false);
    });

    it('classifies POLISH_TRUNCATION_DETECTED as RETRYABLE split candidate', () => {
      const err = new Error('Phát hiện bản chuốt bị cắt cụt: POLISH_TRUNCATION_DETECTED');
      const outcome = classifyTranslationOutcome(err);
      expect(outcome.type).toBe('RETRYABLE');
      expect(outcome.canSplitRetry).toBe(true);
    });

    it('classifies safety string message fallback as CONTENT_BLOCKED', () => {
      const err = new Error('Nội dung bị chặn bởi bộ lọc an toàn Google Gemini');
      const outcome = classifyTranslationOutcome(err);
      expect(outcome.type).toBe('TERMINAL');
      expect(outcome.isContentBlocked).toBe(true);
      expect(outcome.canSplitRetry).toBe(true);
      expect(outcome.isRetryable).toBe(false);
    });
  });

  describe('isAdaptiveSplitRetryableError backward compatibility', () => {
    it('returns true for CONTENT_BLOCKED and domain errors', () => {
      expect(isAdaptiveSplitRetryableError(new Error('UNTRANSLATED_CHINESE_LEFTOVER'))).toBe(true);
      expect(isAdaptiveSplitRetryableError(new Error('bộ lọc an toàn'))).toBe(true);
    });

    it('returns false for AbortError and AUTH_FAILURE', () => {
      const abortErr = new Error('aborted');
      abortErr.name = 'AbortError';
      expect(isAdaptiveSplitRetryableError(abortErr)).toBe(false);

      const authErr = new GeminiRequestError('Auth error', {
        code: 'AUTH_FAILURE',
        category: 'AUTH_FAILURE',
        isRetryable: false,
      });
      expect(isAdaptiveSplitRetryableError(authErr)).toBe(false);
    });
  });

  describe('checkGlossaryCompliance longest-match span masking (Feature 169)', () => {
    const mk = (id: string, chinese: string, vietnamese: string): GlossaryItem => ({
      id,
      chinese,
      pinyin: vietnamese,
      vietnamese,
      type: 'character',
      note: '',
    });

    it('produces zero false-positive terminology errors when shorter term is strictly inside matched longer term', () => {
      const glossary = [
        mk('g_long', '张三丰', 'Trương Tam Phong'),
        mk('g_short', '三丰', 'Tam Phong'),
        mk('g_single', '张', 'Trương'),
      ];

      // Note: "Trương Tam Phong" contains "Tam Phong" or suppose distinct Vietnamese like "Thần Kiếm Môn" vs "Kiếm"
      const distinctViGlossary = [
        mk('g_long', '天煞宗', 'Ám Ảnh Môn'),
        mk('g_short', '煞宗', 'Sát Tông'),
      ];

      const issues = checkGlossaryCompliance({
        sourceText: '天煞宗来了。',
        translatedText: 'Ám Ảnh Môn đã tới.',
        glossary: distinctViGlossary,
      });
      expect(issues).toEqual([]);
      expect(
        checkGlossaryCompliance({
          sourceText: '张三丰来了。',
          translatedText: 'Trương Tam Phong đã tới.',
          glossary,
        })
      ).toEqual([]);
    });

    it('still flags shorter term when it appears independently outside the longer term in same paragraph', () => {
      const glossary = [
        mk('g_long', '天煞宗', 'Ám Ảnh Môn'),
        mk('g_short', '煞宗', 'Sát Tông'),
      ];

      const issues = checkGlossaryCompliance({
        sourceText: '天煞宗围攻煞宗。',
        translatedText: 'Ám Ảnh Môn bao vây đối phương.',
        glossary,
      });

      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe('terminology');
      expect(issues[0].expectedTerm?.chinese).toBe('煞宗');
    });

    it('does not let an incomplete long term with empty vietnamese shadow a valid shorter term inside it', () => {
      const glossary = [
        mk('g_empty', '天煞宗', ''),
        mk('g_valid', '煞宗', 'Sát Tông'),
      ];

      const issues = checkGlossaryCompliance({
        sourceText: '天煞宗来了。',
        translatedText: 'Bọn họ đã tới.',
        glossary,
      });

      expect(issues).toHaveLength(1);
      expect(issues[0].expectedTerm?.chinese).toBe('煞宗');
    });
  });
});
