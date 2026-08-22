import React from 'react';
import { Users, Wifi, WifiOff } from 'lucide-react';
import { CRDTSyncStatus, UserPresence } from '../../types/crdt';
import { Badge } from '../ui/Badge';

interface CollaboratorPresenceBarProps {
  status: CRDTSyncStatus;
  collaborators: UserPresence[];
  isShared: boolean;
}

export const CollaboratorPresenceBar: React.FC<CollaboratorPresenceBarProps> = ({
  status,
  collaborators,
  isShared,
}) => {
  if (!isShared && status === 'offline' && collaborators.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 py-1 px-2 bg-ink/10 border border-parchment-2 rounded-[2px] text-xs">
      {/* Trạng thái kết nối Real-Time */}
      <div className="flex items-center gap-1.5">
        {status === 'connected' && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium" title="Đang đồng bộ real-time qua WebSocket Relay">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <Wifi className="w-3 h-3" />
            <span className="hidden sm:inline">Real-Time</span>
          </span>
        )}

        {status === 'connecting' && (
          <span className="flex items-center gap-1 text-[11px] text-amber-300 font-medium" title="Đang kết nối tới Relay...">
            <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
            <span className="hidden sm:inline">Đang kết nối...</span>
          </span>
        )}

        {status === 'disconnected' && (
          <span className="flex items-center gap-1 text-[11px] text-rose-400 font-medium" title="Mất kết nối relay — Chuyển sang lưu offline">
            <WifiOff className="w-3 h-3" />
            <span className="hidden sm:inline">Offline</span>
          </span>
        )}

        {status === 'offline' && isShared && (
          <span className="flex items-center gap-1 text-[11px] text-text-muted font-medium" title="Chế độ offline cá nhân">
            <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
            <span className="hidden sm:inline">Cục bộ</span>
          </span>
        )}
      </div>

      {/* Danh sách người cộng tác đang cùng mở chương */}
      {collaborators.length > 0 && (
        <div className="flex items-center gap-1 pl-2 border-l border-parchment-2">
          <Users className="w-3 h-3 text-text-muted shrink-0" />
          <div className="flex items-center -space-x-1.5 overflow-hidden">
            {collaborators.map((user, idx) => {
              const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();
              const actionText =
                user.activeField === 'raw'
                  ? 'Đang dịch thô'
                  : user.activeField === 'polished'
                    ? 'Đang biên tập'
                    : 'Đang xem chương này';

              return (
                <div
                  key={`${user.email}_${idx}`}
                  className="relative group cursor-default"
                  title={`${user.name || user.email} (${actionText})`}
                >
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="w-5 h-5 rounded-full border border-parchment object-cover"
                      style={{ borderColor: user.color || '#B8402C' }}
                    />
                  ) : (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-xs"
                      style={{ backgroundColor: user.color || '#B8402C' }}
                    >
                      {initial}
                    </div>
                  )}

                  {/* Indicator khi đang gõ */}
                  {user.activeField && user.activeField !== 'idle' && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-parchment animate-pulse"
                      style={{ backgroundColor: user.color || '#B8402C' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <span className="text-[10px] text-text-muted hidden md:inline">
            {collaborators.length} người đang mở
          </span>
        </div>
      )}
    </div>
  );
};
