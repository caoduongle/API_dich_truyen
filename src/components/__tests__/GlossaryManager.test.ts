import { describe, it, expect } from 'vitest';
import { computeDuplicateGroups } from '../GlossaryManager';
import { GlossaryItem } from '../../types';

describe('computeDuplicateGroups', () => {
    it('should identify duplicate groups based on same Chinese or same Vietnamese text', () => {
        const glossary: GlossaryItem[] = [
            { id: 'glo_1', chinese: '萧炎', pinyin: 'Tiêu Viêm', vietnamese: 'Tiêu Viêm', type: 'character', note: '' },
            { id: 'glo_2', chinese: '萧炎', pinyin: 'Tiêu Viêm', vietnamese: 'Tiêu Viêm Lớn', type: 'character', note: '' }, // Duplicate Chinese
            { id: 'glo_3', chinese: '药老', pinyin: 'Dược Lão', vietnamese: 'Dược Lão', type: 'character', note: '' },
        ];

        const groups = computeDuplicateGroups(glossary, 'proj_1');
        expect(groups.length).toBe(1);
        expect(groups[0].items.map(item => item.id)).toContain('glo_1');
        expect(groups[0].items.map(item => item.id)).toContain('glo_2');
    });

    it('should ignore duplicate pairs specified in ignoredDuplicatePairs', () => {
        const glossary: GlossaryItem[] = [
            { id: 'glo_1', chinese: '萧炎', pinyin: 'Tiêu Viêm', vietnamese: 'Tiêu Viêm', type: 'character', note: '' },
            { id: 'glo_2', chinese: '萧炎', pinyin: 'Tiêu Viêm', vietnamese: 'Tiêu Viêm Lớn', type: 'character', note: '' }, // Duplicate Chinese
            { id: 'glo_3', chinese: '药老', pinyin: 'Dược Lão', vietnamese: 'Dược Lão', type: 'character', note: '' },
        ];

        // If the pair 'glo_1-glo_2' is ignored, there should be no duplicate groups
        const groups = computeDuplicateGroups(glossary, 'proj_1', ['glo_1-glo_2']);
        expect(groups.length).toBe(0);
    });

    it('should handle ignored pairs order-independently', () => {
        const glossary: GlossaryItem[] = [
            { id: 'glo_1', chinese: '萧炎', pinyin: 'Tiêu Viêm', vietnamese: 'Tiêu Viêm', type: 'character', note: '' },
            { id: 'glo_2', chinese: '萧炎', pinyin: 'Tiêu Viêm', vietnamese: 'Tiêu Viêm Lớn', type: 'character', note: '' }, // Duplicate Chinese
        ];

        // Should ignore even if the IDs in the ignoredDuplicatePairs array are ordered differently (e.g. glo_2-glo_1)
        const groups = computeDuplicateGroups(glossary, 'proj_1', ['glo_2-glo_1']);
        expect(groups.length).toBe(0);
    });
});
