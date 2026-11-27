import { GlossaryItem, GlossaryType } from '../types';
import { canonicalizeHan } from '../lib/sinoNormalize';
import { normalizeCharacterProfile } from '../lib/glossaryMatch';

export type GlossaryExportFormat = 'md' | 'csv' | 'json';
export type GlossaryExportScope = 'all' | 'filtered';
export type DuplicateResolutionStrategy = 'review' | 'skip' | 'overwrite';
export type GlossaryImportMode = 'append' | 'replace_all';

export const MAX_GLOSSARY_IMPORT_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface GlossaryExportOptions {
  format: GlossaryExportFormat;
  scope?: GlossaryExportScope;
  projectName?: string;
}

export interface GlossaryImportParseResult {
  mode: 'direct' | 'ai';
  sourceFormat: 'md' | 'csv' | 'json' | 'txt';
  items: Omit<GlossaryItem, 'id'>[];
  skippedRows: number;
  warnings: string[];
}

export interface ImportConflictItem {
  item: GlossaryItem & { reason: string };
  conflictKind: 'system_chinese' | 'system_vietnamese' | 'file_duplicate';
  existingId?: string;
  existingItem?: GlossaryItem;
}

export interface GlossaryImportPreview {
  fileName: string;
  mode: 'direct' | 'ai';
  sourceFormat: 'md' | 'csv' | 'json' | 'txt';
  cleanItems: Omit<GlossaryItem, 'id'>[];
  conflicts: ImportConflictItem[];
  /** Toàn bộ mục hợp lệ sau khi khử trùng nội bộ tệp (dùng cho chế độ 'replace_all') */
  allValidItems?: Omit<GlossaryItem, 'id'>[];
  skippedRows: number;
  warnings: string[];
  rawTextForAiFallback?: string;
}

const VALID_GLOSSARY_TYPES: GlossaryType[] = ['character', 'location', 'term', 'phrase', 'other'];

const TYPE_ORDER: GlossaryType[] = ['character', 'location', 'term', 'phrase', 'other'];

const TYPE_LABELS: Record<GlossaryType, string> = {
  character: 'Nhân vật',
  location: 'Địa danh',
  term: 'Bí kíp / Vật phẩm',
  phrase: 'Thành ngữ / Cụm từ',
  other: 'Thuật ngữ khác',
};

const VALID_ORIGINS = new Set<NonNullable<GlossaryItem['origin']>>(['guideline', 'scanned', 'manual']);

/**
 * Format an ISO timestamp (or valid date string) to DD/MM/YYYY for Vietnamese display.
 * Returns '—' when missing or invalid.
 */
export function formatGlossaryCreatedDate(createdAt?: string): string {
  if (!createdAt || !createdAt.trim()) return '—';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Parse a date string from exported/imported glossary files into a normalized ISO string.
 * Supports ISO-8601, YYYY-MM-DD, and DD/MM/YYYY[ HH:mm[:ss]] deterministically.
 */
export function parseGlossaryCreatedDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '—' || trimmed === '--' || trimmed === '-') {
    return undefined;
  }

  // Deterministic DD/MM/YYYY or D/M/YYYY with optional HH:mm[:ss]
  const vnMatch = trimmed.match(
    /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (vnMatch) {
    const day = Number(vnMatch[1]);
    const month = Number(vnMatch[2]);
    const year = Number(vnMatch[3]);
    const hour = vnMatch[4] ? Number(vnMatch[4]) : 0;
    const minute = vnMatch[5] ? Number(vnMatch[5]) : 0;
    const second = vnMatch[6] ? Number(vnMatch[6]) : 0;

    if (
      month < 1 || month > 12 ||
      day < 1 || day > 31 ||
      hour > 23 || minute > 59 || second > 59
    ) {
      return undefined;
    }

    const candidate = new Date(year, month - 1, day, hour, minute, second);
    if (
      candidate.getFullYear() !== year ||
      candidate.getMonth() !== month - 1 ||
      candidate.getDate() !== day
    ) {
      return undefined;
    }
    return candidate.toISOString();
  }

  // ISO-8601 or YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return undefined;
}

function normalizeGlossaryType(raw?: string, fallback: GlossaryType = 'other'): GlossaryType {
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if ((VALID_GLOSSARY_TYPES as string[]).includes(normalized)) {
    return normalized as GlossaryType;
  }
  if (normalized.includes('nhân vật') || normalized.includes('character')) return 'character';
  if (normalized.includes('địa danh') || normalized.includes('location')) return 'location';
  if (normalized.includes('bí kíp') || normalized.includes('vật phẩm') || normalized.includes('term')) return 'term';
  if (normalized.includes('thành ngữ') || normalized.includes('cụm từ') || normalized.includes('phrase')) return 'phrase';
  if (normalized.includes('thuật ngữ') || normalized.includes('khác') || normalized.includes('other')) return 'other';
  return fallback;
}

function buildExportFilename(format: GlossaryExportFormat, projectName?: string): string {
  const slug = (projectName || '')
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const base = slug ? `tu-dien-${slug}-${datePart}` : `tu-dien-du-an-${datePart}`;
  return `${base}.${format}`;
}

function escapeMdCell(value: string): string {
  return (value || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

function sanitizeCsvCell(value: string): string {
  const str = value ?? '';
  // Guard against CSV formula injection (CWE-1236)
  const neutralized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\r\n]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

function unsanitizeCsvFormulaPrefix(value: string): string {
  if (value.length >= 2 && value.startsWith("'") && /^[=+\-@\t\r]/.test(value[1])) {
    return value.slice(1);
  }
  return value;
}

/**
 * Serialize glossary items to Markdown (.md) with the "Ngày thêm" column.
 */
export function serializeGlossaryToMd(
  items: GlossaryItem[],
  options: Omit<GlossaryExportOptions, 'format'> = {}
): string {
  const grouped: Record<GlossaryType, GlossaryItem[]> = {
    character: [],
    location: [],
    term: [],
    phrase: [],
    other: [],
  };

  items.forEach((item) => {
    const bucket = grouped[item.type] ? item.type : 'other';
    grouped[bucket].push(item);
  });

  const now = new Date().toLocaleString('vi-VN');
  const lines: string[] = [];

  lines.push(options.projectName ? `# Từ Điển Dự Án: ${options.projectName}` : '# Từ Điển Dự Án');
  lines.push('');
  lines.push(`> Xuất tự động lúc: **${now}**`);
  lines.push(`> Tổng số thuật ngữ: **${items.length}**`);
  lines.push('');
  lines.push('---');
  lines.push('');

  TYPE_ORDER.forEach((type) => {
    const groupItems = grouped[type];
    if (groupItems.length === 0) return;

    lines.push(`## ${TYPE_LABELS[type]} (${groupItems.length})`);
    lines.push('');
    lines.push('| Tiếng Trung | Phiên âm | Tiếng Việt | Ghi chú | Ngày thêm |');
    lines.push('|-------------|----------|------------|---------|-----------|');

    groupItems.forEach((item) => {
      const dateLabel = formatGlossaryCreatedDate(item.createdAt);
      lines.push(
        `| ${escapeMdCell(item.chinese)} | ${escapeMdCell(item.pinyin)} | ${escapeMdCell(item.vietnamese)} | ${escapeMdCell(item.note)} | ${dateLabel} |`
      );
    });
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Serialize glossary items to UTF-8 BOM CSV with formula-injection protection.
 */
export function serializeGlossaryToCsv(items: GlossaryItem[]): string {
  const headers = ['Tiếng Trung', 'Phiên âm', 'Tiếng Việt', 'Loại', 'Ghi chú', 'Biến thể', 'Ngày thêm'];
  const rows = [headers.map(sanitizeCsvCell).join(',')];

  items.forEach((item) => {
    const dateLabel = item.createdAt ? formatGlossaryCreatedDate(item.createdAt) : '';
    const cleanDate = dateLabel === '—' ? '' : dateLabel;
    const variantsText = Array.isArray(item.variants) ? item.variants.join('; ') : '';
    rows.push(
      [
        item.chinese,
        item.pinyin,
        item.vietnamese,
        TYPE_LABELS[item.type] || item.type,
        item.note,
        variantsText,
        cleanDate,
      ]
        .map((cell) => sanitizeCsvCell(cell || ''))
        .join(',')
    );
  });

  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Serialize glossary items to lossless JSON export envelope.
 */
export function serializeGlossaryToJson(
  items: GlossaryItem[],
  options: Omit<GlossaryExportOptions, 'format'> = {}
): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      ...(options.projectName ? { projectName: options.projectName } : {}),
      total: items.length,
      items,
    },
    null,
    2
  );
}

/**
 * Unified glossary export serializer returning file content, MIME type, and suggested filename.
 */
export function serializeGlossary(
  items: GlossaryItem[],
  options: GlossaryExportOptions
): { content: string; mimeType: string; filename: string } {
  const filename = buildExportFilename(options.format, options.projectName);
  if (options.format === 'csv') {
    return {
      content: serializeGlossaryToCsv(items),
      mimeType: 'text/csv;charset=utf-8',
      filename,
    };
  }
  if (options.format === 'json') {
    return {
      content: serializeGlossaryToJson(items, options),
      mimeType: 'application/json;charset=utf-8',
      filename,
    };
  }
  return {
    content: serializeGlossaryToMd(items, options),
    mimeType: 'text/markdown;charset=utf-8',
    filename,
  };
}

function splitMarkdownRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|') && !trimmed.endsWith('\\|')) trimmed = trimmed.slice(0, -1);

  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '\\' && trimmed[i + 1] === '|') {
      current += '|';
      i++;
      continue;
    }
    if (ch === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function isMarkdownSeparatorRow(line: string): boolean {
  const cells = splitMarkdownRow(line);
  return cells.length >= 2 && cells.every((cell) => /^:?-{2,}:?$/.test(cell.trim()));
}

type ColumnKey = 'chinese' | 'pinyin' | 'vietnamese' | 'type' | 'note' | 'variants' | 'createdAt';

function mapHeaderToColumnKey(header: string): ColumnKey | null {
  const h = header.trim().toLowerCase();
  if (!h) return null;
  if (h.includes('tiếng trung') || h.includes('chữ hán') || h.includes('từ gốc') || h === 'chinese' || h === 'hanzi') {
    return 'chinese';
  }
  if (h.includes('phiên âm') || h.includes('hán việt') || h === 'pinyin') {
    return 'pinyin';
  }
  if (h.includes('tiếng việt') || h.includes('nghĩa') || h.includes('dịch') || h === 'vietnamese') {
    return 'vietnamese';
  }
  if (h === 'loại' || h === 'phân loại' || h === 'nhóm' || h === 'type' || h === 'category') {
    return 'type';
  }
  if (h.includes('ghi chú') || h.includes('mô tả') || h === 'note' || h === 'notes') {
    return 'note';
  }
  if (h.includes('biến thể') || h === 'variants') {
    return 'variants';
  }
  if (h.includes('ngày thêm') || h.includes('ngày tạo') || h === 'created' || h === 'createdat' || h === 'date') {
    return 'createdAt';
  }
  return null;
}

function buildSafeImportedItem(raw: {
  chinese: string;
  pinyin?: string;
  vietnamese: string;
  type?: GlossaryType;
  note?: string;
  variants?: string[];
  createdAt?: string;
  origin?: GlossaryItem['origin'];
  isPinned?: boolean;
  characterProfile?: unknown;
}): Omit<GlossaryItem, 'id'> | null {
  const chinese = raw.chinese.trim();
  const vietnamese = raw.vietnamese.trim();
  if (!chinese || !vietnamese) return null;

  const item: Omit<GlossaryItem, 'id'> = {
    chinese,
    pinyin: raw.pinyin?.trim() || vietnamese,
    vietnamese,
    type: raw.type || 'other',
    note: raw.note?.trim() || '',
    origin: raw.origin && VALID_ORIGINS.has(raw.origin) ? raw.origin : 'guideline',
    ...(raw.createdAt ? { createdAt: raw.createdAt } : {}),
    ...(raw.variants && raw.variants.length > 0 ? { variants: raw.variants } : {}),
    ...(raw.isPinned ? { isPinned: true } : {}),
  };

  if (raw.characterProfile && typeof raw.characterProfile === 'object') {
    item.characterProfile = normalizeCharacterProfile(raw.characterProfile as GlossaryItem['characterProfile']);
  }

  return item;
}

/**
 * Parse Markdown text for structured glossary tables.
 * Returns null if no valid glossary table is found (so caller can fall back to AI extraction).
 */
export function parseMarkdownGlossaryTables(mdText: string): GlossaryImportParseResult | null {
  const lines = mdText.split(/\r?\n/);
  const items: Omit<GlossaryItem, 'id'>[] = [];
  let skippedRows = 0;
  let foundValidTable = false;
  let currentSectionType: GlossaryType = 'other';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (/^#{1,6}\s+/.test(line)) {
      const headingText = line.replace(/^#{1,6}\s+/, '').trim();
      currentSectionType = normalizeGlossaryType(headingText, 'other');
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && isMarkdownSeparatorRow(lines[i + 1])) {
      const headers = splitMarkdownRow(line);
      const colMap = headers.map(mapHeaderToColumnKey);
      const hasChinese = colMap.includes('chinese');
      const hasVietnamese = colMap.includes('vietnamese');

      if (!hasChinese || !hasVietnamese) {
        continue;
      }

      foundValidTable = true;
      i += 2; // Skip header & separator

      while (i < lines.length) {
        const rowLine = lines[i].trim();
        if (!rowLine || !rowLine.includes('|')) {
          i--; // Re-evaluate non-table line in outer loop
          break;
        }
        const cells = splitMarkdownRow(rowLine);
        const record: Partial<Record<ColumnKey, string>> = {};
        colMap.forEach((key, idx) => {
          if (key && idx < cells.length) {
            record[key] = cells[idx];
          }
        });

        const parsedDate = parseGlossaryCreatedDate(record.createdAt);
        const variants = record.variants
          ? record.variants.split(/[;,]/).map((v) => v.trim()).filter(Boolean)
          : undefined;

        const built = buildSafeImportedItem({
          chinese: record.chinese || '',
          pinyin: record.pinyin,
          vietnamese: record.vietnamese || '',
          type: normalizeGlossaryType(record.type, currentSectionType),
          note: record.note,
          variants,
          createdAt: parsedDate,
        });

        if (built) {
          items.push(built);
        } else {
          skippedRows++;
        }
        i++;
      }
    }
  }

  if (!foundValidTable) {
    return null;
  }

  return {
    mode: 'direct',
    sourceFormat: 'md',
    items,
    skippedRows,
    warnings: [],
  };
}

function parseCsvRows(text: string, delimiter: string): string[][] {
  const cleanText = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (cleanText[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\r') {
      if (cleanText[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function detectCsvDelimiter(text: string): ',' | ';' {
  const firstLine = (text.split(/\r?\n/)[0] || '').replace(/^\uFEFF/, '');
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  return semiCount > commaCount ? ';' : ',';
}

/**
 * Parse CSV glossary content (UTF-8 BOM, ',' or ';', RFC 4180 quotes).
 */
export function parseCsvGlossaryFile(csvText: string): GlossaryImportParseResult {
  const delimiter = detectCsvDelimiter(csvText);
  const rows = parseCsvRows(csvText, delimiter);
  if (rows.length < 2) {
    throw new Error('Tệp CSV không có dữ liệu hoặc thiếu dòng tiêu đề.');
  }

  const colMap = rows[0].map(mapHeaderToColumnKey);
  if (!colMap.includes('chinese') || !colMap.includes('vietnamese')) {
    throw new Error('Tệp CSV cần có ít nhất hai cột "Tiếng Trung" và "Tiếng Việt".');
  }

  const items: Omit<GlossaryItem, 'id'>[] = [];
  let skippedRows = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const record: Partial<Record<ColumnKey, string>> = {};
    colMap.forEach((key, idx) => {
      if (key && idx < row.length) {
        record[key] = unsanitizeCsvFormulaPrefix(row[idx]);
      }
    });

    const variants = record.variants
      ? record.variants.split(/[;,]/).map((v) => v.trim()).filter(Boolean)
      : undefined;

    const built = buildSafeImportedItem({
      chinese: record.chinese || '',
      pinyin: record.pinyin,
      vietnamese: record.vietnamese || '',
      type: normalizeGlossaryType(record.type, 'other'),
      note: record.note,
      variants,
      createdAt: parseGlossaryCreatedDate(record.createdAt),
    });

    if (built) {
      items.push(built);
    } else {
      skippedRows++;
    }
  }

  return {
    mode: 'direct',
    sourceFormat: 'csv',
    items,
    skippedRows,
    warnings: [],
  };
}

/**
 * Parse JSON glossary content with explicit field whitelisting against prototype pollution.
 */
export function parseJsonGlossaryFile(jsonText: string): GlossaryImportParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Tệp JSON không hợp lệ hoặc bị lỗi cú pháp.');
  }

  let rawArray: unknown[] | null = null;
  if (Array.isArray(parsed)) {
    rawArray = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.items)) rawArray = obj.items;
    else if (Array.isArray(obj.glossary)) rawArray = obj.glossary;
  }

  if (!rawArray) {
    throw new Error('Tệp JSON không đúng cấu trúc từ điển (cần mảng hoặc trường "items" / "glossary").');
  }

  const items: Omit<GlossaryItem, 'id'>[] = [];
  let skippedRows = 0;

  rawArray.forEach((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      skippedRows++;
      return;
    }
    const rec = entry as Record<string, unknown>;
    const chinese = typeof rec.chinese === 'string' ? rec.chinese : '';
    const vietnamese = typeof rec.vietnamese === 'string' ? rec.vietnamese : '';
    const pinyin = typeof rec.pinyin === 'string' ? rec.pinyin : undefined;
    const note = typeof rec.note === 'string' ? rec.note : undefined;
    const type = typeof rec.type === 'string' ? normalizeGlossaryType(rec.type, 'other') : 'other';
    const createdAt = typeof rec.createdAt === 'string' ? parseGlossaryCreatedDate(rec.createdAt) : undefined;
    const origin =
      typeof rec.origin === 'string' && VALID_ORIGINS.has(rec.origin as NonNullable<GlossaryItem['origin']>)
        ? (rec.origin as GlossaryItem['origin'])
        : 'guideline';
    const isPinned = typeof rec.isPinned === 'boolean' ? rec.isPinned : undefined;
    const variants = Array.isArray(rec.variants)
      ? rec.variants.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim())
      : undefined;

    const built = buildSafeImportedItem({
      chinese,
      pinyin,
      vietnamese,
      type,
      note,
      variants,
      createdAt,
      origin,
      isPinned,
      characterProfile: rec.characterProfile,
    });

    if (built) {
      items.push(built);
    } else {
      skippedRows++;
    }
  });

  return {
    mode: 'direct',
    sourceFormat: 'json',
    items,
    skippedRows,
    warnings: [],
  };
}

/**
 * Parse a structured glossary file (.json, .csv, or structured .md/.txt).
 * Returns null for unstructured .md/.txt prose so the caller can fall back to AI extraction.
 */
export function parseStructuredGlossaryFile(content: string, fileName: string): GlossaryImportParseResult | null {
  const ext = fileName.split('.').pop()?.trim().toLowerCase() || '';
  if (ext === 'json') {
    return parseJsonGlossaryFile(content);
  }
  if (ext === 'csv') {
    return parseCsvGlossaryFile(content);
  }
  if (ext === 'md' || ext === 'markdown' || ext === 'txt') {
    const mdResult = parseMarkdownGlossaryTables(content);
    if (mdResult) {
      return {
        ...mdResult,
        sourceFormat: ext === 'txt' ? 'txt' : 'md',
      };
    }
    return null;
  }
  throw new Error('Định dạng tệp chưa được hỗ trợ. Vui lòng chọn tệp .md, .txt, .csv hoặc .json.');
}

/**
 * Compare parsed import items against existing glossary and internal file entries.
 * Identifies clean additions vs conflicts with existingId for overwrite support.
 */
export function analyzeGlossaryImportConflicts(
  parsedItems: Omit<GlossaryItem, 'id'>[],
  existingGlossary: GlossaryItem[]
): { cleanItems: Omit<GlossaryItem, 'id'>[]; conflicts: ImportConflictItem[] } {
  const cleanItems: Omit<GlossaryItem, 'id'>[] = [];
  const conflicts: ImportConflictItem[] = [];

  const toCanonChKey = (text: string) => canonicalizeHan(text.trim()).replace(/\s+/g, '');

  const systemCnMap = new Map<string, GlossaryItem>();
  const systemViMap = new Map<string, GlossaryItem>();
  existingGlossary.forEach((g) => {
    const chKey = toCanonChKey(g.chinese);
    if (chKey && !systemCnMap.has(chKey)) systemCnMap.set(chKey, g);
    const viKey = g.vietnamese.trim().toLowerCase();
    if (viKey && !systemViMap.has(viKey)) systemViMap.set(viKey, g);
  });

  const fileCh = new Map<string, Omit<GlossaryItem, 'id'>>();
  const fileVi = new Map<string, Omit<GlossaryItem, 'id'>>();

  parsedItems.forEach((item, idx) => {
    const chinese = item.chinese?.trim();
    const vietnamese = item.vietnamese?.trim();
    if (!chinese || !vietnamese) return;

    const cleanChKey = toCanonChKey(chinese);
    const cleanViKey = vietnamese.toLowerCase();

    const systemCnMatch = systemCnMap.get(cleanChKey);
    const systemViMatch = systemViMap.get(cleanViKey);
    const fileChMatch = fileCh.has(cleanChKey);
    const fileViMatch = fileVi.has(cleanViKey);

    let conflictKind: ImportConflictItem['conflictKind'] | null = null;
    let reason = '';
    let existingItem: GlossaryItem | undefined;

    if (systemCnMatch) {
      conflictKind = 'system_chinese';
      existingItem = systemCnMatch;
      reason = `Trùng từ điển: Chữ gốc '${chinese}' đã có bản dịch là '${systemCnMatch.vietnamese}'.`;
    } else if (systemViMatch) {
      conflictKind = 'system_vietnamese';
      existingItem = systemViMatch;
      reason = `Trùng định nghĩa: Nghĩa Việt '${vietnamese}' đã được gán cho từ gốc '${systemViMatch.chinese}'.`;
    } else if (fileChMatch) {
      conflictKind = 'file_duplicate';
      reason = `Lặp nội bộ tệp: Chữ Trung '${chinese}' xuất hiện nhiều lần trong tệp nhập.`;
    } else if (fileViMatch) {
      conflictKind = 'file_duplicate';
      reason = `Trùng nội bộ tệp: Nghĩa tiếng Việt '${vietnamese}' bị gán trùng lặp trong tệp nhập.`;
    }

    const normalizedItem: Omit<GlossaryItem, 'id'> = {
      ...item,
      chinese,
      pinyin: item.pinyin?.trim() || vietnamese,
      vietnamese,
      type: item.type || 'character',
      note: item.note?.trim() || '',
      origin: item.origin || 'guideline',
      createdAt: item.createdAt || new Date().toISOString(),
    };

    if (conflictKind) {
      conflicts.push({
        conflictKind,
        existingId: existingItem?.id,
        existingItem,
        item: {
          ...normalizedItem,
          id: `glo_md_review_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          reason,
        },
      });
    } else {
      fileCh.set(cleanChKey, normalizedItem);
      fileVi.set(cleanViKey, normalizedItem);
      cleanItems.push(normalizedItem);
    }
  });

  return { cleanItems, conflicts };
}

export interface GuidelineStagedGlossaryAction {
  mode: 'replace' | 'merge';
  items: Omit<GlossaryItem, 'id'>[];
  fileName?: string;
}

/**
 * Khử trùng lặp nội bộ tệp và chuẩn hóa an toàn danh sách thuật ngữ hợp lệ (dùng cho chế độ replace_all).
 * Luôn đi qua buildSafeImportedItem để phòng chống prototype pollution và chuẩn hóa characterProfile.
 */
export function prepareFileDeduplicatedItems(
  parsedItems: Omit<GlossaryItem, 'id'>[]
): Omit<GlossaryItem, 'id'>[] {
  if (!Array.isArray(parsedItems) || parsedItems.length === 0) return [];
  const safeItems: Omit<GlossaryItem, 'id'>[] = [];
  for (const raw of parsedItems) {
    if (!raw || typeof raw !== 'object') continue;
    const built = buildSafeImportedItem({
      chinese: typeof raw.chinese === 'string' ? raw.chinese : '',
      pinyin: typeof raw.pinyin === 'string' ? raw.pinyin : undefined,
      vietnamese: typeof raw.vietnamese === 'string' ? raw.vietnamese : '',
      type: normalizeGlossaryType(typeof raw.type === 'string' ? raw.type : undefined, 'other'),
      note: typeof raw.note === 'string' ? raw.note : undefined,
      variants: Array.isArray(raw.variants)
        ? raw.variants.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim())
        : undefined,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
      origin: raw.origin,
      isPinned: typeof raw.isPinned === 'boolean' ? raw.isPinned : undefined,
      characterProfile: raw.characterProfile,
    });
    if (built) safeItems.push(built);
  }
  const { cleanItems } = analyzeGlossaryImportConflicts(safeItems, []);
  return cleanItems;
}

/**
 * Hợp nhất hoặc thay thế danh sách thuật ngữ trích xuất từ cẩm nang vào từ điển hiện tại của dự án,
 * giữ nguyên hồ sơ nhân vật và bản dịch đã chỉnh sửa ở chế độ merge.
 */
export function mergeImportedGlossaryForProject(
  existingGlossary: GlossaryItem[],
  incomingItems: Omit<GlossaryItem, 'id'>[],
  mode: 'replace' | 'merge'
): GlossaryItem[] {
  if (!Array.isArray(incomingItems) || incomingItems.length === 0) {
    return existingGlossary;
  }

  const nowBase = Date.now();
  const baseList = mode === 'replace' ? [] : existingGlossary;
  const { cleanItems } = analyzeGlossaryImportConflicts(incomingItems, baseList);
  const newItems: GlossaryItem[] = cleanItems.map((item, idx) => ({
    ...item,
    id: `glo_md_${nowBase}_${idx}`,
    origin: item.origin || 'guideline',
    createdAt: item.createdAt || new Date().toISOString(),
  }));

  return mode === 'replace' ? newItems : [...existingGlossary, ...newItems];
}
