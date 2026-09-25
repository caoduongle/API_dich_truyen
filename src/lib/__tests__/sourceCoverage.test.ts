import { describe, it, expect } from 'vitest';
import { verifySourceCoverage } from '../text';

describe('verifySourceCoverage (Spec 162 US3)', () => {
  it('returns isComplete=true and 0 droppedChars when chunks fully reconstruct original', () => {
    const original = 'Đoạn văn thứ nhất。\n\nĐoạn văn thứ hai。\n\nĐoạn văn thứ ba。';
    const chunks = [
      'Đoạn văn thứ nhất。',
      'Đoạn văn thứ hai。\n\nĐoạn văn thứ ba。',
    ];

    const report = verifySourceCoverage(original, chunks);
    expect(report.isComplete).toBe(true);
    expect(report.droppedCharsCount).toBe(0);
    expect(report.originalLength).toBe(original.length);
  });

  it('detects missing content when a chunk is dropped', () => {
    const original = 'Đoạn một。 Đoạn hai。 Đoạn ba。';
    const chunks = ['Đoạn một。', 'Đoạn ba。']; // Đoạn hai missing

    const report = verifySourceCoverage(original, chunks);
    expect(report.isComplete).toBe(false);
    expect(report.droppedCharsCount).toBeGreaterThan(0);
  });

  it('handles empty input gracefully', () => {
    const reportEmpty = verifySourceCoverage('', []);
    expect(reportEmpty.isComplete).toBe(true);
    expect(reportEmpty.droppedCharsCount).toBe(0);

    const reportNull = verifySourceCoverage('Văn bản nguồn', []);
    expect(reportNull.isComplete).toBe(false);
    expect(reportNull.droppedCharsCount).toBe('Văn bản nguồn'.length);
  });

  it('ignores whitespace differences between boundary splits', () => {
    const original = 'Câu 1.\n\n\n\nCâu 2.';
    const chunks = ['Câu 1.', 'Câu 2.'];

    const report = verifySourceCoverage(original, chunks);
    expect(report.isComplete).toBe(true);
    expect(report.droppedCharsCount).toBe(0);
  });
});
