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

export interface RelevantGlossarySelection<T extends GlossaryEntryLike = GlossaryItem> {
  /** Các mục từ điển thực sự xuất hiện trong văn bản nguồn + các mục được ghim (isPinned) */
  entries: T[];
  /** Các mục từ điển có xuất hiện trực tiếp trong văn bản nguồn (dùng cho kiểm tra tuân thủ) */
  matchedInSource: T[];
  /** Danh sách cảnh báo khi có nhiều mục trùng chữ Hán nhưng khác nghĩa Việt */
  conflicts: GlossaryConflictWarning<T>[];
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
 * Giải quyết xung đột khi có nhiều mục từ điển trùng cụm chữ Hán chuẩn hóa (FR-004).
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

  const resolved: T[] = [];
  const conflicts: GlossaryConflictWarning<T>[] = [];

  groups.forEach((group, canonicalChinese) => {
    if (group.length === 1) {
      resolved.push(group[0]);
      return;
    }

    const sorted = [...group].sort(compareGlossaryWinners);
    const winningItem = sorted[0];
    const shadowedItems = sorted.slice(1);
    resolved.push(winningItem);

    const winVi = (winningItem.vietnamese || '').trim().toLowerCase();
    const hasConflictingTranslation = shadowedItems.some(
      (s) => (s.vietnamese || '').trim().toLowerCase() !== winVi
    );
    if (hasConflictingTranslation) {
      conflicts.push({
        canonicalChinese,
        winningItem,
        shadowedItems,
      });
    }
  });

  return { resolved, conflicts };
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

/**
 * Phân loại đồng nhất các thực thể mới AI phát hiện (`discoveredEntities`) cho cả luồng đơn chương
 * và dịch hàng loạt (FR-021): tự động thêm thực thể mới không trùng vào từ điển, đẩy các mục nghi ngờ
 * hoặc trùng chữ Hán/nghĩa Việt vào hàng đợi `pendingGlossary`.
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
      const itemPayload: GlossaryItem = {
        id: `glo_${idPrefix}_${suffix}`,
        chinese: cleanChinese,
        pinyin: cleanPinyin || (defaultPinyinToVietnamese ? cleanVietnamese : ''),
        vietnamese: cleanVietnamese,
        type: cleanType,
        note: cleanNote,
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
