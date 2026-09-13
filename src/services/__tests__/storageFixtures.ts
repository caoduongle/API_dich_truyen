import { Chapter } from '../../types';

/**
 * Creates a mock chapter with customizable fields for storage preservation testing.
 */
export function createMockChapter(overrides: Partial<Chapter> = {}): Chapter {
  const id = overrides.id || `chap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  return {
    id,
    projectId: overrides.projectId || 'proj_test_1',
    title: overrides.title !== undefined ? overrides.title : 'Chương 1: Khởi nguyên đại lục',
    sourceText:
      overrides.sourceText !== undefined
        ? overrides.sourceText
        : '萧炎看着眼前的青色火焰，深深吸了一口气。',
    rawTranslation:
      overrides.rawTranslation !== undefined
        ? overrides.rawTranslation
        : 'Tiêu Viêm nhìn trước mắt thanh sắc hỏa diễm, hít sâu một hơi.',
    polishedTranslation:
      overrides.polishedTranslation !== undefined
        ? overrides.polishedTranslation
        : 'Tiêu Viêm chăm chú nhìn ngọn lửa màu xanh ngọc bích trước mặt, hít sâu một hơi thật sâu.',
    paragraphs:
      overrides.paragraphs !== undefined
        ? overrides.paragraphs
        : ['萧炎看着眼前的青色火焰，深深吸了一口气。'],
    translatedLines:
      overrides.translatedLines !== undefined
        ? overrides.translatedLines
        : ['Tiêu Viêm chăm chú nhìn ngọn lửa màu xanh ngọc bích trước mặt, hít sâu một hơi thật sâu.'],
    status: overrides.status || 'completed',
    createdAt: overrides.createdAt || new Date('2026-08-17T10:00:00.000Z').toISOString(),
    updatedAt: overrides.updatedAt || new Date('2026-08-17T10:30:00.000Z').toISOString(),
    qaIssues: overrides.qaIssues || [],
  };
}
