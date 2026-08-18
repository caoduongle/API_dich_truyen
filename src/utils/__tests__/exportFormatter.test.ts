import { describe, it, expect } from 'vitest';
import {
  normalizeChapterTitle,
  formatChapterForWeb,
  formatChapterForAudio,
  buildExportFileContent,
  FormattedChapterInput
} from '../exportFormatter';

describe('exportFormatter - Web and Audio export formatting', () => {
  describe('normalizeChapterTitle', () => {
    it('should keep standard Vietnamese title intact', () => {
      expect(normalizeChapterTitle('Chương 1: Khởi đầu mới', 1)).toBe('Chương 1: Khởi đầu mới');
    });

    it('should strip existing star and hash prefixes', () => {
      expect(normalizeChapterTitle('*** Chương 2: Bước ngoặt', 2)).toBe('Chương 2: Bước ngoặt');
      expect(normalizeChapterTitle('### Chương 3: Trùng phùng', 3)).toBe('Chương 3: Trùng phùng');
    });

    it('should convert Chinese title 第1章 into Chương 1', () => {
      expect(normalizeChapterTitle('第1章 穿越异界', 1)).toBe('Chương 1: 穿越异界');
      expect(normalizeChapterTitle('第25章', 25)).toBe('Chương 25');
    });

    it('should strip part indicators like (1/2) or [phần 1]', () => {
      expect(normalizeChapterTitle('Chương 5: Đại chiến (1/2)', 5)).toBe('Chương 5: Đại chiến');
      expect(normalizeChapterTitle('Chương 6: Kết thúc [phần 2]', 6)).toBe('Chương 6: Kết thúc');
    });

    it('should add Chapter prefix if only title text provided', () => {
      expect(normalizeChapterTitle('Lời mở đầu', 1)).toBe('Chương 1: Lời mở đầu');
    });
  });

  describe('formatChapterForWeb', () => {
    it('should format chapter with *** prefix on its own line followed immediately by body', () => {
      const input: FormattedChapterInput = {
        index: 1,
        chapterTitle: 'Chương 1: Khởi đầu',
        translatedText: 'Ánh nắng ban mai chiếu rọi khắp ngọn núi.\nDiệp Trần mở mắt thức dậy.',
      };

      const result = formatChapterForWeb(input);

      expect(result.formattedTitle).toBe('Chương 1: Khởi đầu');
      expect(result.cleanBody).toBe('Ánh nắng ban mai chiếu rọi khắp ngọn núi.\nDiệp Trần mở mắt thức dậy.');
      expect(result.fullOutput).toBe(
        '*** Chương 1: Khởi đầu\nÁnh nắng ban mai chiếu rọi khắp ngọn núi.\nDiệp Trần mở mắt thức dậy.'
      );
    });

    it('should eliminate duplicate title line in the first line of content', () => {
      const input: FormattedChapterInput = {
        index: 2,
        chapterTitle: 'Chương 2: Bí cảnh',
        translatedText: 'Chương 2: Bí cảnh\nTrong hang động tối tăm, hắn bước từng bước cẩn thận.',
      };

      const result = formatChapterForWeb(input);

      expect(result.formattedTitle).toBe('Chương 2: Bí cảnh');
      expect(result.cleanBody).toBe('Trong hang động tối tăm, hắn bước từng bước cẩn thận.');
      expect(result.fullOutput).toBe(
        '*** Chương 2: Bí cảnh\nTrong hang động tối tăm, hắn bước từng bước cẩn thận.'
      );
    });

    it('should not strip normal body lines that happen to contain the word Chương', () => {
      const input: FormattedChapterInput = {
        index: 3,
        chapterTitle: 'Chương 3: Gặp gỡ',
        translatedText: 'Hắn nói: "Đây là một chương mới trong cuộc đời của ta."\nNàng khẽ gật đầu mỉm cười.',
      };

      const result = formatChapterForWeb(input);

      expect(result.formattedTitle).toBe('Chương 3: Gặp gỡ');
      expect(result.cleanBody).toBe(
        'Hắn nói: "Đây là một chương mới trong cuộc đời của ta."\nNàng khẽ gật đầu mỉm cười.'
      );
      expect(result.fullOutput).toBe(
        '*** Chương 3: Gặp gỡ\nHắn nói: "Đây là một chương mới trong cuộc đời của ta."\nNàng khẽ gật đầu mỉm cười.'
      );
    });

    it('should remove divider lines like *** or --- from the body', () => {
      const input: FormattedChapterInput = {
        index: 4,
        chapterTitle: 'Chương 4: Quyết chiến',
        translatedText: '***\nĐao kiếm chạm nhau tóe lửa.\n---\nKết quả đã rõ ràng.',
      };

      const result = formatChapterForWeb(input);

      expect(result.cleanBody).toBe('Đao kiếm chạm nhau tóe lửa.\nKết quả đã rõ ràng.');
    });
  });

  describe('buildExportFileContent', () => {
    it('should combine multiple chapters with \\n\\n for Web export mode', () => {
      const chapters: FormattedChapterInput[] = [
        {
          index: 1,
          chapterTitle: 'Chương 1: Khởi đầu',
          translatedText: 'Nội dung chương 1...',
        },
        {
          index: 2,
          chapterTitle: 'Chương 2: Tiếp diễn',
          translatedText: 'Nội dung chương 2...',
        },
      ];

      const output = buildExportFileContent(chapters, 'web');

      const expected =
        '*** Chương 1: Khởi đầu\nNội dung chương 1...\n\n*** Chương 2: Tiếp diễn\nNội dung chương 2...';

      expect(output).toBe(expected);
    });

    it('should combine chapters correctly for Audio export mode', () => {
      const chapters: FormattedChapterInput[] = [
        {
          index: 1,
          chapterTitle: 'Chương 1: Khởi đầu',
          translatedText: 'Nội dung chương 1...',
        },
        {
          index: 2,
          chapterTitle: 'Chương 2: Tiếp diễn',
          translatedText: 'Nội dung chương 2...',
        },
      ];

      const output = buildExportFileContent(chapters, 'audio');

      expect(output).toBe(
        'Chương 1: Khởi đầu\n\nNội dung chương 1...\n\nChương 2: Tiếp diễn\n\nNội dung chương 2...'
      );
    });
  });
});
