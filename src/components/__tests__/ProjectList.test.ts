import { describe, it, expect } from 'vitest';
import { calculateProjectProgressMap } from '../ProjectList';
import { StoryProject } from '../../types';

describe('ProjectList Logic & Progress Calculation', () => {
  it('computes 0% progress for project with 0 chapters', () => {
    const projects: StoryProject[] = [
      {
        id: 'proj_0',
        title: 'Truyện rỗng',
        author: 'Vô Danh',
        genre: 'Đô Thị',
        tone: 'Hiện đại',
        description: '',
        glossary: [],
        chapters: [],
        pendingGlossary: [],
        createdAt: '2026-08-20T00:00:00.000Z',
      },
    ];

    const progressMap = calculateProjectProgressMap(projects);
    const projProgress = progressMap.get('proj_0');

    expect(projProgress).toEqual({ total: 0, done: 0, pct: 0 });
  });

  it('computes correct progress percentage for projects with completed chapters', () => {
    const projects: StoryProject[] = [
      {
        id: 'proj_1',
        title: 'Đấu Phá Thương Khung',
        author: 'Thiên Tàm Thổ Đậu',
        genre: 'Tiên Hiệp',
        tone: 'Cổ phong',
        description: '',
        glossary: [],
        pendingGlossary: [],
        chapters: [
          { id: 'c1', title: 'Chương 1', status: 'completed', createdAt: '2026-08-20', updatedAt: '2026-08-20' },
          { id: 'c2', title: 'Chương 2', status: 'in_progress', createdAt: '2026-08-20', updatedAt: '2026-08-20' },
          { id: 'c3', title: 'Chương 3', status: 'not_started', createdAt: '2026-08-20', updatedAt: '2026-08-20' },
          { id: 'c4', title: 'Chương 4', status: 'completed', createdAt: '2026-08-20', updatedAt: '2026-08-20' },
        ],
        createdAt: '2026-08-20T00:00:00.000Z',
      },
    ];

    const progressMap = calculateProjectProgressMap(projects);
    const projProgress = progressMap.get('proj_1');

    expect(projProgress).toEqual({ total: 4, done: 2, pct: 50 });
  });

  it('handles multiple projects simultaneously and maps progress by ID', () => {
    const projects: StoryProject[] = [
      {
        id: 'p1',
        title: 'P1',
        author: 'A1',
        genre: 'G1',
        tone: 'T1',
        description: '',
        glossary: [],
        pendingGlossary: [],
        chapters: [{ id: 'c1', title: 'C1', status: 'completed', createdAt: '2026-08-20', updatedAt: '2026-08-20' }],
        createdAt: '2026-08-20T00:00:00.000Z',
      },
      {
        id: 'p2',
        title: 'P2',
        author: 'A2',
        genre: 'G2',
        tone: 'T2',
        description: '',
        glossary: [],
        pendingGlossary: [],
        chapters: [
          { id: 'c2', title: 'C2', status: 'not_started', createdAt: '2026-08-20', updatedAt: '2026-08-20' },
          { id: 'c3', title: 'C3', status: 'completed', createdAt: '2026-08-20', updatedAt: '2026-08-20' },
          { id: 'c4', title: 'C4', status: 'completed', createdAt: '2026-08-20', updatedAt: '2026-08-20' },
        ],
        createdAt: '2026-08-21T00:00:00.000Z',
      },
    ];

    const progressMap = calculateProjectProgressMap(projects);

    expect(progressMap.get('p1')).toEqual({ total: 1, done: 1, pct: 100 });
    expect(progressMap.get('p2')).toEqual({ total: 3, done: 2, pct: 67 });
  });
});
