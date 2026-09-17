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
import { getChapterFromDB, saveChapterToDB, saveCrdtState } from '../services/db';
import { registerCrdtPersistence, unregisterCrdtPersistence } from '../services/crdtPersistenceRegistry';

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
            const existing = await getChapterFromDB(chapId);
            const updatedAt = snapshot.updatedAt || new Date().toISOString();
            const sourceText =
              (snapshot.sourceText && snapshot.sourceText.trim()) ||
              (existing?.sourceText && existing.sourceText.trim()) ||
              '';
            const rawTranslation =
              (snapshot.rawTranslation && snapshot.rawTranslation.trim()) ||
              existing?.rawTranslation ||
              '';
            const polishedTranslation =
              (snapshot.polishedTranslation && snapshot.polishedTranslation.trim()) ||
              existing?.polishedTranslation ||
              '';
            const paragraphs =
              snapshot.paragraphs && snapshot.paragraphs.length > 0
                ? snapshot.paragraphs
                : (existing?.paragraphs?.length ? existing.paragraphs : []);
            const translatedLines =
              snapshot.translatedLines && snapshot.translatedLines.length > 0
                ? snapshot.translatedLines
                : (existing?.translatedLines?.length ? existing.translatedLines : []);

            await saveChapterToDB({
              id: chapId,
              projectId: existing?.projectId || projectId,
              title: snapshot.title || existing?.title || '',
              status: snapshot.status || existing?.status || 'in_progress',
              rawTranslation,
              polishedTranslation,
              sourceText,
              paragraphs,
              translatedLines,
              createdAt: existing?.createdAt || snapshot.createdAt || new Date().toISOString(),
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

    let isCancelled = false;

    // 1. Tạo hoặc lấy Y.Doc nội bộ cho chương này
    const session = createChapterYDoc(projectId, chapterId, initialChapter || undefined);
    const doc = session.doc;
    docRef.current = doc;
    rawTextRef.current = session.rawText;
    polishedTextRef.current = session.polishedText;
    metadataMapRef.current = session.metadataMap;

    // 2. Kích hoạt session cache y-indexeddb
    const persistenceDbName = `crdt_${projectId}_${chapterId}`;
    if (typeof window !== 'undefined') {
      try {
        const idbProvider = new IndexeddbPersistence(persistenceDbName, doc);
        persistenceRef.current = idbProvider;
        registerCrdtPersistence(persistenceDbName, idbProvider);
      } catch (e) {
        console.warn('[useChapterCRDT] IndexedDB Persistence không khả dụng:', e);
      }
    }

    // 2b. Khởi tạo bất đồng bộ từ IndexedDB nếu initialChapter không được cung cấp hoặc thiếu dữ liệu bản gốc
    if (!initialChapter || !initialChapter.sourceText) {
      getChapterFromDB(chapterId)
        .then((storedChapter) => {
          if (isCancelled || !storedChapter || !docRef.current) return;
          doc.transact(() => {
            const raw = doc.getText('rawTranslation');
            const polished = doc.getText('polishedTranslation');
            const meta = doc.getMap('metadata');

            if (storedChapter.rawTranslation && raw.length === 0) {
              raw.insert(0, storedChapter.rawTranslation);
            }
            if (storedChapter.polishedTranslation && polished.length === 0) {
              polished.insert(0, storedChapter.polishedTranslation);
            }
            if (storedChapter.sourceText && !meta.get('sourceText')) {
              meta.set('sourceText', storedChapter.sourceText);
            }
            if (storedChapter.title && !meta.get('title')) {
              meta.set('title', storedChapter.title);
            }
            if (storedChapter.status && !meta.get('status')) {
              meta.set('status', storedChapter.status);
            }
            if (storedChapter.paragraphs && !meta.get('paragraphs')) {
              meta.set('paragraphs', storedChapter.paragraphs);
            }
            if (storedChapter.translatedLines && !meta.get('translatedLines')) {
              meta.set('translatedLines', storedChapter.translatedLines);
            }
          }, 'hydration');
        })
        .catch((err) => {
          console.warn('[useChapterCRDT] Hydration error from IndexedDB:', err);
        });
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
      isCancelled = true;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      doc.off('update', handleDocUpdate);
      if (persistenceRef.current) {
        unregisterCrdtPersistence(persistenceDbName, persistenceRef.current);
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
        if (fields.sourceText !== undefined) map.set('sourceText', fields.sourceText);
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
