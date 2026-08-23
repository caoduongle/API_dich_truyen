import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '../ui/Badge';

export interface CountdownBadgeProps {
  remainingMs: number;
  type?: 'blacklist' | 'rateLimit' | 'cooldown';
  label?: string;
  reason?: string;
  className?: string;
}

/**
 * Component lá đếm lùi thời gian tạm dừng / hoãn rate limit.
 * Tự quản lý interval 1s nội bộ, hoàn toàn cách ly và không gây re-render component cha.
 */
export const CountdownBadge = React.memo(function CountdownBadge({
  remainingMs,
  type = 'cooldown',
  reason,
  className,
}: CountdownBadgeProps) {
  const [timeLeftMs, setTimeLeftMs] = useState(remainingMs);
  const targetTimeRef = useRef(Date.now() + remainingMs);

  useEffect(() => {
    targetTimeRef.current = Date.now() + remainingMs;
    setTimeLeftMs(remainingMs);
  }, [remainingMs]);

  useEffect(() => {
    if (timeLeftMs <= 0) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, targetTimeRef.current - Date.now());
      setTimeLeftMs(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeftMs]);

  if (timeLeftMs <= 0) {
    return (
      <Badge tone="polish" className={className} title={reason}>
        <CheckCircle2 className="w-3 h-3 text-polish" />
        Hoạt động
      </Badge>
    );
  }

  const formatRemainingTime = (ms: number) => {
    if (ms <= 0) return '0s';
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes}p ${seconds}s`;
    }
    return `${seconds}s`;
  };

  if (type === 'cooldown' || type === 'blacklist') {
    return (
      <Badge tone="warning" className={`animate-pulse ${className || ''}`} title={reason}>
        <AlertTriangle className="w-3 h-3 text-amber-400" />
        Tạm dừng ({formatRemainingTime(timeLeftMs)})
      </Badge>
    );
  }

  return (
    <Badge tone="neutral" className={className} title={reason}>
      <Clock className="w-3 h-3 text-text-muted" />
      Đang hoãn ({formatRemainingTime(timeLeftMs)})
    </Badge>
  );
});
