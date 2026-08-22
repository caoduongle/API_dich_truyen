import * as Y from 'yjs';

export type CRDTSyncStatus = 'connecting' | 'connected' | 'disconnected' | 'offline';

export interface UserPresence {
  name: string;
  email: string;
  picture?: string;
  color: string;
  activeField?: 'raw' | 'polished' | 'idle';
  lastActive: number;
}

export interface ChapterCRDTSession {
  chapterId: string;
  projectId: string;
  doc: Y.Doc;
  rawText: Y.Text;
  polishedText: Y.Text;
  metadataMap: Y.Map<any>;
  status: CRDTSyncStatus;
  collaborators: UserPresence[];
}
