import { describe, it, expect } from 'vitest';
import {
  containsHanChars,
  detectMandarinPinyin,
} from '../glossaryMatch';
import {
  classifyScannedGlossaryBatch,
  findSubTermOrCompositeOverlap,
  hasSentencePunctuationOrOverlong,
  isCommonEverydayScanNoise,
  isShortAlphanumericCode,
  isSingleHanCharTerm,
  prioritizeKnownAnchorEntriesForChapter,
  sanitizeScannedNote,
} from '../glossaryScanQuality';
import { GlossaryItem } from '../../types';

const mkItem = (overrides: Partial<GlossaryItem> & { chinese: string; vietnamese: string }): GlossaryItem => ({
  id: overrides.id || `id_${overrides.chinese}`,
  pinyin: overrides.pinyin ?? overrides.vietnamese,
  type: overrides.type || 'character',
  note: overrides.note ?? '',
  ...overrides,
});

describe('glossaryScanQuality (Feature 170)', () => {
  describe('Mandarin Pinyin & Han Leak Detection (US1)', () => {
    it('detects Pinyin tone diacritics and untoned Mandarin Pinyin tokens accurately', () => {
      expect(detectMandarinPinyin('huò zūn')).toBe(true);
      expect(detectMandarinPinyin('Yì Tiān Lěi')).toBe(true);
      expect(detectMandarinPinyin('Dào Gé Lā Sī')).toBe(true);
      expect(detectMandarinPinyin('Tan Dai Qin')).toBe(true);
      expect(detectMandarinPinyin('Qicheng San Yiyuan')).toBe(true);
      expect(detectMandarinPinyin('Jichang')).toBe(true);
      expect(detectMandarinPinyin('Yuan')).toBe(true);
      expect(detectMandarinPinyin('Mù shìzhǎng')).toBe(true);
      expect(detectMandarinPinyin('Qí Chéng Zhī Jiā')).toBe(true);
    });

    it('does NOT false-positive on Vietnamese Sino-Vietnamese readings or Western names', () => {
      expect(detectMandarinPinyin('Lâm Chính')).toBe(false);
      expect(detectMandarinPinyin('Văn Thành Chí')).toBe(false);
      expect(detectMandarinPinyin('Cát Bá Đặc')).toBe(false);
      expect(detectMandarinPinyin('Sài Văn')).toBe(false);
      expect(detectMandarinPinyin('Tiền Thương Nhất')).toBe(false);
      expect(detectMandarinPinyin('Quang Âm Trủng')).toBe(false);
      expect(detectMandarinPinyin('Marshall')).toBe(false);
      expect(detectMandarinPinyin('Jack')).toBe(false);
      expect(detectMandarinPinyin('Will')).toBe(false);
      expect(detectMandarinPinyin('Owen')).toBe(false);
      expect(detectMandarinPinyin('Alice')).toBe(false);
      expect(detectMandarinPinyin('Quan Vũ')).toBe(false);
      expect(detectMandarinPinyin('Đạo Quán')).toBe(false);
      expect(detectMandarinPinyin('Pháp Quan')).toBe(false);
      expect(detectMandarinPinyin('Chàng Trai')).toBe(false);
      expect(detectMandarinPinyin('Xin Chào')).toBe(false);
      expect(detectMandarinPinyin('Xíu')).toBe(false);
    });

    it('detects raw Han characters in reading and safely strips Han leaks from Vietnamese notes', () => {
      expect(containsHanChars('秦局')).toBe(true);
      expect(containsHanChars('Tần Cục')).toBe(false);

      const cleaned = sanitizeScannedNote("Nhân viên quay phim đi cùng 李倩 ở Kỳ Thành");
      expect(cleaned.hadHanLeak).toBe(true);
      expect(cleaned.cleanEnough).toBe(true);
      expect(containsHanChars(cleaned.cleanedNote)).toBe(false);
      expect(cleaned.cleanedNote).toContain('Nhân viên quay phim đi cùng');

      const bareHanNote = sanitizeScannedNote('见鬼群');
      expect(bareHanNote.hadHanLeak).toBe(true);
      expect(bareHanNote.cleanEnough).toBe(false);
    });
  });

  describe('Noise Rejection vs. Borderline Review Gate (US2)', () => {
    it('rejects short alphanumeric codes, everyday nouns, idioms, and sentence fragments while keeping composite terms', () => {
      expect(isShortAlphanumericCode('A1')).toBe(true);
      expect(isShortAlphanumericCode('A2')).toBe(true);
      expect(isShortAlphanumericCode('42号')).toBe(false);

      expect(isSingleHanCharTerm('海')).toBe(true);
      expect(isSingleHanCharTerm('昆')).toBe(true);
      expect(isSingleHanCharTerm('42号')).toBe(false);
      expect(isSingleHanCharTerm('词_chap_1')).toBe(false);

      expect(hasSentencePunctuationOrOverlong('我想看鬼，快点！')).toBe(true);
      expect(hasSentencePunctuationOrOverlong('伊丽莎白·乌里扬诺夫')).toBe(false);

      expect(isCommonEverydayScanNoise('电脑', 'other')).toBe(true);
      expect(isCommonEverydayScanNoise('步行街', 'location')).toBe(true);
      expect(isCommonEverydayScanNoise('暗度陈仓', 'phrase')).toBe(true);
      expect(isCommonEverydayScanNoise('万剑归宗', 'phrase')).toBe(false);
      expect(isCommonEverydayScanNoise('钱仓一', 'character')).toBe(false);
    });

    it('detects truncated sub-terms and redundant composite affixes against existing glossary', () => {
      const existing: GlossaryItem[] = [
        mkItem({ id: 'g1', chinese: '钱仓一', vietnamese: 'Tiền Thương Nhất' }),
        mkItem({ id: 'g2', chinese: '天马', vietnamese: 'Thiên Mã' }),
        mkItem({ id: 'g3', chinese: '长兰小区', vietnamese: 'Khu Dân Cư Trường Lan', type: 'location' }),
      ];

      // "仓一" chỉ nằm bên trong "钱仓一" trong văn bản
      const overlap1 = findSubTermOrCompositeOverlap('仓一', existing, '钱仓一走进片场。');
      expect(overlap1).not.toBeNull();
      expect(overlap1?.relatedChinese).toBe('钱仓一');

      // Nếu "仓一" xuất hiện độc lập ngoài "钱仓一" thì không coi là mảnh cắt thuần túy
      const independent = findSubTermOrCompositeOverlap('仓一', existing, '钱仓一停步，仓一笑了。');
      expect(independent).toBeNull();

      // "天马博士" trùng mở rộng danh xưng với "天马"
      const affixOverlap = findSubTermOrCompositeOverlap('天马博士', existing, '天马博士出现。');
      expect(affixOverlap?.relatedChinese).toBe('天马');
    });

    it('routes 592-style defects accurately across accept, review, and reject buckets', () => {
      const existing: GlossaryItem[] = [
        mkItem({ id: 'e1', chinese: '钱仓一', vietnamese: 'Tiền Thương Nhất' }),
        mkItem({ id: 'e2', chinese: '天马', vietnamese: 'Thiên Mã' }),
      ];

      const batch = classifyScannedGlossaryBatch({
        candidates: [
          { chinese: '千江月', pinyin: 'Thiên Giang Nguyệt', vietnamese: 'Thiên Giang Nguyệt', type: 'character', note: 'Nhân vật nữ, diễn viên kỳ cựu' },
          { chinese: '方大泽', pinyin: 'Phương Đại Trạch', vietnamese: 'Phương Đại Trạch', type: 'character', note: 'Nhân viên quay phim đi cùng 李倩' },
          { chinese: '霍尊', pinyin: 'huò zūn', vietnamese: 'Hoắc Tôn', type: 'character', note: 'Thân phận nhân vật' },
          { chinese: '秦局', pinyin: '秦局', vietnamese: 'Cục trưởng Tần', type: 'character', note: 'Cục trưởng' },
          { chinese: '海', pinyin: 'Hai', vietnamese: 'Hai', type: 'character', note: 'Trợ lý' },
          { chinese: '仓一', pinyin: 'Thương Nhất', vietnamese: 'Thương Nhất', type: 'character', note: 'Tên gọi tắt' },
          { chinese: '天马博士', pinyin: 'Thiên Mã Bác Sĩ', vietnamese: 'Tiến sĩ Thiên Mã', type: 'character', note: 'Nhà khoa học' },
          { chinese: 'A1', pinyin: 'A1', vietnamese: 'Khu A1', type: 'location', note: 'Khu vực' },
          { chinese: '电脑', pinyin: 'Diànnǎo', vietnamese: 'Máy Tính', type: 'term', note: 'Đồ vật' },
          { chinese: '我想看鬼', pinyin: 'Ngã Tưởng Khán Quỷ', vietnamese: 'Tôi muốn thấy ma', type: 'phrase', note: 'Câu lệnh' },
        ],
        existingGlossary: existing,
        sourceText: '钱仓一与千江月看着方大泽，霍尊与秦局走来，天马博士打开电脑，海站在A1旁，大喊我想看鬼。',
        chapterTitle: 'Chương 1',
        chapterId: 'chap_1',
      });

      expect(batch.acceptedItems.map((i) => i.chinese)).toEqual(['千江月', '方大泽']);
      expect(batch.acceptedItems[0].characterProfile).toEqual({ gender: 'female' });
      // Note chữ Hán của 方大泽 đã được làm sạch trước khi lưu
      expect(containsHanChars(batch.acceptedItems[1].note)).toBe(false);

      // Các ca lỗi/nghi ngờ đi sang hàng chờ duyệt với lý do chi tiết và union reason hợp lệ
      expect(batch.reviewItems.map((r) => r.chinese)).toEqual(['霍尊', '秦局', '海', '仓一', '天马博士']);
      expect(batch.reviewItems[0].reason).toBe('AI trích xuất nghi ngờ hallucinate');
      expect(batch.reviewItems[0].originalValue).toContain('Bính âm');
      expect(batch.reviewItems[3].reason).toBe('Duplicate Chinese');
      expect(batch.reviewItems[3].originalValue).toContain('钱仓一');

      // Rác rõ rệt bị reject
      expect(batch.rejectedCandidates.map((r) => r.chinese)).toEqual(['A1', '电脑', '我想看鬼']);
      expect(batch.telemetry).toEqual({
        acceptedCount: 2,
        reviewCount: 5,
        rejectedCount: 3,
      });
    });

    it('skips duplicate reviewItems across existingPendingGlossary and within the same batch', () => {
      const batch = classifyScannedGlossaryBatch({
        candidates: [
          { chinese: '霍尊', pinyin: 'huò zūn', vietnamese: 'Hoắc Tôn', type: 'character', note: 'Lặp từ pending cũ' },
          { chinese: '海', pinyin: 'Hai', vietnamese: 'Hai', type: 'character', note: 'Lần 1' },
          { chinese: '海', pinyin: 'Hai', vietnamese: 'Hải', type: 'character', note: 'Lần 2 trùng trong lô' },
        ],
        existingGlossary: [],
        existingPendingGlossary: [
          {
            id: 'pend_old_1',
            chinese: '霍尊',
            pinyin: 'huò zūn',
            vietnamese: 'Hoắc Tôn',
            type: 'character',
            note: '',
            reason: 'AI trích xuất nghi ngờ hallucinate',
            originalValue: 'Đã chờ duyệt',
            importedAt: '2026-11-27T00:00:00Z',
          },
        ],
        sourceText: '霍尊和海站在门口。',
      });

      expect(batch.reviewItems.map((r) => r.chinese)).toEqual(['海']);
      expect(batch.telemetry.reviewCount).toBe(1);
    });
  });

  describe('Loop-1 Chapter Anchor Prioritization (US3)', () => {
    it('prioritizes chapter-present entries with Vietnamese names at Loop 1 within cap', () => {
      const filler = Array.from({ length: 180 }, (_, idx) =>
        mkItem({ id: `f_${idx}`, chinese: `无关词${idx}`, vietnamese: `Không liên quan ${idx}` })
      );
      const present = mkItem({ id: 'p1', chinese: '钱仓一', vietnamese: 'Tiền Thương Nhất' });

      const anchors = prioritizeKnownAnchorEntriesForChapter(
        '钱仓一推开大门。',
        [...filler, present],
        20
      );

      expect(anchors).toHaveLength(20);
      expect(anchors[0]).toEqual({
        chinese: '钱仓一',
        vietnamese: 'Tiền Thương Nhất',
      });
    });
  });
});
