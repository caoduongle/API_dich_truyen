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

  it('exposes bundle sync methods on googleDriveSyncService', async () => {
    const { googleDriveSyncService } = await import('../googleDriveSyncService');
    expect(typeof googleDriveSyncService.syncGranularProjectFiles).toBe('function');
    expect(typeof googleDriveSyncService.importProjectFromSharedFolder).toBe('function');
    expect(typeof googleDriveSyncService.syncGranularProject).toBe('function');
    expect(typeof googleDriveSyncService.importProjectFromBundle).toBe('function');
    expect(typeof googleDriveSyncService.pushProjectBundle).toBe('function');
    expect(typeof googleDriveSyncService.pullProjectBundle).toBe('function');
    expect(typeof googleDriveSyncService.migrateOwnerProjectToBundle).toBe('function');
  });

  it('exposes openFolderPicker, openFilePicker, openBundlePicker, and App ID helpers on googlePickerService', async () => {
    const { googlePickerService } = await import('../googlePickerService');
    expect(typeof googlePickerService.openFolderPicker).toBe('function');
    expect(typeof googlePickerService.openFilePicker).toBe('function');
    expect(typeof googlePickerService.openBundlePicker).toBe('function');
    expect(typeof googlePickerService.getPickerApiKey).toBe('function');
    expect(typeof googlePickerService.getAppId).toBe('function');
    expect(typeof googlePickerService.setAppId).toBe('function');
    expect(typeof googlePickerService.getCustomAppId).toBe('function');

    // Test setAppId and getCustomAppId
    googlePickerService.setAppId('123456789012');
    expect(googlePickerService.getAppId()).toBe('123456789012');
    expect(googlePickerService.getCustomAppId()).toBe('123456789012');

    // Reset
    googlePickerService.setAppId('');
    expect(googlePickerService.getCustomAppId()).toBe('');
  });

  it('throws descriptive error if appId is missing when opening picker', async () => {
    const { googlePickerService } = await import('../googlePickerService');
    googlePickerService.setPickerApiKey('test_key');
    googlePickerService.setAppId('');

    await expect(
      googlePickerService.openFolderPicker({
        accessToken: 'mock_token',
        onFolderSelected: () => {},
      })
    ).rejects.toThrow('Chưa cấu hình Google Cloud App ID (Project Number)');

    await expect(
      googlePickerService.openFilePicker({
        accessToken: 'mock_token',
        folderId: 'folder_123',
        onFilesSelected: () => {},
      })
    ).rejects.toThrow('Chưa cấu hình Google Cloud App ID (Project Number)');

    await expect(
      googlePickerService.openBundlePicker({
        accessToken: 'mock_token',
        onFileSelected: () => {},
      })
    ).rejects.toThrow('Chưa cấu hình Google Cloud App ID (Project Number)');
  });
});


