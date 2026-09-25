import { describe, it, expect } from 'vitest';
import {
  findSplitPoint,
  isIndexInsideProtectedToken,
  adjustSplitPointOutsideProtected,
  splitTextAdaptively,
} from '../text';

describe('Monotonic Split & Bracket Protection (Spec 162 US3)', () => {
  describe('isIndexInsideProtectedToken', () => {
    const text = 'Tiêu Viêm thi triển [Phật Nộ Hỏa Liên] cực kỳ khủng khiếp.';

    it('returns true when index is strictly inside brackets', () => {
      const openIdx = text.indexOf('[');
      const closeIdx = text.indexOf(']');
      expect(isIndexInsideProtectedToken(text, openIdx + 1)).toBe(true);
      expect(isIndexInsideProtectedToken(text, closeIdx)).toBe(true);
    });

    it('returns false when index is outside brackets', () => {
      const openIdx = text.indexOf('[');
      const closeIdx = text.indexOf(']');
      expect(isIndexInsideProtectedToken(text, openIdx)).toBe(false);
      expect(isIndexInsideProtectedToken(text, closeIdx + 1)).toBe(false);
      expect(isIndexInsideProtectedToken(text, 0)).toBe(false);
    });
  });

  describe('adjustSplitPointOutsideProtected', () => {
    const text = 'Tiêu Viêm thi triển [Phật Nộ Hỏa Liên] cực kỳ khủng khiếp.';

    it('shifts split point backwards to opening bracket if inside', () => {
      const openIdx = text.indexOf('[');
      const insidePoint = openIdx + 3;
      const adjusted = adjustSplitPointOutsideProtected(text, insidePoint);
      expect(adjusted).toBe(openIdx);
      expect(isIndexInsideProtectedToken(text, adjusted)).toBe(false);
    });

    it('leaves split point unchanged if already outside', () => {
      expect(adjustSplitPointOutsideProtected(text, 5)).toBe(5);
    });
  });

  describe('findSplitPoint with entity brackets', () => {
    it('avoids splitting directly inside a protected bracket entity', () => {
      // Craft a string where the mathematical midpoint falls right inside [Cửu Lôi Đao]
      const prefix = 'Đoạn văn mở đầu khá dài ở đây ';
      const protectedEntity = '[Cửu Trọng Lôi Đao Bí Tích Cực Phẩm]';
      const suffix = ' đoạn văn kết thúc cũng có độ dài tương đương';
      const text = prefix + protectedEntity + suffix;

      const splitPoint = findSplitPoint(text);
      expect(isIndexInsideProtectedToken(text, splitPoint)).toBe(false);
    });
  });

  describe('splitTextAdaptively', () => {
    it('preserves all paragraphs when splitting by double newline', () => {
      const text =
        'Đoạn văn mở đầu thứ nhất miêu tả cảnh sắc hùng vĩ của đất trời mênh mông vô tận.\n\n' +
        'Đoạn văn thứ hai kể về nhân vật chính [Tiêu Viêm] đang âm thầm tu luyện tuyệt kỹ thượng thừa.\n\n' +
        'Đoạn văn thứ ba tiếp tục mô tả linh khí cuồn cuộn đổ dồn về đan điền như thác lũ cuồng nộ.\n\n' +
        'Đoạn văn thứ tư kết thúc chương truyện với ánh mắt kiên định nhìn về phương xa xôi.';
      const parts = splitTextAdaptively(text, 2);
      expect(parts.length).toBe(2);
      expect(parts[0]).toContain('Đoạn văn mở đầu');
      expect(parts[1]).toContain('Đoạn văn thứ tư');
    });
  });
});
