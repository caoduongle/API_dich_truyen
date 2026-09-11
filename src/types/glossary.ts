import { GlossaryItem } from '../types';

export interface DuplicateGroupEdit {
  groupId: string;
  reason: string;
  items: GlossaryItem[];
}

export interface MergeHanGroup {
  groupId: string;
  canonical: string;
  items: GlossaryItem[];
}
