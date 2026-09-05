import { describe, it, expect, vi } from 'vitest';
import {
  createChapterYDoc,
  applyTextDiff,
  exportDocUpdate,
  applyDocUpdate,
  readChapterFromYDoc,
} from '../crdtDocManager';

describe('crdtDocManager (Yjs Document Core)', () => {
  it('creates a new chapter Y.Doc and initializes fields correctly', () => {
    const session = createChapterYDoc('proj_1', 'chap_1', {
      rawTranslation: 'Bản dịch thô ban đầu',
      polishedTranslation: 'Bản dịch biên tập ban đầu',
      title: 'Chương 1: Mở Đầu',
      status: 'in_progress',
    });

    expect(session.doc.guid).toBeDefined();
    expect(session.rawText.toString()).toBe('Bản dịch thô ban đầu');
    expect(session.polishedText.toString()).toBe('Bản dịch biên tập ban đầu');
    expect(session.metadataMap.get('title')).toBe('Chương 1: Mở Đầu');
    expect(session.metadataMap.get('status')).toBe('in_progress');
  });

  it('updates Y.Text efficiently using applyTextDiff', () => {
    const session = createChapterYDoc('proj_1', 'chap_1', {
      rawTranslation: 'Xin chào',
      polishedTranslation: '',
    });

    applyTextDiff(session.rawText, 'Xin chào thế giới!');
    expect(session.rawText.toString()).toBe('Xin chào thế giới!');

    applyTextDiff(session.rawText, 'Chào thế giới!');
    expect(session.rawText.toString()).toBe('Chào thế giới!');
  });

  it('synchronizes updates deterministically between two replicated Y.Docs', () => {
    // 1. Peer A initializes document with initial chapter content
    const docA = createChapterYDoc('proj_1', 'chap_1', {
      rawTranslation: 'Dòng 1',
      polishedTranslation: 'Đoạn A',
    });

    // 2. Peer B replicates base state from Peer A (via relay / initial pull)
    const docB = createChapterYDoc('proj_1', 'chap_1');
    applyDocUpdate(docB.doc, exportDocUpdate(docA.doc));

    expect(docB.rawText.toString()).toBe('Dòng 1');
    expect(docB.polishedText.toString()).toBe('Đoạn A');

    // 3. Peer A edits rawTranslation concurrently
    docA.rawText.insert(6, ' đã sửa bởi A');

    // 4. Peer B edits polishedTranslation concurrently
    docB.polishedText.insert(6, ' đã sửa bởi B');

    // 5. Exchange binary updates (via WebSocket relay)
    const updateFromA = exportDocUpdate(docA.doc);
    const updateFromB = exportDocUpdate(docB.doc);

    applyDocUpdate(docB.doc, updateFromA);
    applyDocUpdate(docA.doc, updateFromB);

    // 6. Both documents must converge to the exact same content
    expect(docA.rawText.toString()).toBe('Dòng 1 đã sửa bởi A');
    expect(docB.rawText.toString()).toBe('Dòng 1 đã sửa bởi A');

    expect(docA.polishedText.toString()).toBe('Đoạn A đã sửa bởi B');
    expect(docB.polishedText.toString()).toBe('Đoạn A đã sửa bởi B');
  });

  it('reads snapshot data back into a Chapter-compatible structure', () => {
    const session = createChapterYDoc('proj_1', 'chap_1', {
      rawTranslation: 'Thô 123',
      polishedTranslation: 'Chuốt 456',
      title: 'Hồi 1',
      status: 'completed',
    });

    const snapshot = readChapterFromYDoc(session.doc, 'chap_1');
    expect(snapshot.id).toBe('chap_1');
    expect(snapshot.rawTranslation).toBe('Thô 123');
    expect(snapshot.polishedTranslation).toBe('Chuốt 456');
    expect(snapshot.title).toBe('Hồi 1');
    expect(snapshot.status).toBe('completed');
  });

  it('dispatches remote update notifications without recursive observer re-triggering', () => {
    const sessionA = createChapterYDoc('proj_1', 'chap_1', {
      rawTranslation: 'Ban đầu',
      polishedTranslation: 'Ban đầu',
    });
    const sessionB = createChapterYDoc('proj_1', 'chap_1');

    let remoteCallbackCount = 0;
    let lastReceivedTitle = '';

    sessionB.doc.on('update', (_update: Uint8Array, origin: any) => {
      if (origin !== 'local-keystroke') {
        const snapshot = readChapterFromYDoc(sessionB.doc, 'chap_1');
        remoteCallbackCount++;
        lastReceivedTitle = snapshot.title || '';
      }
    });

    // Peer A updates metadata title
    sessionA.metadataMap.set('title', 'Chương 2: Tiến Triển');
    const update = exportDocUpdate(sessionA.doc);

    // Apply update to Peer B
    applyDocUpdate(sessionB.doc, update);

    expect(remoteCallbackCount).toBe(1);
    expect(lastReceivedTitle).toBe('Chương 2: Tiến Triển');
  });
});

