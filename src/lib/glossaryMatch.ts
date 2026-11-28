/**
 * Safe Glossary Matching, Conflict Resolution, Profile Normalization, and Entity Classification
 */

import {
  CharacterGender,
  CharacterProfile,
  CharacterRelationRule,
  GlossaryItem,
  GlossaryType,
  PendingGlossaryItem,
} from '../types';
import { DiscoveredEntity } from '../services/translation/types';
import { canonicalizeHan, findCanonicalSubstring, isHanEquivalent } from './sinoNormalize';
import { sanitizePromptInput } from './text';

const HAN_CHAR_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
const VALID_GENDERS = new Set<CharacterGender>(['male', 'female', 'neutral', 'unknown']);

export interface GlossaryEntryLike {
  id?: string;
  chinese: string;
  vietnamese: string;
  pinyin?: string;
  type?: string;
  note?: string;
  createdAt?: string;
  origin?: string;
  variants?: string[];
  isPinned?: boolean;
  characterProfile?: CharacterProfile;
}

export interface GlossaryConflictWarning<T extends GlossaryEntryLike = GlossaryItem> {
  canonicalChinese: string;
  winningItem: T;
  shadowedItems: T[];
}

export interface GroupedGlossarySections<T extends GlossaryEntryLike = GlossaryItem> {
  characterProfiled: T[];
  characterPlain: T[];
  location: T[];
  term: T[];
  phraseOther: T[];
  pinnedReference: T[];
}

export interface MatchedGlossarySpan<T extends GlossaryEntryLike = GlossaryItem> {
  item: T;
  matchedForm: string;
  startIndex: number;
  endIndex: number;
}

export type GlossaryHealthFilter = 'all' | 'conflicts' | 'missing_profile' | 'incomplete' | 'format_issues';

export interface GlossaryHealthReport {
  conflictGroupCount: number;
  conflictItemIds: string[];
  missingProfileCharIds: string[];
  incompleteViIds: string[];
  /** ID các mục có cột phiên âm nghi ngờ Bính âm/chữ Hán hoặc ghi chú còn lẫn chữ Hán */
  formatIssueIds?: string[];
  totalIssueItems: number;
}

export interface RelevantGlossarySelection<T extends GlossaryEntryLike = GlossaryItem> {
  /** Các mục từ điển thực sự xuất hiện trong văn bản nguồn + các mục được ghim (isPinned) */
  entries: T[];
  /** Các mục từ điển có xuất hiện trực tiếp trong văn bản nguồn (dùng cho kiểm tra tuân thủ) */
  matchedInSource: T[];
  /** Danh sách cảnh báo khi có nhiều mục trùng chữ Hán nhưng khác nghĩa Việt */
  conflicts: GlossaryConflictWarning<T>[];
}

export interface ChapterGlossaryFilterOptions {
  /** Tắt mặc định (false): chỉ đính kèm mục ghim ngoài chương khi người dùng chủ động bật */
  includePinned?: boolean;
  /** Số mục ghim tối đa khi includePinned = true (mặc định 15) */
  maxPinned?: number;
}

export interface ChapterGlossaryFilterResult<T extends GlossaryEntryLike = GlossaryItem>
  extends RelevantGlossarySelection<T> {
  /** Tổng số mục từ điển hợp lệ trước khi lọc theo chương */
  totalCount: number;
  /** Số mục thực tế sau khi lọc */
  filteredCount: number;
}

export interface SafeSubstitutionResult<T extends GlossaryEntryLike = GlossaryItem> {
  /** Văn bản nguồn sau khi đã thay thế các thuật ngữ có độ dài >= minHanLength bằng [Tên_Việt] */
  substitutedText: string;
  /** Tổng số lần thay thế đã thực hiện */
  totalReplacements: number;
  /** Danh sách thuật ngữ đã được thay thế cứng */
  substitutedTerms: T[];
}

export interface ClassifiedDiscoveredEntitiesResult {
  newGlossaryItems: GlossaryItem[];
  newPendingItems: PendingGlossaryItem[];
}

/**
 * Đếm số ký tự Hán thực tế trong một chuỗi (bỏ qua khoảng trắng, dấu câu, chữ Latin).
 */
export function countHanChars(text: string): number {
  if (!text) return 0;
  let count = 0;
  for (const ch of text) {
    if (HAN_CHAR_REGEX.test(ch)) {
      count++;
    }
  }
  return count;
}

function cleanProfileText(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const sanitized = sanitizePromptInput(value).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!sanitized) return undefined;
  return sanitized.length > maxLen ? sanitized.slice(0, maxLen).trim() : sanitized;
}

/**
 * Chuẩn hóa và xác thực CharacterProfile từ dữ liệu nhập hoặc lưu trữ (FR-008a, FR-008c).
 * Loại bỏ ký tự điều khiển / xuống dòng, giới hạn độ dài để chống prompt injection.
 */
export function normalizeCharacterProfile(
  profile?: CharacterProfile | null
): CharacterProfile | undefined {
  if (!profile || typeof profile !== 'object') {
    return undefined;
  }

  let gender: CharacterGender | undefined;
  if (profile.gender !== undefined && profile.gender !== null && String(profile.gender).trim() !== '') {
    const candidate = String(profile.gender).trim() as CharacterGender;
    gender = VALID_GENDERS.has(candidate) ? candidate : 'unknown';
  }

  const defaultSelfPronoun = cleanProfileText(profile.defaultSelfPronoun, 40);
  const defaultNarrativePronoun = cleanProfileText(profile.defaultNarrativePronoun, 40);

  const relations: CharacterRelationRule[] = [];
  const seenTargets = new Set<string>();
  if (Array.isArray(profile.relations)) {
    for (const rel of profile.relations) {
      if (!rel || typeof rel !== 'object') continue;
      const targetName = cleanProfileText(rel.targetName, 40);
      const selfPronoun = cleanProfileText(rel.selfPronoun, 40);
      const targetPronoun = cleanProfileText(rel.targetPronoun, 40);
      if (!targetName || !selfPronoun || !targetPronoun) continue;

      const dedupeKey = targetName.toLowerCase();
      if (seenTargets.has(dedupeKey)) continue;
      seenTargets.add(dedupeKey);

      const note = cleanProfileText(rel.note, 120);
      relations.push({
        targetName,
        selfPronoun,
        targetPronoun,
        ...(note ? { note } : {}),
      });

      if (relations.length >= 20) break;
    }
  }

  const hasContent =
    gender !== undefined ||
    defaultSelfPronoun !== undefined ||
    defaultNarrativePronoun !== undefined ||
    relations.length > 0;

  if (!hasContent) {
    return undefined;
  }

  return {
    ...(gender !== undefined ? { gender } : {}),
    ...(defaultSelfPronoun !== undefined ? { defaultSelfPronoun } : {}),
    ...(defaultNarrativePronoun !== undefined ? { defaultNarrativePronoun } : {}),
    ...(relations.length > 0 ? { relations } : {}),
  };
}

function getOriginPriority(origin?: string): number {
  switch (origin) {
    case 'manual':
      return 3;
    case 'guideline':
      return 2;
    case 'scanned':
      return 1;
    default:
      return 0;
  }
}

function compareGlossaryWinners<T extends GlossaryEntryLike>(a: T, b: T): number {
  const pinDiff = (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
  if (pinDiff !== 0) return pinDiff;

  const originDiff = getOriginPriority(b.origin) - getOriginPriority(a.origin);
  if (originDiff !== 0) return originDiff;

  const profileDiff =
    (normalizeCharacterProfile(b.characterProfile) ? 1 : 0) -
    (normalizeCharacterProfile(a.characterProfile) ? 1 : 0);
  if (profileDiff !== 0) return profileDiff;

  const lenDiff = Array.from((b.chinese || '').trim()).length - Array.from((a.chinese || '').trim()).length;
  if (lenDiff !== 0) return lenDiff;

  const timeA = a.createdAt ? Date.parse(a.createdAt) || 0 : 0;
  const timeB = b.createdAt ? Date.parse(b.createdAt) || 0 : 0;
  if (timeB !== timeA) return timeB - timeA;

  return String(a.id || '').localeCompare(String(b.id || ''));
}

/**
 * Giải quyết xung đột khi có nhiều mục từ điển trùng cụm chữ Hán chuẩn hóa hoặc chia sẻ biến thể (FR-003, FR-006).
 * - Trùng cụm chữ Hán chính: gộp về một mục thắng cuộc duy nhất theo thứ tự ưu tiên tất định.
 * - Trùng qua `variants`: ghi nhận cảnh báo xung đột và gỡ chuỗi biến thể trùng trên mục thua cuộc mà vẫn giữ nguyên mục chính.
 */
export function resolveGlossaryConflicts<T extends GlossaryEntryLike>(glossary: T[]): {
  resolved: T[];
  conflicts: GlossaryConflictWarning<T>[];
} {
  if (!Array.isArray(glossary) || glossary.length === 0) {
    return { resolved: [], conflicts: [] };
  }

  const groups = new Map<string, T[]>();
  for (const item of glossary) {
    if (!item || typeof item.chinese !== 'string') continue;
    const rawCn = item.chinese.trim();
    if (!rawCn) continue;
    const canonical = canonicalizeHan(rawCn);
    if (!canonical) continue;

    const existing = groups.get(canonical);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(canonical, [item]);
    }
  }

  const primaryResolved: T[] = [];
  const conflictMap = new Map<string, GlossaryConflictWarning<T>>();

  groups.forEach((group, canonicalChinese) => {
    if (group.length === 1) {
      primaryResolved.push(group[0]);
      return;
    }

    const sorted = [...group].sort(compareGlossaryWinners);
    const winningItem = sorted[0];
    const shadowedItems = sorted.slice(1);
    primaryResolved.push(winningItem);

    const winVi = (winningItem.vietnamese || '').trim().toLowerCase();
    const hasConflictingTranslation = shadowedItems.some(
      (s) => (s.vietnamese || '').trim().toLowerCase() !== winVi
    );
    if (hasConflictingTranslation) {
      conflictMap.set(canonicalChinese, {
        canonicalChinese,
        winningItem,
        shadowedItems,
      });
    }
  });

  // Kiểm tra xung đột qua biến thể (`variants`) mà không làm mất mục chính khác tên
  const primaryOwnerByCanon = new Map<string, T>();
  for (const item of primaryResolved) {
    const canon = canonicalizeHan((item.chinese || '').trim());
    if (canon && !primaryOwnerByCanon.has(canon)) {
      primaryOwnerByCanon.set(canon, item);
    }
  }

  const prioritized = [...primaryResolved].sort(compareGlossaryWinners);
  const variantOwnerByCanon = new Map<string, T>();
  const keptVariantsByItem = new Map<T, string[]>();

  const registerCollision = (canonSurface: string, holderA: T, holderB: T) => {
    const viA = (holderA.vietnamese || '').trim().toLowerCase();
    const viB = (holderB.vietnamese || '').trim().toLowerCase();
    if (viA === viB) return;

    const [winner, loser] = compareGlossaryWinners(holderA, holderB) <= 0 ? [holderA, holderB] : [holderB, holderA];
    const existingWarning = conflictMap.get(canonSurface);
    if (existingWarning) {
      if (!existingWarning.shadowedItems.includes(loser) && existingWarning.winningItem !== loser) {
        existingWarning.shadowedItems.push(loser);
      }
    } else {
      conflictMap.set(canonSurface, {
        canonicalChinese: canonSurface,
        winningItem: winner,
        shadowedItems: [loser],
      });
    }
  };

  for (const item of prioritized) {
    if (!Array.isArray(item.variants) || item.variants.length === 0) continue;
    const itemPrimaryCanon = canonicalizeHan((item.chinese || '').trim());
    const kept: string[] = [];
    let strippedAny = false;

    for (const rawVar of item.variants) {
      if (typeof rawVar !== 'string') continue;
      const trimmedVar = rawVar.trim();
      if (!trimmedVar) continue;
      const canonVar = canonicalizeHan(trimmedVar);
      if (!canonVar) continue;

      if (canonVar === itemPrimaryCanon) {
        kept.push(trimmedVar);
        continue;
      }

      const primaryOwner = primaryOwnerByCanon.get(canonVar);
      if (primaryOwner && primaryOwner !== item) {
        strippedAny = true;
        registerCollision(canonVar, primaryOwner, item);
        continue;
      }

      const variantOwner = variantOwnerByCanon.get(canonVar);
      if (variantOwner && variantOwner !== item) {
        strippedAny = true;
        registerCollision(canonVar, variantOwner, item);
        continue;
      }

      variantOwnerByCanon.set(canonVar, item);
      kept.push(trimmedVar);
    }

    if (strippedAny) {
      keptVariantsByItem.set(item, kept);
    }
  }

  const finalResolved =
    keptVariantsByItem.size === 0
      ? primaryResolved
      : primaryResolved.map((item) => {
          const nextVariants = keptVariantsByItem.get(item);
          if (!nextVariants) return item;
          const cloned = { ...item } as T;
          if (nextVariants.length > 0) {
            cloned.variants = nextVariants;
          } else {
            delete cloned.variants;
          }
          return cloned;
        });

  return { resolved: finalResolved, conflicts: Array.from(conflictMap.values()) };
}

/**
 * Phân nhóm từ điển theo vai trò ưu tiên cho bước dịch thô, chuốt văn và QA (FR-002).
 */
export function groupGlossaryByRole<T extends GlossaryEntryLike>(
  entries: T[],
  matchedInSource: T[]
): GroupedGlossarySections<T> {
  const matchedSet = new Set(matchedInSource || []);
  const sections: GroupedGlossarySections<T> = {
    characterProfiled: [],
    characterPlain: [],
    location: [],
    term: [],
    phraseOther: [],
    pinnedReference: [],
  };

  for (const item of entries || []) {
    if (!item) continue;
    if (!matchedSet.has(item)) {
      sections.pinnedReference.push(item);
      continue;
    }

    const type = item.type || 'other';
    const hasProfile = normalizeCharacterProfile(item.characterProfile) !== undefined;
    if (type === 'character') {
      if (hasProfile) {
        sections.characterProfiled.push(item);
      } else {
        sections.characterPlain.push(item);
      }
    } else if (type === 'location') {
      sections.location.push(item);
    } else if (type === 'term') {
      sections.term.push(item);
    } else {
      sections.phraseOther.push(item);
    }
  }

  return sections;
}

interface IndexedChar {
  ch: string;
  utf16Start: number;
  utf16End: number;
}

function indexCodePoints(text: string): IndexedChar[] {
  const out: IndexedChar[] = [];
  let offset = 0;
  for (const ch of text) {
    const len = ch.length;
    out.push({ ch, utf16Start: offset, utf16End: offset + len });
    offset += len;
  }
  return out;
}

function findNonOverlappingMatchesForForm(
  sourceParagraph: string,
  indexedChars: IndexedChar[],
  canonSource: string,
  form: string
): Array<{ charStart: number; charEnd: number; startIndex: number; endIndex: number; matchedForm: string }> {
  const trimmed = form.trim();
  if (!trimmed) return [];
  const formChars = Array.from(trimmed);
  const formCharLen = formChars.length;
  if (formCharLen === 0 || formCharLen > indexedChars.length) return [];

  const isSingleHan = countHanChars(trimmed) === 1 && formCharLen === 1;
  const canonForm = canonicalizeHan(trimmed);
  if (!sourceParagraph.includes(trimmed) && (!canonForm || !canonSource.includes(canonForm))) {
    return [];
  }

  const hits: Array<{ charStart: number; charEnd: number; startIndex: number; endIndex: number; matchedForm: string }> = [];

  for (let i = 0; i <= indexedChars.length - formCharLen; i++) {
    const startIndex = indexedChars[i].utf16Start;
    const endIndex = indexedChars[i + formCharLen - 1].utf16End;
    const candidateSlice = sourceParagraph.slice(startIndex, endIndex);

    const matched = candidateSlice === trimmed || (canonForm.length > 0 && canonicalizeHan(candidateSlice) === canonForm);
    if (!matched) continue;

    if (isSingleHan) {
      const prevHan = i > 0 && HAN_CHAR_REGEX.test(indexedChars[i - 1].ch);
      const nextHan = i + 1 < indexedChars.length && HAN_CHAR_REGEX.test(indexedChars[i + 1].ch);
      if (prevHan || nextHan) continue;
    }

    hits.push({
      charStart: i,
      charEnd: i + formCharLen,
      startIndex,
      endIndex,
      matchedForm: candidateSlice,
    });
  }

  return hits;
}

/**
 * Tìm tất cả vị trí khớp thuật ngữ không chồng lấn trong một đoạn văn bản nguồn (FR-004, FR-005).
 * Ưu tiên cụm dài nhất trước; mọi vị trí đã bị cụm dài chiếm chỗ sẽ được khóa để không báo lỗi giả cho cụm ngắn lồng bên trong.
 */
export function findNonOverlappingParagraphTerms<T extends GlossaryEntryLike>(
  sourceParagraph: string,
  candidateItems: T[]
): MatchedGlossarySpan<T>[] {
  if (!sourceParagraph || !Array.isArray(candidateItems) || candidateItems.length === 0) {
    return [];
  }

  const indexedChars = indexCodePoints(sourceParagraph);
  if (indexedChars.length === 0) return [];
  const canonSource = canonicalizeHan(sourceParagraph);

  interface CandidateOccurrence {
    item: T;
    matchedForm: string;
    charStart: number;
    charEnd: number;
    startIndex: number;
    endIndex: number;
    charLen: number;
  }

  const allOccurrences: CandidateOccurrence[] = [];
  for (const item of candidateItems) {
    if (!item) continue;
    for (const form of getAllSurfaceForms(item)) {
      if (countHanChars(form) === 0) continue;
      const matches = findNonOverlappingMatchesForForm(sourceParagraph, indexedChars, canonSource, form);
      for (const m of matches) {
        allOccurrences.push({
          item,
          matchedForm: m.matchedForm,
          charStart: m.charStart,
          charEnd: m.charEnd,
          startIndex: m.startIndex,
          endIndex: m.endIndex,
          charLen: m.charEnd - m.charStart,
        });
      }
    }
  }

  if (allOccurrences.length === 0) return [];

  allOccurrences.sort((a, b) => {
    if (b.charLen !== a.charLen) return b.charLen - a.charLen;
    if (a.charStart !== b.charStart) return a.charStart - b.charStart;
    return compareGlossaryWinners(a.item, b.item);
  });

  const claimed = new Array<boolean>(indexedChars.length).fill(false);
  const selected: MatchedGlossarySpan<T>[] = [];

  for (const occ of allOccurrences) {
    let overlaps = false;
    for (let k = occ.charStart; k < occ.charEnd; k++) {
      if (claimed[k]) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) continue;

    for (let k = occ.charStart; k < occ.charEnd; k++) {
      claimed[k] = true;
    }
    selected.push({
      item: occ.item,
      matchedForm: occ.matchedForm,
      startIndex: occ.startIndex,
      endIndex: occ.endIndex,
    });
  }

  selected.sort((a, b) => a.startIndex - b.startIndex);
  return selected;
}

function getAllSurfaceForms(item: GlossaryEntryLike): string[] {
  const forms: string[] = [];
  if (typeof item.chinese === 'string' && item.chinese.trim()) {
    forms.push(item.chinese.trim());
  }
  if (Array.isArray(item.variants)) {
    for (const v of item.variants) {
      if (typeof v === 'string' && v.trim()) {
        forms.push(v.trim());
      }
    }
  }
  return forms;
}

/**
 * Lọc danh sách từ điển liên quan đến sourceText (hỗ trợ cả giản thể/phồn thể qua canonicalizeHan)
 * và giải quyết xung đột tất định (FR-001, FR-004).
 */
export function selectRelevantGlossary<T extends GlossaryEntryLike>(
  sourceText: string,
  glossary: T[],
  options?: { maxPinned?: number }
): RelevantGlossarySelection<T> {
  const { resolved, conflicts } = resolveGlossaryConflicts(glossary || []);
  if (resolved.length === 0) {
    return { entries: [], matchedInSource: [], conflicts };
  }

  const maxPinned = options?.maxPinned ?? 50;
  const safeSource = sourceText || '';
  const canonicalSource = canonicalizeHan(safeSource);

  const matchedInSource: T[] = [];
  const pinnedExtras: T[] = [];

  for (const item of resolved) {
    const forms = getAllSurfaceForms(item);
    let isMatched = false;

    if (safeSource) {
      for (const form of forms) {
        if (safeSource.includes(form)) {
          isMatched = true;
          break;
        }
        const canonicalForm = canonicalizeHan(form);
        if (canonicalForm && canonicalSource.includes(canonicalForm)) {
          isMatched = true;
          break;
        }
      }
    }

    if (isMatched) {
      matchedInSource.push(item);
    } else if (item.isPinned && pinnedExtras.length < maxPinned) {
      pinnedExtras.push(item);
    }
  }

  // Bảo đảm số lượng mục ghim tổng cộng không vượt quá maxPinned nếu không khớp nguồn;
  // nếu có nhiều mục isPinned đã khớp nguồn trước, vẫn tôn trọng giới hạn trên pinnedExtras.
  const entries = [...matchedInSource, ...pinnedExtras];
  return { entries, matchedInSource, conflicts };
}

/**
 * Lọc chặt từ điển theo đúng văn bản nguồn của chương/phân đoạn đang xử lý (Feature 174).
 * Mặc định tắt việc nhồi thêm các mục ghim không xuất hiện trong chương (`includePinned = false` -> `maxPinned = 0`).
 */
export function filterGlossaryForChapter<T extends GlossaryEntryLike>(
  sourceText: string,
  glossary: T[],
  options?: ChapterGlossaryFilterOptions
): ChapterGlossaryFilterResult<T> {
  const { resolved } = resolveGlossaryConflicts(glossary || []);
  const includePinned = options?.includePinned === true;
  const maxPinned = includePinned ? Math.max(0, options?.maxPinned ?? 15) : 0;
  const selection = selectRelevantGlossary(sourceText, glossary, { maxPinned });
  return {
    ...selection,
    totalCount: resolved.length,
    filteredCount: selection.entries.length,
  };
}

/**
 * Tách văn bản thành các phân đoạn ngoài [...] và bên trong [...] để không thay lồng.
 */
function splitOutsideBrackets(text: string): Array<{ text: string; isBracketed: boolean }> {
  const parts: Array<{ text: string; isBracketed: boolean }> = [];
  const bracketRegex = /\[[^\]]*\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = bracketRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), isBracketed: false });
    }
    parts.push({ text: match[0], isBracketed: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isBracketed: false });
  }

  return parts;
}

interface SubstitutionCandidate<T extends GlossaryEntryLike> {
  surfaceForm: string;
  canonicalForm: string;
  item: T;
  hanLength: number;
}

/**
 * Thay thế cứng an toàn các thuật ngữ vào sourceText:
 * - Bỏ qua các mục có số ký tự Hán < minHanLength (mặc định 2) để không làm vỡ từ ghép (FR-002).
 * - Ưu tiên cụm dài nhất trước, một lượt duy nhất, không thay bên trong [...] đã đánh dấu (FR-003).
 */
export function substituteGlossaryTermsSafely<T extends GlossaryEntryLike>(
  sourceText: string,
  glossary: T[],
  options?: { minHanLength?: number; annotationStyle?: 'bracket-only' | 'inline-pair' }
): SafeSubstitutionResult<T> {
  if (!sourceText || !Array.isArray(glossary) || glossary.length === 0) {
    return {
      substitutedText: sourceText || '',
      totalReplacements: 0,
      substitutedTerms: [],
    };
  }

  const minHanLength = options?.minHanLength ?? 2;
  const annotationStyle = options?.annotationStyle ?? 'bracket-only';
  const { resolved } = resolveGlossaryConflicts(glossary);

  const candidates: SubstitutionCandidate<T>[] = [];
  const seenCanonicalSurface = new Set<string>();

  for (const item of resolved) {
    const vi = (item.vietnamese || '').trim();
    if (!vi) continue;

    for (const form of getAllSurfaceForms(item)) {
      const hanLen = countHanChars(form);
      if (hanLen < minHanLength) continue;

      const canonicalForm = canonicalizeHan(form);
      if (!canonicalForm) continue;
      if (seenCanonicalSurface.has(canonicalForm)) continue;
      seenCanonicalSurface.add(canonicalForm);

      candidates.push({
        surfaceForm: form,
        canonicalForm,
        item,
        hanLength: Array.from(form).length,
      });
    }
  }

  if (candidates.length === 0) {
    return {
      substitutedText: sourceText,
      totalReplacements: 0,
      substitutedTerms: [],
    };
  }

  // Ưu tiên cụm dài nhất trước
  candidates.sort((a, b) => b.hanLength - a.hanLength);

  // Bảo đảm cả các dạng chữ thực sự có mặt trong sourceText (kể cả biến thể phồn/giản thể)
  const formBySegmentMap: Array<{ actualForm: string; item: T; charLen: number }> = [];
  const addedActualForms = new Set<string>();

  const outerTextOnly = splitOutsideBrackets(sourceText)
    .filter((seg) => !seg.isBracketed)
    .map((seg) => seg.text)
    .join('\n');
  const canonicalOuter = canonicalizeHan(outerTextOnly);

  for (const cand of candidates) {
    if (outerTextOnly.includes(cand.surfaceForm)) {
      if (!addedActualForms.has(cand.surfaceForm)) {
        addedActualForms.add(cand.surfaceForm);
        formBySegmentMap.push({
          actualForm: cand.surfaceForm,
          item: cand.item,
          charLen: Array.from(cand.surfaceForm).length,
        });
      }
    }
    // Tìm biến thể phồn/giản thể thật trong outerTextOnly
    if (canonicalOuter.includes(cand.canonicalForm)) {
      const realMatch = findCanonicalSubstring(outerTextOnly, cand.surfaceForm);
      if (realMatch && !addedActualForms.has(realMatch)) {
        addedActualForms.add(realMatch);
        formBySegmentMap.push({
          actualForm: realMatch,
          item: cand.item,
          charLen: Array.from(realMatch).length,
        });
      }
    }
  }

  if (formBySegmentMap.length === 0) {
    return {
      substitutedText: sourceText,
      totalReplacements: 0,
      substitutedTerms: [],
    };
  }

  formBySegmentMap.sort((a, b) => b.charLen - a.charLen);

  let totalReplacements = 0;
  const usedItems = new Set<T>();
  const segments = splitOutsideBrackets(sourceText);

  const rebuilt = segments
    .map((seg) => {
      if (seg.isBracketed) return seg.text;

      let cursor = 0;
      let out = '';
      const text = seg.text;

      while (cursor < text.length) {
        let matchedEntry: { actualForm: string; item: T } | null = null;
        for (const entry of formBySegmentMap) {
          if (text.startsWith(entry.actualForm, cursor)) {
            matchedEntry = entry;
            break;
          }
        }

        if (matchedEntry) {
          const viClean = matchedEntry.item.vietnamese.trim();
          out +=
            annotationStyle === 'inline-pair'
              ? `${matchedEntry.actualForm}[${viClean}]`
              : `[${viClean}]`;
          cursor += matchedEntry.actualForm.length;
          totalReplacements++;
          usedItems.add(matchedEntry.item);
        } else {
          const cp = text.codePointAt(cursor)!;
          const step = cp > 0xffff ? 2 : 1;
          out += text.slice(cursor, cursor + step);
          cursor += step;
        }
      }

      return out;
    })
    .join('');

  return {
    substitutedText: rebuilt,
    totalReplacements,
    substitutedTerms: Array.from(usedItems),
  };
}

function mergeTwoProfiles(
  localProfile: CharacterProfile,
  remoteProfile: CharacterProfile,
  preferLocalScalar: boolean
): CharacterProfile | undefined {
  const primary = preferLocalScalar ? localProfile : remoteProfile;
  const secondary = preferLocalScalar ? remoteProfile : localProfile;

  const relationsMap = new Map<string, CharacterRelationRule>();
  const addRelations = (list?: CharacterRelationRule[]) => {
    if (!list) return;
    for (const r of list) {
      const key = r.targetName.toLowerCase();
      if (!relationsMap.has(key)) {
        relationsMap.set(key, r);
      }
    }
  };

  addRelations(primary.relations);
  addRelations(secondary.relations);

  return normalizeCharacterProfile({
    gender: primary.gender ?? secondary.gender,
    defaultSelfPronoun: primary.defaultSelfPronoun ?? secondary.defaultSelfPronoun,
    defaultNarrativePronoun: primary.defaultNarrativePronoun ?? secondary.defaultNarrativePronoun,
    relations: Array.from(relationsMap.values()),
  });
}

/**
 * Hợp nhất danh sách từ điển khi kéo dữ liệu từ Google Drive / bản sao lưu cũ:
 * Bảo toàn characterProfile và isPinned của bản local nếu bản remote từ phiên bản cũ không có (FR-008b).
 */
export function mergeGlossaryPreservingProfiles(
  localGlossary: GlossaryItem[],
  remoteGlossary: GlossaryItem[]
): GlossaryItem[] {
  const safeLocal = Array.isArray(localGlossary) ? localGlossary : [];
  const safeRemote = Array.isArray(remoteGlossary) ? remoteGlossary : [];

  if (safeRemote.length === 0) {
    return safeLocal.map((item) => ({ ...item }));
  }

  const localById = new Map<string, GlossaryItem>();
  const localByKey = new Map<string, GlossaryItem>();

  for (const item of safeLocal) {
    if (!item) continue;
    if (item.id) localById.set(item.id, item);
    if (item.chinese) {
      const key = `${canonicalizeHan(item.chinese.trim())}::${(item.vietnamese || '').trim().toLowerCase()}`;
      if (!localByKey.has(key)) {
        localByKey.set(key, item);
      }
    }
  }

  return safeRemote.map((remoteItem) => {
    const matchedLocal =
      (remoteItem.id ? localById.get(remoteItem.id) : undefined) ??
      (remoteItem.chinese
        ? localByKey.get(
            `${canonicalizeHan(remoteItem.chinese.trim())}::${(remoteItem.vietnamese || '').trim().toLowerCase()}`
          )
        : undefined);

    const normalizedRemoteProfile = normalizeCharacterProfile(remoteItem.characterProfile);
    const normalizedLocalProfile = normalizeCharacterProfile(matchedLocal?.characterProfile);

    let finalProfile: CharacterProfile | undefined;
    if (normalizedRemoteProfile && normalizedLocalProfile) {
      const localTime = matchedLocal?.createdAt ? Date.parse(matchedLocal.createdAt) || 0 : 0;
      const remoteTime = remoteItem.createdAt ? Date.parse(remoteItem.createdAt) || 0 : 0;
      finalProfile = mergeTwoProfiles(normalizedLocalProfile, normalizedRemoteProfile, localTime > remoteTime);
    } else {
      finalProfile = normalizedRemoteProfile ?? normalizedLocalProfile;
    }

    const finalPinned =
      remoteItem.isPinned !== undefined ? remoteItem.isPinned : matchedLocal?.isPinned;

    const merged: GlossaryItem = {
      ...remoteItem,
    };

    if (finalProfile !== undefined) {
      merged.characterProfile = finalProfile;
    } else {
      delete merged.characterProfile;
    }

    if (finalPinned !== undefined) {
      merged.isPinned = finalPinned;
    } else {
      delete merged.isPinned;
    }

    return merged;
  });
}

const NOISY_COMMON_CHINESE_STOPWORDS = new Set<string>([
  '我', '你', '您', '他', '她', '它',
  '我们', '你们', '他们', '她们', '它们', '咱们',
  '自己', '别人', '人家', '大家', '本人',
  '这', '那', '这里', '那里', '这边', '那边', '这个', '那个', '这些', '那些', '这样', '那样',
  '哪里', '哪儿', '什么', '怎么', '怎样', '为什么', '多少', '几个',
  '的', '了', '着', '过', '呢', '吧', '吗', '啊', '呀', '哦', '嗯',
  '可以', '不能', '没有', '已经', '因为', '所以', '但是', '不过', '如果', '虽然', '而且', '然后', '或者', '还是',
  '一个', '一些', '一点', '东西', '事情', '时候', '地方', '问题', '现在', '刚才', '以前', '以后', '今天', '明天', '昨天',
]);

const LATIN_LETTER_RE = /[A-Za-z\u00C0-\u1EF9]/;

/**
 * Nhận diện thuật ngữ nhiễu (đại từ phổ thông, hư từ, chuỗi không chứa chữ Hán/chữ cái hợp lệ) (FR-008).
 */
export function isNoisyGlossaryTerm(chinese: string, _type?: string): boolean {
  if (typeof chinese !== 'string') return true;
  const cleaned = chinese.replace(/\s+/g, '').trim();
  if (!cleaned) return true;
  if (countHanChars(cleaned) === 0 && !LATIN_LETTER_RE.test(cleaned)) {
    return true;
  }
  const canonical = canonicalizeHan(cleaned);
  return NOISY_COMMON_CHINESE_STOPWORDS.has(cleaned) || NOISY_COMMON_CHINESE_STOPWORDS.has(canonical);
}

const FEMALE_NOTE_CUES_RE =
  /(?:^|[^\p{L}\p{N}])(nhân vật nữ|nữ chính|nữ phụ|thiếu nữ|nữ tử|nữ nhân|cô gái|cô nương|tiểu thư|sư tỷ|sư muội|sư mẫu|mẫu thân|phu nhân|hoàng hậu|công chúa|vương phi|nữ đế|nữ vương|nàng|cô ấy|bà lão)(?=$|[^\p{L}\p{N}])/iu;
const MALE_NOTE_CUES_RE =
  /(?:^|[^\p{L}\p{N}])(nhân vật nam|nam chính|nam phụ|thiếu niên|nam tử|nam nhân|đại hán|công tử|sư huynh|sư đệ|phụ thân|lão giả|lão nhân|hoàng đế|vương gia|thái tử|hắn|chàng|gã|y là nam)(?=$|[^\p{L}\p{N}])/iu;
const STANDALONE_FEMALE_LABEL_RE = /^(?:nữ|giới tính:\s*nữ)$/iu;
const STANDALONE_MALE_LABEL_RE = /^(?:nam|giới tính:\s*nam)$/iu;
const SOURCE_FEMALE_WORD_CUES_RE = /(?:姑娘|小姐|少女|女子|公主|皇后|夫人|师姐|师妹|母亲|她)/;
const SOURCE_MALE_WORD_CUES_RE = /(?:少年|男子|公子|皇帝|王爷|大汉|师兄|师弟|父亲|老者|他)/;

/**
 * Suy luận giới tính nhân vật mới từ ghi chú hoặc văn cảnh đơn chủ thể rõ ràng (FR-009).
 * Chỉ trả về `'male' | 'female'` khi bằng chứng nhất quán và không mâu thuẫn; trả về `undefined` khi mơ hồ.
 */
export function inferCharacterGenderFromContext(params: {
  chinese: string;
  note?: string;
  sourceParagraph?: string;
}): 'male' | 'female' | undefined {
  const note = (params.note || '').trim();
  const sourceParagraph = (params.sourceParagraph || '').trim();
  const cn = (params.chinese || '').trim();

  let hasFemale =
    Boolean(note) && (FEMALE_NOTE_CUES_RE.test(note) || STANDALONE_FEMALE_LABEL_RE.test(note));
  let hasMale =
    Boolean(note) && (MALE_NOTE_CUES_RE.test(note) || STANDALONE_MALE_LABEL_RE.test(note));

  if (hasFemale && hasMale) {
    return undefined;
  }

  if (!hasFemale && !hasMale && sourceParagraph && cn) {
    const escapedCn = cn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const directFemaleRe = new RegExp(
      `${escapedCn}[\\s，,]*(?:是位|是一位|是个|乃|为)?(?:少女|女子|姑娘|小姐|公主|皇后|夫人)|${escapedCn}[^。！？\\n]{0,4}她`
    );
    const directMaleRe = new RegExp(
      `${escapedCn}[\\s，,]*(?:是位|是一位|是个|乃|为)?(?:少年|男子|公子|大汉|老者)|${escapedCn}[^。！？\\n]{0,4}他`
    );

    const paraFemale = SOURCE_FEMALE_WORD_CUES_RE.test(sourceParagraph);
    const paraMale = SOURCE_MALE_WORD_CUES_RE.test(sourceParagraph);

    if (directFemaleRe.test(sourceParagraph) && !paraMale) {
      hasFemale = true;
    } else if (directMaleRe.test(sourceParagraph) && !paraFemale) {
      hasMale = true;
    }
  }

  if (hasFemale && !hasMale) return 'female';
  if (hasMale && !hasFemale) return 'male';
  return undefined;
}

/**
 * Ưu tiên danh sách thuật ngữ đã biết có xuất hiện trong chương hiện tại vào đầu danh sách loại trừ (FR-007).
 */
export function prioritizeKnownTermsForChapter(
  sourceText: string,
  knownTerms: Array<string | GlossaryEntryLike>,
  maxLimit = 150
): string[] {
  if (!Array.isArray(knownTerms) || knownTerms.length === 0 || maxLimit <= 0) {
    return [];
  }

  const safeSource = sourceText || '';
  const canonSource = canonicalizeHan(safeSource);
  const indexedSourceChars = safeSource ? indexCodePoints(safeSource) : [];

  const matched: string[] = [];
  const pinned: string[] = [];
  const rest: string[] = [];
  const seenCanon = new Set<string>();

  for (const entry of knownTerms) {
    const rawCn = typeof entry === 'string' ? entry.trim() : (entry?.chinese || '').trim();
    if (!rawCn) continue;
    const canonCn = canonicalizeHan(rawCn);
    if (!canonCn || seenCanon.has(canonCn)) continue;
    seenCanon.add(canonCn);

    const forms =
      typeof entry === 'string' ? [rawCn] : getAllSurfaceForms(entry);

    let isMatched = false;
    if (safeSource) {
      for (const form of forms) {
        const trimmed = form.trim();
        if (!trimmed) continue;
        if (countHanChars(trimmed) === 1 && Array.from(trimmed).length === 1) {
          if (findNonOverlappingMatchesForForm(safeSource, indexedSourceChars, canonSource, trimmed).length > 0) {
            isMatched = true;
            break;
          }
        } else if (
          safeSource.includes(trimmed) ||
          (canonSource && canonSource.includes(canonicalizeHan(trimmed)))
        ) {
          isMatched = true;
          break;
        }
      }
    }

    if (isMatched) {
      matched.push(rawCn);
    } else if (typeof entry !== 'string' && entry?.isPinned) {
      pinned.push(rawCn);
    } else {
      rest.push(rawCn);
    }
  }

  return [...matched, ...pinned, ...rest].slice(0, maxLimit);
}

const STRICT_PINYIN_TONE_RE = /[āǎēěīǐōǒūǔǖǘǚǜĀǍĒĚĪǏŌǑŪǓǕǗǙǛ]/;
const VIETNAMESE_EXCLUSIVE_CHAR_RE = /[ăâđêôơưĂÂĐÊÔƠƯảãạắằẳẵặấầẩẫậẻẽẹếềểễệỉĩịỏõọốồổỗộớờởỡợủũụứừửữựỳỷỹỵẢÃẠẮẰẲẴẶẤẦẨẪẬẺẼẸẾỀỂỄỆỈĨỊỎÕỌỐỒỔỖỘỚỜỞỠỢỦŨỤỨỪỬỮỰỲỶỸỴ]/;
const PINYIN_UNTONED_TOKEN_RE =
  /^(?:zh(?:ang|eng|ong|ou|uai|uan|uang|ui|un|uo|a|e|i|u)|ch(?:eng|ou|uai|uan|uang|uo)|sh(?:uang|uai|ui|uo)|q(?:iang|iao|iong|ian|ie|in|ing|iu|ue|un|i)|x(?:iang|iao|iong|ian|ie|ing|uan|ue|un)|j(?:iang|iao|iong|ian|ie|ing|iu|uan|ue|un|ichang)|yu(?:an|e|n)?|z(?:ai|ao|ei|en|eng|ong|ou|un|uo)|qicheng|yiyuan|weier|diannao|wangba|ceshi|rengong|tuling|shenme|women|nimen|tamen)$/i;
const PINYIN_SECOND_FOURTH_TONE_SYLLABLE_RE =
  /^(?:zh|sh|j|z|w|q(?=[iíì]))[a-z]*[áàéèíìóòúù][a-z]*$/i;

/**
 * Kiểm tra chuỗi có chứa ký tự chữ Hán hay không (FR-003, FR-010).
 */
export function containsHanChars(text?: string | null): boolean {
  if (typeof text !== 'string' || !text) return false;
  return HAN_CHAR_REGEX.test(text);
}

/**
 * Phát hiện chuỗi Bính âm tiếng Phổ thông (có dấu thanh Bính âm hoặc tổ hợp âm tiết Bính âm đặc trưng).
 * Tránh gắn nhầm trên tiếng Việt thuần (có dấu ă/â/đ/ê/ô/ơ/ư/hỏi/ngã/nặng) và tên phương Tây hợp lệ.
 */
export function detectMandarinPinyin(text?: string | null): boolean {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  if (STRICT_PINYIN_TONE_RE.test(trimmed)) {
    return true;
  }

  const tokens = trimmed.split(/[\s·•.,\-_'"/()]+/).filter(Boolean);
  for (const token of tokens) {
    if (VIETNAMESE_EXCLUSIVE_CHAR_RE.test(token)) {
      continue;
    }
    if (PINYIN_SECOND_FOURTH_TONE_SYLLABLE_RE.test(token)) {
      return true;
    }
    const bare = token.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (PINYIN_UNTONED_TOKEN_RE.test(bare)) {
      return true;
    }
  }

  return false;
}

/**
 * Chẩn đoán sức khỏe bộ từ điển hiện tại của truyện (FR-010).
 * Tái dùng `resolveGlossaryConflicts` để bảo đảm nhất quán 100% với luồng dịch.
 */
export function computeGlossaryHealth(glossary: GlossaryEntryLike[]): GlossaryHealthReport {
  if (!Array.isArray(glossary) || glossary.length === 0) {
    return {
      conflictGroupCount: 0,
      conflictItemIds: [],
      missingProfileCharIds: [],
      incompleteViIds: [],
      formatIssueIds: [],
      totalIssueItems: 0,
    };
  }

  const { conflicts } = resolveGlossaryConflicts(glossary);
  const conflictIdSet = new Set<string>();
  for (const c of conflicts) {
    if (c.winningItem.id) conflictIdSet.add(c.winningItem.id);
    for (const s of c.shadowedItems) {
      if (s.id) conflictIdSet.add(s.id);
    }
  }

  const missingProfileCharIds: string[] = [];
  const incompleteViIds: string[] = [];
  const formatIssueIds: string[] = [];

  for (const item of glossary) {
    if (!item || !item.id) continue;
    if (!item.vietnamese || !item.vietnamese.trim()) {
      incompleteViIds.push(item.id);
    }
    if (item.type === 'character') {
      const profile = normalizeCharacterProfile(item.characterProfile);
      const hasGender = profile?.gender === 'male' || profile?.gender === 'female' || profile?.gender === 'neutral';
      const hasNarrativePronoun = Boolean(profile?.defaultNarrativePronoun);
      if (!hasGender && !hasNarrativePronoun) {
        missingProfileCharIds.push(item.id);
      }
    }
    const hasReadingIssue = containsHanChars(item.pinyin) || detectMandarinPinyin(item.pinyin);
    const hasNoteHanLeak = containsHanChars(item.note);
    const hasPinyinInVietnamese =
      containsHanChars(item.chinese) &&
      (STRICT_PINYIN_TONE_RE.test((item.vietnamese || '').trim()) ||
        (hasReadingIssue && detectMandarinPinyin(item.vietnamese)));
    if (hasReadingIssue || hasNoteHanLeak || hasPinyinInVietnamese) {
      formatIssueIds.push(item.id);
    }
  }

  const unionIds = new Set<string>([
    ...conflictIdSet,
    ...missingProfileCharIds,
    ...incompleteViIds,
    ...formatIssueIds,
  ]);

  return {
    conflictGroupCount: conflicts.length,
    conflictItemIds: Array.from(conflictIdSet),
    missingProfileCharIds,
    incompleteViIds,
    formatIssueIds,
    totalIssueItems: unionIds.size,
  };
}

/**
 * Phân loại đồng nhất các thực thể mới AI phát hiện (`discoveredEntities`) cho cả luồng đơn chương
 * và dịch hàng loạt (FR-008, FR-009): lọc từ phổ thông nhiễu, tự động thêm thực thể mới hợp lệ
 * kèm gợi ý giới tính nhân vật từ ngữ cảnh rõ ràng, và đẩy các mục trùng hoặc nghi ngờ vào `pendingGlossary`
 * mà không bao giờ ghi đè mục sẵn có.
 */
export function classifyDiscoveredEntitiesForGlossary(params: {
  discoveredEntities: DiscoveredEntity[];
  existingGlossary: GlossaryItem[];
  sourceText: string;
  chapterTitle?: string;
  chapterId?: string;
  idPrefix?: string;
  defaultPinyinToVietnamese?: boolean;
}): ClassifiedDiscoveredEntitiesResult {
  const {
    discoveredEntities,
    existingGlossary,
    sourceText,
    chapterTitle,
    chapterId,
    idPrefix = 'auto',
    defaultPinyinToVietnamese = false,
  } = params;

  const newGlossaryItems: GlossaryItem[] = [];
  const newPendingItems: PendingGlossaryItem[] = [];

  if (!Array.isArray(discoveredEntities) || discoveredEntities.length === 0) {
    return { newGlossaryItems, newPendingItems };
  }

  const workingGlossary: GlossaryItem[] = [...(existingGlossary || [])];
  const sourceParagraphs = (sourceText || '').split('\n');
  const nowIso = new Date().toISOString();

  for (const ent of discoveredEntities) {
    if (!ent || typeof ent.chinese !== 'string') continue;
    const rawChinese = ent.chinese.trim();
    const cleanChinese = rawChinese.replace(/\s+/g, '').trim();
    if (!cleanChinese) continue;

    const cleanVietnamese = (typeof ent.vietnamese === 'string' ? ent.vietnamese : '').trim();
    const cleanPinyin = (typeof ent.pinyin === 'string' ? ent.pinyin : '').trim();
    const cleanNote = (typeof ent.note === 'string' ? ent.note : '').trim();
    const cleanType: GlossaryType = (ent.type || 'other') as GlossaryType;

    // Lọc từ phổ thông vô nghĩa / rác trước khi đưa vào từ điển chính (FR-008)
    if (isNoisyGlossaryTerm(cleanChinese, cleanType)) {
      continue;
    }

    const matchedByCn = workingGlossary.find((gItem) => isHanEquivalent(gItem.chinese, rawChinese));
    const matchedByVi =
      cleanVietnamese.length > 0
        ? workingGlossary.find(
            (gItem) => (gItem.vietnamese || '').trim().toLowerCase() === cleanVietnamese.toLowerCase()
          )
        : undefined;

    const originParagraph =
      sourceParagraphs
        .find((p) => p.includes(rawChinese) || p.replace(/\s+/g, '').includes(cleanChinese))
        ?.trim() || '';

    const suffix = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    if (!matchedByCn && !matchedByVi && !ent.needsReview) {
      const inferredGender =
        cleanType === 'character'
          ? inferCharacterGenderFromContext({
              chinese: cleanChinese,
              note: cleanNote,
              sourceParagraph: originParagraph,
            })
          : undefined;

      const itemPayload: GlossaryItem = {
        id: `glo_${idPrefix}_${suffix}`,
        chinese: cleanChinese,
        pinyin: cleanPinyin || (defaultPinyinToVietnamese ? cleanVietnamese : ''),
        vietnamese: cleanVietnamese,
        type: cleanType,
        note: cleanNote,
        ...(inferredGender ? { characterProfile: { gender: inferredGender } } : {}),
        ...(chapterTitle ? { sourceChapter: chapterTitle } : {}),
        ...(originParagraph || chapterTitle ? { sourceParagraph: originParagraph } : {}),
        ...(chapterId ? { sourceChapterId: chapterId } : {}),
        origin: 'scanned',
        createdAt: nowIso,
      };
      newGlossaryItems.push(itemPayload);
      workingGlossary.push(itemPayload);
    } else {
      let reason: PendingGlossaryItem['reason'] = 'Duplicate Chinese';
      let originalValue = '';

      if (ent.needsReview) {
        reason = 'AI trích xuất nghi ngờ hallucinate';
        originalValue = 'Không tìm thấy cụm từ này trong văn bản gốc của chương.';
      } else if (matchedByCn && matchedByVi) {
        reason = 'Duplicate Both';
        originalValue = `Trùng cả cụm: Gốc "${matchedByCn.chinese}" -> Nghĩa "${matchedByCn.vietnamese}"`;
      } else if (matchedByCn) {
        reason = 'Duplicate Chinese';
        originalValue = `Trùng chữ Trung gốc: "${matchedByCn.chinese}" đã dịch là "${matchedByCn.vietnamese}"`;
      } else if (matchedByVi) {
        reason = 'Duplicate Vietnamese';
        originalValue = `Trùng nghĩa dịch Việt: "${matchedByVi.vietnamese}" đã được dùng cho gốc "${matchedByVi.chinese}"`;
      }

      newPendingItems.push({
        id: `pend_${idPrefix}_${suffix}`,
        chinese: cleanChinese,
        pinyin: cleanPinyin,
        vietnamese: cleanVietnamese,
        type: cleanType,
        note: cleanNote,
        reason,
        originalValue,
        importedAt: nowIso,
        needsReview: Boolean(ent.needsReview),
        ...(chapterId ? { sourceChapterId: chapterId } : {}),
      });
    }
  }

  return { newGlossaryItems, newPendingItems };
}
