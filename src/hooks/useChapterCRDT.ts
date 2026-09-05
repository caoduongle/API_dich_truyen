import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Chapter } from '../types';
import { CRDTSyncStatus, UserPresence } from '../types/crdt';
import {
  createChapterYDoc,
  applyTextDiff,
  readChapterFromYDoc,
  exportDocUpdate,
} from '../services/crdtDocManager';
import { saveChapterToDB, saveCrdtState } from '../services/db';

export interface UseChapterCRDTOptions {
  projectId: string;
  chapterId: string | null;
  initialChapter?: Chapter | null;
  isShared?: boolean;
  userEmail?: string;
  userName?: string;
  userPicture?: string;
  onRemoteChange?: (updated: Partial<Chapter>) => void;
}

export function useChapterCRDT({
  projectId,
  chapterId,
  initialChapter,
  onRemoteChange,
}: UseChapterCRDTOptions) {
  const [status] = useState<CRDTSyncStatus>('offline');
  const [collaborators] = useState<UserPresence[]>([]);

  const docRef = useRef<Y.Doc | null>(null);
  const rawTextRef = useRef<Y.Text | null>(null);
  const polishedTextRef = useRef<Y.Text | null>(null);
  const metadataMapRef = useRef<Y.Map<any> | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const saveTimeoutRef = useRef<any>(null);

  const onRemoteChangeRef = useRef(onRemoteChange);
  onRemoteChangeRef.current = onRemoteChange;

  // Debounced auto-save to IndexedDB (db.ts)
  const debouncedSaveToDb = useCallback(
    (doc: Y.Doc, chapId: string) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const snapshot = readChapterFromYDoc(doc, chapId);
          if (snapshot.id && (snapshot.rawTranslation || snapshot.polishedTranslation)) {
            const updatedAt = snapshot.updatedAt || new Date().toISOString();
            await saveChapterToDB({
              id: chapId,
              projectId,
              title: snapshot.title || '',
              status: snapshot.status || 'in_progress',
              rawTranslation: snapshot.rawTranslation || '',
              polishedTranslation: snapshot.polishedTranslation || '',
              sourceText: snapshot.sourceText || '',
              paragraphs: snapshot.paragraphs || [],
              translatedLines: snapshot.translatedLines || [],
              createdAt: snapshot.createdAt || new Date().toISOString(),
              updatedAt,
            });

            // Đồng thời lưu binary CRDT state để bảo tồn lineage lịch sử chỉnh sửa
            await saveCrdtState({
              chapterId: chapId,
              projectId,
              state: exportDocUpdate(doc),
              updatedAt,
            });
          }
        } catch (err) {
          console.warn('[useChapterCRDT] Lỗi tự động lưu vào IndexedDB:', err);
        }
      }, 500);
    },
    [projectId]
  );

  useEffect(() => {
    if (!chapterId || !projectId) {
      return;
    }

    // 1. Tạo hoặc lấy Y.Doc nội bộ cho chương này
    const session = createChapterYDoc(projectId, chapterId, initialChapter || undefined);
    const doc = session.doc;
    docRef.current = doc;
    rawTextRef.current = session.rawText;
    polishedTextRef.current = session.polishedText;
    metadataMapRef.current = session.metadataMap;

    // 2. Kích hoạt session cache y-indexeddb
    if (typeof window !== 'undefined') {
      try {
        const idbProvider = new IndexeddbPersistence(`crdt_${projectId}_${chapterId}`, doc);
        persistenceRef.current = idbProvider;
      } catch (e) {
        console.warn('[useChapterCRDT] IndexedDB Persistence không khả dụng:', e);
      }
    }

    // 3. Lắng nghe cập nhật Y.Doc để đồng bộ giao diện & db.ts
    const handleDocUpdate = (_update: Uint8Array, origin: any) => {
      if (origin !== 'local-keystroke') {
        const updated = readChapterFromYDoc(doc, chapterId);
        onRemoteChangeRef.current?.(updated);
      }
      debouncedSaveToDb(doc, chapterId);
    };
    doc.on('update', handleDocUpdate);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      doc.off('update', handleDocUpdate);
      if (persistenceRef.current) {
        persistenceRef.current.destroy();
        persistenceRef.current = null;
      }
      doc.destroy();
      docRef.current = null;
    };
  }, [projectId, chapterId, debouncedSaveToDb]);

  const updateRawTranslation = useCallback((newText: string) => {
    if (rawTextRef.current && docRef.current) {
      docRef.current.transact(() => {
        applyTextDiff(rawTextRef.current!, newText);
      }, 'local-keystroke');
    }
  }, []);

  const updatePolishedTranslation = useCallback((newText: string) => {
    if (polishedTextRef.current && docRef.current) {
      docRef.current.transact(() => {
        applyTextDiff(polishedTextRef.current!, newText);
      }, 'local-keystroke');
    }
  }, []);

  const updateMetadata = useCallback((fields: Partial<Chapter>) => {
    if (metadataMapRef.current && docRef.current) {
      docRef.current.transact(() => {
        const map = metadataMapRef.current!;
        if (fields.title !== undefined) map.set('title', fields.title);
        if (fields.status !== undefined) map.set('status', fields.status);
        if (fields.paragraphs !== undefined) map.set('paragraphs', fields.paragraphs);
        if (fields.translatedLines !== undefined) map.set('translatedLines', fields.translatedLines);
        map.set('updatedAt', new Date().toISOString());
      }, 'local-keystroke');
    }
  }, []);

  const setActiveField = useCallback((_field: 'raw' | 'polished' | 'idle') => {
    // No-op in client-only mode without WebSocket relay
  }, []);

  return {
    doc: docRef.current,
    status,
    collaborators,
    updateRawTranslation,
    updatePolishedTranslation,
    updateMetadata,
    setActiveField,
  };
}
