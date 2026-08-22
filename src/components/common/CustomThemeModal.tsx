import React, { useState, useEffect } from 'react';
import { Palette, RotateCcw, AlertTriangle, CheckCircle2, Eye, Type, Minus, Plus } from 'lucide-react';
import {
  CustomThemePalette,
  DEFAULT_DARK_PALETTE,
  ReaderFontId,
  READER_FONT_OPTIONS,
  DEFAULT_READER_FONT,
  DEFAULT_READER_FONT_SIZE,
  MIN_READER_FONT_SIZE,
  MAX_READER_FONT_SIZE,
} from '../../types/theme';
import { useThemeContext } from '../../context/ThemeContext';
import { auditPalette } from '../../utils/contrastAuditor';
import { loadGoogleFont } from '../../utils/fontLoader';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useNotifications } from '../NotificationSystem';

interface CustomThemeModalProps {
  open: boolean;
  onClose: () => void;
}

export const CustomThemeModal: React.FC<CustomThemeModalProps> = ({ open, onClose }) => {
  const {
    customPalette,
    setCustomPalette,
    resetCustomPalette,
    setTheme,
    readerFont,
    readerFontSize,
    setReaderFont,
    setReaderFontSize,
    resetReaderTypography,
  } = useThemeContext();

  const [draftPalette, setDraftPalette] = useState<CustomThemePalette>(customPalette);
  const [draftFont, setDraftFont] = useState<ReaderFontId>(readerFont);
  const [draftFontSize, setDraftFontSize] = useState<number>(readerFontSize);
  const { showToast } = useNotifications();

  useEffect(() => {
    if (open) {
      setDraftPalette(customPalette);
      setDraftFont(readerFont);
      setDraftFontSize(readerFontSize);
    }
  }, [open, customPalette, readerFont, readerFontSize]);

  useEffect(() => {
    loadGoogleFont(draftFont);
  }, [draftFont]);

  const audit = auditPalette(draftPalette);

  const handleColorChange = (key: keyof CustomThemePalette, value: string) => {
    setDraftPalette((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleFontChange = (fontId: ReaderFontId) => {
    setDraftFont(fontId);
  };

  const handleIncreaseFontSize = () => {
    setDraftFontSize((prev) => Math.min(MAX_READER_FONT_SIZE, prev + 1));
  };

  const handleDecreaseFontSize = () => {
    setDraftFontSize((prev) => Math.max(MIN_READER_FONT_SIZE, prev - 1));
  };

  const handleSave = () => {
    setCustomPalette(draftPalette);
    setTheme('custom');
    setReaderFont(draftFont);
    setReaderFontSize(draftFontSize);
    showToast({ message: 'Đã lưu cấu hình giao diện & kiểu chữ!', type: 'success' });
    onClose();
  };

  const handleReset = () => {
    setDraftPalette(DEFAULT_DARK_PALETTE);
    resetCustomPalette();
    setDraftFont(DEFAULT_READER_FONT);
    setDraftFontSize(DEFAULT_READER_FONT_SIZE);
    resetReaderTypography();
    showToast({ message: 'Đã khôi phục bảng màu và kiểu chữ mặc định.', type: 'info' });
  };

  if (!open) return null;

  const selectedFontOption = READER_FONT_OPTIONS.find((f) => f.id === draftFont) || READER_FONT_OPTIONS[0];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="2xl"
      title={
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-gold" />
          <span>Tùy Chỉnh Giao Diện & Kiểu Chữ</span>
        </div>
      }
      description="Tự do cấu hình màu sắc và kiểu chữ đọc truyện theo thị giác cá nhân"
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReset}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Khôi phục mặc định
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Hủy
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave}>
              Lưu cấu hình
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Tùy chỉnh Kiểu chữ & Cỡ chữ (Typography Settings) */}
        <div className="p-3.5 bg-ink/10 border border-parchment-2 rounded-[2px] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-text-main">
              <Type className="w-3.5 h-3.5 text-gold" />
              <span>Kiểu chữ &amp; Cỡ chữ đọc truyện:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-text-muted">Cỡ chữ:</span>
              <div className="flex items-center border border-parchment-2 rounded-[2px] bg-ink overflow-hidden">
                <button
                  type="button"
                  onClick={handleDecreaseFontSize}
                  disabled={draftFontSize <= MIN_READER_FONT_SIZE}
                  className="p-1 px-1.5 text-text-muted hover:text-text-main hover:bg-parchment-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Giảm cỡ chữ (tối thiểu 14px)"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-xs font-mono font-bold px-2 text-text-main min-w-[3rem] text-center">
                  {draftFontSize}px
                </span>
                <button
                  type="button"
                  onClick={handleIncreaseFontSize}
                  disabled={draftFontSize >= MAX_READER_FONT_SIZE}
                  className="p-1 px-1.5 text-text-muted hover:text-text-main hover:bg-parchment-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Tăng cỡ chữ (tối đa 50px)"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Danh sách Font chữ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {READER_FONT_OPTIONS.map((font) => {
              const isSelected = draftFont === font.id;
              return (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => handleFontChange(font.id)}
                  className={`p-2 rounded-[2px] border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-gold bg-gold/15 text-text-main ring-1 ring-gold/40'
                      : 'border-parchment-2 bg-ink/5 text-text-muted hover:text-text-main hover:border-parchment-2/80'
                  }`}
                >
                  <span className="text-xs font-bold leading-tight truncate">{font.label}</span>
                  <span
                    className="text-sm mt-1 truncate"
                    style={{ fontFamily: font.fontFamilyCss }}
                  >
                    Việt Nam 123
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Kiểm định độ tương phản WCAG */}
        <div className="p-3 bg-ink/5 border border-parchment-2 rounded-[2px] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-main">
              Kiểm định tương phản WCAG 2.1:
            </span>
            {audit.isTextMainCompliant ? (
              <Badge tone="polish" className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Đạt chuẩn WCAG ({audit.textMainOnParchment}:1)
              </Badge>
            ) : (
              <Badge tone="warning" className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Độ tương phản thấp: {audit.textMainOnParchment}:1
              </Badge>
            )}
          </div>

          {!audit.isTextMainCompliant && (
            <p className="text-[11px] text-amber-300/90 leading-tight">
              Khuyến nghị tỷ lệ tương phản giữa chữ chính và nền đạt tối thiểu <strong>4.5:1</strong> để đọc lâu không bị mỏi mắt.
            </p>
          )}
        </div>

        {/* 6 Bộ Chọn Màu Sắc Thuần Native */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {/* 1. Nền trang (parchment) */}
          <div className="border border-parchment-2 rounded-[2px] p-2.5 bg-ink/10 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-main">Nền trang đọc</label>
              <input
                type="color"
                value={draftPalette.parchment}
                onChange={(e) => handleColorChange('parchment', e.target.value)}
                className="w-7 h-7 rounded-[2px] border border-parchment-2 cursor-pointer bg-transparent"
              />
            </div>
            <p className="text-[10px] text-text-muted font-mono">{draftPalette.parchment}</p>
          </div>

          {/* 2. Khối panel (ink) */}
          <div className="border border-parchment-2 rounded-[2px] p-2.5 bg-ink/10 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-main">Khối panel / Card</label>
              <input
                type="color"
                value={draftPalette.ink}
                onChange={(e) => handleColorChange('ink', e.target.value)}
                className="w-7 h-7 rounded-[2px] border border-parchment-2 cursor-pointer bg-transparent"
              />
            </div>
            <p className="text-[10px] text-text-muted font-mono">{draftPalette.ink}</p>
          </div>

          {/* 3. Đường viền (parchment-2) */}
          <div className="border border-parchment-2 rounded-[2px] p-2.5 bg-ink/10 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-main">Viền & Phân cách</label>
              <input
                type="color"
                value={draftPalette.parchment2}
                onChange={(e) => handleColorChange('parchment2', e.target.value)}
                className="w-7 h-7 rounded-[2px] border border-parchment-2 cursor-pointer bg-transparent"
              />
            </div>
            <p className="text-[10px] text-text-muted font-mono">{draftPalette.parchment2}</p>
          </div>

          {/* 4. Chữ chính (text-main) */}
          <div className="border border-parchment-2 rounded-[2px] p-2.5 bg-ink/10 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-main">Chữ nội dung</label>
              <input
                type="color"
                value={draftPalette.textMain}
                onChange={(e) => handleColorChange('textMain', e.target.value)}
                className="w-7 h-7 rounded-[2px] border border-parchment-2 cursor-pointer bg-transparent"
              />
            </div>
            <p className="text-[10px] text-text-muted font-mono">{draftPalette.textMain}</p>
          </div>

          {/* 5. Chữ phụ (text-muted) */}
          <div className="border border-parchment-2 rounded-[2px] p-2.5 bg-ink/10 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-main">Chữ phụ / Chú thích</label>
              <input
                type="color"
                value={draftPalette.textMuted}
                onChange={(e) => handleColorChange('textMuted', e.target.value)}
                className="w-7 h-7 rounded-[2px] border border-parchment-2 cursor-pointer bg-transparent"
              />
            </div>
            <p className="text-[10px] text-text-muted font-mono">{draftPalette.textMuted}</p>
          </div>

          {/* 6. Điểm nhấn Chu Sa (polish) */}
          <div className="border border-parchment-2 rounded-[2px] p-2.5 bg-ink/10 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-main">Màu nhấn Chu Sa</label>
              <input
                type="color"
                value={draftPalette.polish}
                onChange={(e) => handleColorChange('polish', e.target.value)}
                className="w-7 h-7 rounded-[2px] border border-parchment-2 cursor-pointer bg-transparent"
              />
            </div>
            <p className="text-[10px] text-text-muted font-mono">{draftPalette.polish}</p>
          </div>
        </div>

        {/* Khung Xem Trước Trực Tiếp (Live Preview) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-text-main">
            <div className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-gold" />
              <span>Xem trước giao diện soạn thảo &amp; đọc:</span>
            </div>
            <span className="text-[11px] font-normal text-text-muted">
              {selectedFontOption.label} • {draftFontSize}px
            </span>
          </div>

          <div
            className="p-4 rounded-[2px] border space-y-3 transition-colors duration-150"
            style={{
              backgroundColor: draftPalette.parchment,
              borderColor: draftPalette.parchment2,
            }}
          >
            {/* Header mô phỏng */}
            <div
              className="p-2.5 rounded-[2px] border flex items-center justify-between"
              style={{
                backgroundColor: draftPalette.ink,
                borderColor: draftPalette.parchment2,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded-[2px] text-white"
                  style={{ backgroundColor: draftPalette.polish }}
                >
                  Chương 1
                </span>
                <span
                  className="text-xs font-bold"
                  style={{
                    color: draftPalette.textMain,
                    fontFamily: selectedFontOption.fontFamilyCss,
                  }}
                >
                  Yểm Ngục Bắt Đầu
                </span>
              </div>
              <span className="text-[10px]" style={{ color: draftPalette.textMuted }}>
                1,500 chữ • Tiên Hiệp
              </span>
            </div>

            {/* Khung đọc mô phỏng */}
            <div
              className="p-3 rounded-[2px] border space-y-2 transition-all duration-150"
              style={{
                backgroundColor: draftPalette.ink,
                borderColor: draftPalette.parchment2,
                color: draftPalette.textMain,
                fontFamily: selectedFontOption.fontFamilyCss,
                fontSize: `${draftFontSize}px`,
                lineHeight: 1.6,
              }}
            >
              <p>
                Trên Đại Lục Đấu Khí, kẻ yếu hèn không bao giờ có chỗ dung thân. Tiêu Viêm nhìn chăm chăm vào đôi bàn tay của mình, ngọn lửa ý chí bùng cháy dữ dội.
              </p>
              <p
                style={{
                  color: draftPalette.textMuted,
                  fontSize: `${Math.max(12, Math.round(draftFontSize * 0.75))}px`,
                }}
                className="font-mono"
              >
                [Nguyên tác]: 在斗气大陆，弱者无容身之地。萧炎望着双手，内心燃起熊熊烈火。
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
