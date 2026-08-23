import { describe, it, expect } from 'vitest';
import { reconcileProjectTimestamps, serializeProjectForDrive } from '../googleDriveSyncService';
import { StoryProject, Chapter } from '../../types';

describe('googleDriveSyncService reconciliation & serialization', () => {
  const mockProject: StoryProject = {
    id: 'proj_123',
    title: 'Đại Phụng Đả Canh Nhân',
    author: 'Mại Báo Tiểu Lang Quân',
    genre: 'Tiên Hiệp',
    tone: 'Trang nghiêm',
    description: 'Truyện tiên hiệp trinh thám',
    glossary: [
      {
        id: 'glo_1',
        chinese: '许七安',
        pinyin: 'Xu Qi An',
        vietnamese: 'Hứa Thất An',
        type: 'character',
        note: 'Nhân vật chính',
        createdAt: '2026-08-20T10:00:00Z',
      },
    ],
    pendingGlossary: [],
    chapters: [
      { id: 'chap_1', title: 'Chương 1', status: 'completed', createdAt: '2026-08-20T09:00:00Z', updatedAt: '2026-08-22T04:00:00Z' },
    ],
    createdAt: '2026-08-20T09:00:00Z',
    updatedAt: '2026-08-22T04:00:00Z',
  };

  const mockChapters: Chapter[] = [
    {
      id: 'chap_1',
      title: 'Chương 1: Yểm Ngục',
      sourceText: '第一章 狱中',
      rawTranslation: 'Chương 1: Trong ngục',
      polishedTranslation: 'Chương 1: Trong nhà giam ngục tù',
      paragraphs: ['第一章 狱中'],
      translatedLines: ['Chương 1: Trong nhà giam ngục tù'],
      status: 'completed',
      createdAt: '2026-08-20T09:00:00Z',
      updatedAt: '2026-08-22T04:00:00Z',
    },
  ];

  it('serializes project and chapters cleanly into valid JSON strings', () => {
    const serialized = serializeProjectForDrive(mockProject, mockChapters);
    expect(serialized.projectJson).toBeDefined();
    expect(serialized.chaptersJson).toBeDefined();

    const parsedProj = JSON.parse(serialized.projectJson);
    const parsedChaps = JSON.parse(serialized.chaptersJson);

    expect(parsedProj.id).toBe('proj_123');
    expect(parsedProj.title).toBe('Đại Phụng Đả Canh Nhân');
    expect(parsedProj.glossary.length).toBe(1);
    expect(parsedChaps.length).toBe(1);
    expect(parsedChaps[0].id).toBe('chap_1');
  });

  it('reconciles timestamp: returns "push" when local version is newer than remote', () => {
    const localUpdatedAt = '2026-08-22T04:30:00.000Z';
    const remoteUpdatedAt = '2026-08-22T01:00:00.000Z';
    const action = reconcileProjectTimestamps(localUpdatedAt, remoteUpdatedAt);
    expect(action).toBe('push');
  });

  it('reconciles timestamp: returns "pull" when remote version is newer than local', () => {
    const localUpdatedAt = '2026-08-20T01:00:00.000Z';
    const remoteUpdatedAt = '2026-08-22T04:30:00.000Z';
    const action = reconcileProjectTimestamps(localUpdatedAt, remoteUpdatedAt);
    expect(action).toBe('pull');
  });

  it('reconciles timestamp: returns "in_sync" when timestamps match', () => {
    const timestamp = '2026-08-22T04:00:00.000Z';
    const action = reconcileProjectTimestamps(timestamp, timestamp);
    expect(action).toBe('in_sync');
  });

  it('exposes syncGranularProjectFiles and importProjectFromSharedFolder on googleDriveSyncService', async () => {
    const { googleDriveSyncService } = await import('../googleDriveSyncService');
    expect(typeof googleDriveSyncService.syncGranularProjectFiles).toBe('function');
    expect(typeof googleDriveSyncService.importProjectFromSharedFolder).toBe('function');
    expect(typeof googleDriveSyncService.syncGranularProject).toBe('function');
  });

  it('exposes openFolderPicker and openFilePicker on googlePickerService', async () => {
    const { googlePickerService } = await import('../googlePickerService');
    expect(typeof googlePickerService.openFolderPicker).toBe('function');
    expect(typeof googlePickerService.openFilePicker).toBe('function');
    expect(typeof googlePickerService.getPickerApiKey).toBe('function');
  });
});

