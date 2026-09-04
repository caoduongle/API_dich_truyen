import React, { useEffect, useState } from 'react';
import { Cloud, LogIn, UserCheck } from 'lucide-react';
import { googleAuthService } from '../../services/googleAuthService';
import { GoogleAuthState } from '../../types/googleAuth';
import { Button } from '../ui/Button';

interface GoogleUserButtonProps {
  onOpenSyncModal: () => void;
}

export const GoogleUserButton: React.FC<GoogleUserButtonProps> = ({ onOpenSyncModal }) => {
  const [authState, setAuthState] = useState<GoogleAuthState>(googleAuthService.getAuthState());
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const unsubscribe = googleAuthService.onAuthStateChanged((newState) => {
      setAuthState(newState);
      setImgError(false);
    });
    return unsubscribe;
  }, []);

  if (authState.isAuthenticated && authState.user) {
    const firstName = authState.user.name.split(' ')[0] || authState.user.name;

    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={onOpenSyncModal}
        title={`Tài khoản Google: ${authState.user.email} (Bấm để mở Quản lý Đồng bộ Drive)`}
        className="flex items-center gap-1.5 py-1 px-2.5 max-w-[160px] truncate"
      >
        {authState.user.picture && !imgError ? (
          <img
            src={authState.user.picture}
            alt={authState.user.name || authState.user.email || 'Ảnh đại diện người dùng'}
            width={16}
            height={16}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-4 h-4 rounded-full border border-parchment-2 shrink-0 object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <UserCheck className="w-3.5 h-3.5 text-polish shrink-0" />
        )}
        <span className="truncate text-xs font-medium text-text-main hidden sm:inline">
          {firstName}
        </span>
        <Cloud className="w-3 h-3 text-gold shrink-0 ml-0.5" />
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onOpenSyncModal}
      title="Đăng nhập Google để sao lưu & đồng bộ dự án lên Google Drive (Tùy chọn)"
      className="flex items-center gap-1.5 py-1 px-2.5"
    >
      <Cloud className="w-3.5 h-3.5 text-text-muted" />
      <span className="text-xs text-text-main hidden md:inline">
        Đồng bộ Drive
      </span>
      <LogIn className="w-3 h-3 text-text-muted hidden sm:inline" />
    </Button>
  );
};
