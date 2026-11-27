import { useState, useMemo, useRef, useEffect } from 'react';
import {
  AlertTriangle,
  BookMarked,
  Download,
  FileCode2,
  ListChecks,
  Loader2,
  RotateCcw,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  CUSTOM_GENRE_OPTION_VALUE,
  CUSTOM_TONE_OPTION_VALUE,
  GENRE_GROUPS,
  GENRE_PROFILES,
  GUIDELINE_SECTION_HEADINGS,
  MAX_CUSTOM_STYLE_LENGTH,
  StructuredGuidelineSections,
  TONE_PROFILES,
  detectStyleConflicts,
  formatGuidelinesMarkdownExport,
  getGenreProfile,
  getGenreStarterTemplateText,
  getRecommendedTonesForGenre,
  getToneProfile,
  hasStructuredGuidelineHeadings,
  isBuiltInGenre,
  isBuiltInTone,
  parseStructuredGuidelines,
  sanitizeExportFileNameBase,
  serializeStructuredGuidelines,
} from '../../config/translationStyles';
import { analyzeGuidelinesDirect } from '../../services/directGlossaryEngine';
import type { GuidelineStagedGlossaryAction } from '../../services/glossaryIO';
import { validateGuidelinesUploadFile } from '../../utils/fileValidator';
import { triggerDownload } from '../../utils/download';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { GenreMark } from '../ui/GenreMark';
import {
  GuidelineImportPreview,
  GuidelineImportPreviewData,
  GuidelineImportSelection,
} from './GuidelineImportPreview';

export type { GuidelineStagedGlossaryAction };

export interface StyleGuidelineEditorProps {
  genre: string;
  onGenreChange: (value: string) => void;
  tone: string;
  onToneChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  projectTitle?: string;
  existingGlossaryCount?: number;
  stagedGlossaryAction?: GuidelineStagedGlossaryAction | null;
  onStageGlossaryAction?: (action: GuidelineStagedGlossaryAction | null) => void;
  genreError?: string | null;
  toneError?: string | null;
  apiKeys?: string[];
  selectedModel?: string;
  showToast?: (opts: { message: string; type: 'success' | 'warning' | 'error' | 'info' }) => void;
  idPrefix?: string;
}

const STRUCTURED_FIELDS: Array<{
  key: Exclude<keyof StructuredGuidelineSections, 'extraNotes'>;
  label: string;
  placeholder: string;
  rows: number;
}> = [
  {
    key: 'contextSummary',
    label: 'Bối cảnh & Tóm tắt cốt truyện',
    placeholder: 'Tóm tắt thế giới quan, thời đại, bối cảnh chung của tác phẩm...',
    rows: 2,
  },
  {
    key: 'pronounRules',
    label: 'Quy tắc xưng hô mặc định',
    placeholder: 'Ví dụ: Đồng đạo xưng ta - các hạ; huynh đệ sư môn; tình cảm dùng chàng - nàng hoặc anh - em...',
    rows: 2,
  },
  {
    key: 'hanVietPolicy',
    label: 'Mức độ Hán-Việt / Thuần Việt',
    placeholder: 'Ví dụ: Cảnh giới/chiêu thức giữ Hán-Việt; tự sự và hội thoại ưu tiên thuần Việt tự nhiên...',
    rows: 2,
  },
  {
    key: 'titlesAndForeignNames',
    label: 'Danh xưng, Cấp bậc & Tên ngoại lai',
    placeholder: 'Ví dụ: Khôi phục tên tiếng Anh gốc cho tên phương Tây; thống nhất cấp bậc tông môn/quan chức...',
    rows: 2,
  },
  {
    key: 'avoidRules',
    label: 'Điều cần tránh / Cấm kỵ',
    placeholder: 'Ví dụ: Tránh từ lóng hiện đại, không gộp thoại vào tự sự, không để sót chữ convert...',
    rows: 2,
  },
];

export function StyleGuidelineEditor({
  genre,
  onGenreChange,
  tone,
  onToneChange,
  description,
  onDescriptionChange,
  projectTitle,
  existingGlossaryCount = 0,
  stagedGlossaryAction,
  onStageGlossaryAction,
  genreError,
  toneError,
  apiKeys = [],
  selectedModel,
  showToast,
  idPrefix = 'style',
}: StyleGuidelineEditorProps) {
  const [isCustomGenreMode, setIsCustomGenreMode] = useState<boolean>(
    Boolean(genre.trim() && !isBuiltInGenre(genre))
  );
  const [isCustomToneMode, setIsCustomToneMode] = useState<boolean>(
    Boolean(tone.trim() && !isBuiltInTone(tone))
  );
  const [editorMode, setEditorMode] = useState<'structured' | 'raw'>(() =>
    hasStructuredGuidelineHeadings(description) || !description.trim() ? 'structured' : 'raw'
  );
  const [templateConfirmOpen, setTemplateConfirmOpen] = useState(false);
  const [isAnalyzingMd, setIsAnalyzingMd] = useState(false);
  const [importPreview, setImportPreview] = useState<GuidelineImportPreviewData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const mdInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const trimmed = genre.trim();
    if (trimmed && !isBuiltInGenre(trimmed)) {
      setIsCustomGenreMode(true);
    }
  }, [genre]);

  useEffect(() => {
    const trimmed = tone.trim();
    if (trimmed && !isBuiltInTone(trimmed)) {
      setIsCustomToneMode(true);
    }
  }, [tone]);

  const activeGenreProfile = useMemo(() => getGenreProfile(genre), [genre]);
  const activeToneProfile = useMemo(() => getToneProfile(tone), [tone]);
  const recommendedToneIds = useMemo(() => getRecommendedTonesForGenre(genre), [genre]);
  const structuredSections = useMemo(() => parseStructuredGuidelines(description), [description]);
  const conflicts = useMemo(
    () => detectStyleConflicts({ genre, tone, description }),
    [genre, tone, description]
  );

  const genreSelectValue = isCustomGenreMode
    ? CUSTOM_GENRE_OPTION_VALUE
    : activeGenreProfile?.id || (genre.trim() ? CUSTOM_GENRE_OPTION_VALUE : 'Tiên Hiệp');

  const toneSelectValue = isCustomToneMode
    ? CUSTOM_TONE_OPTION_VALUE
    : activeToneProfile?.id || (tone.trim() ? CUSTOM_TONE_OPTION_VALUE : 'Dịch thuần Việt mượt mà');

  const handleGenreSelectChange = (val: string) => {
    if (val === CUSTOM_GENRE_OPTION_VALUE) {
      setIsCustomGenreMode(true);
      if (isBuiltInGenre(genre)) {
        onGenreChange('');
      }
      return;
    }
    setIsCustomGenreMode(false);
    onGenreChange(val);
  };

  const handleToneSelectChange = (val: string) => {
    if (val === CUSTOM_TONE_OPTION_VALUE) {
      setIsCustomToneMode(true);
      if (isBuiltInTone(tone)) {
        onToneChange('');
      }
      return;
    }
    setIsCustomToneMode(false);
    onToneChange(val);
  };

  const handleStructuredFieldChange = (
    key: Exclude<keyof StructuredGuidelineSections, 'extraNotes'>,
    value: string
  ) => {
    const next: StructuredGuidelineSections = {
      ...structuredSections,
      [key]: value,
    };
    onDescriptionChange(serializeStructuredGuidelines(next));
  };

  const applyStarterTemplate = (mode: 'replace' | 'append') => {
    const templateText = getGenreStarterTemplateText(genre || 'Tiên Hiệp');
    if (mode === 'append' && description.trim()) {
      onDescriptionChange(`${description.trim()}\n\n${templateText}`);
    } else {
      onDescriptionChange(templateText);
    }
    setEditorMode('structured');
    setTemplateConfirmOpen(false);
    showToast?.({
      message: `Đã chèn mẫu cẩm nang cho thể loại "${genre.trim() || 'Tiên Hiệp'}".`,
      type: 'success',
    });
  };

  const handleInsertTemplateClick = () => {
    if (!description.trim()) {
      applyStarterTemplate('replace');
    } else {
      setTemplateConfirmOpen((prev) => !prev);
    }
  };

  const handleGuidelineFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportPreview(null);
    setIsAnalyzingMd(true);

    try {
      validateGuidelinesUploadFile(file);
      const mdText = await file.text();
      if (!mdText.trim()) {
        throw new Error('Tệp cẩm nang không chứa nội dung.');
      }

      const data = await analyzeGuidelinesDirect({
        text: mdText,
        apiKeys,
        model: selectedModel,
      });

      const warnings: string[] = [];
      if (data.analysisMode === 'local_fallback') {
        warnings.push(
          'Đang dùng bộ trích xuất cấu trúc Markdown cục bộ (không gọi AI do chưa có API Key hoặc kết nối AI tạm gián đoạn).'
        );
      }
      if (data.truncated) {
        warnings.push(
          `Phần văn xuôi quy tắc dài (${(data.proseLength || data.originalLength || 0).toLocaleString()} ký tự); đã giữ trọn phần mở đầu và phần kết thúc (${(data.analyzedLength || 0).toLocaleString()} ký tự). Từ điển vẫn được bóc tách đầy đủ 100%.`
        );
      }

      setImportPreview({
        fileName: file.name,
        analysisMode: data.analysisMode || 'ai',
        genre: data.genre || '',
        tone: data.tone || '',
        description: data.description || '',
        extractedGlossary: data.extractedGlossary || [],
        truncated: data.truncated,
        originalLength: data.originalLength,
        analyzedLength: data.analyzedLength,
        proseLength: data.proseLength,
        warnings,
      });
    } catch (err: any) {
      const msg = err?.message || 'Không thể đọc và phân tích tệp cẩm nang dịch thuật.';
      setImportError(msg);
      showToast?.({ message: msg, type: 'error' });
    } finally {
      setIsAnalyzingMd(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleApplyPreview = (selection: GuidelineImportSelection) => {
    if (!importPreview) return;

    if (selection.genre === 'apply' && importPreview.genre) {
      const matched = getGenreProfile(importPreview.genre);
      if (matched) {
        setIsCustomGenreMode(false);
        onGenreChange(matched.id);
      } else {
        setIsCustomGenreMode(true);
        onGenreChange(importPreview.genre.slice(0, MAX_CUSTOM_STYLE_LENGTH));
      }
    }

    if (selection.tone === 'apply' && importPreview.tone) {
      const matched = getToneProfile(importPreview.tone);
      if (matched) {
        setIsCustomToneMode(false);
        onToneChange(matched.id);
      } else {
        setIsCustomToneMode(true);
        onToneChange(importPreview.tone.slice(0, MAX_CUSTOM_STYLE_LENGTH));
      }
    }

    if (selection.description === 'replace' && importPreview.description) {
      onDescriptionChange(importPreview.description);
      if (hasStructuredGuidelineHeadings(importPreview.description)) {
        setEditorMode('structured');
      }
    } else if (selection.description === 'merge' && importPreview.description) {
      const merged = description.trim()
        ? `${description.trim()}\n\n${importPreview.description}`
        : importPreview.description;
      onDescriptionChange(merged);
    }

    if (selection.glossary !== 'keep' && importPreview.extractedGlossary.length > 0 && onStageGlossaryAction) {
      onStageGlossaryAction({
        mode: selection.glossary,
        items: importPreview.extractedGlossary,
        fileName: importPreview.fileName,
      });
    }

    setImportPreview(null);
    showToast?.({
      message: 'Đã nạp cấu hình từ cẩm nang vào biểu mẫu (chỉ lưu chính thức khi bạn bấm Lưu).',
      type: 'success',
    });
  };

  const handleExportGuidelinesMd = () => {
    const mdContent = formatGuidelinesMarkdownExport({
      title: projectTitle,
      genre,
      tone,
      description,
    });
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${sanitizeExportFileNameBase(projectTitle || '')}_cam_nang.md`);
    URL.revokeObjectURL(url);
    showToast?.({ message: 'Đã xuất tệp cẩm nang dịch thuật (.md).', type: 'success' });
  };

  return (
    <div className="space-y-4">
      {/* Row: Thể loại chính & Tông giọng biên tập */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Thể loại chính */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={`${idPrefix}-select-genre`}
              className="block text-[10px] uppercase font-bold text-text-muted"
            >
              Thể loại chính
            </label>
            <div className="flex items-center gap-1.5">
              <GenreMark genre={genre || 'Khác'} size="sm" />
              <span className="text-[10px] text-text-muted truncate max-w-[140px]">
                {activeGenreProfile ? activeGenreProfile.group : 'Tùy chỉnh'}
              </span>
            </div>
          </div>

          <select
            id={`${idPrefix}-select-genre`}
            value={genreSelectValue}
            onChange={(e) => handleGenreSelectChange(e.target.value)}
            className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-3 py-2 text-text-main focus:outline-none focus:border-polish cursor-pointer font-semibold"
          >
            {GENRE_GROUPS.map((group) => {
              const items = GENRE_PROFILES.filter((g) => g.group === group);
              if (items.length === 0) return null;
              return (
                <optgroup key={group} label={group} className="bg-parchment text-text-muted">
                  {items.map((item) => (
                    <option key={item.id} value={item.id} className="bg-parchment text-text-main">
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              );
            })}
            <option value={CUSTOM_GENRE_OPTION_VALUE} className="bg-parchment text-polish font-bold">
              + Tự nhập thể loại tùy chỉnh...
            </option>
          </select>

          {isCustomGenreMode && (
            <input
              id={`${idPrefix}-input-custom-genre`}
              type="text"
              maxLength={MAX_CUSTOM_STYLE_LENGTH}
              value={genre}
              onChange={(e) => onGenreChange(e.target.value)}
              placeholder="Nhập tên thể loại riêng (ví dụ: Tu Chân Công Nghệ, Quỷ Bí Đô Thị...)"
              aria-invalid={!!genreError}
              className={cn(
                'w-full text-xs bg-ink border rounded-[2px] px-3 py-1.5 text-text-main font-semibold focus:outline-none',
                genreError ? 'border-polish bg-polish/5' : 'border-parchment-2 focus:border-polish'
              )}
            />
          )}

          {genreError ? (
            <p className="text-[11px] text-polish font-medium">{genreError}</p>
          ) : (
            <p className="text-[11px] text-text-muted leading-snug">
              {activeGenreProfile
                ? activeGenreProfile.shortDescription
                : 'Thể loại tùy chỉnh sẽ được giữ nguyên làm ngữ cảnh dịch thuật xuyên suốt các chương.'}
            </p>
          )}
        </div>

        {/* Tông giọng biên tập */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={`${idPrefix}-select-tone`}
              className="block text-[10px] uppercase font-bold text-text-muted"
            >
              Tông giọng biên dịch &amp; Biên tập
            </label>
            {recommendedToneIds.includes(tone) && (
              <Badge tone="polish">Khuyên dùng</Badge>
            )}
          </div>

          <select
            id={`${idPrefix}-select-tone`}
            value={toneSelectValue}
            onChange={(e) => handleToneSelectChange(e.target.value)}
            className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-3 py-2 text-text-main focus:outline-none focus:border-polish cursor-pointer font-semibold"
          >
            {TONE_PROFILES.map((item) => {
              const isRec = recommendedToneIds.includes(item.id);
              return (
                <option key={item.id} value={item.id} className="bg-parchment text-text-main">
                  {isRec ? `${item.label} [Gợi ý]` : item.label}
                </option>
              );
            })}
            <option value={CUSTOM_TONE_OPTION_VALUE} className="bg-parchment text-polish font-bold">
              + Tự nhập tông giọng tùy chỉnh...
            </option>
          </select>

          {isCustomToneMode && (
            <input
              id={`${idPrefix}-input-custom-tone`}
              type="text"
              maxLength={MAX_CUSTOM_STYLE_LENGTH}
              value={tone}
              onChange={(e) => onToneChange(e.target.value)}
              placeholder="Mô tả tông giọng riêng (ví dụ: Lạnh lùng châm biếm kiểu phương Tây...)"
              aria-invalid={!!toneError}
              className={cn(
                'w-full text-xs bg-ink border rounded-[2px] px-3 py-1.5 text-text-main font-semibold focus:outline-none',
                toneError ? 'border-polish bg-polish/5' : 'border-parchment-2 focus:border-polish'
              )}
            />
          )}

          {toneError ? (
            <p className="text-[11px] text-polish font-medium">{toneError}</p>
          ) : (
            <div className="space-y-1">
              <p className="text-[11px] text-text-muted leading-snug">
                {activeToneProfile
                  ? activeToneProfile.shortDescription
                  : 'Tông giọng tùy chỉnh sẽ được truyền trực tiếp vào dịch thô, chuốt văn và sửa cục bộ.'}
              </p>
              {recommendedToneIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[10px] text-text-muted">Gợi ý hợp thể loại:</span>
                  {recommendedToneIds.map((recTone) => {
                    const isActive = recTone === tone;
                    return (
                      <button
                        key={recTone}
                        type="button"
                        onClick={() => {
                          setIsCustomToneMode(false);
                          onToneChange(recTone);
                        }}
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded-[2px] border transition-colors cursor-pointer',
                          isActive
                            ? 'bg-polish/15 border-polish/50 text-polish font-bold'
                            : 'bg-ink border-parchment-2 text-text-muted hover:text-text-main hover:border-text-muted'
                        )}
                      >
                        {recTone}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Non-blocking style conflict banner */}
      {conflicts.length > 0 && (
        <div
          role="status"
          className="bg-amber-950/40 border border-amber-800/50 text-amber-200 rounded-[3px] p-3 space-y-2 text-xs"
        >
          {conflicts.map((conflict) => (
            <div key={conflict.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-snug">{conflict.message}</span>
              </div>
              {conflict.suggestedTone && conflict.suggestedActionLabel && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIsCustomToneMode(false);
                    onToneChange(conflict.suggestedTone!);
                  }}
                  className="shrink-0 text-[11px] py-1 min-h-[28px] border-amber-700/60"
                >
                  {conflict.suggestedActionLabel}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Cẩm nang dịch thuật & Quy tắc dịch */}
      <div className="bg-ink/60 border border-parchment-2 rounded-md p-3.5 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 border-b border-parchment-2 pb-2.5">
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-text-main flex items-center gap-1.5">
              <BookMarked className="w-3.5 h-3.5 text-polish" />
              Cẩm nang dịch thuật &amp; Quy tắc dịch (Ưu tiên cao hơn Thể loại &amp; Tông giọng)
            </h4>
            <p className="text-[11px] text-text-muted">
              Cố định cách xưng hô, tỷ lệ Hán-Việt, danh xưng và điều cần tránh cho bộ truyện này.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex rounded-[2px] border border-parchment-2 bg-ink p-0.5">
              <button
                type="button"
                onClick={() => setEditorMode('structured')}
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-[2px] cursor-pointer transition-colors',
                  editorMode === 'structured'
                    ? 'bg-polish text-white font-bold'
                    : 'text-text-muted hover:text-text-main'
                )}
              >
                <ListChecks className="w-3 h-3" />
                Có cấu trúc
              </button>
              <button
                type="button"
                onClick={() => setEditorMode('raw')}
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-[2px] cursor-pointer transition-colors',
                  editorMode === 'raw'
                    ? 'bg-polish text-white font-bold'
                    : 'text-text-muted hover:text-text-main'
                )}
              >
                <FileCode2 className="w-3 h-3" />
                Markdown thô
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={<Sparkles className="w-3 h-3 text-polish" />}
              onClick={handleInsertTemplateClick}
              className="text-[11px]"
            >
              Chèn mẫu theo thể loại
            </Button>

            <input
              ref={mdInputRef}
              type="file"
              accept=".md,.txt"
              onChange={handleGuidelineFileUpload}
              className="hidden"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={isAnalyzingMd}
              icon={
                isAnalyzingMd ? (
                  <Loader2 className="w-3 h-3 animate-spin text-polish" />
                ) : (
                  <Upload className="w-3 h-3 text-polish" />
                )
              }
              onClick={() => mdInputRef.current?.click()}
              className="text-[11px]"
            >
              {isAnalyzingMd ? 'Đang phân tích...' : 'Nhập cẩm nang (.md)'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              icon={<Download className="w-3 h-3 text-polish" />}
              onClick={handleExportGuidelinesMd}
              className="text-[11px]"
            >
              Xuất (.md)
            </Button>
          </div>
        </div>

        {/* Inline starter template overwrite confirmation */}
        {templateConfirmOpen && (
          <div className="bg-amber-950/40 border border-amber-800/50 rounded-[2px] p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-amber-200">
            <span>
              Ô quy tắc đang có nội dung. Bạn muốn <strong>Thay thế toàn bộ</strong> hay <strong>Chèn thêm vào cuối</strong> mẫu của thể loại &ldquo;{genre || 'Tiên Hiệp'}&rdquo;?
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="primary" size="sm" onClick={() => applyStarterTemplate('replace')}>
                Thay thế
              </Button>
              <Button variant="secondary" size="sm" onClick={() => applyStarterTemplate('append')}>
                Chèn thêm
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setTemplateConfirmOpen(false)}>
                Hủy
              </Button>
            </div>
          </div>
        )}

        {importError && (
          <div className="bg-polish/10 border border-polish/40 text-polish rounded-[2px] p-2.5 text-[11px] flex items-center justify-between gap-2">
            <span>{importError}</span>
            <button
              type="button"
              onClick={() => setImportError(null)}
              className="text-polish underline text-[10px] cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}

        {stagedGlossaryAction && stagedGlossaryAction.items.length > 0 && (
          <div className="bg-parchment border border-polish/40 rounded-[2px] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2 text-text-main">
              <Badge tone="polish">Chờ lưu</Badge>
              <span>
                Sẽ {stagedGlossaryAction.mode === 'replace' ? 'thay thế bằng' : 'hợp nhất thêm'}{' '}
                <strong>{stagedGlossaryAction.items.length} thuật ngữ</strong>
                {stagedGlossaryAction.fileName ? ` từ "${stagedGlossaryAction.fileName}"` : ''} khi bấm Lưu.
              </span>
            </div>
            {onStageGlossaryAction && (
              <Button
                variant="ghost"
                size="sm"
                icon={<RotateCcw className="w-3 h-3" />}
                onClick={() => onStageGlossaryAction(null)}
                className="text-[11px] min-h-[26px] py-0.5"
              >
                Bỏ nạp từ điển
              </Button>
            )}
          </div>
        )}

        {importPreview && (
          <GuidelineImportPreview
            preview={importPreview}
            hasExistingRules={description.trim().length > 0}
            existingGlossaryCount={existingGlossaryCount}
            onConfirm={handleApplyPreview}
            onCancel={() => setImportPreview(null)}
          />
        )}

        {editorMode === 'structured' ? (
          <div className="space-y-2.5">
            {STRUCTURED_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-text-muted">
                  {field.label}{' '}
                  <span className="font-mono normal-case text-[10px] opacity-60">
                    ({GUIDELINE_SECTION_HEADINGS[field.key]})
                  </span>
                </label>
                <textarea
                  rows={field.rows}
                  value={structuredSections[field.key]}
                  onChange={(e) => handleStructuredFieldChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-3 py-2 text-text-main focus:outline-none focus:border-polish resize-y leading-relaxed"
                />
              </div>
            ))}
            {structuredSections.extraNotes && (
              <p className="text-[10px] text-text-muted italic">
                Ghi chú bổ sung ngoài 5 mục chuẩn đang được bảo toàn. Chuyển sang &ldquo;Markdown thô&rdquo; để chỉnh sửa trực tiếp phần đó.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <label
              htmlFor={`${idPrefix}-textarea-description`}
              className="block text-[10px] uppercase font-bold text-text-muted"
            >
              Nội dung Cẩm nang / Quy tắc dịch (Markdown thô)
            </label>
            <textarea
              id={`${idPrefix}-textarea-description`}
              rows={6}
              placeholder="Ghi chú tự do về văn phong, cốt truyện, xưng hô hoặc dán trực tiếp quy tắc Markdown..."
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-3 py-2 text-text-main focus:outline-none focus:border-polish resize-y font-mono leading-relaxed"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default StyleGuidelineEditor;
