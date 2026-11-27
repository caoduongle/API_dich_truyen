import React, { useState, useRef, useEffect } from 'react';
import { StoryProject, GlossaryItem, Chapter } from '../../types';
import { useNotifications } from '../NotificationSystem';
import { parseTxtContent, parseEpubFile } from '../../utils/fileParser';
import { validateUploadFile } from '../../utils/fileValidator';
import {
  mergeImportedGlossaryForProject,
  type GuidelineStagedGlossaryAction,
} from '../../services/glossaryIO';
import { StyleGuidelineEditor } from '../common/StyleGuidelineEditor';
import {
  Plus, Edit3, Check, Upload, FileText, Loader2
} from 'lucide-react';
import { cn } from '../../lib/cn';

export interface ProjectFormModalProps {
  editingProject: StoryProject | null;
  onSave: (payload: {
    title: string;
    author: string;
    genre: string;
    tone: string;
    description: string;
    chapters: Chapter[];
    glossary: GlossaryItem[];
    glossaryMode?: 'replace' | 'merge';
  }) => void;
  onCancel: () => void;
  apiKeys: string[];
  selectedModel: string;
}

export function ProjectFormModal({
  editingProject,
  onSave,
  onCancel,
  apiKeys,
  selectedModel,
}: ProjectFormModalProps) {
  const { showToast } = useNotifications();

  const [title, setTitle] = useState(editingProject?.title || '');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [author, setAuthor] = useState(editingProject?.author || '');
  const [genre, setGenre] = useState(editingProject?.genre || 'Tiên Hiệp');
  const [tone, setTone] = useState(editingProject?.tone || 'Dịch thuần Việt mượt mà');
  const [description, setDescription] = useState(editingProject?.description || '');
  const [genreError, setGenreError] = useState<string | null>(null);
  const [toneError, setToneError] = useState<string | null>(null);

  // File analysis states
  const [rawFileName, setRawFileName] = useState('');
  const [parsedChapters, setParsedChapters] = useState<{ title: string; sourceText: string }[]>([]);
  const [splitMethod, setSplitMethod] = useState<'regex' | 'chunk'>('regex');
  const [isParsingRaw, setIsParsingRaw] = useState(false);

  // Staged imported glossary (chỉ ghi vào dự án khi bấm Lưu)
  const [stagedGlossaryAction, setStagedGlossaryAction] = useState<GuidelineStagedGlossaryAction | null>(null);

  const rawInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingProject) {
      setTitle(editingProject.title);
      setAuthor(editingProject.author);
      setGenre(editingProject.genre);
      setTone(editingProject.tone);
      setDescription(editingProject.description || '');
    }
    setStagedGlossaryAction(null);
    setGenreError(null);
    setToneError(null);
  }, [editingProject]);

  const handleRawFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRawFileName(file.name);
    setParsedChapters([]);
    setIsParsingRaw(true);

    try {
      await validateUploadFile(file);
      if (file.name.endsWith('.txt')) {
        const fullText = await file.text();
        const chaps = parseTxtContent(fullText, splitMethod);
        setParsedChapters(chaps);
      } else if (file.name.endsWith('.epub')) {
        const chaps = await parseEpubFile(file);
        setParsedChapters(chaps);
      } else {
        showToast({ message: 'Chỉ hỗ trợ định dạng tệp .txt hoặc .epub.', type: 'warning' });
        setRawFileName('');
      }
    } catch (err: any) {
      console.error(err);
      showToast({ message: 'Lỗi khi đọc file raw gốc: ' + err.message, type: 'error' });
      setRawFileName('');
    } finally {
      setIsParsingRaw(false);
    }
  };

  const handleToggleSplitMethod = async (method: 'regex' | 'chunk') => {
    setSplitMethod(method);
    if (rawInputRef.current?.files?.[0] && rawInputRef.current.files[0].name.endsWith('.txt')) {
      setIsParsingRaw(true);
      try {
        const fullText = await rawInputRef.current.files[0].text();
        const chaps = parseTxtContent(fullText, method);
        setParsedChapters(chaps);
      } catch (err: any) {
        showToast({ message: err.message, type: 'error' });
      } finally {
        setIsParsingRaw(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError('Vui lòng điền tên tiểu thuyết / bộ truyện dịch.');
      showToast({ message: 'Vui lòng điền tên tiểu thuyết.', type: 'warning' });
      return;
    }

    if (!genre.trim()) {
      setGenreError('Vui lòng chọn hoặc nhập tên Thể loại chính.');
      showToast({ message: 'Vui lòng chọn hoặc nhập Thể loại chính.', type: 'warning' });
      return;
    }

    if (!tone.trim()) {
      setToneError('Vui lòng chọn hoặc nhập Tông giọng biên tập.');
      showToast({ message: 'Vui lòng chọn hoặc nhập Tông giọng biên tập.', type: 'warning' });
      return;
    }

    const finalChapters: Chapter[] = parsedChapters.map((pc, idx) => ({
      id: 'chap_file_' + Date.now() + '_' + idx,
      title: pc.title,
      sourceText: pc.sourceText,
      rawTranslation: '',
      polishedTranslation: '',
      paragraphs: [],
      translatedLines: [],
      status: 'not_started',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const finalGlossary: GlossaryItem[] = stagedGlossaryAction?.items?.length
      ? mergeImportedGlossaryForProject([], stagedGlossaryAction.items, 'replace')
      : [];

    onSave({
      title: title.trim(),
      author: author.trim() || 'Chưa rõ tác giả',
      genre: genre.trim(),
      tone: tone.trim(),
      description: description.trim(),
      chapters: finalChapters,
      glossary: finalGlossary,
      glossaryMode: stagedGlossaryAction?.mode,
    });
  };

  return (
    <form
      id="form-create-project"
      onSubmit={handleSubmit}
      className="bg-parchment border border-parchment-2 rounded-md p-5 md:p-6 space-y-5 shadow-xs animate-slide-up"
    >
      <div className="border-b border-parchment-2 pb-3">
        <h3 className="text-sm font-display font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
          {editingProject ? <Edit3 className="w-4 h-4 text-polish" /> : <Plus className="w-4 h-4 text-polish" />}
          {editingProject ? 'Chỉnh sửa Môi trường & Bộ truyện' : 'Thiết kế Môi trường & Bộ Truyện mới'}
        </h3>
        <p className="text-xs text-text-muted">
          {editingProject
            ? 'Cập nhật các trường liên quan bên dưới để chỉnh sửa thông tin bộ truyện. Bạn cũng có thể tải file raw hoặc file cẩm nang để nhập thêm chương/từ mới.'
            : 'Hãy nhập các trường liên quan. Bạn có thể sử dụng tính năng tải file bên dưới để tự động điền nhanh.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-[10px] uppercase font-bold text-text-muted">
            Tên tiểu thuyết / Bộ truyện dịch *
          </label>
          <input
            id="input-project-title"
            type="text"
            placeholder="Ví dụ: Đấu Phá Thương Khung, Thần Điêu Đại Hiệp..."
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (titleError) setTitleError(null);
            }}
            className={cn(
              "w-full text-xs bg-ink border rounded-[2px] px-3 py-2 text-text-main font-semibold focus:outline-none",
              titleError ? "border-polish bg-polish/5" : "border-parchment-2 focus:border-polish"
            )}
            aria-invalid={!!titleError}
            required
          />
          {titleError && (
            <p className="text-[10px] text-polish font-medium mt-1">{titleError}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] uppercase font-bold text-text-muted">Tác giả gốc</label>
          <input
            id="input-project-author"
            type="text"
            placeholder="Ví dụ: Thiên Tàm Thổ Đậu, Ngã Thất Tây Hồng Thị..."
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full text-xs bg-ink border border-parchment-2 rounded-[2px] px-3 py-2 text-text-main font-semibold focus:outline-none focus:border-polish"
          />
        </div>
      </div>

      <StyleGuidelineEditor
        key={editingProject?.id || 'new'}
        idPrefix="create"
        genre={genre}
        onGenreChange={(val) => {
          setGenre(val);
          if (genreError) setGenreError(null);
        }}
        tone={tone}
        onToneChange={(val) => {
          setTone(val);
          if (toneError) setToneError(null);
        }}
        description={description}
        onDescriptionChange={setDescription}
        projectTitle={title}
        existingGlossaryCount={editingProject?.glossary.length || 0}
        stagedGlossaryAction={stagedGlossaryAction}
        onStageGlossaryAction={setStagedGlossaryAction}
        genreError={genreError}
        toneError={toneError}
        apiKeys={apiKeys}
        selectedModel={selectedModel}
        showToast={showToast}
      />

      {/* ATTACHMENT PROCESSING SECTION: File Raw (.txt / .epub) */}
      <div className="border-t border-parchment-2 pt-4">
        <div className="bg-ink border border-parchment-2 rounded-md p-4 space-y-3">
          <div>
            <h4 className="text-xs font-bold text-text-main flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-draft" />
              Tải lên Novel Raw Gốc (.txt; .epub)
            </h4>
            <p className="text-[11px] text-text-muted">Trích xuất nội dung toàn bộ văn bản và chia chương nhanh</p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".txt,.epub"
              ref={rawInputRef}
              onChange={handleRawFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => rawInputRef.current?.click()}
              className="flex items-center gap-1 bg-parchment hover:bg-parchment-2 border border-parchment-2 text-text-main text-xs font-semibold px-3 py-2 rounded-[2px] cursor-pointer transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-draft" />
              Chọn File Gốc
            </button>
            <span className="text-[11px] text-text-muted truncate max-w-[200px]" title={rawFileName}>
              {rawFileName || 'Chưa chọn tệp'}
            </span>
          </div>

          {/* Splitting mechanism settings for TXT */}
          {rawFileName && rawFileName.endsWith('.txt') && (
            <div className="bg-parchment border border-parchment-2 p-2.5 rounded-[2px] space-y-1.5 text-[11px]">
              <span className="font-bold text-text-muted block">Cơ chế tự động phân chia chương văn bản:</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-text-main">
                  <input
                    type="radio"
                    checked={splitMethod === 'regex'}
                    onChange={() => handleToggleSplitMethod('regex')}
                    className="accent-polish"
                  />
                  Tìm theo tên chương (&quot;Chương x&quot;)
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-text-main">
                  <input
                    type="radio"
                    checked={splitMethod === 'chunk'}
                    onChange={() => handleToggleSplitMethod('chunk')}
                    className="accent-polish"
                  />
                  Chia đều mỗi 8,000 ký tự
                </label>
              </div>
            </div>
          )}

          {/* Discovered raw chapter progress */}
          {isParsingRaw ? (
            <div className="flex items-center gap-1.5 text-xs text-text-muted pt-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-draft" />
              <span>Đang bóc tách giải nén và phân tích cấu trúc...</span>
            </div>
          ) : parsedChapters.length > 0 ? (
            <div className="bg-parchment border border-polish/30 text-text-main text-xs p-2.5 rounded-[2px] flex items-start gap-1.5">
              <Check className="w-4 h-4 text-polish shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-polish">Giải tích tệp tin hoàn tất!</span>
                <span>Phát hiện thành công <strong>{parsedChapters.length} chương</strong> có sẵn để nạp vào truyện.</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1 border-t border-parchment-2">
        <button
          id="btn-cancel-project"
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-text-main hover:bg-parchment-2 rounded-[2px] transition-colors cursor-pointer"
        >
          Hủy
        </button>
        <button
          id="btn-save-project"
          type="submit"
          className="bg-polish hover:bg-[#A03522] text-white px-5 py-1.5 text-xs font-bold rounded-[2px] shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          {editingProject ? 'Lưu & Cập nhật truyện' : 'Lưu & Tạo truyện mới'}
        </button>
      </div>
    </form>
  );
}
