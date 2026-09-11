import React, { useMemo, useState, useRef } from 'react';
import { BookUp, Eye, EyeOff, Link2, Unlink, ListOrdered, Loader2, CheckCircle2, AlertCircle, CircleDashed, Trash2, ImageUp, Copy, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { StoryProject } from '../../types';
import { ZuminovelNovel, ZuminovelUploadResult } from '../../types/zuminovel';
import { ZuminovelPublishOverrides } from '../../services/zuminovelPublishService';

export interface ZuminovelPublishPanelProps {
  project: StoryProject;
  totalChapters: number;

  apiKey: string;
  setApiKey: (key: string) => void;
  isVerifying: boolean;
  isKeyValid: boolean | null;
  novels: ZuminovelNovel[];
  handleVerifyKey: () => void;
  handleLinkNovel: (novel: ZuminovelNovel) => void;
  handleUnlinkNovel: () => void;

  isPublishing: boolean;
  publishProgress: { index: number; total: number } | null;
  handlePublishChapters: (chapterIds: string[], overrides?: ZuminovelPublishOverrides) => void;

  deletingChapterId: string | null;
  handleDeleteChapter: (chapterId: string) => void;

  isUploading: boolean;
  uploadResult: ZuminovelUploadResult | null;
  handleUploadImage: (file: File, folder?: string) => void;

  publishRangeEnabled: boolean;
  setPublishRangeEnabled: (b: boolean) => void;
  publishRangeStart: number;
  setPublishRangeStart: (n: number) => void;
  publishRangeEnd: number;
  setPublishRangeEnd: (n: number) => void;
}

export const ZuminovelPublishPanel = React.memo(function ZuminovelPublishPanel({
  project,
  totalChapters,
  apiKey,
  setApiKey,
  isVerifying,
  isKeyValid,
  novels,
  handleVerifyKey,
  handleLinkNovel,
  handleUnlinkNovel,
  isPublishing,
  publishProgress,
  handlePublishChapters,
  deletingChapterId,
  handleDeleteChapter,
  isUploading,
  uploadResult,
  handleUploadImage,
  publishRangeEnabled,
  setPublishRangeEnabled,
  publishRangeStart,
  setPublishRangeStart,
  publishRangeEnd,
  setPublishRangeEnd,
}: ZuminovelPublishPanelProps) {
  const [revealKey, setRevealKey] = useState(false);
  const [onlyPending, setOnlyPending] = useState(true);
  const [isVIP, setIsVIP] = useState(false);
  const [price, setPrice] = useState(0);
  const [uploadFolder, setUploadFolder] = useState('chapters');
  const [copiedField, setCopiedField] = useState<'url' | 'img' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLinked = !!(project.zuminovelNovelId || project.zuminovelNovelSlug);

  const publishedChapters = useMemo(
    () => project.chapters.filter((c) => !!c.zuminovelChapterId),
    [project.chapters]
  );

  const copyToClipboard = async (text: string, field: 'url' | 'img') => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      // Bỏ qua nếu trình duyệt chặn clipboard — người dùng vẫn có thể tự bôi đen chép tay.
    }
  };

  const safeStart = Math.max(1, Math.min(publishRangeEnabled ? publishRangeStart : 1, totalChapters || 1));
  const safeEnd = Math.max(safeStart, Math.min(publishRangeEnabled ? publishRangeEnd : totalChapters, totalChapters || 1));

  const { counts, idsToPublish } = useMemo(() => {
    const inRange = totalChapters > 0 ? project.chapters.slice(safeStart - 1, safeEnd) : [];
    const c = { never_published: 0, synced: 0, error: 0 };
    const ids: string[] = [];
    for (const meta of inRange) {
      const isPending = !meta.zuminovelChapterId || meta.zuminovelSyncStatus === 'error';
      if (!meta.zuminovelChapterId) c.never_published++;
      else if (meta.zuminovelSyncStatus === 'error') c.error++;
      else c.synced++;
      if (!onlyPending || isPending) ids.push(meta.id);
    }
    return { counts: c, idsToPublish: ids };
  }, [project.chapters, safeStart, safeEnd, totalChapters, onlyPending]);

  return (
    <div id="zuminovel-publish-card" className="space-y-4 bg-parchment border border-parchment-2 p-5 rounded-md shadow-xs">
      <h3 className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-2 border-b border-parchment-2 pb-2 font-display">
        <BookUp className="w-4 h-4 text-polish" /> Đăng lên ZumiNovel
      </h3>

      {/* --- Bước 1: API Key --- */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-text-main uppercase tracking-wider">API Key ZumiNovel</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-1 border border-parchment-2 rounded-[2px] px-2.5 py-1.5 bg-ink">
            <input
              type={revealKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="zn_..."
              className="flex-1 bg-transparent text-xs text-text-main focus:outline-none font-mono"
            />
            <button type="button" onClick={() => setRevealKey((v) => !v)} className="text-text-muted hover:text-text-main shrink-0" aria-label="Hiện/ẩn API Key">
              {revealKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={handleVerifyKey} disabled={isVerifying || !apiKey.trim()}>
            {isVerifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Kiểm tra'}
          </Button>
        </div>
        {isKeyValid === true && (
          <p className="text-[11px] text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Key hợp lệ — tìm thấy {novels.length} truyện sở hữu.</p>
        )}
        {isKeyValid === false && (
          <p className="text-[11px] text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Key không hợp lệ hoặc chưa kết nối được — xem log bên dưới.</p>
        )}
      </div>

      {/* --- Bước 2: liên kết truyện --- */}
      <div className="space-y-1.5 pt-1 border-t border-parchment-2">
        <label className="text-xs font-bold text-text-main uppercase tracking-wider">Truyện trên ZumiNovel</label>
        {isLinked ? (
          <div className="flex items-center justify-between bg-ink border border-parchment-2 rounded-[2px] px-3 py-2">
            <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-polish" /> {project.zuminovelNovelTitle || project.zuminovelNovelSlug || project.zuminovelNovelId}
            </span>
            <button type="button" onClick={handleUnlinkNovel} className="text-[10px] font-bold text-text-muted hover:text-red-500 flex items-center gap-1">
              <Unlink className="w-3 h-3" /> Đổi truyện khác
            </button>
          </div>
        ) : novels.length > 0 ? (
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {novels.map((novel) => (
              <button
                key={novel.id}
                type="button"
                onClick={() => handleLinkNovel(novel)}
                className="w-full text-left px-3 py-2 rounded-[2px] border border-parchment-2 bg-ink text-xs text-text-main hover:border-polish hover:bg-polish/10 transition-colors"
              >
                {novel.title} <span className="text-text-muted font-mono text-[10px]">({novel.slug})</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-text-muted">Kiểm tra API Key ở trên để tải danh sách truyện bạn sở hữu trên ZumiNovel.</p>
        )}
      </div>

      {/* --- Bước 3: phạm vi + bộ lọc trạng thái --- */}
      <div className="space-y-2.5 pt-3 border-t border-parchment-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
            <ListOrdered className="w-3.5 h-3.5 text-polish" /> Giới hạn phạm vi chương đăng
          </span>
          <button
            type="button"
            onClick={() => setPublishRangeEnabled(!publishRangeEnabled)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${publishRangeEnabled ? 'bg-polish' : 'bg-parchment-2'}`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ${publishRangeEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>
        {publishRangeEnabled && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-muted uppercase block">Từ số</label>
              <input
                type="number"
                min={1}
                max={totalChapters}
                value={publishRangeStart}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(totalChapters, Number(e.target.value)));
                  setPublishRangeStart(v);
                  if (v > publishRangeEnd) setPublishRangeEnd(v);
                }}
                className="w-full text-center text-sm font-bold border border-parchment-2 rounded-[2px] bg-ink py-1.5 text-text-main focus:outline-none focus:border-polish"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-muted uppercase block">Đến số</label>
              <input
                type="number"
                min={publishRangeStart}
                max={totalChapters}
                value={publishRangeEnd}
                onChange={(e) => setPublishRangeEnd(Math.max(publishRangeStart, Math.min(totalChapters, Number(e.target.value))))}
                className="w-full text-center text-sm font-bold border border-parchment-2 rounded-[2px] bg-ink py-1.5 text-text-main focus:outline-none focus:border-polish"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
          <button type="button" onClick={() => setOnlyPending(true)} className={`py-1.5 px-2 rounded-[2px] text-xs font-bold border cursor-pointer ${onlyPending ? 'border-polish bg-polish/10 text-polish shadow-xs' : 'border-parchment-2 bg-ink text-text-muted hover:bg-parchment-2 hover:text-text-main'}`}>Chỉ chương chưa đăng/lỗi</button>
          <button type="button" onClick={() => setOnlyPending(false)} className={`py-1.5 px-2 rounded-[2px] text-xs font-bold border cursor-pointer ${!onlyPending ? 'border-polish bg-polish/10 text-polish shadow-xs' : 'border-parchment-2 bg-ink text-text-muted hover:bg-parchment-2 hover:text-text-main'}`}>Toàn bộ trong phạm vi</button>
        </div>

        <div className="flex items-center gap-3 text-[10px] font-bold pt-1">
          <span className="flex items-center gap-1 text-text-muted"><CircleDashed className="w-3 h-3" /> {counts.never_published} chưa đăng</span>
          <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3 h-3" /> {counts.synced} đã đồng bộ</span>
          <span className="flex items-center gap-1 text-red-500"><AlertCircle className="w-3 h-3" /> {counts.error} lỗi</span>
        </div>
      </div>

      {/* --- Bước 4: tùy chọn thu phí --- */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-parchment-2">
        <button
          type="button"
          onClick={() => setIsVIP((v) => !v)}
          className={`py-1.5 px-2 rounded-[2px] text-xs font-bold border cursor-pointer ${isVIP ? 'border-polish bg-polish/10 text-polish shadow-xs' : 'border-parchment-2 bg-ink text-text-muted hover:bg-parchment-2 hover:text-text-main'}`}
        >
          {isVIP ? 'Chương VIP (thu phí)' : 'Chương miễn phí'}
        </button>
        <input
          type="number"
          min={0}
          disabled={!isVIP}
          value={price}
          onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))}
          placeholder="Giá (VND/Zumi)"
          className="w-full text-center text-xs font-bold border border-parchment-2 rounded-[2px] bg-ink py-1.5 text-text-main focus:outline-none focus:border-polish disabled:opacity-40"
        />
      </div>

      {isPublishing && publishProgress && (
        <div className="bg-ink border border-parchment-2 rounded-[2px] px-3 py-2 text-[11px] text-text-main flex items-center justify-between">
          <span className="text-text-muted">Đang đăng...</span>
          <strong className="text-polish font-bold">{publishProgress.index}/{publishProgress.total}</strong>
        </div>
      )}

      <Button
        type="button"
        variant="primary"
        size="md"
        onClick={() => handlePublishChapters(idsToPublish, isVIP ? { isVIP, price } : undefined)}
        disabled={isPublishing || !isLinked || !apiKey.trim() || idsToPublish.length === 0}
        icon={isPublishing ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <BookUp className="w-4 h-4 text-white" />}
        className="w-full py-2.5 glow-polish"
      >
        {isPublishing ? 'Đang đăng lên ZumiNovel...' : `Đăng ${idsToPublish.length} chương lên ZumiNovel`}
      </Button>

      {/* --- Chương đã đăng: cho phép xoá, luôn xác nhận trước (xem cảnh báo trong tài liệu ZumiNovel) --- */}
      {publishedChapters.length > 0 && (
        <div className="space-y-1.5 pt-3 border-t border-parchment-2">
          <label className="text-xs font-bold text-text-main uppercase tracking-wider">
            Chương đã đăng trên ZumiNovel ({publishedChapters.length})
          </label>
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {publishedChapters.map((meta) => (
              <div
                key={meta.id}
                className="flex items-center justify-between gap-2 bg-ink border border-parchment-2 rounded-[2px] px-3 py-1.5"
              >
                <span className="text-xs text-text-main truncate flex items-center gap-1.5">
                  {meta.zuminovelSyncStatus === 'error' ? (
                    <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                  )}
                  {meta.title}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteChapter(meta.id)}
                  disabled={deletingChapterId === meta.id}
                  aria-label={`Xoá "${meta.title}" khỏi ZumiNovel`}
                  className="shrink-0 text-text-muted hover:text-red-500 disabled:opacity-40 p-1"
                >
                  {deletingChapterId === meta.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- Tiện ích tải ảnh lên CDN ZumiNovel (POST /external/upload) --- */}
      <div className="space-y-1.5 pt-3 border-t border-parchment-2">
        <label className="text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-1.5">
          <ImageUp className="w-3.5 h-3.5 text-polish" /> Tải ảnh lên ZumiNovel (CDN)
        </label>
        <p className="text-[11px] text-text-muted">
          Dùng cho ảnh minh hoạ chèn vào nội dung chương — không tự động chèn, bạn tự dán URL/thẻ &lt;img&gt; vào chỗ cần trong bản dịch. Tối đa 5MB/ảnh.
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUploadImage(file, uploadFolder.trim() || undefined);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || !apiKey.trim()}
            icon={isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageUp className="w-3.5 h-3.5" />}
          >
            {isUploading ? 'Đang tải...' : 'Chọn ảnh & tải lên'}
          </Button>
          <input
            type="text"
            value={uploadFolder}
            onChange={(e) => setUploadFolder(e.target.value)}
            placeholder="folder (mặc định: chapters)"
            className="flex-1 min-w-0 text-xs border border-parchment-2 rounded-[2px] bg-ink px-2.5 py-1.5 text-text-main focus:outline-none focus:border-polish"
          />
        </div>

        {uploadResult && (
          <div className="space-y-1 bg-ink border border-parchment-2 rounded-[2px] px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-text-main font-mono truncate">{uploadResult.url}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(uploadResult.url, 'url')}
                className="shrink-0 text-text-muted hover:text-polish p-1"
                aria-label="Sao chép URL ảnh"
              >
                {copiedField === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-text-muted font-mono truncate">{`<img src="${uploadResult.url}" alt="" />`}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(`<img src="${uploadResult.url}" alt="" />`, 'img')}
                className="shrink-0 text-text-muted hover:text-polish p-1"
                aria-label="Sao chép thẻ img"
              >
                {copiedField === 'img' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default ZuminovelPublishPanel;
