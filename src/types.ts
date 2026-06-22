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

export interface ChapterMetadata {
    id: string;
    title: string;
    status: ChapterStatus;
    createdAt: string;
    updatedAt: string;
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
}

export interface StoryProject {
    id: string;
    title: string;
    author: string;
    genre: string;        // e.g. Tiên Hiệp, Võ Hiệp, Ngôn Tình, Đô Thị, Khoa Huyễn, Huyền Huyễn
    tone: string;         // Translation tone
    description: string;
    glossary: GlossaryItem[];
    pendingGlossary: PendingGlossaryItem[];  // Deduplication verification queue
    chapters: ChapterMetadata[];
    createdAt: string;
    translationQueueState?: {
        queueIds: string[];
        currentIndex: number;
        mode: string;
        skipFailedChapters?: boolean;
        failedIds?: string[];
    };
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
}