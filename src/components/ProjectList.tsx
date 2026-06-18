import React, { useState, useRef } from 'react';
import { StoryProject, GlossaryItem, Chapter } from '../types';
import JSZip from 'jszip';
import { 
  Plus, Trash2, Folder, BookOpen, Clock, Tag, FileText, Upload, Download, 
  Sparkles, Loader2, Check, AlertCircle, ChevronRight, Info, Calendar, ArrowUpRight
} from 'lucide-react';

interface ProjectListProps {
  projects: StoryProject[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onCreateProject: (project: Omit<StoryProject, 'id' | 'createdAt'>) => void;
  apiKeys: string[];
  selectedModel: string;
}

export default function ProjectList({
  projects,
  activeProjectId,
  onSelectProject,
  onDeleteProject,
  onCreateProject,
  apiKeys,
  selectedModel,
}: ProjectListProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [genre, setGenre] = useState('Tiên Hiệp');
  const [tone, setTone] = useState('Dịch thuần Việt mượt màng');
  const [description, setDescription] = useState('');

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

  // File Inputs Ref
  const rawInputRef = useRef<HTMLInputElement>(null);
  const mdInputRef = useRef<HTMLInputElement>(null);
  const importJsonInputRef = useRef<HTMLInputElement>(null);

  // --- 1. HANDLE SOURCE NOVEL FILES (.txt / .epub) ---
  const handleRawFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRawFileName(file.name);
    setParsedChapters([]);
    setIsParsingRaw(true);

    try {
      if (file.name.endsWith('.txt')) {
        const fullText = await file.text();
        parseTxtContent(fullText, splitMethod);
      } else if (file.name.endsWith('.epub')) {
        await parseEpubFile(file);
      } else {
        alert("Chỉ hỗ trợ định dạng tệp .txt hoặc .epub.");
        setRawFileName('');
      }
    } catch (err: any) {
      console.error(err);
      alert("Lỗi khi đọc file raw gốc: " + err.message);
      setRawFileName('');
    } finally {
      setIsParsingRaw(false);
    }
  };

  // Re-parse text file if split method is toggled
  const handleToggleSplitMethod = async (method: 'regex' | 'chunk') => {
    setSplitMethod(method);
    if (rawInputRef.current?.files?.[0] && rawInputRef.current.files[0].name.endsWith('.txt')) {
      setIsParsingRaw(true);
      try {
        const fullText = await rawInputRef.current.files[0].text();
        parseTxtContent(fullText, method);
      } catch (err: any) {
        alert(err.message);
      } finally {
        setIsParsingRaw(false);
      }
    }
  };

  // Parse TXT
  const parseTxtContent = (fullText: string, method: 'regex' | 'chunk') => {
    const chapters: { title: string; sourceText: string }[] = [];

    if (method === 'regex') {
      const lines = fullText.split(/\r?\n/);
      let currentChapterTitle = "Khởi đầu / Phần mở đầu";
      let currentLines: string[] = [];
      const chapRegex = /^\s*(Chương\s+\d+|Chương\s+[I|V|X|L|C|D|M]+|第[零一二三四五六七八九十百千万\d]+[章节])/i;

      for (const line of lines) {
        if (chapRegex.test(line)) {
          if (currentLines.length > 0) {
            chapters.push({
              title: currentChapterTitle,
              sourceText: currentLines.join("\n").trim()
            });
          }
          currentChapterTitle = line.trim();
          currentLines = [];
        } else {
          currentLines.push(line);
        }
      }

      if (currentLines.length > 0 || String(currentChapterTitle).trim() !== "") {
        chapters.push({
          title: currentChapterTitle,
          sourceText: currentLines.join("\n").trim() || "Không có nội dung"
        });
      }
    } else {
      // Chunking by size (e.g. 8000 characters)
      const chunkSize = 8000;
      for (let i = 0; i < fullText.length; i += chunkSize) {
        const textChunk = fullText.substring(i, i + chunkSize);
        chapters.push({
          title: `Phần ${Math.floor(i / chunkSize) + 1}`,
          sourceText: textChunk.trim()
        });
      }
    }

    setParsedChapters(chapters.filter(c => c.sourceText.length > 10));
  };

  // Parse EPUB (Zip extraction with Spine analysis)
  const parseEpubFile = async (file: File) => {
    const zip = await JSZip.loadAsync(file);
    
    // Find metadata container to find content OPF path
    let opfPath = 'content.opf';
    const containerFile = zip.file('META-INF/container.xml');
    if (containerFile) {
      const containerContent = await containerFile.async('text');
      const parser = new DOMParser();
      const doc = parser.parseFromString(containerContent, 'text/xml');
      const rootfilePath = doc.querySelector('rootfile')?.getAttribute('full-path');
      if (rootfilePath) {
        opfPath = rootfilePath;
      }
    }

    const opfFile = zip.file(opfPath);
    if (!opfFile) {
      // Fallback: fuzzy search for .opf file in ZIP
      const foundOpf = Object.keys(zip.files).find(name => name.endsWith('.opf'));
      if (foundOpf) {
        const opfContent = await zip.files[foundOpf].async('text');
        await parseEpubOpf(zip, foundOpf, opfContent);
      } else {
        // Ultimate fallback: select all .html/.xhtml files
        const fallbackHtmlFiles = Object.keys(zip.files).filter(name => 
          name.endsWith('.html') || name.endsWith('.xhtml') || name.endsWith('.htm')
        );
        fallbackHtmlFiles.sort();
        await parseEpubFallback(zip, fallbackHtmlFiles);
      }
      return;
    }

    const opfContent = await opfFile.async('text');
    await parseEpubOpf(zip, opfPath, opfContent);
  };

  const parseEpubOpf = async (zip: JSZip, opfPath: string, opfContent: string) => {
    const parser = new DOMParser();
    const opfDoc = parser.parseFromString(opfContent, 'text/xml');
    
    // Read manifest item paths and types
    const items: Record<string, { href: string; mediaType: string }> = {};
    const itemElements = opfDoc.querySelectorAll('manifest > item');
    itemElements.forEach(el => {
      const id = el.getAttribute('id');
      const href = el.getAttribute('href');
      const mediaType = el.getAttribute('media-type');
      if (id && href) {
        items[id] = { href, mediaType: mediaType || '' };
      }
    });

    // Read logical chapter order spin
    const spineIds: string[] = [];
    const spineElements = opfDoc.querySelectorAll('spine > itemref');
    spineElements.forEach(el => {
      const idref = el.getAttribute('idref');
      if (idref) {
        spineIds.push(idref);
      }
    });

    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
    const chapters: { title: string; sourceText: string }[] = [];

    for (const idref of spineIds) {
      const item = items[idref];
      if (!item) continue;

      if (!item.mediaType.includes('xml') && !item.mediaType.includes('html') && !item.href.endsWith('.html') && !item.href.endsWith('.xhtml')) {
        continue;
      }

      let relativePath = item.href;
      try {
        relativePath = decodeURIComponent(relativePath);
      } catch (_) {}

      let fullPath = opfDir + relativePath;

      if (fullPath.includes('../')) {
        const parts = fullPath.split('/');
        const resolvedParts: string[] = [];
        for (const p of parts) {
          if (p === '..') {
            resolvedParts.pop();
          } else if (p !== '.') {
            resolvedParts.push(p);
          }
        }
        fullPath = resolvedParts.join('/');
      }

      let zipFile = zip.file(fullPath);
      if (!zipFile) {
        const lowerPath = fullPath.toLowerCase();
        const fuzzyKey = Object.keys(zip.files).find(k => k.toLowerCase() === lowerPath || k.toLowerCase().endsWith('/' + relativePath.toLowerCase()));
        if (fuzzyKey) {
          zipFile = zip.file(fuzzyKey);
        }
      }

      if (zipFile) {
        const textContent = await zipFile.async('text');
        const htmlDoc = parser.parseFromString(textContent, 'text/html');
        
        htmlDoc.querySelectorAll('script, style, iframe').forEach(el => el.remove());
        const pageText = htmlDoc.body?.textContent || htmlDoc.documentElement?.textContent || '';
        
        let headerTitle = htmlDoc.querySelector('title')?.textContent || htmlDoc.querySelector('h1, h2, h3, h4')?.textContent || '';
        headerTitle = headerTitle.replace(/\s+/g, ' ').trim();
        if (!headerTitle) {
          headerTitle = relativePath.split('/').pop()?.replace(/\.(xhtml|html|xml|htm)$/i, '') || 'Chương không tên';
        }

        if (pageText.trim().length > 50) {
          chapters.push({
            title: headerTitle,
            sourceText: pageText.trim()
          });
        }
      }
    }

    if (chapters.length > 0) {
      setParsedChapters(chapters);
    } else {
      // Ultimate fallback
      const fallbackHtmlFiles = Object.keys(zip.files).filter(name => 
        name.endsWith('.html') || name.endsWith('.xhtml') || name.endsWith('.htm')
      );
      fallbackHtmlFiles.sort();
      await parseEpubFallback(zip, fallbackHtmlFiles);
    }
  };

  const parseEpubFallback = async (zip: JSZip, filePaths: string[]) => {
    const parser = new DOMParser();
    const chapters: { title: string; sourceText: string }[] = [];
    
    for (const filePath of filePaths) {
      const fileContent = await zip.files[filePath].async('text');
      const doc = parser.parseFromString(fileContent, 'text/html');
      doc.querySelectorAll('script, style, iframe').forEach(el => el.remove());
      const pageText = doc.body?.textContent || doc.documentElement?.textContent || '';
      
      let headerTitle = doc.querySelector('title')?.textContent || doc.querySelector('h1, h2, h3')?.textContent || filePath.split('/').pop()?.replace(/\.(xhtml|html|htm)$/i, '') || 'Chương';
      headerTitle = headerTitle.trim();
      
      if (pageText.trim().length > 50) {
        chapters.push({
          title: headerTitle,
          sourceText: pageText.trim()
        });
      }
    }
    setParsedChapters(chapters);
  };


  // --- 2. HANDLE GUIDELINE MARKDOWN FILES (.md) ---
  const handleGuidelinesFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setGuidelineFileName(file.name);
    setIsAnalyzingGuidelines(true);
    setAnalyzedGlossary([]);
    setAnalyzedInfo(null);

    try {
      const mdText = await file.text();
      
      // Perform API call to parse guidelines using Gemini on server
      const response = await fetch('/api/analyze-guidelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: mdText,
          apiKeys,
          model: selectedModel
        })
      });

      if (!response.ok) {
        throw new Error("Lỗi mạng phản hồi không hợp lệ.");
      }

      const data = await response.json();
      
      if (data.extractedGlossary) {
        setAnalyzedGlossary(data.extractedGlossary);
      }
      
      setAnalyzedInfo({
        genre: data.genre,
        tone: data.tone,
        description: data.description
      });

      // Autofill fields for convenience
      if (data.genre) setGenre(data.genre);
      if (data.tone) setTone(data.tone);
      if (data.description) setDescription(data.description);

    } catch (err: any) {
      console.error(err);
      alert("Không thể phân tích cẩm nang dịch thuật: " + err.message);
      setGuidelineFileName('');
    } finally {
      setIsAnalyzingGuidelines(false);
    }
  };


  // --- 3. EXPORT PROJECT TO DISK (.json) ---
  const handleExportProjectJson = (proj: StoryProject) => {
    const jsonString = JSON.stringify(proj, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = `${proj.title.replace(/[\s\/:*?"<>|]+/g, '_')}_from_disk.json`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);
  };

  // Export polished Vietnamese text or bilingual side-by-side
  const handleExportText = (proj: StoryProject, mode: 'vietnamese' | 'bilingual') => {
    let output = '';
    proj.chapters.forEach((chapter) => {
      output += `=== ${chapter.title} ===\n\n`;
      if (mode === 'bilingual') {
        if (chapter.paragraphs && chapter.paragraphs.length > 0) {
          chapter.paragraphs.forEach((cnLine, idx) => {
            const viLine = chapter.translatedLines?.[idx] || chapter.polishedTranslation || '';
            output += `[CN]: ${cnLine}\n[VI]: ${viLine || '(Chưa dịch)'}\n\n`;
          });
        } else {
          output += `[CN]:\n${chapter.sourceText}\n\n[VI]:\n${chapter.polishedTranslation || chapter.rawTranslation || '(Chưa dịch)'}\n\n`;
        }
      } else {
        output += (chapter.polishedTranslation || chapter.rawTranslation || '') + '\n\n';
      }
    });

    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${proj.title.replace(/[\s\/:*?"<>|]+/g, '_')}_${mode}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Calculate translation completion progress for a project
  const getProjectProgress = (proj: StoryProject) => {
    const total = proj.chapters.length;
    if (total === 0) return { total: 0, done: 0, pct: 0 };
    const done = proj.chapters.filter(c =>
      (c.polishedTranslation && c.polishedTranslation.trim().length > 0) ||
      (c.status === 'completed')
    ).length;
    return { total, done, pct: Math.round((done / total) * 100) };
  };


  // --- 4. IMPORT PROJECT FROM DISK (.json) ---
  const handleImportProjectJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = event.target?.result as string;
        const imported = JSON.parse(raw);

        if (!imported.title) {
          alert("Tệp JSON không hợp lệ, không tìm thấy tên tiểu thuyết (title).");
          return;
        }

        const projectPayload: StoryProject = {
          ...imported,
          id: 'proj_' + Date.now(),
          createdAt: imported.createdAt || new Date().toISOString(),
          glossary: Array.isArray(imported.glossary) ? imported.glossary : [],
          pendingGlossary: Array.isArray(imported.pendingGlossary) ? imported.pendingGlossary : [],
          chapters: Array.isArray(imported.chapters) ? imported.chapters : []
        };

        onCreateProject(projectPayload);
        alert(`Nhập khẩu dự án thành công! Thêm bộ truyện "${projectPayload.title}" với ${projectPayload.chapters.length} chương và ${projectPayload.glossary.length} từ điển.`);
      } catch (err: any) {
        alert("Lỗi giải mã cấu trúc dữ liệu tệp JSON: " + err.message);
      }
    };
    reader.readAsText(file);
    
    // Clear input
    if (importJsonInputRef.current) {
      importJsonInputRef.current.value = '';
    }
  };


  // --- 5. CREATE SUBMIT HANDLER ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Vui lòng điền tên tiểu thuyết.");
      return;
    }

    // Convert parsed chapters list into matching Type schemas
    const finalChapters: Chapter[] = parsedChapters.map((pc, idx) => ({
      id: 'chap_file_' + Date.now() + '_' + idx,
      title: pc.title,
      sourceText: pc.sourceText,
      rawTranslation: '',
      polishedTranslation: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    // Convert analyzed glossary items into matching Type schemas
    const finalGlossary: GlossaryItem[] = analyzedGlossary.map((ag, idx) => ({
      ...ag,
      id: 'glo_md_' + Date.now() + '_' + idx,
      origin: 'guideline',
      createdAt: new Date().toISOString()
    }));

    onCreateProject({
      title: title.trim(),
      author: author.trim() || "Khuyết Danh",
      genre,
      tone,
      description: description.trim(),
      chapters: finalChapters,
      glossary: finalGlossary,
      pendingGlossary: []
    });

    // Reset Form
    setTitle('');
    setAuthor('');
    setGenre('Tiên Hiệp');
    setTone('Dịch thuần Việt mượt mà');
    setDescription('');
    setRawFileName('');
    setParsedChapters([]);
    setGuidelineFileName('');
    setAnalyzedGlossary([]);
    setAnalyzedInfo(null);
    setIsCreating(false);
  };

  const getGenreEmoji = (g: string) => {
    switch (g) {
      case 'Tiên Hiệp': return '✨';
      case 'Võ Hiệp': return '⚔️';
      case 'Ngôn Tình': return '💖';
      case 'Đô Thị': return '🏙️';
      case 'Huyền Huyễn': return '🐉';
      case 'Huyền Huyễn Phương Tây': return '🏰';
      case 'Vô Hạn Lưu': return '🌀';
      default: return '📖';
    }
  };

  return (
    <div id="project-list-root-container" className="space-y-6">
      
      {/* Outer Quick Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-5 rounded-2xl shadow-xs">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Folder className="w-4 h-4 text-indigo-600 animate-pulse" />
            Giám Sát & Quản Lý Dự Án Truyện
          </h2>
          <p className="text-xs text-slate-500">
            Tạo truyện mới, nhập tệp truyện thô (.txt, .epub), phân tích tệp hướng dẫn dịch (.md) để trích xuất từ điển thông minh, và lưu trữ dữ liệu bền vững về máy tính của bạn.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* File input for importing project JSON */}
          <input
            type="file"
            accept=".json"
            ref={importJsonInputRef}
            onChange={handleImportProjectJson}
            className="hidden"
          />
          <button
            id="btn-import-project-json"
            onClick={() => importJsonInputRef.current?.click()}
            className="flex items-center gap-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer"
            title="Đọc tệp tin .json lưu ở máy tính để dịch tiếp"
          >
            <Upload className="w-3.5 h-3.5" />
            Nạp tệp sao lưu (.json)
          </button>

          <button
            id="btn-trigger-add-project"
            onClick={() => setIsCreating(!isCreating)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-1.5 text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            {isCreating ? 'Hủy' : 'Tạo truyện mới'}
          </button>
        </div>
      </div>

      {/* Creation form */}
      {isCreating && (
        <form id="form-create-project" onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 md:p-6 space-y-5 shadow-xs animate-slide-up">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-600" />
              Thiết kế Môi trường & Bộ Truyện mới
            </h3>
            <p className="text-xs text-slate-400">
              Hãy nhập các trường liên quan. Bạn có thể sử dụng tính năng tải file bên dưới để tự động điền nhanh.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-slate-500">Tên tiểu thuyết / Bộ truyện dịch *</label>
              <input
                id="input-project-title"
                type="text"
                placeholder="Ví dụ: Đấu Phá Thương Khung, Thần Điêu Đại Hiệp..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs bg-white border border-slate-350 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-105"
                required
              />
            </div>
            
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-slate-500">Tác giả gốc</label>
              <input
                id="input-project-author"
                type="text"
                placeholder="Ví dụ: Thiên Tàm Thổ Đậu, Ngã Thất Tây Hồng Thị..."
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full text-xs bg-white border border-slate-350 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-105"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-slate-500">Thể loại chính</label>
              <select
                id="select-project-genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full text-xs bg-white border border-slate-350 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-600"
              >
                <option value="Tiên Hiệp">Tiên Hiệp (Giả tưởng bay bổng, tu tiên, tiên giới)</option>
                <option value="Võ Hiệp">Võ Hiệp (Kiếm hiệp truyền thống, ân oán giang hồ)</option>
                <option value="Ngôn Tình">Ngôn Tình (Tình cảm lãng mạn lôi cuốn)</option>
                <option value="Đô Thị">Đô Thị (Thời hiện đại, thương trường, cuộc sống)</option>
                <option value="Huyền Huyễn">Huyền Huyễn (Lịch sử giả tưởng kỳ ảo)</option>
                <option value="Huyền Huyễn Phương Tây">Huyền Huyễn Phương Tây (Hiệp sĩ, ma pháp, rồng, ma quỷ phương Tây)</option>
                <option value="Vô Hạn Lưu">Vô Hạn Lưu (Sinh tồn, luân hồi, nhiệm vụ phó bản nghẹt thở)</option>
                <option value="Khác">Thể loại khác</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-slate-500">Tông giọng biên dịch & Biên tập</label>
              <select
                id="select-project-tone"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full text-xs bg-white border border-slate-350 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-600"
              >
                <option value="Dịch thuần Việt mượt mà">Thuần Việt mượt mà (Ưu tiên câu từ lưu loát tự nhiên Việt Nam)</option>
                <option value="Trang nghiêm cổ phong">Cổ phong trang nghiêm (Từ ngữ đậm chất Hán Việt, sang quý)</option>
                <option value="Bình dị dân dã">Bình dị đời thường (Từ ngữ đơn giản mộc mạc phong vị đời thật)</option>
                <option value="Hùng tráng dồn dập">Hùng tráng dập dồn (Thích hợp truyện võ đấu, kịch tính nhiệt huyết)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] uppercase font-bold text-slate-500">Giới thiệu tóm tắt / Quy tắc dịch (Được cập nhật tự động khi tải file .md)</label>
            <textarea
              id="textarea-project-desc"
              rows={2}
              placeholder="Ghi chú về văn phong, cốt truyện hoặc cách xưng hô chung..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs bg-white border border-slate-350 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-600 resize-none"
            />
          </div>

          {/* ATTACHMENT PROCESSING SECTION */}
          <div className="border-t border-slate-200 pt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Box 1: File Raw (.txt / .epub) */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-500" />
                    Tải lên Novel Raw Gốc (.txt; .epub)
                  </h4>
                  <p className="text-[11px] text-slate-400">Trích xuất nội dung toàn bộ văn bản và chia chương nhanh</p>
                </div>
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
                  className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Chọn File Gốc
                </button>
                <span className="text-[11px] text-slate-500 truncate max-w-[150px]" title={rawFileName}>
                  {rawFileName || "Chưa chọn tệp"}
                </span>
              </div>

              {/* Splitting mechanism settings for TXT */}
              {rawFileName && rawFileName.endsWith('.txt') && (
                <div className="bg-slate-50 p-2.5 rounded-lg space-y-1.5 text-[11px]">
                  <span className="font-bold text-slate-600 block">Cơ chế tự động phân chia chương văn bản:</span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                      <input
                        type="radio"
                        checked={splitMethod === 'regex'}
                        onChange={() => handleToggleSplitMethod('regex')}
                        className="accent-indigo-600"
                      />
                      Tìm theo tên chương (&quot;Chương x&quot;)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                      <input
                        type="radio"
                        checked={splitMethod === 'chunk'}
                        onChange={() => handleToggleSplitMethod('chunk')}
                        className="accent-indigo-600"
                      />
                      Chia đều mỗi 8,000 ký tử
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
                <div className="bg-emerald-50 text-emerald-900 text-xs p-2.5 rounded-lg border border-emerald-100 flex items-start gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-emerald-950">Giải tích tệp tin hoàn tất!</span>
                    <span>Phát hiện thành công <strong>{parsedChapters.length} chương</strong> có sẵn để nạp sẵn vào truyện.</span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Box 2: Analysis Guideline Markdown (.md) */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    Tải lên Cẩm Nang Dịch Thuật (.md)
                  </h4>
                  <p className="text-[11px] text-slate-400">Ví dụ: dich_thuat.md chứa từ điển/giọng xưng hô của bộ truyện</p>
                </div>
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
                  className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Tải Lên File MD
                </button>
                <span className="text-[11px] text-slate-500 truncate max-w-[150px]" title={guidelineFileName}>
                  {guidelineFileName || "Chưa chọn tệp"}
                </span>
              </div>

              {/* Guidelines Processing logic status mapping */}
              {isAnalyzingGuidelines ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  <span>Hệ thống AI đang đọc và trích từ vựng...</span>
                </div>
              ) : analyzedGlossary.length > 0 ? (
                <div className="space-y-1 bg-emerald-50 border border-emerald-150 p-2.5 rounded-lg text-[11px] text-emerald-900">
                  <div className="flex items-center gap-1 text-xs font-bold text-emerald-950">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Bộ Hướng Dẫn & Từ Điển Đã Sẵn Sàng!</span>
                  </div>
                  <p>AI đã trích xuất thành công <strong>{analyzedGlossary.length} từ khóa</strong> nạp sẵn vào từ điển, cấu hình tông xưng hô và thể loại dịch thuật.</p>
                  
                  {/* Miniature tags representation of the extracted items */}
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto mt-1 pt-0.5">
                    {analyzedGlossary.slice(0, 8).map((it, idx) => (
                      <span key={idx} className="bg-white border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-semibold text-emerald-950">
                        {it.chinese || "???"} ➜ {it.vietnamese}
                      </span>
                    ))}
                    {analyzedGlossary.length > 8 && (
                      <span className="text-[10px] text-slate-400 font-bold px-1">+{analyzedGlossary.length - 8} từ khác...</span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-slate-200">
            <button
              id="btn-cancel-project"
              type="button"
              onClick={() => {
                setIsCreating(false);
                setRawFileName('');
                setParsedChapters([]);
                setGuidelineFileName('');
                setAnalyzedGlossary([]);
                setAnalyzedInfo(null);
              }}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              id="btn-save-project"
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-1.5 text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Lưu & Tạo truyện mới
            </button>
          </div>
        </form>
      )}

      {/* Grid displays projects */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tiểu thuyết hiện hữu trong hệ thống</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((proj) => {
            const isActive = proj.id === activeProjectId;
            return (
              <div
                id={`project-card-${proj.id}`}
                key={proj.id}
                onClick={() => onSelectProject(proj.id)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                  isActive
                    ? 'border-indigo-600 bg-indigo-50/15 shadow-xs ring-4 ring-indigo-500/5'
                    : 'border-slate-200 bg-white hover:border-slate-350 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl">{getGenreEmoji(proj.genre)}</span>
                      <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md">
                        {proj.genre}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {/* Export Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportProjectJson(proj);
                        }}
                        className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors pointer"
                        title="Sao lưu lưu trữ truyện về ổ cứng máy tính (.json)"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {projects.length > 1 && (
                        <button
                          id={`btn-delete-project-${proj.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Bạn chắc chắn muốn xóa vĩnh viễn dự án '${proj.title}'? Hành động này sẽ xóa tất cả từ điển và chương đã luỹ tích.`)) {
                              onDeleteProject(proj.id);
                            }
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors pointer"
                          title="Xóa truyện"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-0.5">
                    <h3 className="text-sm font-extrabold text-slate-900 line-clamp-1">
                      {proj.title}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                      Tác giả: <span className="text-slate-600 font-sans">{proj.author}</span>
                    </p>
                  </div>

                  {proj.description && (
                    <p className="mt-3 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {proj.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 space-y-2 text-[11px] text-slate-400">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Tổng số chương dịch:</span>
                    </div>
                    <strong className="text-slate-800 font-extrabold">{proj.chapters.length} chương</strong>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Bảng từ điển (Glossary):</span>
                    </div>
                    <strong className="text-slate-800 font-extrabold">{proj.glossary.length} từ</strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Phong cách:</span>
                    </div>
                    <strong className="text-slate-850 font-bold truncate max-w-[120px]" title={proj.tone}>{proj.tone}</strong>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400/80 pt-1">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>Ngày khởi tạo:</span>
                    </div>
                    <span>{new Date(proj.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>

                  {/* Progress bar */}
                  {(() => {
                    const prog = getProjectProgress(proj);
                    return prog.total > 0 ? (
                      <div className="pt-2 space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400">Tiến trình dịch</span>
                          <span className="font-bold text-indigo-700">{prog.done}/{prog.total} chương ({prog.pct}%)</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: prog.pct + '%' }}
                          />
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Export text buttons */}
                  {proj.chapters.length > 0 && (
                    <div className="flex gap-1.5 pt-2 border-t border-slate-50">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleExportText(proj, 'vietnamese'); }}
                        className="flex-1 text-center text-[10px] font-semibold py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-md transition"
                        title="Xuất bản dịch tiếng Việt (.txt)"
                      >
                        ↓ Bản Việt (.txt)
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleExportText(proj, 'bilingual'); }}
                        className="flex-1 text-center text-[10px] font-semibold py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-md transition"
                        title="Xuất song ngữ Trung-Việt (.txt)"
                      >
                        ↓ Song ngữ (.txt)
                      </button>
                    </div>
                  )}
                </div>

                {isActive && (
                  <div className="absolute top-4 right-14 bg-indigo-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wider uppercase">
                    ĐANG DỊCH
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
