import React, { useState, useRef, useMemo } from 'react';
import { StoryProject, GlossaryItem, Chapter } from '../types';
import { getChapterFromDB } from '../services/db';
import { useNotifications } from './NotificationSystem';
import { triggerDownload } from '../utils/download';
import { parseTxtContent, parseEpubFile } from '../utils/fileParser';
import { apiFetch } from '../utils/apiClient';
import JSZip from 'jszip';
import { 
  Plus, Trash2, Folder, BookOpen, Clock, Tag, FileText, Upload, Download, 
  Sparkles, Loader2, Check, AlertCircle, ChevronRight, Info, Calendar, ArrowUpRight, Edit3
} from 'lucide-react';

interface ProjectListProps {
  projects: StoryProject[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onCreateProject: (project: Omit<StoryProject, 'id' | 'createdAt'>) => void;
  onUpdateProject?: (project: StoryProject) => void;
  apiKeys: string[];
  selectedModel: string;
}

export default function ProjectList({
  projects,
  activeProjectId,
  onSelectProject,
  onDeleteProject,
  onCreateProject,
  onUpdateProject,
  apiKeys,
  selectedModel,
}: ProjectListProps) {
  const { showToast, showConfirm } = useNotifications();
  const [isExportingEpub, setIsExportingEpub] = useState<string | null>(null);

  const handleExportEpub = async (proj: StoryProject) => {
    setIsExportingEpub(proj.id);
    try {
      const fullChapters: Chapter[] = [];
      if (proj.chapters && Array.isArray(proj.chapters)) {
        for (const meta of proj.chapters) {
          const chap = await getChapterFromDB(meta.id);
          if (chap) {
            fullChapters.push(chap);
          }
        }
      }

      if (fullChapters.length === 0) {
        showToast({ message: "Không có chương truyện nào để xuất bản EPUB.", type: "warning" });
        setIsExportingEpub(null);
        return;
      }

      const sortedChapters = [...fullChapters].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      const zip = new JSZip();

      zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

      zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

      zip.file('OEBPS/style.css', `body {
  font-family: "Georgia", "Times New Roman", serif;
  margin: 10%;
  line-height: 1.6;
  font-size: 1.1em;
  color: #111111;
  background-color: #fcfcfc;
}
h1 {
  text-align: center;
  font-size: 1.6em;
  margin-bottom: 1.5em;
  color: #0b1a30;
  border-bottom: 1px solid #eaeaea;
  padding-bottom: 0.5em;
}
p {
  text-indent: 1.5em;
  margin-top: 0;
  margin-bottom: 0.8em;
  text-align: justify;
}
.author {
  text-align: center;
  font-style: italic;
  margin-bottom: 2em;
}
.description {
  margin: 2em 10%;
  padding: 1em;
  border-left: 3px solid #ccc;
  background-color: #f5f5f5;
  font-size: 0.95em;
  line-height: 1.5;
}
`);

      const spineItems: string[] = [];
      const manifestItems: string[] = [];
      const navLinks: string[] = [];
      const ncxPoints: string[] = [];

      const coverHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${proj.title}</title>
  <link rel="stylesheet" href="style.css" type="text/css"/>
</head>
<body>
  <div style="text-align: center; margin-top: 25%;">
    <h1 style="border: none; margin-bottom: 0.2em; font-size: 2.2em;">${proj.title}</h1>
    <p class="author" style="font-size: 1.2em; margin-top: 0.5em;">Tác giả: ${proj.author || "Khuyết Danh"}</p>
    <div style="margin-top: 10%; font-size: 0.9em; color: #555;">
      <p style="text-align: center; text-indent: 0;">Thể loại: ${proj.genre || "Chưa phân loại"}</p>
      <p style="text-align: center; text-indent: 0;">Tông giọng dịch: ${proj.tone || "Chuẩn"}</p>
    </div>
    ${proj.description ? `
    <div class="description">
      <h3 style="margin-top:0; font-size: 1.1em; color: #333;">Giới thiệu tác phẩm:</h3>
      <p style="text-indent: 0; text-align: left;">${proj.description.replace(/\n+/g, '<br/>')}</p>
    </div>` : ''}
  </div>
</body>
</html>`;
      zip.file('OEBPS/cover.xhtml', coverHtml);
      manifestItems.push(`<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`);
      spineItems.push(`<itemref idref="cover"/>`);
      navLinks.push(`<li><a href="cover.xhtml">Giới thiệu tác phẩm</a></li>`);
      ncxPoints.push(`<navPoint id="navPoint-cover" playOrder="1">
        <navLabel><text>Giới thiệu tác phẩm</text></navLabel>
        <content src="cover.xhtml"/>
      </navPoint>`);

      sortedChapters.forEach((chap, idx) => {
        const chapId = `chap_${idx + 1}`;
        const filename = `${chapId}.xhtml`;
        
        const textContent = chap.polishedTranslation || chap.rawTranslation || "Chưa dịch";
        const paragraphs = textContent.split(/\r?\n/).map(p => p.trim()).filter(p => p.length > 0);
        const pTags = paragraphs.map(p => `<p>${p}</p>`).join('\n  ');

        const chapHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${chap.title}</title>
  <link rel="stylesheet" href="style.css" type="text/css"/>
</head>
<body>
  <h1>${chap.title}</h1>
  ${pTags}
</body>
</html>`;

        zip.file(`OEBPS/${filename}`, chapHtml);
        manifestItems.push(`<item id="${chapId}" href="${filename}" media-type="application/xhtml+xml"/>`);
        spineItems.push(`<itemref idref="${chapId}"/>`);
        navLinks.push(`<li><a href="${filename}">${chap.title}</a></li>`);
        ncxPoints.push(`<navPoint id="navPoint-${chapId}" playOrder="${idx + 2}">
          <navLabel><text>${chap.title}</text></navLabel>
          <content src="${filename}"/>
        </navPoint>`);
      });

      const navHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Mục lục</title>
  <link rel="stylesheet" href="style.css" type="text/css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Mục lục sách</h1>
    <ol>
      ${navLinks.join('\n      ')}
    </ol>
  </nav>
</body>
</html>`;
      zip.file('OEBPS/nav.xhtml', navHtml);
      manifestItems.push(`<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`);

      const ncxXml = `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${proj.id}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${proj.title}</text>
  </docTitle>
  <navMap>
    ${ncxPoints.join('\n    ')}
  </navMap>
</ncx>`;
      zip.file('OEBPS/toc.ncx', ncxXml);
      manifestItems.push(`<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`);

      const opfXml = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${proj.title}</dc:title>
    <dc:creator>${proj.author || "Khuyết Danh"}</dc:creator>
    <dc:identifier id="bookid">urn:uuid:${proj.id}</dc:identifier>
    <dc:language>vi</dc:language>
    <dc:date>${new Date().toISOString()}</dc:date>
    <dc:description>${proj.description || ""}</dc:description>
  </metadata>
  <manifest>
    <item id="style" href="style.css" media-type="text/css"/>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spineItems.join('\n    ')}
  </spine>
</package>`;
      zip.file('OEBPS/content.opf', opfXml);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      triggerDownload(url, `${proj.title.replace(/[\s\/:*?"<>|]+/g, '_')}.epub`);
      URL.revokeObjectURL(url);
      showToast({ message: "Xuất bản và đóng gói EPUB thành công!", type: "success" });
    } catch (err: any) {
      console.error(err);
      showToast({ message: "Lỗi đóng gói EPUB: " + err.message, type: "error" });
    } finally {
      setIsExportingEpub(null);
    }
  };

  // Memoize project completion progress calculations to avoid recalculating on every render
  const projectProgressMap = useMemo(() => {
    const map = new Map<string, { total: number; done: number; pct: number }>();
    projects.forEach((proj) => {
      const total = proj.chapters.length;
      if (total === 0) {
        map.set(proj.id, { total: 0, done: 0, pct: 0 });
      } else {
        const done = proj.chapters.filter((c) => c.status === 'completed').length;
        map.set(proj.id, { total, done, pct: Math.round((done / total) * 100) });
      }
    });
    return map;
  }, [projects]);

  const [isCreating, setIsCreating] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [genre, setGenre] = useState('Tiên Hiệp');
  const [tone, setTone] = useState('Dịch thuần Việt mượt mà');
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
        const chaps = parseTxtContent(fullText, splitMethod);
        setParsedChapters(chaps);
      } else if (file.name.endsWith('.epub')) {
        const chaps = await parseEpubFile(file);
        setParsedChapters(chaps);
      } else {
        showToast({ message: "Chỉ hỗ trợ định dạng tệp .txt hoặc .epub.", type: 'warning' });
        setRawFileName('');
      }
    } catch (err: any) {
      console.error(err);
      showToast({ message: "Lỗi khi đọc file raw gốc: " + err.message, type: 'error' });
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
        const chaps = parseTxtContent(fullText, method);
        setParsedChapters(chaps);
      } catch (err: any) {
        showToast({ message: err.message, type: 'error' });
      } finally {
        setIsParsingRaw(false);
      }
    }
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
      const response = await apiFetch('/api/analyze-guidelines', {
        method: 'POST',
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
      
      if (data.truncated) {
        showToast({
          message: `Lưu ý: Chỉ ${data.analyzedLength.toLocaleString()} / ${data.originalLength.toLocaleString()} ký tự đầu tiên của cẩm nang được phân tích để tối ưu hiệu suất.`,
          type: 'warning'
        });
      }

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
      showToast({ message: "Không thể phân tích cẩm nang dịch thuật: " + err.message, type: 'error' });
      setGuidelineFileName('');
    } finally {
      setIsAnalyzingGuidelines(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };


  // --- 3. EXPORT PROJECT TO DISK (.json) ---
  const handleExportProjectJson = async (proj: StoryProject) => {
    const fullChapters: Chapter[] = [];
    if (proj.chapters && Array.isArray(proj.chapters)) {
      for (const meta of proj.chapters) {
        const chap = await getChapterFromDB(meta.id);
        if (chap) {
          fullChapters.push(chap);
        }
      }
    }

    const projectWithFullChapters = {
      ...proj,
      chapters: fullChapters
    };

    const jsonString = JSON.stringify(projectWithFullChapters, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    triggerDownload(url, `${proj.title.replace(/[\s\/:*?"<>|]+/g, '_')}_from_disk.json`);
    URL.revokeObjectURL(url);
  };

  // Export polished Vietnamese text or bilingual side-by-side
  const handleExportText = async (proj: StoryProject, mode: 'vietnamese' | 'bilingual') => {
    let output = '';
    for (const chapterMeta of proj.chapters) {
      const chapter = await getChapterFromDB(chapterMeta.id);
      if (!chapter) continue;
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
    }

    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${proj.title.replace(/[\s\/:*?"<>|]+/g, '_')}_${mode}.txt`);
    URL.revokeObjectURL(url);
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
          showToast({ message: "Tệp JSON không hợp lệ, không tìm thấy tên tiểu thuyết (title).", type: 'error' });
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
        showToast({ message: `Nhập khẩu dự án thành công! Thêm bộ truyện "${projectPayload.title}" với ${projectPayload.chapters.length} chương và ${projectPayload.glossary.length} từ điển.`, type: 'success' });
      } catch (err: any) {
        showToast({ message: "Lỗi giải mã cấu trúc dữ liệu tệp JSON: " + err.message, type: 'error' });
      }
    };
    reader.readAsText(file);
    
    // Clear input
    if (importJsonInputRef.current) {
      importJsonInputRef.current.value = '';
    }
  };


  // --- 5. CREATE OR UPDATE SUBMIT HANDLER ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast({ message: "Vui lòng điền tên tiểu thuyết.", type: 'warning' });
      return;
    }

    // Convert parsed chapters list into matching Type schemas
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
      updatedAt: new Date().toISOString()
    }));

    // Convert analyzed glossary items into matching Type schemas
    const finalGlossary: GlossaryItem[] = analyzedGlossary.map((ag, idx) => ({
      ...ag,
      id: 'glo_md_' + Date.now() + '_' + idx,
      origin: 'guideline',
      createdAt: new Date().toISOString()
    }));

    if (editingProjectId && onUpdateProject) {
      const existingProj = projects.find(p => p.id === editingProjectId);
      if (existingProj) {
        const updatedProj: StoryProject = {
          ...existingProj,
          title: title.trim(),
          author: author.trim() || "Khuyết Danh",
          genre,
          tone,
          description: description.trim(),
          chapters: [...existingProj.chapters, ...finalChapters],
          glossary: [...existingProj.glossary, ...finalGlossary]
        };
        onUpdateProject(updatedProj);
        showToast({ message: `Đã cập nhật thông tin truyện "${title.trim()}" thành công!`, type: 'success' });
      }
    } else {
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
    }

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
    if (rawInputRef.current) rawInputRef.current.value = '';
    if (mdInputRef.current) mdInputRef.current.value = '';
    setEditingProjectId(null);
    setIsCreating(false);
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setEditingProjectId(null);
    setTitle('');
    setAuthor('');
    setGenre('Tiên Hiệp');
    setTone('Dịch thuần Việt mượt mà');
    setDescription('');
    setRawFileName('');
    setGuidelineFileName('');
    setParsedChapters([]);
    setAnalyzedGlossary([]);
    setAnalyzedInfo(null);
    if (rawInputRef.current) rawInputRef.current.value = '';
    if (mdInputRef.current) mdInputRef.current.value = '';
  };

  const handleStartEditProject = (e: React.MouseEvent, proj: StoryProject) => {
    e.stopPropagation();
    setEditingProjectId(proj.id);
    setTitle(proj.title);
    setAuthor(proj.author);
    setGenre(proj.genre);
    setTone(proj.tone);
    setDescription(proj.description || '');
    setRawFileName('');
    setGuidelineFileName('');
    setParsedChapters([]);
    setAnalyzedGlossary([]);
    setAnalyzedInfo(null);
    setIsCreating(true);

    setTimeout(() => {
      const formElement = document.getElementById('form-create-project');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
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
      case 'Lịch Sử / Quân Sự': return '🛡️';
      case 'Khoa Huyễn / Võng Du': return '🤖';
      case 'Linh Dị / Thần Quái': return '👻';
      case 'Hệ Thống / Điền Văn': return '🌾';
      default: return '📖';
    }
  };

  return (
    <div id="project-list-root-container" className="space-y-6">
      
      {/* Outer Quick Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl shadow-xs">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Folder className="w-4 h-4 text-indigo-400 animate-pulse" />
            Giám Sát & Quản Lý Dự Án Truyện
          </h2>
          <p className="text-xs text-slate-400">
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
            className="flex items-center gap-1.5 border border-slate-800 hover:bg-slate-850 hover:text-slate-200 text-slate-300 font-semibold px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer"
            title="Đọc tệp tin .json lưu ở máy tính để dịch tiếp"
          >
            <Upload className="w-3.5 h-3.5" />
            Nạp tệp sao lưu (.json)
          </button>

          <button
            id="btn-trigger-add-project"
            onClick={() => {
              if (isCreating) {
                handleCancelCreate();
              } else {
                setIsCreating(true);
              }
            }}
            className="flex items-center gap-1.5 bg-indigo-650 hover:bg-indigo-755 text-white font-bold px-4 py-1.5 text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            {isCreating ? 'Hủy' : 'Tạo truyện mới'}
          </button>
        </div>
      </div>

      {/* Creation form */}
      {isCreating && (
        <form id="form-create-project" onSubmit={handleSubmit} className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 md:p-6 space-y-5 shadow-xs animate-slide-up">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              {editingProjectId ? <Edit3 className="w-4 h-4 text-indigo-400" /> : <Plus className="w-4 h-4 text-indigo-400" />}
              {editingProjectId ? 'Chỉnh sửa Môi trường & Bộ truyện' : 'Thiết kế Môi trường & Bộ Truyện mới'}
            </h3>
            <p className="text-xs text-slate-450">
              {editingProjectId
                ? 'Cập nhật các trường liên quan bên dưới để chỉnh sửa thông tin bộ truyện. Bạn cũng có thể tải file raw hoặc file cẩm nang để nhập thêm chương/từ mới.'
                : 'Hãy nhập các trường liên quan. Bạn có thể sử dụng tính năng tải file bên dưới để tự động điền nhanh.'
              }
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] uppercase font-bold text-slate-400">Tên tiểu thuyết / Bộ truyện dịch *</label>
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
              <label className="block text-[10px] uppercase font-bold text-slate-400">Tông giọng biên dịch & Biên tập</label>
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
            <label className="block text-[10px] uppercase font-bold text-slate-400">Giới thiệu tóm tắt / Quy tắc dịch (Được cập nhật tự động khi tải file .md)</label>
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
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-450" />
                    Tải lên Novel Raw Gốc (.txt; .epub)
                  </h4>
                  <p className="text-[11px] text-slate-500">Trích xuất nội dung toàn bộ văn bản và chia chương nhanh</p>
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
                  className="flex items-center gap-1 bg-blue-950/30 hover:bg-blue-900/30 border border-blue-900/40 text-blue-300 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Chọn File Gốc
                </button>
                <span className="text-[11px] text-slate-450 truncate max-w-[150px]" title={rawFileName}>
                  {rawFileName || "Chưa chọn tệp"}
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
                <div className="bg-emerald-950/15 border border-emerald-900/30 text-emerald-300 text-xs p-2.5 rounded-lg flex items-start gap-1.5">
                  <Check className="w-4 h-4 text-emerald-450 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-emerald-350">Giải tích tệp tin hoàn tất!</span>
                    <span>Phát hiện thành công <strong>{parsedChapters.length} chương</strong> có sẵn để nạp sẵn vào truyện.</span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Box 2: Analysis Guideline Markdown (.md) */}
            <div className="bg-slate-950/20 border border-slate-800/80 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    Tải lên Cẩm Nang Dịch Thuật (.md)
                  </h4>
                  <p className="text-[11px] text-slate-500">Ví dụ: dich_thuat.md chứa từ điển/giọng xưng hô của bộ truyện</p>
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
                  className="flex items-center gap-1 bg-indigo-950/30 hover:bg-indigo-900/30 border border-indigo-900/40 text-indigo-300 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Tải Lên File MD
                </button>
                <span className="text-[11px] text-slate-455 truncate max-w-[150px]" title={guidelineFileName}>
                  {guidelineFileName || "Chưa chọn tệp"}
                </span>
              </div>

              {/* Guidelines Processing logic status mapping */}
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
                  
                  {/* Miniature tags representation of the extracted items */}
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto mt-1 pt-0.5">
                    {analyzedGlossary.slice(0, 8).map((it, idx) => (
                      <span key={idx} className="bg-slate-950 border border-emerald-900/60 px-1.5 py-0.5 rounded text-[10px] font-semibold text-emerald-300">
                        {it.chinese || "???"} ➜ {it.vietnamese}
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
              onClick={handleCancelCreate}
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
              {editingProjectId ? 'Lưu & Cập nhật truyện' : 'Lưu & Tạo truyện mới'}
            </button>
          </div>
        </form>
      )}

      {/* Grid displays projects */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-450 uppercase tracking-widest">Tiểu thuyết hiện hữu trong hệ thống</h3>
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
                    ? 'border-indigo-600 bg-indigo-950/20 shadow-xs ring-4 ring-indigo-550/15'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl">{getGenreEmoji(proj.genre)}</span>
                      <span className="bg-slate-950 text-slate-300 border border-slate-800 text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md">
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
                        className="text-slate-400 hover:text-indigo-400 p-1.5 rounded-lg hover:bg-slate-850 transition-colors cursor-pointer"
                        title="Sao lưu lưu trữ truyện về ổ cứng máy tính (.json)"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={(e) => handleStartEditProject(e, proj)}
                        className="text-slate-400 hover:text-indigo-400 p-1.5 rounded-lg hover:bg-slate-850 transition-colors cursor-pointer"
                        title="Chỉnh sửa thông tin môi trường và bộ truyện"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {projects.length > 1 && (
                        <button
                          id={`btn-delete-project-${proj.id}`}
                          onClick={async (e) => {
                            e.stopPropagation();
                            const confirmed = await showConfirm({
                              title: 'Xóa vĩnh viễn dự án',
                              message: `Bạn chắc chắn muốn xóa vĩnh viễn dự án '${proj.title}'? Hành động này sẽ xóa tất cả từ điển và chương đã luỹ tích.`,
                              confirmText: 'Xác nhận xóa',
                              cancelText: 'Hủy',
                              type: 'danger'
                            });
                            if (confirmed) {
                              onDeleteProject(proj.id);
                            }
                          }}
                          className="text-slate-400 hover:text-rose-455 p-1.5 rounded-lg hover:bg-rose-955/40 transition-colors cursor-pointer"
                          title="Xóa truyện"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-0.5">
                    <h3 className="text-sm font-extrabold text-slate-200 line-clamp-1">
                      {proj.title}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                      Tác giả: <span className="text-slate-350 font-sans">{proj.author}</span>
                    </p>
                  </div>

                  {proj.description && (
                    <p className="mt-3 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {proj.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800/80 space-y-2 text-[11px] text-slate-450">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Tổng số chương dịch:</span>
                    </div>
                    <strong className="text-slate-200 font-extrabold">{proj.chapters.length} chương</strong>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Bảng từ điển (Glossary):</span>
                    </div>
                    <strong className="text-slate-200 font-extrabold">{proj.glossary.length} từ</strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Phong cách:</span>
                    </div>
                    <strong className="text-slate-300 font-bold truncate max-w-[120px]" title={proj.tone}>{proj.tone}</strong>
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
                    const prog = projectProgressMap.get(proj.id) || { total: 0, done: 0, pct: 0 };
                    return prog.total > 0 ? (
                      <div className="pt-2 space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-405">Tiến trình dịch</span>
                          <span className="font-bold text-indigo-400">{prog.done}/{prog.total} chương ({prog.pct}%)</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-950 border border-slate-800/60 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: prog.pct + '%' }}
                          />
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {proj.chapters.length > 0 && (
                    <div className="flex gap-1.5 pt-2 border-t border-slate-800/60">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleExportText(proj, 'vietnamese'); }}
                        className="flex-1 text-center text-[10px] font-semibold py-1.5 bg-emerald-950/20 hover:bg-emerald-900/20 text-emerald-400 border border-emerald-900/40 rounded-md transition cursor-pointer"
                        title="Xuất bản dịch tiếng Việt (.txt)"
                      >
                        ↓ Bản Việt (.txt)
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleExportText(proj, 'bilingual'); }}
                        className="flex-1 text-center text-[10px] font-semibold py-1.5 bg-indigo-950/20 hover:bg-indigo-900/20 text-indigo-300 border border-indigo-900/40 rounded-md transition cursor-pointer"
                        title="Xuất song ngữ Trung-Việt (.txt)"
                      >
                        ↓ Song ngữ (.txt)
                      </button>
                      <button
                        disabled={isExportingEpub === proj.id}
                        onClick={(e) => { e.stopPropagation(); handleExportEpub(proj); }}
                        className="flex-1 text-center text-[10px] font-semibold py-1.5 bg-amber-950/20 hover:bg-amber-900/20 text-amber-400 border border-amber-900/40 rounded-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Đóng gói và xuất file sách điện tử (.epub) để đọc trên điện thoại/Kindle"
                      >
                        {isExportingEpub === proj.id ? 'Đang xuất...' : '↓ Sách EPUB'}
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
