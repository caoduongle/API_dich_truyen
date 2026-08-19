import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Tạo mã requestId duy nhất
 */
export function generateRequestId(): string {
  const time = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `req_${time}_${random}`;
}

/**
 * Middleware gắn requestId cho mọi HTTP request và đính kèm vào header phản hồi
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'];
  const requestId = (typeof incomingId === 'string' && incomingId.trim()) 
    ? incomingId.trim() 
    : generateRequestId();

  req.id = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
