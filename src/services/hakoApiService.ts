/**
 * Client-Side Hako API Service
 * Feature: 075-moderator-quality-checker
 */

import { HakoNovelMeta } from '../types/hakoChecker';
import { apiFetch } from '../utils/apiClient';

export class HakoApiError extends Error {
  code: string;
  retryAfterSeconds?: number;

  constructor(message: string, code: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'HakoApiError';
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Gọi API backend để lấy metadata và danh mục chương của bộ truyện
 */
export async function fetchHakoNovelMeta(url: string): Promise<HakoNovelMeta> {
  const response = await apiFetch('/api/hako/novel-info', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: url.trim() }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new HakoApiError(
      data.error || `Lỗi khi lấy thông tin truyện (HTTP ${response.status})`,
      data.code || 'HAKO_API_ERROR',
      data.retryAfterSeconds
    );
  }

  return data as HakoNovelMeta;
}

export interface HakoChapterContentResult {
  url: string;
  title: string;
  volumeTitle: string;
  content: string;
  wordCount: number;
  fetchedAt: string;
}

/**
 * Gọi API backend để lấy nội dung văn bản của một chương
 */
export async function fetchHakoChapterContent(url: string): Promise<HakoChapterContentResult> {
  const response = await apiFetch('/api/hako/chapter-content', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: url.trim() }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new HakoApiError(
      data.error || `Lỗi khi lấy nội dung chương (HTTP ${response.status})`,
      data.code || 'HAKO_API_ERROR',
      data.retryAfterSeconds
    );
  }

  return data as HakoChapterContentResult;
}
