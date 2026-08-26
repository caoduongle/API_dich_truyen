/**
 * Hako & Docln Controller for Read-Only Public Metadata & Chapters
 * Feature: 075-moderator-quality-checker
 */

import { Request, Response } from 'express';
import {
  fetchNovelMeta,
  fetchChapterContent,
  HakoScraperError,
} from '../services/hakoScraperService';

function sendScraperError(res: Response, err: any): void {
  const code = err.code || 'HAKO_SERVER_ERROR';
  const message = err.message || 'Lỗi không xác định khi kết nối đến Hako.';
  const retryAfterSeconds = err.retryAfterSeconds;

  let statusCode = 500;
  if (code === 'INVALID_HAKO_URL') statusCode = 400;
  else if (code === 'HAKO_RATE_LIMITED') statusCode = 429;
  else if (code === 'HAKO_BOT_CHALLENGE') statusCode = 403;
  else if (code === 'HAKO_NOVEL_NOT_FOUND') statusCode = 404;
  else if (code === 'HAKO_NETWORK_ERROR') statusCode = 502;
  else if (code === 'HAKO_PARSE_ERROR') statusCode = 422;

  res.status(statusCode).json({
    error: message,
    code,
    ...(typeof retryAfterSeconds === 'number' ? { retryAfterSeconds } : {}),
  });
}

/**
 * Lấy thông tin metadata và mục lục bộ truyện
 * POST /api/hako/novel-info
 * Body: { url: string }
 */
export async function getNovelInfoHandler(req: Request, res: Response): Promise<void> {
  const { url } = req.body || {};

  if (!url || typeof url !== 'string' || !url.trim()) {
    res.status(400).json({
      error: 'Vui lòng cung cấp URL truyện Hako/Docln trong trường "url".',
      code: 'INVALID_HAKO_URL',
    });
    return;
  }

  try {
    const meta = await fetchNovelMeta(url.trim());
    res.status(200).json(meta);
  } catch (err: any) {
    sendScraperError(res, err);
  }
}

/**
 * Lấy nội dung văn bản thuần của một chương
 * POST /api/hako/chapter-content
 * Body: { url: string }
 */
export async function getChapterContentHandler(req: Request, res: Response): Promise<void> {
  const { url } = req.body || {};

  if (!url || typeof url !== 'string' || !url.trim()) {
    res.status(400).json({
      error: 'Vui lòng cung cấp URL chương trong trường "url".',
      code: 'INVALID_HAKO_URL',
    });
    return;
  }

  try {
    const chapterData = await fetchChapterContent(url.trim());
    res.status(200).json(chapterData);
  } catch (err: any) {
    sendScraperError(res, err);
  }
}
