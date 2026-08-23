import crypto from 'crypto';

export function hashApiKey(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (/^[0-9a-f]{64}$/.test(trimmed)) {
    return trimmed; // Đã là hash SHA-256, giữ nguyên (idempotent)
  }
  return crypto.createHash('sha256').update(trimmed).digest('hex');
}

export function maskApiKey(key: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (/^[0-9a-f]{64}$/.test(trimmed)) {
    return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
  }
  if (trimmed.length <= 10) {
    return '***';
  }
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

export function getDayInLosAngeles(timestamp: number = Date.now()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date(timestamp));
}
