import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrollAndSelectInTextarea } from '../textareaHighlight';

interface MockTextarea {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  scrollTop: number;
  focus: ReturnType<typeof vi.fn>;
  setSelectionRange: ReturnType<typeof vi.fn>;
}

function createMockTextarea(initialValue: string = ''): MockTextarea {
  const el: MockTextarea = {
    value: initialValue,
    selectionStart: 0,
    selectionEnd: 0,
    scrollTop: 0,
    focus: vi.fn(),
    setSelectionRange: vi.fn((start: number, end: number) => {
      el.selectionStart = start;
      el.selectionEnd = end;
    }),
  };
  return el;
}

describe('scrollAndSelectInTextarea Utility Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('Null Safety & Boundary Checks', () => {
    it('returns false when textarea element is null or undefined', () => {
      expect(scrollAndSelectInTextarea(null, 'test')).toBe(false);
      expect(scrollAndSelectInTextarea(undefined, 'test')).toBe(false);
    });

    it('returns false when targetText is null, undefined, or whitespace', () => {
      const textarea = createMockTextarea('Nội dung mẫu của chương truyện.');
      expect(scrollAndSelectInTextarea(textarea as unknown as HTMLTextAreaElement, null)).toBe(false);
      expect(scrollAndSelectInTextarea(textarea as unknown as HTMLTextAreaElement, undefined)).toBe(false);
      expect(scrollAndSelectInTextarea(textarea as unknown as HTMLTextAreaElement, '')).toBe(false);
      expect(scrollAndSelectInTextarea(textarea as unknown as HTMLTextAreaElement, '   ')).toBe(false);
    });

    it('returns false without changing selection when targetText does not exist in value', () => {
      const textarea = createMockTextarea('Tiêu Viêm thở ra một ngụm khí tức.');
      textarea.selectionStart = 0;
      textarea.selectionEnd = 0;

      const result = scrollAndSelectInTextarea(textarea as unknown as HTMLTextAreaElement, 'Đoạn văn không hề tồn tại');
      expect(result).toBe(false);
      expect(textarea.selectionStart).toBe(0);
      expect(textarea.selectionEnd).toBe(0);
      expect(textarea.focus).not.toHaveBeenCalled();
      expect(textarea.setSelectionRange).not.toHaveBeenCalled();
    });
  });

  describe('Selection Range & Focus Handling', () => {
    it('focuses and sets selection range correctly on exact matching snippet', () => {
      const textarea = createMockTextarea(
        'Chương 1.\nTiêu Viêm đứng trên vách núi.\nGió lạnh thổi qua vạt áo.'
      );
      const targetText = 'Tiêu Viêm đứng trên vách núi.';
      const expectedStart = textarea.value.indexOf(targetText);
      const expectedEnd = expectedStart + targetText.length;

      const result = scrollAndSelectInTextarea(textarea as unknown as HTMLTextAreaElement, targetText);

      expect(result).toBe(true);
      expect(textarea.focus).toHaveBeenCalled();
      expect(textarea.setSelectionRange).toHaveBeenCalledWith(expectedStart, expectedEnd);
      expect(textarea.selectionStart).toBe(expectedStart);
      expect(textarea.selectionEnd).toBe(expectedEnd);
    });

    it('selects the first occurrence when snippet appears multiple times', () => {
      const textarea = createMockTextarea('Lặp lại câu từ.\nĐoạn giữa.\nLặp lại câu từ.');
      const targetText = 'Lặp lại câu từ.';

      const result = scrollAndSelectInTextarea(textarea as unknown as HTMLTextAreaElement, targetText);

      expect(result).toBe(true);
      expect(textarea.selectionStart).toBe(0);
      expect(textarea.selectionEnd).toBe(targetText.length);
    });
  });

  describe('Scroll Position Calculation', () => {
    it('clamps scrollTop to 0 for matches in the first few lines', () => {
      const textarea = createMockTextarea('Dòng 1: Tiêu Viêm.\nDòng 2: Dược Lão xuất hiện.');
      const result = scrollAndSelectInTextarea(textarea as unknown as HTMLTextAreaElement, 'Dược Lão');

      expect(result).toBe(true);
      // Line count is 1 (index 1), with buffer 2 lines, targetScrollTop = Math.max(0, (1 - 2) * lineHeight) = 0
      expect(textarea.scrollTop).toBe(0);
    });

    it('calculates positive scrollTop when matching snippet is on deeper lines', () => {
      const lines = [
        'Dòng 0',
        'Dòng 1',
        'Dòng 2',
        'Dòng 3',
        'Dòng 4',
        'Dòng 5: Đoạn lỗi cần bôi chọn tại đây',
        'Dòng 6',
      ];
      const textarea = createMockTextarea(lines.join('\n'));

      // Stub window and getComputedStyle
      vi.stubGlobal('window', {
        getComputedStyle: vi.fn(() => ({
          lineHeight: '24px',
          fontSize: '16px',
        })),
      });

      const targetText = 'Đoạn lỗi cần bôi chọn';
      const result = scrollAndSelectInTextarea(textarea as unknown as HTMLTextAreaElement, targetText);

      expect(result).toBe(true);
      // Line count is 5, buffer is 2 lines -> (5 - 2) * 24px = 72px
      expect(textarea.scrollTop).toBe(72);
    });

    it('falls back to proportional fontSize calculation when lineHeight is not numeric', () => {
      const lines = [
        'Dòng 0',
        'Dòng 1',
        'Dòng 2',
        'Dòng 3',
        'Dòng 4',
        'Dòng 5: Mục tiêu trích dẫn',
      ];
      const textarea = createMockTextarea(lines.join('\n'));

      // Stub window with 'normal' lineHeight
      vi.stubGlobal('window', {
        getComputedStyle: vi.fn(() => ({
          lineHeight: 'normal',
          fontSize: '16px',
        })),
      });

      const targetText = 'Mục tiêu trích dẫn';
      const result = scrollAndSelectInTextarea(textarea as unknown as HTMLTextAreaElement, targetText);

      expect(result).toBe(true);
      // Fallback lineHeight = 16 * 1.5 = 24px
      // Line count is 5 -> (5 - 2) * 24 = 72px
      expect(textarea.scrollTop).toBe(72);
    });

    it('uses default fallback lineHeight 21 when window is undefined', () => {
      const lines = [
        'Dòng 0',
        'Dòng 1',
        'Dòng 2',
        'Dòng 3',
        'Dòng 4',
        'Dòng 5: Trích đoạn kiểm thử',
      ];
      const textarea = createMockTextarea(lines.join('\n'));

      // In Node environment without stubbed window.getComputedStyle:
      // Fallback lineHeight = 21px
      // Line count is 5 -> (5 - 2) * 21 = 63px
      const targetText = 'Trích đoạn kiểm thử';
      const result = scrollAndSelectInTextarea(textarea as unknown as HTMLTextAreaElement, targetText);

      expect(result).toBe(true);
      expect(textarea.scrollTop).toBe(63);
    });
  });

  describe('Smart Snippet Normalization & Quote Trimming', () => {
    it('matches and selects snippet wrapped in ASCII double quotes when text has no quotes', () => {
      const textarea = createMockTextarea(
        'Món đồ nhỏ bạn gái tặng mà không vứt đi được, phiền chết đi được.'
      );
      // Snippet bọc trong ngoặc kép như trích dẫn AI
      const snippetWithQuotes = '"Món đồ nhỏ bạn gái tặng mà không vứt đi được, phiền chết đi được."';

      const result = scrollAndSelectInTextarea(textarea as unknown as HTMLTextAreaElement, snippetWithQuotes);

      expect(result).toBe(true);
      expect(textarea.selectionStart).toBe(0);
      expect(textarea.selectionEnd).toBe(textarea.value.length);
      expect(textarea.focus).toHaveBeenCalled();
    });

    it('matches and selects snippet wrapped in curly quotes (“...”) and trailing ellipsis', () => {
      const textarea = createMockTextarea(
        'Hắn bước vào đại điện. Tiêu Viêm thần sắc nghiêm nghị nhìn chung quanh.'
      );
      const snippet = '“Tiêu Viêm thần sắc nghiêm nghị”...';

      const result = scrollAndSelectInTextarea(textarea as unknown as HTMLTextAreaElement, snippet);

      expect(result).toBe(true);
      expect(textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)).toBe(
        'Tiêu Viêm thần sắc nghiêm nghị'
      );
    });

    it('matches snippet using head chunk matching when text has trailing differences', () => {
      const textarea = createMockTextarea(
        'Hắn bước vào đại điện. Món đồ nhỏ bạn gái tặng mà không vứt đi được, phiền thật đấy nhé.'
      );
      // Snippet hơi khác đoạn đuôi
      const snippet = 'Món đồ nhỏ bạn gái tặng mà không vứt đi được, phiền chết đi được.';

      const result = scrollAndSelectInTextarea(textarea as unknown as HTMLTextAreaElement, snippet);

      expect(result).toBe(true);
      expect(textarea.selectionStart).toBe(23);
    });
  });
});

