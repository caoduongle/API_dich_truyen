/**
 * Types for AI Chinese-Vietnamese Story Translator (Full Merged Version)
 * Combines: 2-phase AI translation + parallel line view + deduplication queue
 */

export type GlossaryType = 'character' | 'location' | 'term' | 'phrase' | 'other';

export interface GlossaryItem {
    id: string;
    chinese: string;      // Original Chinese characters, e.g. "萧炎"
    pinyin: string;       // Pinyin/Sino-Vietnamese equivalent, e.g. "Tiêu Viêm"
    vietnamese: string;   // Final polished Vietnamese translation or custom rename
    type: GlossaryType;   // Item category
    note: string;         // Explanation or role
    createdAt?: string;   // ISO timestamp
    sourceChapter?: string;
    sourceParagraph?: string;
    sourceChapterId?: string;
    origin?: 'guideline' | 'scanned' | 'manual';
    variants?: string[];  // Traditional/Simplified variants under canonicalization
    needsReview?: boolean;
}

/**
 * Pending glossary item — holds items flagged as duplicates during import/extraction.
 * User must review and confirm/discard before they enter the main glossary.
 */
export interface PendingGlossaryItem {
    id: string;
    chinese: string;
    pinyin: string;
    vietnamese: string;
    type: GlossaryType;
    note: string;
    reason: 'Duplicate Chinese' | 'Duplicate Vietnamese' | 'Duplicate Both' | 'AI trích xuất nghi ngờ hallucinate';
    originalValue?: string; // value of the duplicate already in the main glossary
    importedAt: string;
    needsReview?: boolean;
    sourceChapterId?: string;
}

export type ChapterStatus = 'not_started' | 'in_progress' | 'completed';

// Trạng thái đồng bộ giữa chương trong app và chương đã đăng trên ZumiNovel.
// 'never_published' = chưa từng đăng; 'synced' = bản trên Zumi khớp bản dịch mới nhất;
// 'out_of_date' = chương đã đăng nhưng bản dịch local đã sửa sau đó; 'error' = lần đăng/cập nhật gần nhất thất bại.
export type ZuminovelSyncStatus = 'never_published' | 'synced' | 'out_of_date' | 'error';

export interface ChapterMetadata {
    id: string;
    title: string;
    status: ChapterStatus;
    createdAt: string;
    updatedAt: string;
    zuminovelChapterId?: string;
    zuminovelSyncStatus?: ZuminovelSyncStatus;
    qaIssues?: Array<{
        type: 'omission' | 'addition' | 'repetition' | 'terminology' | 'other';
        severity: 'critical' | 'warning' | 'info';
        targetText: string;
        description: string;
    }>;
}

export interface Chapter {
    id: string;
    title: string;
    projectId?: string;           // Parent project ID for indexing
    // --- Full-chapter 2-phase translation (primary workflow) ---
    sourceText: string;           // Original Chinese text block

    processedSourceText?: string; // sourceText after glossary pre-replacement (used by auto-translator if set)
    rawTranslation: string;       // Phase 1: raw translation
    polishedTranslation: string;  // Phase 2: polished literary output
    // --- Parallel line-by-line view (secondary/export helper) ---
    paragraphs: string[];       // sourceText split into paragraphs
    translatedLines: string[];  // Matching Vietnamese for each paragraph
    status: ChapterStatus;
    createdAt: string;
    updatedAt: string;
    // --- ZumiNovel publish integration (optional, additive) ---
    zuminovelChapterId?: string;         // ID chương trên ZumiNovel sau lần đăng đầu tiên
    zuminovelSyncStatus?: ZuminovelSyncStatus;
    zuminovelPublishedAt?: string;       // ISO timestamp lần đăng/cập nhật thành công gần nhất
    // --- QA Critique results (optional, additive) ---
    qaIssues?: Array<{
        type: 'omission' | 'addition' | 'repetition' | 'terminology' | 'other';
        severity: 'critical' | 'warning' | 'info';
        targetText: string;
        description: string;
    }>;
}

export interface StoryProject {
    id: string;
    title: string;
    author: string;
    genre: string;        // e.g. Tiên Hiệp, Võ Hiệp, Ngôn Tình, Đô Thị, Khoa Huyễn, Huyền Huyễn
    tone: string;         // Translation tone
    description: string;
    additionalInstructions?: string; // Persistent custom instructions for polishing phase
    glossary: GlossaryItem[];
    pendingGlossary: PendingGlossaryItem[];  // Deduplication verification queue
    chapters: ChapterMetadata[];
    createdAt: string;
    updatedAt?: string;
    driveFolderId?: string;
    driveFileId?: string;
    driveStorageFormat?: 'monolithic' | 'granular' | 'bundle';
    // --- ZumiNovel publish integration (optional, additive) ---
    zuminovelNovelId?: string;       // ID truyện trên ZumiNovel sau khi liên kết
    zuminovelNovelSlug?: string;     // Slug truyện trên ZumiNovel (dùng khi gọi API)
    zuminovelNovelTitle?: string;    // Tên hiển thị cache lại từ lúc liên kết, chỉ để hiển thị UI
    isShared?: boolean;
    isOwner?: boolean;
    collaborators?: Array<{
        permissionId: string;
        emailAddress: string;
        displayName?: string;
        role: 'writer' | 'reader' | 'owner';
        photoLink?: string;
    }>;
    translationQueueState?: {
        queueIds: string[];
        currentIndex: number;
        mode: string;
        skipFailedChapters?: boolean;
        failedIds?: string[];
    };
    glossaryScanQueueState?: {
        failedIds?: string[];
        lastScanRange?: { start: number; end: number } | null;
    };
    ignoredDuplicatePairs?: string[];
}

// ---- API Request/Response types ----

export interface AnalyzeGlossaryRequest {
    text: string;
}

export interface AnalyzeGlossaryResponse {
    suggestions: Omit<GlossaryItem, 'id'>[];
}

export interface TranslateRawRequest {
    text: string;
    genre: string;
    tone: string;
    glossary: GlossaryItem[];
}

export interface TranslateRawResponse {
    rawTranslation: string;
    discoveredEntities: Omit<GlossaryItem, 'id'>[];
    isPartial?: boolean;
}

export interface PolishTranslationRequest {
    sourceText: string;
    rawTranslation: string;
    genre: string;
    tone: string;
    glossary: GlossaryItem[];
    additionalInstructions?: string;
}

export interface PolishTranslationResponse {
    polishedTranslation: string;
    newlyDiscoveredDuringPolish?: Omit<GlossaryItem, 'id'>[];
    isPartial?: boolean;
}