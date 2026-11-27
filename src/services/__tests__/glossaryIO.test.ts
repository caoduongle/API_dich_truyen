import { describe, it, expect } from 'vitest';
import {
  analyzeGlossaryImportConflicts,
  formatGlossaryCreatedDate,
  mergeImportedGlossaryForProject,
  parseCsvGlossaryFile,
  parseGlossaryCreatedDate,
  parseJsonGlossaryFile,
  parseMarkdownGlossaryTables,
  parseStructuredGlossaryFile,
  prepareFileDeduplicatedItems,
  serializeGlossary,
} from '../glossaryIO';
import { GlossaryItem } from '../../types';

describe('glossaryIO date helpers', () => {
  it('formats valid ISO dates to DD/MM/YYYY and returns — for missing/invalid', () => {
    expect(formatGlossaryCreatedDate('2026-11-22T02:43:25.000Z')).toMatch(/^\d{2}\/\d{2}\/2026$/);
    expect(formatGlossaryCreatedDate(undefined)).toBe('—');
    expect(formatGlossaryCreatedDate('')).toBe('—');
    expect(formatGlossaryCreatedDate('not-a-date')).toBe('—');
  });

  it('parses DD/MM/YYYY deterministically without swapping month and day', () => {
    const iso = parseGlossaryCreatedDate('05/11/2026');
    expect(iso).toBeDefined();
    expect(formatGlossaryCreatedDate(iso)).toBe('05/11/2026');

    const isoWithTime = parseGlossaryCreatedDate('05/11/2026 14:30:15');
    expect(isoWithTime).toBeDefined();
    const d = new Date(isoWithTime!);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(10); // November (0-indexed)
    expect(d.getDate()).toBe(5);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
    expect(d.getSeconds()).toBe(15);
  });

  it('rejects impossible calendar dates and placeholder dashes', () => {
    expect(parseGlossaryCreatedDate('31/02/2026')).toBeUndefined();
    expect(parseGlossaryCreatedDate('—')).toBeUndefined();
    expect(parseGlossaryCreatedDate('--')).toBeUndefined();
    expect(parseGlossaryCreatedDate('')).toBeUndefined();
  });
});

describe('glossaryIO Markdown export & import', () => {
  const sampleItems: GlossaryItem[] = [
    {
      id: 'g1',
      chinese: '萧炎',
      pinyin: 'Tiêu Viêm',
      vietnamese: 'Tiêu Viêm',
      type: 'character',
      note: 'Nhân vật chính | Đấu Khí',
      createdAt: parseGlossaryCreatedDate('05/11/2026'),
    },
    {
      id: 'g2',
      chinese: '乌坦城',
      pinyin: 'Ô Thản Thành',
      vietnamese: 'Thành Ô Thản',
      type: 'location',
      note: 'Thành trấn biên giới',
      // legacy entry without createdAt
    },
  ];

  it('serializes Markdown with Ngày thêm column and — fallback for legacy items', () => {
    const out = serializeGlossary(sampleItems, {
      format: 'md',
      projectName: 'Đấu Phá Thương Khung',
    });

    expect(out.filename).toMatch(/^tu-dien-dau-pha-thuong-khung-\d{8}\.md$/);
    expect(out.content).toContain('| Tiếng Trung | Phiên âm | Tiếng Việt | Ghi chú | Ngày thêm |');
    expect(out.content).toContain('Nhân vật chính \\| Đấu Khí');
    expect(out.content).toContain('| 萧炎 | Tiêu Viêm | Tiêu Viêm | Nhân vật chính \\| Đấu Khí | 05/11/2026 |');
    expect(out.content).toContain('| 乌坦城 | Ô Thản Thành | Thành Ô Thản | Thành trấn biên giới | — |');
  });

  it('round-trips structured Markdown directly without AI and preserves Ngày thêm & types', () => {
    const out = serializeGlossary(sampleItems, { format: 'md' });
    const parsed = parseStructuredGlossaryFile(out.content, out.filename);

    expect(parsed).not.toBeNull();
    expect(parsed!.mode).toBe('direct');
    expect(parsed!.items).toHaveLength(2);
    expect(parsed!.items[0]).toMatchObject({
      chinese: '萧炎',
      vietnamese: 'Tiêu Viêm',
      type: 'character',
      note: 'Nhân vật chính | Đấu Khí',
    });
    expect(formatGlossaryCreatedDate(parsed!.items[0].createdAt)).toBe('05/11/2026');
    expect(parsed!.items[1].type).toBe('location');
    expect(parsed!.items[1].createdAt).toBeUndefined();
  });

  it('returns null for unstructured Markdown prose so AI fallback can handle it', () => {
    const prose = '# Cẩm nang dịch\n\nNhân vật chính tên là Tiêu Viêm (萧炎), sống ở thành Ô Thản.';
    expect(parseMarkdownGlossaryTables(prose)).toBeNull();
    expect(parseStructuredGlossaryFile(prose, 'cam-nang.md')).toBeNull();
  });
});

describe('glossaryIO CSV export & import', () => {
  it('exports UTF-8 BOM CSV with formula injection neutralization and round-trips safely', () => {
    const items: GlossaryItem[] = [
      {
        id: 'g1',
        chinese: '药老',
        pinyin: 'Dược Lão',
        vietnamese: 'Dược Trần',
        type: 'character',
        note: '=CMD|"/C calc"!A0, ghi chú',
        variants: ['藥老'],
        createdAt: parseGlossaryCreatedDate('15/10/2026'),
      },
    ];

    const out = serializeGlossary(items, { format: 'csv' });
    expect(out.content.startsWith('\uFEFF')).toBe(true);
    expect(out.content).toContain("'=CMD|\"\"/C calc\"\"!A0, ghi chú");
    expect(out.content).toContain('15/10/2026');

    const parsed = parseCsvGlossaryFile(out.content);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].note).toBe('=CMD|"/C calc"!A0, ghi chú');
    expect(parsed.items[0].variants).toEqual(['藥老']);
    expect(formatGlossaryCreatedDate(parsed.items[0].createdAt)).toBe('15/10/2026');
  });
});

describe('glossaryIO JSON export & import', () => {
  it('whitelists fields against prototype pollution and preserves full metadata', () => {
    const maliciousJson = JSON.stringify({
      version: 1,
      items: [
        {
          chinese: '萧炎',
          pinyin: 'Tiêu Viêm',
          vietnamese: 'Tiêu Viêm',
          type: 'character',
          note: 'Main',
          createdAt: '2026-09-01T10:00:00.000Z',
          __proto__: { polluted: true },
          unexpectedField: 'drop-me',
        },
        {
          chinese: '',
          vietnamese: 'Thiếu chữ Hán',
        },
      ],
    });

    const parsed = parseJsonGlossaryFile(maliciousJson);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.skippedRows).toBe(1);
    expect((parsed.items[0] as any).unexpectedField).toBeUndefined();
    expect(({} as any).polluted).toBeUndefined();
    expect(parsed.items[0].createdAt).toBe('2026-09-01T10:00:00.000Z');
  });
});

describe('analyzeGlossaryImportConflicts', () => {
  const existing: GlossaryItem[] = [
    {
      id: 'glo_1',
      chinese: '萧炎',
      pinyin: 'Tiêu Viêm',
      vietnamese: 'Tiêu Viêm',
      type: 'character',
      note: 'Old note',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'glo_2',
      chinese: '炎帝',
      pinyin: 'Viêm Đế',
      vietnamese: 'Viêm Đế',
      type: 'character',
      note: '',
    },
  ];

  it('detects Traditional/Simplified Chinese match, Vietnamese match, and internal duplicates', () => {
    const incoming = [
      { chinese: '蕭炎', pinyin: 'Tiêu Viêm', vietnamese: 'Tiêu Viêm (mới)', type: 'character' as const, note: 'New' },
      { chinese: '新词', pinyin: 'Tân Từ', vietnamese: 'Viêm Đế', type: 'term' as const, note: '' },
      { chinese: '药老', pinyin: 'Dược Lão', vietnamese: 'Dược Lão', type: 'character' as const, note: '' },
      { chinese: '药老', pinyin: 'Dược Lão', vietnamese: 'Dược Trần', type: 'character' as const, note: '' },
    ];

    const { cleanItems, conflicts } = analyzeGlossaryImportConflicts(incoming, existing);
    expect(cleanItems).toHaveLength(1);
    expect(cleanItems[0].chinese).toBe('药老');

    expect(conflicts).toHaveLength(3);
    expect(conflicts[0].conflictKind).toBe('system_chinese');
    expect(conflicts[0].existingId).toBe('glo_1');
    expect(conflicts[1].conflictKind).toBe('system_vietnamese');
    expect(conflicts[2].conflictKind).toBe('file_duplicate');
  });
});

describe('mergeImportedGlossaryForProject', () => {
  const existing: GlossaryItem[] = [
    {
      id: 'glo_1',
      chinese: '萧炎',
      pinyin: 'Tiêu Viêm',
      vietnamese: 'Tiêu Viêm',
      type: 'character',
      note: 'Nhân vật chính',
      characterProfile: { gender: 'male', defaultSelfPronoun: 'ta' },
    },
  ];

  const incoming = [
    { chinese: '蕭炎', pinyin: 'Tiêu Viêm', vietnamese: 'Tiêu Viêm mới', type: 'character' as const, note: '' },
    { chinese: '药老', pinyin: 'Dược Lão', vietnamese: 'Dược Trần', type: 'character' as const, note: 'Sư phụ' },
    { chinese: '药老', pinyin: 'Dược Lão', vietnamese: 'Dược Lão', type: 'character' as const, note: 'Trùng nội bộ' },
  ];

  it('merges cleanly without duplicating canonical Han entries and preserves existing profiles', () => {
    const merged = mergeImportedGlossaryForProject(existing, incoming, 'merge');
    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe('glo_1');
    expect(merged[0].characterProfile?.gender).toBe('male');
    expect(merged[1].chinese).toBe('药老');
    expect(merged[1].vietnamese).toBe('Dược Trần');
  });

  it('replaces existing glossary cleanly while deduplicating internal duplicates', () => {
    const replaced = mergeImportedGlossaryForProject(existing, incoming, 'replace');
    expect(replaced).toHaveLength(2);
    expect(replaced.map((i) => i.chinese)).toEqual(['蕭炎', '药老']);
  });
});

describe('prepareFileDeduplicatedItems (Feature 169 replace_all safety)', () => {
  it('filters invalid rows, deduplicates file-internally, and sanitizes metadata against prototype pollution', () => {
    const maliciousIncoming: any[] = [
      {
        chinese: '林风',
        vietnamese: 'Lâm Phong',
        type: 'character',
        variants: ['風哥'],
        isPinned: true,
        characterProfile: { gender: 'male', defaultSelfPronoun: 'ta' },
        __proto__: { polluted: true },
        unexpected: 'ignore-me',
      },
      {
        chinese: '林風', // file-internal Traditional duplicate
        vietnamese: 'Lâm Phong 2',
        type: 'character',
      },
      {
        chinese: '   ',
        vietnamese: 'Thiếu chữ Hán',
        type: 'other',
      },
    ];

    const prepared = prepareFileDeduplicatedItems(maliciousIncoming);
    expect(prepared).toHaveLength(1);
    expect(prepared[0]).toMatchObject({
      chinese: '林风',
      vietnamese: 'Lâm Phong',
      variants: ['風哥'],
      isPinned: true,
      characterProfile: { gender: 'male', defaultSelfPronoun: 'ta' },
    });
    expect((prepared[0] as any).unexpected).toBeUndefined();
    expect(({} as any).polluted).toBeUndefined();
  });
});
