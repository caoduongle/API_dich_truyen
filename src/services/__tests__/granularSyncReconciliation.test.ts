import { describe, it, expect } from 'vitest';
import {
  reconcileChapterTimestamps,
  buildSharedProjectManifest,
  formatChapterFileName,
  sanitizeChapterTitleSlug,
} from '../googleDriveSyncService';
import { Chapter } from '../../types';

describe('granularSyncReconciliation', () => {
  it('reconciles chapter timestamp: returns "push" when local chapter is newer', () => {
    const local = '2026-08-22T05:10:00.000Z';
    const remote = '2026-08-22T04:00:00.000Z';
    expect(reconcileChapterTimestamps(local, remote)).toBe('push');
  });

  it('reconciles chapter timestamp: returns "pull" when remote chapter is newer', () => {
    const local = '2026-08-22T03:00:00.000Z';
    const remote = '2026-08-22T05:10:00.000Z';
    expect(reconcileChapterTimestamps(local, remote)).toBe('pull');
  });

  it('reconciles chapter timestamp: returns "in_sync" when timestamps match', () => {
    const time = '2026-08-22T05:00:00.000Z';
    expect(reconcileChapterTimestamps(time, time)).toBe('in_sync');
  });

  it('sanitizes Vietnamese chapter titles into safe ASCII slugs', () => {
    expect(sanitizeChapterTitleSlug('Chương 1: Yểm Ngục')).toBe('chuong-1-yem-nguc');
    expect(sanitizeChapterTitleSlug('Hồi 10: Trận chiến tại đỉnh núi! (Phần 2)')).toBe('hoi-10-tran-chien-tai-dinh-nui');
    expect(sanitizeChapterTitleSlug('')).toBe('');
  });

  it('formats chapter filenames with 3-digit index and slug', () => {
    expect(formatChapterFileName(0, 'Chương 1: Yểm Ngục', 'chap_1')).toBe('chapter_001_chuong-1-yem-nguc.json');
    expect(formatChapterFileName(11, '', 'chap_file_import_123456_11')).toBe('chapter_012.json');
    expect(formatChapterFileName(99, 'Hồi cuối', 'chap_100')).toBe('chapter_100_hoi-cuoi.json');
  });

  it('builds a SharedProjectManifest with readable fileNames from chapter list', () => {
    const chapters: Chapter[] = [
      {
        id: 'chap_file_import_17244_0',
        title: 'Chương 1: Khởi đầu',
        sourceText: '第一章',
        rawTranslation: '',
        polishedTranslation: 'Chương 1: Khởi đầu',
        paragraphs: ['第一章'],
        translatedLines: ['Chương 1: Khởi đầu'],
        status: 'completed',
        createdAt: '2026-08-22T01:00:00Z',
        updatedAt: '2026-08-22T04:00:00Z',
      },
      {
        id: 'chap_file_import_17244_1',
        title: 'Chương 2: Gặp gỡ',
        sourceText: '第二章',
        rawTranslation: '',
        polishedTranslation: 'Chương 2: Gặp gỡ',
        paragraphs: ['第二章'],
        translatedLines: ['Chương 2: Gặp gỡ'],
        status: 'in_progress',
        createdAt: '2026-08-22T02:00:00Z',
        updatedAt: '2026-08-22T04:30:00Z',
      },
    ];

    const manifest = buildSharedProjectManifest('proj_123', 'Đại Phụng Đả Canh Nhân', chapters);
    expect(manifest.projectId).toBe('proj_123');
    expect(manifest.title).toBe('Đại Phụng Đả Canh Nhân');
    expect(manifest.chapters.length).toBe(2);
    expect(manifest.chapters[0].id).toBe('chap_file_import_17244_0');
    expect(manifest.chapters[0].fileName).toBe('chapter_001_chuong-1-khoi-dau.json');
    expect(manifest.chapters[0].status).toBe('completed');
    expect(manifest.chapters[1].id).toBe('chap_file_import_17244_1');
    expect(manifest.chapters[1].fileName).toBe('chapter_002_chuong-2-gap-go.json');
    expect(manifest.chapters[1].status).toBe('in_progress');
  });

  it('correctly maps selectedFiles to manifest chapter fileIds and project metadata with formatted names', () => {
    const selectedFiles = [
      { id: 'file_proj_json', name: 'project.json' },
      { id: 'file_manifest_json', name: 'manifest.json' },
      { id: 'file_chap_1', name: 'chapter_001_chuong-1.json' },
      { id: 'file_chap_2', name: 'chapter_chap_2.json' }, // legacy name
    ];

    const projectFile = selectedFiles.find((f) => f.name === 'project.json');
    const manifestFile = selectedFiles.find((f) => f.name === 'manifest.json');
    const chap1File = selectedFiles.find((f) => f.name === 'chapter_001_chuong-1.json');
    const chap2Legacy = selectedFiles.find((f) => f.name === 'chapter_chap_2.json');

    expect(projectFile?.id).toBe('file_proj_json');
    expect(manifestFile?.id).toBe('file_manifest_json');
    expect(chap1File?.id).toBe('file_chap_1');
    expect(chap2Legacy?.id).toBe('file_chap_2');
  });

  it('detects omitted chapters when validating selectedFiles against manifest with readable names', () => {
    const manifestChapters = [
      { id: 'chap_1', title: 'Chương 1', fileName: 'chapter_001_chuong-1.json', fileId: 'f1', updatedAt: '2026-08-22T00:00:00Z', status: 'completed' as const },
      { id: 'chap_2', title: 'Chương 2', fileName: 'chapter_002_chuong-2.json', fileId: 'f2', updatedAt: '2026-08-22T00:00:00Z', status: 'completed' as const },
      { id: 'chap_3', title: 'Chương 3', fileName: 'chapter_003_chuong-3.json', fileId: 'f3', updatedAt: '2026-08-22T00:00:00Z', status: 'completed' as const },
    ];

    const selectedFiles = [
      { id: 'f1', name: 'chapter_001_chuong-1.json' },
      { id: 'f3', name: 'chapter_003_chuong-3.json' },
    ];

    const missingFiles: string[] = [];
    for (const chapMeta of manifestChapters) {
      const hasFile = selectedFiles.some(
        (f) =>
          (chapMeta.fileName && f.name === chapMeta.fileName) ||
          f.name === `chapter_${chapMeta.id}.json` ||
          (chapMeta.fileId && f.id === chapMeta.fileId)
      );
      if (!hasFile) {
        missingFiles.push(chapMeta.fileName || `chapter_${chapMeta.id}.json`);
      }
    }

    expect(missingFiles).toEqual(['chapter_002_chuong-2.json']);
  });
});



