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
    status: 'disconnected',
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
