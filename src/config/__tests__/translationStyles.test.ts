import { describe, it, expect } from 'vitest';
import {
  GENRE_PROFILES,
  TONE_PROFILES,
  getGenreProfile,
  getToneProfile,
  getGenreStyleGuide,
  getToneStyleGuide,
  getRecommendedTonesForGenre,
  getGenreStarterTemplateText,
  parseStructuredGuidelines,
  serializeStructuredGuidelines,
  hasStructuredGuidelineHeadings,
  formatGuidelinesMarkdownExport,
  extractGuidelinesProseSection,
  parseGuidelinesMarkdownLocal,
  detectStyleConflicts,
} from '../translationStyles';

describe('src/config/translationStyles.ts', () => {
  describe('US1: Primary Genre Catalog & Rich Style Guides', () => {
    it('provides 17+ expanded genre profiles with unique Hanzi seal chars, rich guides, and recommended tones', () => {
      expect(GENRE_PROFILES.length).toBeGreaterThanOrEqual(17);

      const distinctGuides = new Set<string>();
      for (const profile of GENRE_PROFILES) {
        expect(profile.id.trim().length).toBeGreaterThan(0);
        expect(profile.sealChar).toMatch(/^[\u4e00-\u9fff]$/);
        expect(profile.styleGuide.length).toBeGreaterThan(80);
        expect(profile.recommendedTones.length).toBeGreaterThan(0);
        for (const toneId of profile.recommendedTones) {
          expect(getToneProfile(toneId)).toBeDefined();
        }
        distinctGuides.add(profile.styleGuide);
      }

      expect(distinctGuides.size).toBe(GENRE_PROFILES.length);
      expect(getGenreProfile('Cung Đấu / Gia Đấu')).toBeDefined();
      expect(getGenreProfile('Mạt Thế / Sinh Tồn')).toBeDefined();
      expect(getGenreProfile('Huyền Nghi / Trinh Thám')).toBeDefined();
    });

    it('handles custom genres gracefully without losing custom name', () => {
      const customGuide = getGenreStyleGuide('Huyền Huyễn Đô Thị Tu Chân');
      expect(customGuide).toContain('Huyền Huyễn Đô Thị Tu Chân');
      expect(getRecommendedTonesForGenre('Huyền Huyễn Đô Thị Tu Chân').length).toBeGreaterThan(0);
    });
  });

  describe('US2: Editing Tone Catalog & Behavioral Guides', () => {
    it('provides 11+ distinct tone profiles and preserves legacy tone alias', () => {
      expect(TONE_PROFILES.length).toBeGreaterThanOrEqual(11);

      const distinctToneGuides = new Set<string>();
      for (const tone of TONE_PROFILES) {
        expect(tone.id.trim().length).toBeGreaterThan(0);
        expect(tone.shortDescription.trim().length).toBeGreaterThan(10);
        expect(tone.styleGuide.length).toBeGreaterThan(80);
        distinctToneGuides.add(tone.styleGuide);
      }
      expect(distinctToneGuides.size).toBe(TONE_PROFILES.length);

      expect(getToneProfile('Trang nghiêm cổ kính')?.id).toBe('Trang nghiêm cổ phong');
      expect(getToneStyleGuide('Trang nghiêm cổ kính')).toBe(getToneStyleGuide('Trang nghiêm cổ phong'));
    });

    it('handles custom tones gracefully', () => {
      const customToneGuide = getToneStyleGuide('Châm biếm sâu cay kiểu kiếm hiệp');
      expect(customToneGuide).toContain('Châm biếm sâu cay kiểu kiếm hiệp');
    });
  });

  describe('US3: Structured Guidelines, Templates, Export/Import Round-Trip & Long File Prose Extraction', () => {
    it('round-trips structured guidelines and preserves legacy unstructured text without data loss', () => {
      const starter = getGenreStarterTemplateText('Cung Đấu / Gia Đấu');
      expect(hasStructuredGuidelineHeadings(starter)).toBe(true);

      const parsed = parseStructuredGuidelines(starter);
      expect(parsed.contextSummary.length).toBeGreaterThan(0);
      expect(parsed.pronounRules.length).toBeGreaterThan(0);
      expect(parsed.hanVietPolicy.length).toBeGreaterThan(0);
      expect(parsed.titlesAndForeignNames.length).toBeGreaterThan(0);
      expect(parsed.avoidRules.length).toBeGreaterThan(0);

      const withExtra = serializeStructuredGuidelines({
        ...parsed,
        extraNotes: '## Lưu ý riêng\n- Chương hồi không ngắt lời thoại.',
      });
      const reparsed = parseStructuredGuidelines(withExtra);
      expect(reparsed.pronounRules).toBe(parsed.pronounRules);
      expect(reparsed.extraNotes).toContain('Chương hồi không ngắt lời thoại.');

      const legacyPlain = 'Nhân vật chính xưng ta, nữ chính gọi công tử, giữ không khí nhẹ nhàng.';
      expect(hasStructuredGuidelineHeadings(legacyPlain)).toBe(false);
      expect(parseStructuredGuidelines(legacyPlain).contextSummary).toBe(legacyPlain);
    });

    it('exports Markdown guidelines and re-imports them locally without losing genre, tone, or rules', () => {
      const md = formatGuidelinesMarkdownExport({
        title: 'Phàm Nhân Tu Tiên',
        genre: 'Tiên Hiệp',
        tone: 'Trang nghiêm cổ phong',
        description: getGenreStarterTemplateText('Tiên Hiệp'),
      });

      const localParsed = parseGuidelinesMarkdownLocal(md);
      expect(localParsed.genre).toBe('Tiên Hiệp');
      expect(localParsed.tone).toBe('Trang nghiêm cổ phong');
      expect(localParsed.description).toContain('### Quy tắc xưng hô mặc định');
      expect(localParsed.description).toContain('### Điều cần tránh');
    });

    it('strips large glossary tables while retaining Vietnamese rule bullets and tail rules in >15,000-char files', () => {
      const glossaryHeader = '# Từ điển nhân vật\n| Tiếng Trung | Phiên âm | Tiếng Việt | Ghi chú |\n|---|---|---|---|';
      const rows = Array.from({ length: 400 }, (_, i) => `| 角色${i} | Nhân vật ${i} | Nhân Vật ${i} | Phụ |`).join('\n');
      const bulletGlossary = '\n- 韩立 -> Hàn Lập (Main)\n';
      const tailRules = [
        '### Quy tắc xưng hô mặc định',
        '- Xưng hô mặc định: ta -> ngươi trong giao đấu.',
        '- Tránh dùng: OK -> Được.',
        '### Điều cần tránh',
        '- Quy tắc cuối tệp: Không dùng từ lóng đô thị.',
      ].join('\n');

      const largeMd = [glossaryHeader, rows, bulletGlossary, '', tailRules].join('\n');
      expect(largeMd.length).toBeGreaterThan(15000);

      const prose = extractGuidelinesProseSection(largeMd);
      expect(prose).not.toContain('角色10');
      expect(prose).not.toContain('韩立 -> Hàn Lập');
      expect(prose).toContain('- Xưng hô mặc định: ta -> ngươi trong giao đấu.');
      expect(prose).toContain('- Tránh dùng: OK -> Được.');
      expect(prose).toContain('Quy tắc cuối tệp: Không dùng từ lóng đô thị.');
    });
  });

  describe('US4: Deterministic Style Conflict Detection', () => {
    it('detects contradictory genre/tone and rule/tone pairs without blocking valid pairs', () => {
      const modernClassical = detectStyleConflicts({
        genre: 'Đô Thị',
        tone: 'Trang nghiêm cổ phong',
        description: '',
      });
      expect(modernClassical.some((w) => w.category === 'genre_tone_mismatch' && w.suggestedTone)).toBe(true);

      const banHanViet = detectStyleConflicts({
        genre: 'Tiên Hiệp',
        tone: 'Trang nghiêm cổ phong',
        description: 'Cấm dùng từ Hán-Việt trong lời thoại thường ngày.',
      });
      expect(banHanViet.some((w) => w.category === 'rule_tone_conflict')).toBe(true);

      const validPair = detectStyleConflicts({
        genre: 'Đô Thị',
        tone: 'Dịch thuần Việt mượt mà',
        description: 'Xưng tôi - anh.',
      });
      expect(validPair).toHaveLength(0);
    });
  });
});
