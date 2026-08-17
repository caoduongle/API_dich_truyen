import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, Loader2, AlertCircle, X } from 'lucide-react';
import { loginWithPassword } from '../utils/apiClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: () => void;
  canDismiss?: boolean;
}

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  canDismiss = false,
}: AuthModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Vui lòng nhập mật khẩu truy cập.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await loginWithPassword(password.trim());
      if (result.success) {
        setPassword('');
        onSuccess();
        if (onClose) onClose();
      } else {
        setError(result.error || 'Mật khẩu không chính xác.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (canDismiss && onClose && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-md bg-parchment border border-parchment-2 rounded-md shadow-2xl p-6 flex flex-col gap-5">
        {/* Close Button (if dismissible) */}
        {canDismiss && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-text-muted hover:text-text-main p-1.5 rounded-[2px] hover:bg-parchment-2 transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-[3px] bg-ink border border-parchment-2 flex items-center justify-center text-polish shrink-0 shadow-xs">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-display font-bold text-text-main flex items-center gap-2">
              Xác Thực Bản Thảo
              <ShieldCheck className="w-4 h-4 text-polish" />
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Máy chủ yêu cầu mật khẩu bảo vệ để sử dụng các tính năng dịch thuật.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-[2px] bg-polish/10 border border-polish/40 text-polish text-xs animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-text-main uppercase tracking-wider mb-1.5">
              Mật khẩu truy cập (ACCESS_PASSWORD)
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Nhập mật khẩu truy cập máy chủ..."
                autoFocus
                className="w-full px-3.5 py-2.5 pr-11 bg-ink border border-parchment-2 focus:border-polish rounded-[2px] text-xs font-mono text-text-main placeholder:text-text-muted outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-text-muted hover:text-text-main transition-colors cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-text-muted mt-1.5">
              Mật khẩu được lưu trong cấu hình <code className="text-text-main font-mono">.env</code> của máy chủ.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {canDismiss && onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-main bg-ink hover:bg-parchment-2 rounded-[2px] border border-parchment-2 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-polish hover:bg-[#A03522] active:bg-[#8F2D1E] disabled:opacity-50 disabled:cursor-not-allowed rounded-[2px] transition-all shadow-xs cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang xác thực...
                </>
              ) : (
                'Mở Khóa Máy Chủ'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
