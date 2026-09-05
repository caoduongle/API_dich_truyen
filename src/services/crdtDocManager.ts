import * as Y from 'yjs';
import { Chapter } from '../types';
import { ChapterCRDTSession } from '../types/crdt';

export interface InitialChapterData {
  rawTranslation?: string;
  polishedTranslation?: string;
  title?: string;
  status?: Chapter['status'];
  sourceText?: string;
  paragraphs?: string[];
  translatedLines?: string[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Khởi tạo một Y.Doc mới cho một chương truyện với 2 trường Y.Text và 1 trường metadata Y.Map
 */
export function createChapterYDoc(
  projectId: string,
  chapterId: string,
  initialData?: InitialChapterData
): ChapterCRDTSession {
  const doc = new Y.Doc({
    gc: true,
  });

  const rawText = doc.getText('rawTranslation');
  const polishedText = doc.getText('polishedTranslation');
  const metadataMap = doc.getMap('metadata');

  doc.transact(() => {
    if (initialData?.rawTranslation && rawText.length === 0) {
      rawText.insert(0, initialData.rawTranslation);
    }
    if (initialData?.polishedTranslation && polishedText.length === 0) {
      polishedText.insert(0, initialData.polishedTranslation);
    }
    if (initialData?.title) {
      metadataMap.set('title', initialData.title);
    }
    if (initialData?.status) {
      metadataMap.set('status', initialData.status);
    }
    if (initialData?.sourceText) {
      metadataMap.set('sourceText', initialData.sourceText);
    }
    if (Array.isArray(initialData?.paragraphs)) {
      metadataMap.set('paragraphs', initialData.paragraphs);
    }
    if (Array.isArray(initialData?.translatedLines)) {
      metadataMap.set('translatedLines', initialData.translatedLines);
    }
    if (initialData?.updatedAt) {
      metadataMap.set('updatedAt', initialData.updatedAt);
    }
  });

  return {
    chapterId,
    projectId,
    doc,
    rawText,
    polishedText,
    metadataMap,
    status: 'offline',
    collaborators: [],
  };
}

/**
 * Cập nhật nội dung Y.Text từ một chuỗi text mới với diff tối ưu (tránh xóa toàn bộ tạo churn)
 */
export function applyTextDiff(yText: Y.Text, newText: string): void {
  const oldText = yText.toString();
  if (oldText === newText) return;

  let start = 0;
  while (start < oldText.length && start < newText.length && oldText[start] === newText[start]) {
    start++;
  }

  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }

  const deleteLength = oldEnd - start;
  const insertText = newText.slice(start, newEnd);

  yText.doc?.transact(() => {
    if (deleteLength > 0) {
      yText.delete(start, deleteLength);
    }
    if (insertText.length > 0) {
      yText.insert(start, insertText);
    }
  });
}

/**
 * Xuất toàn bộ trạng thái Y.Doc dưới dạng binary update snapshot (dùng cho backup Google Drive)
 */
export function exportDocUpdate(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

/**
 * Nhập binary update snapshot vào một Y.Doc
 */
export function applyDocUpdate(doc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(doc, update);
}

/**
 * Đọc dữ liệu từ Y.Doc chuyển thành Chapter object để phần còn lại của ứng dụng sử dụng
 */
export function readChapterFromYDoc(doc: Y.Doc, chapterId: string): Partial<Chapter> {
  const rawText = doc.getText('rawTranslation');
  const polishedText = doc.getText('polishedTranslation');
  const metadataMap = doc.getMap('metadata');

  return {
    id: chapterId,
    rawTranslation: rawText.toString(),
    polishedTranslation: polishedText.toString(),
    title: (metadataMap.get('title') as string) || '',
    status: (metadataMap.get('status') as Chapter['status']) || 'not_started',
    sourceText: (metadataMap.get('sourceText') as string) || '',
    paragraphs: (metadataMap.get('paragraphs') as string[]) || [],
    translatedLines: (metadataMap.get('translatedLines') as string[]) || [],
    updatedAt: (metadataMap.get('updatedAt') as string) || new Date().toISOString(),
  };
}

/**
 * Chuyển Uint8Array thành Base64 string an toàn trong cả môi trường browser lẫn Node/test
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Chuyển Base64 string thành Uint8Array an toàn trong cả môi trường browser lẫn Node/test
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Trích xuất snapshot Base64 từ một Y.Doc
 */
export function extractCrdtSnapshot(doc: Y.Doc): string {
  const updateBytes = exportDocUpdate(doc);
  return uint8ArrayToBase64(updateBytes);
}

export interface MergeChapterCrdtParams {
  projectId: string;
  chapterId: string;
  localChapter?: Chapter | null;
  localCrdtState?: Uint8Array | null;
  remoteChapter: Chapter;
  remoteCrdtSnapshot?: string | null;
}

export interface MergeChapterCrdtResult {
  mergedChapter: Chapter;
  crdtState: Uint8Array;
  isConflictFree: boolean;
}

/**
 * Hợp nhất dữ liệu chương cục bộ và từ xa sử dụng Yjs CRDT.
 */
export function mergeChapterCrdt({
  projectId,
  chapterId,
  localChapter,
  localCrdtState,
  remoteChapter,
  remoteCrdtSnapshot,
}: MergeChapterCrdtParams): MergeChapterCrdtResult {
  // 1. Trường hợp chương mới tải về lần đầu (chưa có local)
  if (!localChapter) {
    let doc: Y.Doc;
    if (remoteCrdtSnapshot) {
      doc = new Y.Doc({ gc: true });
      try {
        const remoteUpdate = base64ToUint8Array(remoteCrdtSnapshot);
        applyDocUpdate(doc, remoteUpdate);
      } catch (err) {
        console.warn('[mergeChapterCrdt] Lỗi giải mã remote snapshot, fallback tạo mới:', err);
        const session = createChapterYDoc(projectId, chapterId, remoteChapter);
        doc = session.doc;
      }
    } else {
      const session = createChapterYDoc(projectId, chapterId, remoteChapter);
      doc = session.doc;
    }

    const snapshot = readChapterFromYDoc(doc, chapterId);
    const mergedChapter: Chapter = {
      ...remoteChapter,
      ...snapshot,
      id: chapterId,
      projectId,
      sourceText: remoteChapter.sourceText || snapshot.sourceText || '',
      paragraphs: remoteChapter.paragraphs || snapshot.paragraphs || [],
      translatedLines: remoteChapter.translatedLines || snapshot.translatedLines || [],
      createdAt: remoteChapter.createdAt || new Date().toISOString(),
      updatedAt: remoteChapter.updatedAt || new Date().toISOString(),
    };

    return {
      mergedChapter,
      crdtState: exportDocUpdate(doc),
      isConflictFree: true,
    };
  }

  // 2. Trường hợp có cả local lẫn remote:
  const doc = new Y.Doc({ gc: true });

  if (localCrdtState && localCrdtState.length > 0) {
    // 2a. Có lineage CRDT local đã lưu trước đó
    try {
      applyDocUpdate(doc, localCrdtState);
    } catch (err) {
      console.warn('[mergeChapterCrdt] Lỗi nạp localCrdtState, khởi tạo từ localChapter:', err);
      const session = createChapterYDoc(projectId, chapterId, localChapter);
      applyDocUpdate(doc, exportDocUpdate(session.doc));
    }

    // Đẩy bất kỳ thay đổi text local chưa kịp flush vào doc
    applyTextDiff(doc.getText('rawTranslation'), localChapter.rawTranslation || '');
    applyTextDiff(doc.getText('polishedTranslation'), localChapter.polishedTranslation || '');

    // Nếu remote có snapshot, áp dụng merge CRDT
    if (remoteCrdtSnapshot) {
      try {
        const remoteUpdate = base64ToUint8Array(remoteCrdtSnapshot);
        applyDocUpdate(doc, remoteUpdate);
      } catch (err) {
        console.warn('[mergeChapterCrdt] Lỗi merge remote snapshot:', err);
      }
    }

    // Cập nhật metadata từ remote nếu remote mới hơn theo cơ chế Last-Write-Wins
    const remoteTime = remoteChapter.updatedAt ? new Date(remoteChapter.updatedAt).getTime() : 0;
    const localTime = localChapter.updatedAt ? new Date(localChapter.updatedAt).getTime() : 0;
    if (remoteTime > localTime) {
      const meta = doc.getMap('metadata');
      doc.transact(() => {
        if (remoteChapter.title) meta.set('title', remoteChapter.title);
        if (remoteChapter.status) meta.set('status', remoteChapter.status);
        if (remoteChapter.paragraphs) meta.set('paragraphs', remoteChapter.paragraphs);
        if (remoteChapter.translatedLines) meta.set('translatedLines', remoteChapter.translatedLines);
        if (remoteChapter.updatedAt) meta.set('updatedAt', remoteChapter.updatedAt);
      });
    }
  } else {
    // 2b. Chưa có local CRDT lineage (chuyển đổi từ hệ thống cũ / fresh doc)
    if (remoteCrdtSnapshot) {
      try {
        // Sử dụng remote doc làm base, sau đó apply text diff từ local lên
        const remoteUpdate = base64ToUint8Array(remoteCrdtSnapshot);
        applyDocUpdate(doc, remoteUpdate);
        applyTextDiff(doc.getText('rawTranslation'), localChapter.rawTranslation || '');
        applyTextDiff(doc.getText('polishedTranslation'), localChapter.polishedTranslation || '');
      } catch (err) {
        console.warn('[mergeChapterCrdt] Lỗi khởi tạo từ remote snapshot, fallback:', err);
        const session = createChapterYDoc(projectId, chapterId, localChapter);
        applyDocUpdate(doc, exportDocUpdate(session.doc));
      }
    } else {
      // Cả 2 đều không có snapshot -> lấy bản mới hơn làm base và merge text diff
      const remoteTime = remoteChapter.updatedAt ? new Date(remoteChapter.updatedAt).getTime() : 0;
      const localTime = localChapter.updatedAt ? new Date(localChapter.updatedAt).getTime() : 0;
      const baseChapter = remoteTime > localTime ? remoteChapter : localChapter;
      const otherChapter = remoteTime > localTime ? localChapter : remoteChapter;

      const session = createChapterYDoc(projectId, chapterId, baseChapter);
      applyDocUpdate(doc, exportDocUpdate(session.doc));
      applyTextDiff(doc.getText('rawTranslation'), otherChapter.rawTranslation || '');
      applyTextDiff(doc.getText('polishedTranslation'), otherChapter.polishedTranslation || '');
    }
  }

  // Đọc snapshot đã merge từ Y.Doc
  const snapshot = readChapterFromYDoc(doc, chapterId);

  // Tính updatedAt mới nhất
  const localTime = localChapter.updatedAt ? new Date(localChapter.updatedAt).getTime() : 0;
  const remoteTime = remoteChapter.updatedAt ? new Date(remoteChapter.updatedAt).getTime() : 0;
  const latestUpdatedTime = Math.max(localTime, remoteTime, Date.now());

  const mergedChapter: Chapter = {
    ...localChapter,
    ...remoteChapter,
    ...snapshot,
    id: chapterId,
    projectId: localChapter.projectId || remoteChapter.projectId || projectId,
    sourceText: localChapter.sourceText || remoteChapter.sourceText || snapshot.sourceText || '',
    processedSourceText: localChapter.processedSourceText || remoteChapter.processedSourceText,
    rawTranslation: snapshot.rawTranslation ?? localChapter.rawTranslation ?? remoteChapter.rawTranslation,
    polishedTranslation: snapshot.polishedTranslation ?? localChapter.polishedTranslation ?? remoteChapter.polishedTranslation,
    paragraphs: snapshot.paragraphs && snapshot.paragraphs.length > 0
      ? snapshot.paragraphs
      : (localChapter.paragraphs?.length ? localChapter.paragraphs : remoteChapter.paragraphs || []),
    translatedLines: snapshot.translatedLines && snapshot.translatedLines.length > 0
      ? snapshot.translatedLines
      : (localChapter.translatedLines?.length ? localChapter.translatedLines : remoteChapter.translatedLines || []),
    createdAt: localChapter.createdAt || remoteChapter.createdAt,
    updatedAt: new Date(latestUpdatedTime).toISOString(),
  };

  return {
    mergedChapter,
    crdtState: exportDocUpdate(doc),
    isConflictFree: true,
  };
}

