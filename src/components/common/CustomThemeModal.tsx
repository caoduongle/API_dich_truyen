import React, { useState, useEffect } from 'react';
import { Palette, RotateCcw, AlertTriangle, CheckCircle2, Eye } from 'lucide-react';
import { CustomThemePalette, DEFAULT_DARK_PALETTE } from '../../types/theme';
import { useThemeContext } from '../../context/ThemeContext';
import { auditPalette } from '../../utils/contrastAuditor';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useNotifications } from '../NotificationSystem';

interface CustomThemeModalProps {
  open: boolean;
  onClose: () => void;
}

export const CustomThemeModal: React.FC<CustomThemeModalProps> = ({ open, onClose }) => {
  const { customPalette, setCustomPalette, resetCustomPalette, setTheme } = useThemeContext();
  const [draftPalette, setDraftPalette] = useState<CustomThemePalette>(customPalette);
  const { showToast } = useNotifications();

  useEffect(() => {
    if (open) {
      setDraftPalette(customPalette);
    }
  }, [open, customPalette]);

  const audit = auditPalette(draftPalette);

  const handleColorChange = (key: keyof CustomThemePalette, value: string) => {
    setDraftPalette((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = () => {
    setCustomPalette(draftPalette);
    setTheme('custom');
    showToast({ message: 'Đã áp dụng bảng màu tùy chỉnh!', type: 'success' });
    onClose();
  };

  const handleReset = () => {
    setDraftPalette(DEFAULT_DARK_PALETTE);
    resetCustomPalette();
    showToast({ message: 'Đã khôi phục bảng màu mặc định.', type: 'info' });
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="2xl"
      title={
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-gold" />
          <span>Tùy Chỉnh Bảng Màu Đọc & Biên Tập</span>
        </div>
      }
      description="Tự do cấu hình 6 token màu sắc theo thị giác cá nhân"
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
              Lưu bảng màu
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
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
          <div className="flex items-center gap-1.5 text-xs font-bold text-text-main">
            <Eye className="w-3.5 h-3.5 text-gold" />
            Xem trước giao diện soạn thảo:
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
                <span className="text-xs font-serif font-bold" style={{ color: draftPalette.textMain }}>
                  Yểm Ngục Bắt Đầu
                </span>
              </div>
              <span className="text-[10px]" style={{ color: draftPalette.textMuted }}>
                1,500 chữ • Tiên Hiệp
              </span>
            </div>

            {/* Khung đọc mô phỏng */}
            <div
              className="p-3 rounded-[2px] border space-y-1.5 font-serif text-xs leading-relaxed"
              style={{
                backgroundColor: draftPalette.ink,
                borderColor: draftPalette.parchment2,
                color: draftPalette.textMain,
              }}
            >
              <p>
                Trên Đại Lục Đấu Khí, kẻ yếu hèn không bao giờ có chỗ dung thân. Tiêu Viêm nhìn chăm chăm vào đôi bàn tay của mình, ngọn lửa ý chí bùng cháy dữ dội.
              </p>
              <p style={{ color: draftPalette.textMuted }} className="text-[11px] font-mono">
                [Nguyên tác]: 在斗气大陆，弱者无容身之地。萧炎望着双手，内心燃起熊熊烈火。
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
