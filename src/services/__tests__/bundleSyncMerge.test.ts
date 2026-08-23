import { describe, it, expect } from 'vitest';
import {
  createChapterYDoc,
  exportDocUpdate,
  applyDocUpdate,
  applyTextDiff,
  mergeChapterCrdt,
  extractCrdtSnapshot,
  uint8ArrayToBase64,
  base64ToUint8Array,
} from '../crdtDocManager';
import { Chapter } from '../../types';

describe('bundleSyncMerge (CRDT Merge on Pull)', () => {
  const baseLocalChapter: Chapter = {
    id: 'chap_1',
    projectId: 'proj_test',
    title: 'Chương 1: Khởi Đầu',
    sourceText: '第一章 启程\n第二段 内容',
    rawTranslation: 'Chương 1: Khởi đầu\nĐoạn hai: Nội dung gốc',
    polishedTranslation: 'Hồi 1: Lên đường\nĐoạn hai: Chi tiết mở đầu',
    paragraphs: ['第一章 启程', '第二段 内容'],
    translatedLines: ['Hồi 1: Lên đường', 'Đoạn hai: Chi tiết mở đầu'],
    status: 'in_progress',
    createdAt: '2026-08-20T10:00:00Z',
    updatedAt: '2026-08-22T08:00:00Z',
  };

  it('merges new chapter downloaded for the first time without prior local chapter', () => {
    const remoteChapter: Chapter = {
      ...baseLocalChapter,
      id: 'chap_new_99',
      title: 'Chương mới từ remote',
      rawTranslation: 'Bản dịch mới',
      polishedTranslation: 'Bản chuốt mới',
    };

    const session = createChapterYDoc('proj_test', 'chap_new_99', remoteChapter);
    const remoteSnapshot = extractCrdtSnapshot(session.doc);

    const result = mergeChapterCrdt({
      projectId: 'proj_test',
      chapterId: 'chap_new_99',
      localChapter: null,
      localCrdtState: null,
      remoteChapter,
      remoteCrdtSnapshot: remoteSnapshot,
    });

    expect(result.mergedChapter.id).toBe('chap_new_99');
    expect(result.mergedChapter.title).toBe('Chương mới từ remote');
    expect(result.mergedChapter.rawTranslation).toBe('Bản dịch mới');
    expect(result.mergedChapter.polishedTranslation).toBe('Bản chuốt mới');
    expect(result.crdtState).toBeInstanceOf(Uint8Array);
    expect(result.crdtState.length).toBeGreaterThan(0);
  });

  it('performs character-level CRDT merge when both peers have shared lineage and concurrent edits', () => {
    // 1. Base document
    const baseSession = createChapterYDoc('proj_test', 'chap_1', baseLocalChapter);
    const baseStateBytes = exportDocUpdate(baseSession.doc);

    // 2. Peer A (Local) edits rawTranslation
    const localSession = createChapterYDoc('proj_test', 'chap_1');
    applyDocUpdate(localSession.doc, baseStateBytes);
    applyTextDiff(localSession.rawText, 'Chương 1: Khởi đầu (Sửa bởi Local)\nĐoạn hai: Nội dung gốc');
    const localUpdatedState = exportDocUpdate(localSession.doc);

    const localChapter: Chapter = {
      ...baseLocalChapter,
      rawTranslation: 'Chương 1: Khởi đầu (Sửa bởi Local)\nĐoạn hai: Nội dung gốc',
      updatedAt: '2026-08-23T10:00:00Z',
    };

    // 3. Peer B (Remote) edits polishedTranslation concurrently
    const remoteSession = createChapterYDoc('proj_test', 'chap_1');
    applyDocUpdate(remoteSession.doc, baseStateBytes);
    applyTextDiff(remoteSession.polishedText, 'Hồi 1: Lên đường\nĐoạn hai: Chi tiết mở đầu (Đã chuốt bởi Remote)');
    const remoteSnapshot = extractCrdtSnapshot(remoteSession.doc);

    const remoteChapter: Chapter = {
      ...baseLocalChapter,
      polishedTranslation: 'Hồi 1: Lên đường\nĐoạn hai: Chi tiết mở đầu (Đã chuốt bởi Remote)',
      updatedAt: '2026-08-23T10:05:00Z',
    };

    // 4. Merge on Pull
    const result = mergeChapterCrdt({
      projectId: 'proj_test',
      chapterId: 'chap_1',
      localChapter,
      localCrdtState: localUpdatedState,
      remoteChapter,
      remoteCrdtSnapshot: remoteSnapshot,
    });

    // Both local rawTranslation edit AND remote polishedTranslation edit must be preserved
    expect(result.mergedChapter.rawTranslation).toContain('(Sửa bởi Local)');
    expect(result.mergedChapter.polishedTranslation).toContain('(Đã chuốt bởi Remote)');
  });

  it('merges metadata fields per-key using last-write-wins', () => {
    const baseSession = createChapterYDoc('proj_test', 'chap_1', baseLocalChapter);
    const baseStateBytes = exportDocUpdate(baseSession.doc);

    const remoteChapter: Chapter = {
      ...baseLocalChapter,
      title: 'Tiêu đề cập nhật từ Remote',
      status: 'completed',
      updatedAt: '2026-08-23T12:00:00Z',
    };

    const remoteSession = createChapterYDoc('proj_test', 'chap_1', remoteChapter);
    const remoteSnapshot = extractCrdtSnapshot(remoteSession.doc);

    const result = mergeChapterCrdt({
      projectId: 'proj_test',
      chapterId: 'chap_1',
      localChapter: baseLocalChapter,
      localCrdtState: baseStateBytes,
      remoteChapter,
      remoteCrdtSnapshot: remoteSnapshot,
    });

    expect(result.mergedChapter.title).toBe('Tiêu đề cập nhật từ Remote');
    expect(result.mergedChapter.status).toBe('completed');
  });

  it('encodes and decodes Base64 CRDT snapshots losslessly', () => {
    const session = createChapterYDoc('proj_1', 'chap_1', baseLocalChapter);
    const originalBytes = exportDocUpdate(session.doc);

    const b64 = uint8ArrayToBase64(originalBytes);
    const decodedBytes = base64ToUint8Array(b64);

    expect(decodedBytes.length).toBe(originalBytes.length);
    expect(Array.from(decodedBytes)).toEqual(Array.from(originalBytes));
  });

  it('handles fallback gracefully when no CRDT lineage exists on either side', () => {
    const localWithoutCrdt: Chapter = {
      ...baseLocalChapter,
      rawTranslation: 'Bản dịch local không lineage',
      updatedAt: '2026-08-22T01:00:00Z',
    };

    const remoteWithoutCrdt: Chapter = {
      ...baseLocalChapter,
      rawTranslation: 'Bản dịch remote không lineage (mới hơn)',
      updatedAt: '2026-08-23T01:00:00Z',
    };

    const result = mergeChapterCrdt({
      projectId: 'proj_test',
      chapterId: 'chap_1',
      localChapter: localWithoutCrdt,
      localCrdtState: null,
      remoteChapter: remoteWithoutCrdt,
      remoteCrdtSnapshot: null,
    });

    expect(result.mergedChapter.rawTranslation).toBeDefined();
    expect(result.crdtState).toBeInstanceOf(Uint8Array);
    expect(result.crdtState.length).toBeGreaterThan(0);
  });
});
