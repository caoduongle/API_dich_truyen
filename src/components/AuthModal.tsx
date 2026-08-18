import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { loginWithPassword } from '../utils/apiClient';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: () => void;
  canDismiss?: boolean;
}

export default function AuthModal({
  isOpen,
  onClose = () => {},
  onSuccess,
  canDismiss = false,
}: AuthModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        if (canDismiss && onClose) onClose();
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
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      showCloseButton={canDismiss}
      closeOnBackdropClick={canDismiss}
      closeOnEscape={canDismiss}
      icon={<Lock className="w-5 h-5" />}
      title={
        <span className="flex items-center gap-2">
          Xác Thực Bản Thảo
          <ShieldCheck className="w-4 h-4 text-polish" />
        </span>
      }
      description="Máy chủ yêu cầu mật khẩu bảo vệ để sử dụng các tính năng dịch thuật."
    >
      <div className="flex flex-col gap-4">
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
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={onClose}
                disabled={isLoading}
              >
                Hủy bỏ
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isLoading || !password.trim()}
              icon={isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
            >
              {isLoading ? 'Đang xác thực...' : 'Mở Khóa Máy Chủ'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
