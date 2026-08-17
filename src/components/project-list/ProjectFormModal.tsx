import React, { useState, useRef, useEffect } from 'react';
import { StoryProject, GlossaryItem, Chapter } from '../../types';
import { useNotifications } from '../NotificationSystem';
import { parseTxtContent, parseEpubFile } from '../../utils/fileParser';
import { apiFetch } from '../../utils/apiClient';
import {
  Plus, Edit3, Check, Upload, FileText, Sparkles, Loader2
} from 'lucide-react';

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
  const [author, setAuthor] = useState(editingProject?.author || '');
  const [genre, setGenre] = useState(editingProject?.genre || 'Tiên Hiệp');
  const [tone, setTone] = useState(editingProject?.tone || 'Dịch thuần Việt mượt mà');
  const [description, setDescription] = useState(editingProject?.description || '');

  // File analysis states
  const [rawFileName, setRawFileName] = useState('');
  const [parsedChapters, setParsedChapters] = useState<{ title: string; sourceText: string }[]>([]);
  const [splitMethod, setSplitMethod] = useState<'regex' | 'chunk'>('regex');
  const [isParsingRaw, setIsParsingRaw] = useState(false);

  // Markdown guidelines states
  const [guidelineFileName, setGuidelineFileName] = useState('');
  const [isAnalyzingGuidelines, setIsAnalyzingGuidelines] = useState(false);
  const [analyzedGlossary, setAnalyzedGlossary] = useState<Omit<GlossaryItem, 'id'>[]>([]);
  const [analyzedInfo, setAnalyzedInfo] = useState<{ genre?: string; tone?: string; description?: string } | null>(null);

  const rawInputRef = useRef<HTMLInputElement>(null);
  const mdInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingProject) {
      setTitle(editingProject.title);
      setAuthor(editingProject.author);
      setGenre(editingProject.genre);
      setTone(editingProject.tone);
      setDescription(editingProject.description || '');
    }
  }, [editingProject]);

  const handleRawFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRawFileName(file.name);
    setParsedChapters([]);
    setIsParsingRaw(true);

    try {
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

  const handleGuidelinesFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setGuidelineFileName(file.name);
    setIsAnalyzingGuidelines(true);
    setAnalyzedGlossary([]);
    setAnalyzedInfo(null);

    try {
      const mdText = await file.text();
      const response = await apiFetch('/api/analyze-guidelines', {
        method: 'POST',
        body: JSON.stringify({
          text: mdText,
          apiKeys,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        throw new Error('Lỗi mạng phản hồi không hợp lệ.');
      }

      const data = await response.json();
      if (data.truncated) {
        showToast({
          message: `Lưu ý: Chỉ ${data.analyzedLength.toLocaleString()} / ${data.originalLength.toLocaleString()} ký tự đầu tiên của cẩm nang được phân tích để tối ưu hiệu suất.`,
          type: 'warning',
        });
      }

      if (data.extractedGlossary) {
        setAnalyzedGlossary(data.extractedGlossary);
      }

      setAnalyzedInfo({
        genre: data.genre,
        tone: data.tone,
        description: data.description,
      });

      if (data.genre) setGenre(data.genre);
      if (data.tone) setTone(data.tone);
      if (data.description) setDescription(data.description);
    } catch (err: any) {
      console.error(err);
      showToast({ message: 'Không thể phân tích cẩm nang dịch thuật: ' + err.message, type: 'error' });
      setGuidelineFileName('');
    } finally {
      setIsAnalyzingGuidelines(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast({ message: 'Vui lòng điền tên tiểu thuyết.', type: 'warning' });
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

    const finalGlossary: GlossaryItem[] = analyzedGlossary.map((ag, idx) => ({
      ...ag,
      id: 'glo_md_' + Date.now() + '_' + idx,
      origin: 'guideline',
      createdAt: new Date().toISOString(),
    }));

    onSave({
      title: title.trim(),
      author: author.trim() || 'Khuyết Danh',
      genre,
      tone,
      description: description.trim(),
      chapters: finalChapters,
      glossary: finalGlossary,
    });
  };

  return (
    <form
      id="form-create-project"
      onSubmit={handleSubmit}
      className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 md:p-6 space-y-5 shadow-xs animate-slide-up"
    >
      <div className="border-b border-slate-800 pb-3">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          {editingProject ? <Edit3 className="w-4 h-4 text-indigo-400" /> : <Plus className="w-4 h-4 text-indigo-400" />}
          {editingProject ? 'Chỉnh sửa Môi trường & Bộ truyện' : 'Thiết kế Môi trường & Bộ Truyện mới'}
        </h3>
        <p className="text-xs text-slate-450">
          {editingProject
            ? 'Cập nhật các trường liên quan bên dưới để chỉnh sửa thông tin bộ truyện. Bạn cũng có thể tải file raw hoặc file cẩm nang để nhập thêm chương/từ mới.'
            : 'Hãy nhập các trường liên quan. Bạn có thể sử dụng tính năng tải file bên dưới để tự động điền nhanh.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-[10px] uppercase font-bold text-slate-400">
            Tên tiểu thuyết / Bộ truyện dịch *
          </label>
          <input
            id="input-project-title"
            type="text"
            placeholder="Ví dụ: Đấu Phá Thương Khung, Thần Điêu Đại Hiệp..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-xs bg-slate-950 border border-slate-750/80 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-950"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] uppercase font-bold text-slate-400">Tác giả gốc</label>
          <input
            id="input-project-author"
            type="text"
            placeholder="Ví dụ: Thiên Tàm Thổ Đậu, Ngã Thất Tây Hồng Thị..."
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full text-xs bg-slate-950 border border-slate-750/80 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-950"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] uppercase font-bold text-slate-400">Thể loại chính</label>
          <select
            id="select-project-genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full text-xs bg-slate-950 border border-slate-750/80 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="Tiên Hiệp">Tiên Hiệp (Giả tưởng bay bổng, tu tiên, tiên giới)</option>
            <option value="Võ Hiệp">Võ Hiệp (Kiếm hiệp truyền thống, ân oán giang hồ)</option>
            <option value="Ngôn Tình">Ngôn Tình (Tình cảm lãng mạn lôi cuốn)</option>
            <option value="Đô Thị">Đô Thị (Thời hiện đại, thương trường, cuộc sống)</option>
            <option value="Huyền Huyễn">Huyền Huyễn (Lịch sử giả tưởng kỳ ảo)</option>
            <option value="Huyền Huyễn Phương Tây">Huyền Huyễn Phương Tây (Hiệp sĩ, ma pháp, rồng, ma quỷ phương Tây)</option>
            <option value="Vô Hạn Lưu">Vô Hạn Lưu (Sinh tồn, luân hồi, nhiệm vụ phó bản nghẹt thở)</option>
            <option value="Lịch Sử / Quân Sự">Lịch Sử / Quân Sự (Dã sử, quân triều, binh pháp chiến tranh)</option>
            <option value="Khoa Huyễn / Võng Du">Khoa Huyễn / Võng Du (Khoa học viễn tưởng, thế giới game ảo, cơ giáp)</option>
            <option value="Linh Dị / Thần Quái">Linh Dị / Thần Quái (Kinh dị tâm linh, ma quỷ kỳ bí, trinh thám u ám)</option>
            <option value="Hệ Thống / Điền Văn">Hệ Thống / Điền Văn (Sinh hoạt gia đình, làm ruộng điền viên nhẹ nhàng)</option>
            <option value="Khác">Thể loại khác</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] uppercase font-bold text-slate-400">
            Tông giọng biên dịch & Biên tập
          </label>
          <select
            id="select-project-tone"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full text-xs bg-slate-950 border border-slate-750/80 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="Dịch thuần Việt mượt mà">Thuần Việt mượt mà (Ưu tiên câu từ lưu loát tự nhiên Việt Nam)</option>
            <option value="Trang nghiêm cổ phong">Cổ phong trang nghiêm (Từ ngữ đậm chất Hán Việt, sang quý)</option>
            <option value="Bình dịch dân dã">Bình dị đời thường (Từ ngữ đơn giản mộc mạc phong vị đời thật)</option>
            <option value="Hùng tráng dồn dập">Hùng tráng dập dồn (Thích hợp truyện võ đấu, kịch tính nhiệt huyết)</option>
            <option value="Trầm hùng dã sử">Trầm hùng dã sử (Trang nghiêm sử thi, thích hợp quân sự lịch sử)</option>
            <option value="Hiện đại công nghệ">Hiện đại công nghệ (Thuật ngữ viễn tưởng số hóa, hiện đại)</option>
            <option value="Kịch tính ly kỳ">Kịch tính ly kỳ (Gợi cảm giác hồi hộp, u ám tâm linh)</option>
            <option value="Nhẹ nhàng điền văn">Nhẹ nhàng điền văn (Lối kể mộc mạc ấm áp, đời thường chậm rãi)</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-[10px] uppercase font-bold text-slate-400">
          Giới thiệu tóm tắt / Quy tắc dịch (Được cập nhật tự động khi tải file .md)
        </label>
        <textarea
          id="textarea-project-desc"
          rows={2}
          placeholder="Ghi chú về văn phong, cốt truyện hoặc cách xưng hô chung..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full text-xs bg-slate-950 border border-slate-750/80 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
        />
      </div>

      {/* ATTACHMENT PROCESSING SECTION */}
      <div className="border-t border-slate-800 pt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Box 1: File Raw (.txt / .epub) */}
        <div className="bg-slate-950/20 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div>
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-450" />
              Tải lên Novel Raw Gốc (.txt; .epub)
            </h4>
            <p className="text-[11px] text-slate-500">Trích xuất nội dung toàn bộ văn bản và chia chương nhanh</p>
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
              className="flex items-center gap-1 bg-blue-950/30 hover:bg-blue-900/30 border border-blue-900/40 text-blue-300 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Chọn File Gốc
            </button>
            <span className="text-[11px] text-slate-455 truncate max-w-[150px]" title={rawFileName}>
              {rawFileName || 'Chưa chọn tệp'}
            </span>
          </div>

          {/* Splitting mechanism settings for TXT */}
          {rawFileName && rawFileName.endsWith('.txt') && (
            <div className="bg-slate-950/40 border border-slate-800/60 p-2.5 rounded-lg space-y-1.5 text-[11px]">
              <span className="font-bold text-slate-350 block">Cơ chế tự động phân chia chương văn bản:</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-300">
                  <input
                    type="radio"
                    checked={splitMethod === 'regex'}
                    onChange={() => handleToggleSplitMethod('regex')}
                    className="accent-indigo-550"
                  />
                  Tìm theo tên chương (&quot;Chương x&quot;)
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-300">
                  <input
                    type="radio"
                    checked={splitMethod === 'chunk'}
                    onChange={() => handleToggleSplitMethod('chunk')}
                    className="accent-indigo-550"
                  />
                  Chia đều mỗi 8,000 ký tự
                </label>
              </div>
            </div>
          )}

          {/* Discovered raw chapter progress */}
          {isParsingRaw ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
              <span>Đang bóc tách giải nén và phân tích cấu trúc...</span>
            </div>
          ) : parsedChapters.length > 0 ? (
            <div className="bg-emerald-950/15 border border-emerald-900/30 text-emerald-300 text-xs p-2.5 rounded-lg flex items-start gap-1.5">
              <Check className="w-4 h-4 text-emerald-450 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-emerald-350">Giải tích tệp tin hoàn tất!</span>
                <span>Phát hiện thành công <strong>{parsedChapters.length} chương</strong> có sẵn để nạp vào truyện.</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Box 2: Analysis Guideline Markdown (.md) */}
        <div className="bg-slate-950/20 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div>
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Tải lên Cẩm Nang Dịch Thuật (.md)
            </h4>
            <p className="text-[11px] text-slate-500">Ví dụ: dich_thuat.md chứa từ điển/giọng xưng hô của bộ truyện</p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".md"
              ref={mdInputRef}
              onChange={handleGuidelinesFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => mdInputRef.current?.click()}
              className="flex items-center gap-1 bg-indigo-950/30 hover:bg-indigo-900/30 border border-indigo-900/40 text-indigo-300 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Tải Lên File MD
            </button>
            <span className="text-[11px] text-slate-455 truncate max-w-[150px]" title={guidelineFileName}>
              {guidelineFileName || 'Chưa chọn tệp'}
            </span>
          </div>

          {/* Guidelines Processing status */}
          {isAnalyzingGuidelines ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
              <span>Hệ thống AI đang đọc và trích từ vựng...</span>
            </div>
          ) : analyzedGlossary.length > 0 ? (
            <div className="space-y-1 bg-emerald-950/15 border border-emerald-900/30 p-2.5 rounded-lg text-[11px] text-emerald-350">
              <div className="flex items-center gap-1 text-xs font-bold text-emerald-350">
                <Check className="w-4 h-4 text-emerald-450 shrink-0" />
                <span>Bộ Hướng Dẫn & Từ Điển Đã Sẵn Sàng!</span>
              </div>
              <p>AI đã trích xuất thành công <strong>{analyzedGlossary.length} từ khóa</strong> nạp sẵn vào từ điển, cấu hình tông xưng hô và thể loại dịch thuật.</p>
              
              <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto mt-1 pt-0.5">
                {analyzedGlossary.slice(0, 8).map((it, idx) => (
                  <span key={idx} className="bg-slate-950 border border-emerald-900/60 px-1.5 py-0.5 rounded text-[10px] font-semibold text-emerald-300">
                    {it.chinese || '???'} ➜ {it.vietnamese}
                  </span>
                ))}
                {analyzedGlossary.length > 8 && (
                  <span className="text-[10px] text-slate-500 font-bold px-1">+{analyzedGlossary.length - 8} từ khác...</span>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1 border-t border-slate-800">
        <button
          id="btn-cancel-project"
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          Hủy
        </button>
        <button
          id="btn-save-project"
          type="submit"
          className="bg-indigo-650 hover:bg-indigo-755 text-white px-5 py-1.5 text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          {editingProject ? 'Lưu & Cập nhật truyện' : 'Lưu & Tạo truyện mới'}
        </button>
      </div>
    </form>
  );
}
