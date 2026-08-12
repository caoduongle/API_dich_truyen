import { describe, it, expect } from 'vitest';
import { parseGlossaryFromMd } from '../parser';

describe('parser utils', () => {
  describe('parseGlossaryFromMd', () => {
    it('should parse markdown tables correctly', () => {
      const md = `
| 萧炎 | Tiêu Viêm | Tiêu Viêm | Nhân vật chính |
| 乌坦城 | Ô Thản Thành | Ô Thản Thành | Thành phố |
`;
      const parsed = parseGlossaryFromMd(md);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({
        chinese: '萧炎',
        pinyin: 'Tiêu Viêm',
        vietnamese: 'Tiêu Viêm',
        type: 'term', // default type since no header was encountered
        note: 'Nhân vật chính'
      });
      expect(parsed[1].chinese).toBe('乌坦城');
    });

    it('should parse markdown arrow lists correctly', () => {
      const md = `
- 熏儿 -> Huân Nhi (Bạn gái nam chính)
- 雅妃 -> Nhã Phi
`;
      const parsed = parseGlossaryFromMd(md);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({
        chinese: '熏儿',
        pinyin: '',
        vietnamese: 'Huân Nhi',
        type: 'term',
        note: 'Bạn gái nam chính'
      });
      expect(parsed[1]).toEqual({
        chinese: '雅妃',
        pinyin: '',
        vietnamese: 'Nhã Phi',
        type: 'term',
        note: ''
      });
    });

    it('should switch entity types when encountering type section headings', () => {
      const md = `
# NHÂN VẬT (Characters)
| 萧炎 | Tiêu Viêm | Tiêu Viêm | Main |

# ĐỊA DANH (Locations)
| 乌坦城 | Ô Thản Thành | Ô Thản Thành | City |
`;
      const parsed = parseGlossaryFromMd(md);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].type).toBe('character');
      expect(parsed[1].type).toBe('location');
    });

    it('should handle empty input gracefully', () => {
      expect(parseGlossaryFromMd('')).toEqual([]);
      expect(parseGlossaryFromMd(null as any)).toEqual([]);
    });

    it('should ignore non-chinese terms in table/list', () => {
      const md = `
| English | pinyin | vietnamese | note |
- Hello -> Xin chào
`;
      expect(parseGlossaryFromMd(md)).toEqual([]);
    });
  });
});
