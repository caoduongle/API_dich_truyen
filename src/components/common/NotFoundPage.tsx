import React from 'react';
import { Home, ArrowLeft } from 'lucide-react';
import { Seal } from '../ui/Seal';
import { Button } from '../ui/Button';

export interface NotFoundPageProps {
  onGoHome?: () => void;
  message?: string;
}

/**
 * Trang lỗi 404 phong cách "Mực & Chu Sa" (Ink & Cinnabar)
 * Sử dụng ấn triện Chu Sa "無" (Vô), phông chữ Fraunces cổ phong,
 * và điều hướng quay lại Bàn Dịch chính.
 */
export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  onGoHome,
  message = 'Trang bản thảo hoặc phân vùng bạn tìm kiếm tựa như mây khói hư ảo, không còn lưu vết trong tàng kinh các.',
}) => {
  const handleHome = () => {
    if (onGoHome) {
      onGoHome();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-200">
      <div className="max-w-md w-full bg-parchment border border-parchment-2 rounded-md p-8 shadow-md relative overflow-hidden">
        {/* Họa tiết ấn triện chìm góc */}
        <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none select-none">
          <span className="font-serif text-9xl text-polish">譯</span>
        </div>

        {/* Cụm ấn triện Chu Sa chữ VÔ (無) */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <Seal character="無" size="md" tone="polish" className="scale-150 transform" />
          </div>
        </div>

        {/* Tiêu đề mã lỗi 404 */}
        <h1 className="font-display font-bold text-4xl text-text-main tracking-wider mb-2">
          404
        </h1>
        <h2 className="font-display font-semibold text-base text-polish tracking-wide uppercase mb-3">
          Bản Thảo Thất Lạc &bull; Trang Không Tồn Tại
        </h2>

        {/* Nội dung diễn giải văn phong cổ điển */}
        <p className="text-xs text-text-muted leading-relaxed mb-6 font-serif">
          {message}
        </p>

        {/* Các nút hành động */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="primary"
            size="md"
            icon={<Home className="w-4 h-4" />}
            onClick={handleHome}
            className="w-full sm:w-auto"
          >
            Quay về Bàn Dịch
          </Button>
          <Button
            variant="secondary"
            size="md"
            icon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => window.history.back()}
            className="w-full sm:w-auto"
          >
            Trang trước
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
