import { describe, it, expect } from 'vitest';
import {
  normalizeChapterTitle,
  formatChapterForWeb,
  formatChapterForAudio,
  buildExportFileContent,
  formatExportTxtFileName,
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

  describe('formatExportTxtFileName', () => {
    it('should format filename for multiple chapters range with _den_ and _WEB suffix', () => {
      const filename = formatExportTxtFileName({
        projectTitle: 'Đài Phát Thanh Kinh Dị',
        startIndex: 1,
        endIndex: 20,
        mode: 'web',
      });
      expect(filename).toBe('Đài_Phát_Thanh_Kinh_Dị_Chuong_001_den_Chuong_020_WEB.txt');
    });

    it('should format filename for multiple chapters range with _AUDIO suffix', () => {
      const filename = formatExportTxtFileName({
        projectTitle: 'Đài Phát Thanh Kinh Dị',
        startIndex: 21,
        endIndex: 30,
        mode: 'audio',
      });
      expect(filename).toBe('Đài_Phát_Thanh_Kinh_Dị_Chuong_021_den_Chuong_030_AUDIO.txt');
    });

    it('should format single chapter filename without _den_ when startIndex equals endIndex', () => {
      const filename = formatExportTxtFileName({
        projectTitle: 'Đài Phát Thanh Kinh Dị',
        startIndex: 5,
        endIndex: 5,
        mode: 'web',
      });
      expect(filename).toBe('Đài_Phát_Thanh_Kinh_Dị_Chuong_005_WEB.txt');
    });

    it('should pad chapter numbers with 3 digits correctly for large numbers', () => {
      const filename = formatExportTxtFileName({
        projectTitle: 'Phàm Nhân Tu Tiên',
        startIndex: 101,
        endIndex: 120,
        mode: 'web',
      });
      expect(filename).toBe('Phàm_Nhân_Tu_Tiên_Chuong_101_den_Chuong_120_WEB.txt');
    });

    it('should sanitize special characters in project title', () => {
      const filename = formatExportTxtFileName({
        projectTitle: 'Truyện: Hay/Cực Phẩm? [Vip#1]',
        startIndex: 1,
        endIndex: 10,
        mode: 'web',
      });
      expect(filename).toBe('Truyện_Hay_Cực_Phẩm_Vip_1_Chuong_001_den_Chuong_010_WEB.txt');
    });

    it('should fallback to default title if empty or undefined', () => {
      const filename = formatExportTxtFileName({
        projectTitle: '',
        startIndex: 1,
        endIndex: 1,
        mode: 'audio',
      });
      expect(filename).toBe('Truyen_Chuong_001_AUDIO.txt');
    });
  });
});

