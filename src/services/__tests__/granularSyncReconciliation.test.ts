import { describe, it, expect } from 'vitest';
import { reconcileChapterTimestamps, buildSharedProjectManifest } from '../googleDriveSyncService';
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

  it('builds a SharedProjectManifest from project details and chapter list', () => {
    const chapters: Chapter[] = [
      {
        id: 'chap_1',
        title: 'Chương 1',
        sourceText: '第一章',
        rawTranslation: '',
        polishedTranslation: 'Chương 1',
        paragraphs: ['第一章'],
        translatedLines: ['Chương 1'],
        status: 'completed',
        createdAt: '2026-08-22T01:00:00Z',
        updatedAt: '2026-08-22T04:00:00Z',
      },
      {
        id: 'chap_2',
        title: 'Chương 2',
        sourceText: '第二章',
        rawTranslation: '',
        polishedTranslation: 'Chương 2',
        paragraphs: ['第二章'],
        translatedLines: ['Chương 2'],
        status: 'in_progress',
        createdAt: '2026-08-22T02:00:00Z',
        updatedAt: '2026-08-22T04:30:00Z',
      },
    ];

    const manifest = buildSharedProjectManifest('proj_123', 'Đại Phụng Đả Canh Nhân', chapters);
    expect(manifest.projectId).toBe('proj_123');
    expect(manifest.title).toBe('Đại Phụng Đả Canh Nhân');
    expect(manifest.chapters.length).toBe(2);
    expect(manifest.chapters[0].id).toBe('chap_1');
    expect(manifest.chapters[0].status).toBe('completed');
    expect(manifest.chapters[1].id).toBe('chap_2');
    expect(manifest.chapters[1].status).toBe('in_progress');
  });

  it('correctly maps selectedFiles to manifest chapter fileIds and project metadata', () => {
    const selectedFiles = [
      { id: 'file_proj_json', name: 'project.json' },
      { id: 'file_manifest_json', name: 'manifest.json' },
      { id: 'file_chap_1', name: 'chapter_chap_1.json' },
      { id: 'file_chap_2', name: 'chapter_chap_2.json' },
    ];

    const projectFile = selectedFiles.find((f) => f.name === 'project.json');
    const manifestFile = selectedFiles.find((f) => f.name === 'manifest.json');
    const chap1File = selectedFiles.find((f) => f.name === 'chapter_chap_1.json');
    const chap3File = selectedFiles.find((f) => f.name === 'chapter_chap_3.json');

    expect(projectFile?.id).toBe('file_proj_json');
    expect(manifestFile?.id).toBe('file_manifest_json');
    expect(chap1File?.id).toBe('file_chap_1');
    expect(chap3File).toBeUndefined();
  });

  it('detects omitted chapters when validating selectedFiles against manifest', () => {
    const manifestChapters = [
      { id: 'chap_1', title: 'Chương 1', fileId: 'f1', updatedAt: '2026-08-22T00:00:00Z', status: 'completed' as const },
      { id: 'chap_2', title: 'Chương 2', fileId: 'f2', updatedAt: '2026-08-22T00:00:00Z', status: 'completed' as const },
      { id: 'chap_3', title: 'Chương 3', fileId: 'f3', updatedAt: '2026-08-22T00:00:00Z', status: 'completed' as const },
    ];

    const selectedFiles = [
      { id: 'f1', name: 'chapter_chap_1.json' },
      { id: 'f3', name: 'chapter_chap_3.json' },
    ];

    const missingFiles: string[] = [];
    for (const chapMeta of manifestChapters) {
      const hasFile = selectedFiles.some(
        (f) => f.name === `chapter_${chapMeta.id}.json` || (chapMeta.fileId && f.id === chapMeta.fileId)
      );
      if (!hasFile) {
        missingFiles.push(`chapter_${chapMeta.id}.json`);
      }
    }

    expect(missingFiles).toEqual(['chapter_chap_2.json']);
  });
});


