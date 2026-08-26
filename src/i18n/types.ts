export type SupportedLocale = 'vi' | 'en' | 'zh';

export interface LocaleDefinition {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LOCALES: LocaleDefinition[] = [
  { code: 'vi', name: 'Tiếng Việt', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
];

export type TranslationSchema = {
  common: {
    appTitle: string;
    appSubtitle: string;
    loading: string;
    save: string;
    saving: string;
    saved: string;
    cancel: string;
    delete: string;
    edit: string;
    create: string;
    close: string;
    copy: string;
    copied: string;
    download: string;
    confirm: string;
    actions: string;
    search: string;
    filter: string;
    all: string;
    status: string;
    system: string;
    keys: string;
    error: string;
    success: string;
    warning: string;
  };
  nav: {
    translate: string;
    autoTranslate: string;
    glossary: string;
    history: string;
    projects: string;
    aiConfig: string;
    currentBook: string;
    hakoChecker: string;
  };
  workspace: {
    stage1Title: string;
    stage2Title: string;
    rawDraft: string;
    polishedEdit: string;
    sourcePlaceholder: string;
    restoreOriginal: string;
    applyGlossary: string;
    applyingGlossary: string;
    cleanText: string;
    findCharacters: string;
    findingCharacters: string;
    translateRawBtn: string;
    translatingBtn: string;
    polishBtn: string;
    polishingBtn: string;
    saveChapterBtn: string;
    charCount: string;
    mismatchWarning: string;
  };
  projects: {
    title: string;
    createBtn: string;
    noProjects: string;
    chaptersCount: string;
    glossaryCount: string;
    deleteConfirm: string;
  };
  glossary: {
    title: string;
    term: string;
    translation: string;
    category: string;
    notes: string;
    addTerm: string;
    importExport: string;
    pendingCount: string;
  };
};
