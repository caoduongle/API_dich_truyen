import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as directGeminiClient from '../../directGeminiClient';
import {
  analyzeStructureParity,
  checkStructureParityIssues,
  extractParagraphSignature,
  normalizeTranslatedPunctuation,
  realignParagraphStructure,
  validateStrictStructureParity,
} from '../structureParity';
import {
  evaluatePolishRoundFidelity,
  mergeAndDeduplicateQaIssues,
  runDeterministicTranslationChecks,
} from '../translationValidation';
import { translateRawDirect } from '../rawTranslation';
import { polishTranslationDirect } from '../polishTranslation';
import { splitBilingualAdaptively } from '../bilingualSplit';
import { repairChapterCriticalIssuesDirect } from '../targetedRepair';

describe('Strict 1:1 Raw Structure Parity (Spec 166)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('normalizeTranslatedPunctuation (US2)', () => {
    it('converts all full-width CJK punctuation to Vietnamese standards including nested quotes', () => {
      const input =
        '「Ngươi nói 『tuyệt đối không thể』 là có ý gì？」Tiêu Viêm hỏi。\n\n' +
        'Hắn lấy ra 《Phần Quyết》——một bộ công pháp cổ xưa（đã thất truyền）；rồi nói：“Đi thôi……”\n\n' +
        '【Hệ thống：Độ hoàn thành 3.5%～100%。。。】';

      const normalized = normalizeTranslatedPunctuation(input);

      expect(normalized).not.toMatch(/[。，、；：？！「」『』（）《》〈〉【】［］＂＇．～…]/);
      expect(normalized).toContain(`"Ngươi nói 'tuyệt đối không thể' là có ý gì?" Tiêu Viêm hỏi.`);
      expect(normalized).toContain('«Phần Quyết»');
      expect(normalized).toContain('—một bộ công pháp cổ xưa (đã thất truyền)');
      expect(normalized).toContain('"Đi thôi..."');
      expect(normalized).toContain('[Hệ thống: Độ hoàn thành 3.5%~100%...]');
    });

    it('normalizes full-width variants (．＂＇［］〈〉) and collapses excessive blank lines', () => {
      const input = '＂Xin chào＇s＂．\n\n\n\n［Bảng trạng thái］〈Bí Tịch〉';
      const normalized = normalizeTranslatedPunctuation(input);
      expect(normalized).not.toMatch(/[。，、；：？！「」『』（）《》〈〉【】［］＂＇．～…]/);
      expect(normalized).toBe('"Xin chào\'s".\n\n[Bảng trạng thái] «Bí Tịch»');
    });

    it('preserves line breaks, decimals (3.5), timestamps (12:30), and scene dividers (***)', () => {
      const input = 'Tỉ lệ đạt 3.5 lần vào lúc 12:30。\n\n***\n\nHắn bước đi.';
      const normalized = normalizeTranslatedPunctuation(input);
      expect(normalized).toBe('Tỉ lệ đạt 3.5 lần vào lúc 12:30.\n\n***\n\nHắn bước đi.');
    });
  });

  describe('extractParagraphSignature & O(n) safety', () => {
    it('extracts sentence count, dialogue quotes, and terminal punctuation accurately without decimal false splits', () => {
      const sig = extractParagraphSignature(
        '"Tỉ lệ thành công chỉ 3.5% thôi sao?" Hắn sững sờ... "Thật khó tin!"',
        'vi'
      );
      expect(sig.sentenceCount).toBe(3);
      expect(sig.questionCount).toBe(1);
      expect(sig.ellipsisCount).toBe(1);
      expect(sig.exclamationCount).toBe(1);
      expect(sig.dialogueQuoteCount).toBe(2);
      expect(sig.hasDirectDialogue).toBe(true);
      expect(sig.terminalKind).toBe('exclamation');
    });

    it('handles unbalanced quotes cleanly in linear time without hanging', () => {
      const unbalanced = '"'.repeat(500) + 'Một câu chưa đóng ngoặc?';
      const sig = extractParagraphSignature(unbalanced, 'vi');
      expect(sig.questionCount).toBe(1);
      expect(sig.terminalKind).toBe('question');
    });

    it('treats clustered terminal punctuation (？！, ！！！, ……？) as a single sentence', () => {
      const srcSig = extractParagraphSignature('“什么？！”他惊呼。“不可能！！！”怎么会……？', 'zh');
      const tgtSig = extractParagraphSignature('"Cái gì?!" Hắn kinh hô. "Không thể nào!!!" Sao lại...?', 'vi');

      expect(srcSig.sentenceCount).toBe(4);
      expect(tgtSig.sentenceCount).toBe(4);
      expect(srcSig.questionCount).toBe(2);
      expect(tgtSig.questionCount).toBe(2);
      expect(srcSig.exclamationCount).toBe(2);
      expect(tgtSig.exclamationCount).toBe(2);
      expect(srcSig.ellipsisCount).toBe(1);
      expect(tgtSig.ellipsisCount).toBe(1);

      const report = analyzeStructureParity(
        '“什么？！”他惊呼。“不可能！！！”怎么会……？',
        '"Cái gì?!" Hắn kinh hô. "Không thể nào!!!" Sao lại...?'
      );
      expect(report.discrepancies).toHaveLength(0);
    });
  });

  describe('realignParagraphStructure & bilingualSplit sync (US1)', () => {
    it('splits merged pure adjacent dialogue lines when matching separate source dialogue lines', () => {
      const source = ['"Ngươi đi đâu?"', '"Ta đi tìm sư phụ."'].join('\n\n');
      const merged = '"Ngươi đi đâu?" "Ta đi tìm sư phụ."';
      const realigned = realignParagraphStructure(source, merged);
      expect(realigned).toBe('"Ngươi đi đâu?"\n\n"Ta đi tìm sư phụ."');
    });

    it('does NOT split a single paragraph containing two quotes separated by narration', () => {
      const source = '“走吧，”他回头说道，“天快黑了。”';
      const translated = '"Đi thôi," hắn quay đầu nói, "trời sắp tối rồi."';
      const realigned = realignParagraphStructure(source, translated);
      expect(realigned).toBe(translated);
    });

    it('does NOT blindly split a legitimate 2-quote source line when a non-dialogue paragraph elsewhere collapsed', () => {
      const source = ['“第一句。” “第二句。”', '他转身。', '夜风吹过。'].join('\n\n');
      const translated = ['"Câu một." "Câu hai."', 'Hắn quay người. Gió đêm thổi qua.'].join('\n\n');
      const realigned = realignParagraphStructure(source, translated);
      expect(realigned).toBe(translated);
    });

    it('splits bilingual text using consistent single/double newline paragraph boundaries', () => {
      const source = '第一章 启程\n\n第一行对话。\n第二行对话。\n第三行对话。\n第四行对话。';
      const raw = 'Chương 1: Khởi hành\n\nLời thoại 1.\nLời thoại 2.\nLời thoại 3.\nLời thoại 4.';
      const chunks = splitBilingualAdaptively(source, raw, 2);
      expect(chunks).toHaveLength(2);
      expect(chunks[0].sourceParagraphRange).toEqual({ start: 0, end: 3 });
      expect(chunks[0].rawParagraphRange).toEqual({ start: 0, end: 3 });
    });
  });

  describe('analyzeStructureParity, validateStrictStructureParity & checkStructureParityIssues (US1–US4)', () => {
    it('enforces exact 1:1 paragraph parity even for short chapters (< 5 paragraphs)', () => {
      const source = '第一句。\n\n第二句。\n\n第三句。';
      const collapsed = 'Câu thứ nhất.\n\nCâu thứ hai gộp câu thứ ba.';
      expect(() => validateStrictStructureParity(source, collapsed)).toThrow(/PARAGRAPH_STRUCTURE_DIVERGENCE/);
    });

    it('detects missing dialogue quotes, terminal ? -> . conversion, and sentence merging with paragraphIndex', () => {
      const source = [
        '第一章 试炼',
        '“你真的要去吗？”',
        '第一句。第二句。第三句。',
      ].join('\n\n');
      const broken = [
        'Chương 1: Thí luyện',
        'Ngươi thật sự muốn đi sao.',
        'Cả ba câu đã bị gộp lại thành một câu duy nhất.',
      ].join('\n\n');

      const report = analyzeStructureParity(source, broken);
      expect(report.isParagraphCountExact).toBe(true);
      expect(report.discrepancies.some((d) => d.kind === 'dialogue_quote_loss' && d.paragraphIndex === 1)).toBe(true);
      expect(report.discrepancies.some((d) => d.kind === 'terminal_punctuation_mismatch' && d.paragraphIndex === 1)).toBe(true);
      expect(report.discrepancies.some((d) => d.kind === 'sentence_count_divergence' && d.paragraphIndex === 2)).toBe(true);

      const issues = checkStructureParityIssues({ sourceText: source, translatedText: broken });
      expect(issues.every((i) => i.source === 'deterministic' && typeof i.paragraphIndex === 'number')).toBe(true);
      expect(issues.some((i) => i.paragraphIndex === 1 && i.severity === 'critical')).toBe(true);
      // Consolidates multiple 'other' structural discrepancies on paragraph 1 into 1 issue
      expect(issues.filter((i) => i.paragraphIndex === 1 && i.type === 'other')).toHaveLength(1);
    });

    it('does not suppress unrelated AI "other" issues on the same paragraph when [Cấu trúc 1-1] warning is present', () => {
      const source = '“你好吗？”';
      const translated = 'Ngươi khỏe không.';
      const deterministicIssues = checkStructureParityIssues({ sourceText: source, translatedText: translated });
      const merged = mergeAndDeduplicateQaIssues({
        deterministicIssues,
        aiIssues: [
          {
            type: 'other',
            severity: 'critical',
            targetText: 'Ngươi khỏe không.',
            description: 'Câu thoại bị gượng ngữ khí nghiêm trọng.',
          },
        ],
        translatedText: translated,
      });
      expect(merged.some((i) => i.source === 'deterministic')).toBe(true);
      expect(merged.some((i) => i.source !== 'deterministic' && i.description.includes('gượng ngữ khí'))).toBe(true);
    });

    it('does not include structure parity issues in runDeterministicTranslationChecks unless requested', () => {
      const source = '“你好吗？”';
      const broken = 'Ngươi khỏe không.';
      const defaultIssues = runDeterministicTranslationChecks({
        sourceText: source,
        translatedText: broken,
        glossary: [],
      });
      const withParityIssues = runDeterministicTranslationChecks({
        sourceText: source,
        translatedText: broken,
        glossary: [],
        includeStructureParity: true,
      });
      expect(defaultIssues).toHaveLength(0);
      expect(withParityIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Pipeline integration: raw/polish split-retry, Non-Regression fidelity & targetedRepair', () => {
    it('triggers split-retry in translateRawDirect when raw output collapses paragraphs and recovers 1:1', async () => {
      let callCount = 0;
      const source = ['“你来了？”', '“嗯。”', '他转身离开。', '夜风吹过。'].join('\n\n');

      vi.spyOn(directGeminiClient, 'callGeminiDirect').mockImplementation(async (args) => {
        callCount++;
        if (callCount === 1) {
          // Whole call merges 4 lines into 2
          return {
            text: JSON.stringify({
              rawTranslation: '"Ngươi tới rồi?" "Ừ." Hắn quay người rời đi.\n\nGió đêm thổi qua.',
              discoveredEntities: [],
            }),
            successKeyIndex: 0,
          };
        }
        const textBlock = args.prompt.split('--- VĂN BẢN TIẾNG TRUNG GỐC ---')[1] || args.prompt;
        const translatedParts: string[] = [];
        if (textBlock.includes('你来了')) translatedParts.push('"Ngươi tới rồi？"');
        if (textBlock.includes('嗯')) translatedParts.push('"Ừ。"');
        if (textBlock.includes('他转身离开')) translatedParts.push('Hắn quay người rời đi。');
        if (textBlock.includes('夜风吹过')) translatedParts.push('Gió đêm thổi qua。');
        return {
          text: JSON.stringify({
            rawTranslation: translatedParts.join('\n\n'),
            discoveredEntities: [],
          }),
          successKeyIndex: 0,
        };
      });

      const res = await translateRawDirect({
        text: source,
        genre: 'Tiên Hiệp',
        tone: 'Trang nghiêm',
        glossary: [],
        apiKeys: ['KEY_1'],
      });

      expect(callCount).toBe(3);
      expect(res.rawTranslation).toBe('"Ngươi tới rồi?"\n\n"Ừ."\n\nHắn quay người rời đi.\n\nGió đêm thổi qua.');
    });

    it('rejects round-2 polish candidate that collapses paragraphs and round-1 candidate that drops dialogue quotes', () => {
      const source = '“走吧！”\n\n他迈步前行。';
      const prev = '"Đi thôi!"\n\nHắn cất bước tiến lên.';

      const round2Collapsed = 'Đi thôi. Hắn cất bước tiến lên.';
      const fidelityRound2 = evaluatePolishRoundFidelity({
        sourceText: source,
        previousDraft: prev,
        candidatePolished: round2Collapsed,
        glossary: [],
        roundIndex: 2,
      });
      expect(fidelityRound2.isAcceptable).toBe(false);
      expect(fidelityRound2.rejectionReason).toContain('PARAGRAPH_STRUCTURE_DIVERGENCE');
      expect(fidelityRound2.rejectionReason).toContain('STRUCTURE_PARITY_REGRESSION');

      const round1DroppedQuotes = 'Đi thôi.\n\nHắn cất bước tiến lên.';
      const fidelityRound1 = evaluatePolishRoundFidelity({
        sourceText: source,
        previousDraft: prev,
        candidatePolished: round1DroppedQuotes,
        glossary: [],
        roundIndex: 1,
      });
      expect(fidelityRound1.isAcceptable).toBe(false);
      expect(fidelityRound1.rejectionReason).toContain('STRUCTURE_PARITY_REGRESSION');
    });

    it('normalizes CJK punctuation in polishTranslationDirect without extra retry calls', async () => {
      const spy = vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
        text: JSON.stringify({
          polishedTranslation: '「Ngươi thật sự không sợ sao？」Tiêu Viêm khẽ cười……',
          discoveredEntities: [],
        }),
        successKeyIndex: 0,
      });

      const res = await polishTranslationDirect({
        sourceText: '「你真的不怕吗？」萧炎轻笑……',
        rawTranslation: '"Ngươi thật sự không sợ sao?" Tiêu Viêm khẽ cười...',
        genre: 'Tiên Hiệp',
        tone: 'Trang nghiêm',
        glossary: [],
        apiKeys: ['KEY_1'],
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(res.polishedTranslation).toBe('"Ngươi thật sự không sợ sao?" Tiêu Viêm khẽ cười...');
    });

    it('allows targetedRepair to restore missing sentence in omission fix without false rollback', async () => {
      const source = '第一章\n\n他停下脚步。然后转身看着对方。';
      const broken = 'Chương 1\n\nHắn dừng bước.';
      vi.spyOn(directGeminiClient, 'callGeminiDirect').mockResolvedValue({
        text: JSON.stringify({
          repairedParagraph: 'Hắn dừng bước. Sau đó quay người nhìn đối phương.',
        }),
        successKeyIndex: 0,
      });

      const result = await repairChapterCriticalIssuesDirect({
        sourceText: source,
        translatedText: broken,
        issues: [
          {
            type: 'omission',
            severity: 'critical',
            targetText: 'Hắn dừng bước.',
            description: 'Thiếu câu thứ hai.',
            paragraphIndex: 1,
          },
        ],
        glossary: [],
        genre: 'Tiên Hiệp',
        tone: 'Trang nghiêm',
        apiKeys: ['KEY_1'],
      });

      expect(result.repairedParagraphIndices).toEqual([1]);
      expect(result.repairedTranslatedText).toBe('Chương 1\n\nHắn dừng bước. Sau đó quay người nhìn đối phương.');
    });
  });
});
