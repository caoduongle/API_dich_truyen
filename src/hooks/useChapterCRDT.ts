import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Chapter } from '../types';
import { CRDTSyncStatus, UserPresence } from '../types/crdt';
import {
  createChapterYDoc,
  applyTextDiff,
  readChapterFromYDoc,
} from '../services/crdtDocManager';
import { googleAuthService } from '../services/googleAuthService';
import { saveChapterToDB } from '../services/db';

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

const COLOR_PALETTE = [
  '#B8402C', // Chu sa
  '#2C5EB8', // Lam cổ
  '#3D7E5A', // Trúc diệp
  '#9B5B2E', // Hổ phách
  '#6D3D8A', // Tử đằng
  '#B8860B', // Hoàng kim
];

function generateColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

export function useChapterCRDT({
  projectId,
  chapterId,
  initialChapter,
  isShared = false,
  userEmail = '',
  userName = 'Người dịch',
  userPicture,
  onRemoteChange,
}: UseChapterCRDTOptions) {
  const [status, setStatus] = useState<CRDTSyncStatus>('offline');
  const [collaborators, setCollaborators] = useState<UserPresence[]>([]);

  const docRef = useRef<Y.Doc | null>(null);
  const rawTextRef = useRef<Y.Text | null>(null);
  const polishedTextRef = useRef<Y.Text | null>(null);
  const metadataMapRef = useRef<Y.Map<any> | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const saveTimeoutRef = useRef<any>(null);

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
              updatedAt: snapshot.updatedAt || new Date().toISOString(),
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
      setStatus('offline');
      setCollaborators([]);
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

    // 3. Lắng nghe cập nhật Y.Doc từ remote để đồng bộ giao diện & db.ts
    const handleDocUpdate = (_update: Uint8Array, origin: any) => {
      if (origin !== 'local-keystroke') {
        const updated = readChapterFromYDoc(doc, chapterId);
        onRemoteChange?.(updated);
      }
      debouncedSaveToDb(doc, chapterId);
    };
    doc.on('update', handleDocUpdate);

    // 4. Nếu dự án có chia sẻ cộng tác, kết nối WebSocket Relay
    if (isShared && typeof window !== 'undefined') {
      setStatus('connecting');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const token = googleAuthService.getAccessToken() || '';
      const roomId = `project_${projectId}_chapter_${chapterId}`;

      try {
        const provider = new WebsocketProvider(
          `${protocol}//${host}/ws/sync?projectId=${encodeURIComponent(projectId)}&chapterId=${encodeURIComponent(chapterId)}&token=${encodeURIComponent(token)}`,
          roomId,
          doc,
          { connect: true }
        );

        providerRef.current = provider;

        provider.on('status', ({ status: pStatus }: { status: string }) => {
          if (pStatus === 'connected') {
            setStatus('connected');
          } else if (pStatus === 'connecting') {
            setStatus('connecting');
          } else {
            setStatus('disconnected');
          }
        });

        // 5. Cấu hình Awareness (hiện diện trực tiếp)
        const awareness = provider.awareness;
        const userColor = generateColor(userEmail || userName);

        awareness.setLocalStateField('user', {
          name: userName,
          email: userEmail,
          picture: userPicture,
          color: userColor,
          activeField: 'idle',
          lastActive: Date.now(),
        });

        const handleAwarenessChange = () => {
          const states = awareness.getStates();
          const activeUsers: UserPresence[] = [];
          states.forEach((state: any, clientId: number) => {
            if (clientId !== awareness.clientID && state.user) {
              activeUsers.push(state.user as UserPresence);
            }
          });
          setCollaborators(activeUsers);
        };

        awareness.on('change', handleAwarenessChange);
      } catch (err) {
        console.warn('[useChapterCRDT] Lỗi kết nối WebSocket relay:', err);
        setStatus('offline');
      }
    } else {
      setStatus('offline');
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      doc.off('update', handleDocUpdate);
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
      if (persistenceRef.current) {
        persistenceRef.current.destroy();
        persistenceRef.current = null;
      }
      doc.destroy();
      docRef.current = null;
    };
  }, [projectId, chapterId, isShared, userEmail, userName, userPicture, onRemoteChange, debouncedSaveToDb]);

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

  const setActiveField = useCallback((field: 'raw' | 'polished' | 'idle') => {
    if (providerRef.current) {
      const awareness = providerRef.current.awareness;
      const current = awareness.getLocalState()?.user || {};
      awareness.setLocalStateField('user', {
        ...current,
        activeField: field,
        lastActive: Date.now(),
      });
    }
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
