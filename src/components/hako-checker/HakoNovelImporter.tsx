/**
 * HakoNovelImporter Component
 * Feature: 075-moderator-quality-checker
 *
 * Nhập liên kết truyện Hako/Docln, tìm nạp metadata công khai và hiển thị thông tin truyện.
 * Xử lý lỗi anti-bot / rate-limit rõ ràng với đồng hồ đếm ngược và nút thử lại.
 */

import React, { useState, useEffect } from 'react';
import {
  Link2,
  Search,
  BookOpen,
  User,
  Palette,
  AlertTriangle,
  RefreshCw,
  Clock,
  ExternalLink,
  Layers,
  FileText,
} from 'lucide-react';
import { HakoNovelMeta } from '../../types/hakoChecker';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Seal } from '../ui/Seal';
import { cn } from '../../lib/cn';

export interface HakoNovelImporterProps {
  novelUrl: string;
  novelMeta: HakoNovelMeta | null;
  onFetchMeta: (url: string) => Promise<void>;
  isLoading: boolean;
  error?: { code: string; message: string; retryAfterSeconds?: number } | null;
  onClearError?: () => void;
}

export function HakoNovelImporter({
  novelUrl,
  novelMeta,
  onFetchMeta,
  isLoading,
  error,
  onClearError,
}: HakoNovelImporterProps) {
  const [inputUrl, setInputUrl] = useState(novelUrl || '');
  const [countdown, setCountdown] = useState<number | null>(null);

  // Sync internal input state with prop if changed
  useEffect(() => {
    if (novelUrl && novelUrl !== inputUrl) {
      setInputUrl(novelUrl);
    }
  }, [novelUrl]);

  // Handle countdown for rate-limit / bot challenge
  useEffect(() => {
    if (error?.retryAfterSeconds && error.retryAfterSeconds > 0) {
      setCountdown(error.retryAfterSeconds);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setCountdown(null);
    }
  }, [error]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim() || isLoading) return;
    if (onClearError) onClearError();
    onFetchMeta(inputUrl.trim());
  };

  const totalChaptersCount = novelMeta
    ? novelMeta.volumes.reduce((acc, v) => acc + v.chapters.length, 0)
    : 0;

  return (
    <div className="bg-parchment border border-parchment-2 rounded-md p-5 shadow-xs mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-parchment-2">
        <div className="flex items-center gap-2.5">
          <Seal character="查" tone="polish" className="text-[11px]" />
          <div>
            <h2 className="text-sm font-display font-bold text-text-main flex items-center gap-2">
              Tìm nạp bộ truyện từ Hako / Docln
            </h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              Dán URL trang giới thiệu truyện công khai (ví dụ: https://ln.hako.vn/truyen/1234-ten-truyen)
            </p>
          </div>
        </div>

        <Badge tone="neutral" className="text-[10px]">
          Chế độ Read-Only
        </Badge>
      </div>

      {/* URL Input Form */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch gap-2.5 mb-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
            <Link2 className="w-4 h-4" />
          </div>
          <input
            type="url"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="https://ln.hako.vn/truyen/..."
            disabled={isLoading}
            className="w-full bg-ink/70 border border-parchment-2 rounded-[3px] pl-9 pr-3 py-2 text-xs font-mono text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-polish focus:ring-1 focus:ring-polish/30 transition-all"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={isLoading || !inputUrl.trim() || (countdown !== null && countdown > 0)}
          icon={isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          className="shrink-0"
        >
          {isLoading ? 'Đang tìm nạp...' : 'Lấy thông tin truyện'}
        </Button>
      </form>

      {/* Error Alert with Anti-bot & Rate-limit Handling */}
      {error && (
        <div
          className={cn(
            'rounded-[3px] p-3.5 mb-4 text-xs border transition-all animate-in fade-in duration-200',
            error.code === 'HAKO_RATE_LIMITED' || error.code === 'HAKO_BOT_CHALLENGE'
              ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
              : 'bg-red-950/40 border-red-800/60 text-red-200'
          )}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <strong className="font-semibold">
                  {error.code === 'HAKO_RATE_LIMITED'
                    ? 'Giới hạn tần suất truy cập Hako'
                    : error.code === 'HAKO_BOT_CHALLENGE'
                    ? 'Thử thách bảo vệ chống Bot (Cloudflare)'
                    : 'Lỗi truy xuất dữ liệu'}
                </strong>
                <Badge tone="warning" className="text-[9px]">
                  {error.code}
                </Badge>
              </div>

              <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                {error.message}
              </p>

              {/* Countdown & Retry Button */}
              {countdown !== null && countdown > 0 && (
                <div className="flex items-center gap-2 mt-2.5 text-[11px] text-amber-300 font-mono">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                  <span>Có thể thử lại sau: <strong>{countdown} giây</strong></span>
                </div>
              )}

              {countdown === 0 && (
                <div className="mt-2.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => onFetchMeta(inputUrl.trim())}
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    className="text-[11px] py-1"
                  >
                    Thử lại ngay
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Novel Metadata Preview Card */}
      {novelMeta && (
        <div className="bg-ink/40 border border-parchment-2 rounded-[3px] p-4 animate-in fade-in duration-200">
          <div className="flex flex-col md:flex-row gap-4 items-start">
            {/* Cover Image */}
            {novelMeta.coverUrl ? (
              <div className="w-24 h-32 shrink-0 rounded-[2px] overflow-hidden border border-parchment-2 shadow-xs bg-ink">
                <img
                  src={novelMeta.coverUrl}
                  alt={novelMeta.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className="w-24 h-32 shrink-0 rounded-[2px] border border-parchment-2 bg-ink/70 flex items-center justify-center text-text-muted">
                <BookOpen className="w-6 h-6 opacity-40" />
              </div>
            )}

            {/* Meta Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-sm font-display font-bold text-text-main truncate">
                  {novelMeta.title}
                </h3>
                <a
                  href={novelMeta.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-muted hover:text-polish transition-colors p-1"
                  title="Mở trên Hako"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Author / Artist */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted mb-2.5">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 text-text-muted" />
                  <span>Tác giả:</span>
                  <strong className="text-text-main font-medium">{novelMeta.author}</strong>
                </span>

                <span className="flex items-center gap-1">
                  <Palette className="w-3 h-3 text-text-muted" />
                  <span>Họa sĩ:</span>
                  <strong className="text-text-main font-medium">{novelMeta.artist}</strong>
                </span>
              </div>

              {/* Summary */}
              {novelMeta.description && (
                <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed mb-3">
                  {novelMeta.description}
                </p>
              )}

              {/* Stats Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-parchment-2/60">
                <span className="inline-flex items-center gap-1 text-[10px] text-text-muted bg-ink/70 px-2 py-0.5 rounded-[2px] border border-parchment-2">
                  <Layers className="w-3 h-3 text-polish" />
                  <span>{novelMeta.volumes.length} tập</span>
                </span>

                <span className="inline-flex items-center gap-1 text-[10px] text-text-muted bg-ink/70 px-2 py-0.5 rounded-[2px] border border-parchment-2">
                  <FileText className="w-3 h-3 text-polish" />
                  <span>{totalChaptersCount} chương công khai</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HakoNovelImporter;
