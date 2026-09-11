/**
 * Lưu trữ API Key ZumiNovel — theo đúng khuôn bảo mật hiện có của app (xem
 * useAIConfig.ts / gemini_api_keys, googleAuthService.ts): chỉ sessionStorage,
 * KHÔNG BAO GIỜ localStorage hay IndexedDB, vì đây là secret của người dùng
 * chứ không phải dữ liệu dự án. Việc liên kết dự án <-> truyện (novelId/slug)
 * không nhạy cảm nên vẫn lưu trong StoryProject (IndexedDB) như bình thường.
 */

const ZUMINOVEL_API_KEY_STORAGE = 'zuminovel_api_key';

export function getStoredZuminovelApiKey(): string {
  if (typeof sessionStorage === 'undefined') return '';
  try {
    return sessionStorage.getItem(ZUMINOVEL_API_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

export function setStoredZuminovelApiKey(key: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const trimmed = key.trim();
    if (trimmed) {
      sessionStorage.setItem(ZUMINOVEL_API_KEY_STORAGE, trimmed);
    } else {
      sessionStorage.removeItem(ZUMINOVEL_API_KEY_STORAGE);
    }
  } catch {
    // sessionStorage có thể bị chặn (chế độ ẩn danh nghiêm ngặt...) — bỏ qua, không throw.
  }
}

export function clearStoredZuminovelApiKey(): void {
  setStoredZuminovelApiKey('');
}
