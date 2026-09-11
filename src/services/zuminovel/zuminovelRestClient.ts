import {
  ZUMINOVEL_API_BASE_URL,
  ZUMINOVEL_ERROR_MESSAGES,
  ZUMINOVEL_RATE_LIMIT_PER_MINUTE,
  ZuminovelChapterSummary,
  ZuminovelCreateChapterPayload,
  ZuminovelCreateChapterResponse,
  ZuminovelCreateChapterResult,
  ZuminovelDeleteChapterResponse,
  ZuminovelErrorCode,
  ZuminovelListChaptersResponse,
  ZuminovelListNovelsResponse,
  ZuminovelNovel,
  ZuminovelUpdateChapterPayload,
  ZuminovelUpdateChapterResponse,
  ZuminovelUpdateChapterResult,
  ZuminovelUploadResponse,
  ZuminovelUploadResult,
} from '../../types/zuminovel';

/**
 * Server ZumiNovel đã nhận request và trả lời — nhưng trả lời là lỗi
 * (401/403/429/... theo đúng bảng "Safety & Error Handling" trong tài liệu).
 */
export class ZuminovelApiError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ZuminovelApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Request KHÔNG nhận được response nào từ server (mất mạng, DNS lỗi, hoặc —
 * khả năng cao nhất trong app 100% client-side này — bị trình duyệt chặn ở
 * bước CORS preflight vì ZumiNovel không trả Access-Control-Allow-Origin cho
 * origin lạ). fetch() không phân biệt được các trường hợp này với nhau —
 * TypeError "Failed to fetch" là dấu hiệu chung cho tất cả.
 */
export class ZuminovelNetworkError extends Error {
  public readonly originalError?: unknown;

  constructor(originalError?: unknown) {
    super(
      'Không kết nối được tới ZumiNovel. Nếu mạng vẫn ổn và API Key đúng, nhiều khả năng ' +
      'ZumiNovel chặn gọi API trực tiếp từ trình duyệt (CORS) — cần một proxy nhỏ phía server ' +
      'để chuyển tiếp request này thay vì gọi thẳng.'
    );
    this.name = 'ZuminovelNetworkError';
    this.originalError = originalError;
  }
}

// Sliding-window guard đơn giản trong bộ nhớ để tránh vô tình vượt quá 50 request/phút
// khi đăng/cập nhật hàng loạt chương. Đơn giản hơn nhiều so với localQuotaTracker (vốn
// để quản lý nhiều Gemini key/model) vì ở đây chỉ có đúng 1 API key cho 1 tài khoản Zumi.
const requestTimestamps: number[] = [];

async function waitForRateLimitSlot(): Promise<void> {
  const now = Date.now();
  while (requestTimestamps.length > 0 && now - requestTimestamps[0] > 60_000) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= ZUMINOVEL_RATE_LIMIT_PER_MINUTE) {
    const waitMs = 60_000 - (now - requestTimestamps[0]) + 50; // +50ms đệm an toàn
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  requestTimestamps.push(Date.now());
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  isMultipart?: boolean;
}

export class ZuminovelRestClient {
  private async request<T>(apiKey: string, path: string, options: RequestOptions = {}): Promise<T> {
    await waitForRateLimitSlot();

    const { method = 'GET', body, isMultipart = false } = options;
    const headers: Record<string, string> = { 'X-API-Key': apiKey };
    let requestBody: BodyInit | undefined;

    if (isMultipart) {
      requestBody = body as FormData;
      // KHÔNG tự set Content-Type cho multipart — trình duyệt cần tự thêm boundary.
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(body);
    }

    let res: Response;
    try {
      res = await fetch(`${ZUMINOVEL_API_BASE_URL}${path}`, { method, headers, body: requestBody });
    } catch (err) {
      throw new ZuminovelNetworkError(err);
    }

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // Không có body JSON hợp lệ (vd trang lỗi HTML từ CDN trung gian)
    }

    if (!res.ok || json?.success === false) {
      const code: string | undefined = json?.code;
      const friendlyMessage =
        code && code in ZUMINOVEL_ERROR_MESSAGES
          ? ZUMINOVEL_ERROR_MESSAGES[code as ZuminovelErrorCode]
          : json?.error || json?.message || `Lỗi không xác định (HTTP ${res.status})`;
      throw new ZuminovelApiError(friendlyMessage, res.status, code);
    }

    return json as T;
  }

  /** GET /external/novels — danh sách truyện sở hữu. */
  public async listNovels(apiKey: string): Promise<ZuminovelNovel[]> {
    const res = await this.request<ZuminovelListNovelsResponse>(apiKey, '/novels');
    return res.data;
  }

  /** GET /external/novels/{id_or_slug}/chapters — danh sách chương của 1 truyện. */
  public async listChapters(apiKey: string, idOrSlug: string): Promise<ZuminovelChapterSummary[]> {
    const res = await this.request<ZuminovelListChaptersResponse>(
      apiKey,
      `/novels/${encodeURIComponent(idOrSlug)}/chapters`
    );
    return res.data;
  }

  /** POST /external/chapters — đăng chương mới. */
  public async createChapter(
    apiKey: string,
    payload: ZuminovelCreateChapterPayload
  ): Promise<ZuminovelCreateChapterResult> {
    const res = await this.request<ZuminovelCreateChapterResponse>(apiKey, '/chapters', {
      method: 'POST',
      body: payload,
    });
    return res.data;
  }

  /** PUT /external/chapters/{chapter_id} — cập nhật chương đã đăng (kiểu PATCH: chỉ gửi field cần đổi). */
  public async updateChapter(
    apiKey: string,
    chapterId: string,
    payload: ZuminovelUpdateChapterPayload
  ): Promise<ZuminovelUpdateChapterResult> {
    const res = await this.request<ZuminovelUpdateChapterResponse>(
      apiKey,
      `/chapters/${encodeURIComponent(chapterId)}`,
      { method: 'PUT', body: payload }
    );
    return res.data;
  }

  /**
   * DELETE /external/chapters/{chapter_id} — xóa vĩnh viễn.
   * CẢNH BÁO (theo tài liệu): chương đã có độc giả mua sẽ mất quyền đọc ngay lập tức.
   * Cố ý KHÔNG có UI gọi hàm này trong bản đầu — chỉ để sẵn ở tầng service.
   */
  public async deleteChapter(apiKey: string, chapterId: string): Promise<void> {
    await this.request<ZuminovelDeleteChapterResponse>(apiKey, `/chapters/${encodeURIComponent(chapterId)}`, {
      method: 'DELETE',
    });
  }

  /** POST /external/upload — tải ảnh lên CDN (multipart/form-data, tối đa 5MB/ảnh). */
  public async uploadImage(apiKey: string, file: File | Blob, folder?: string): Promise<ZuminovelUploadResult> {
    const form = new FormData();
    form.append('image', file);
    if (folder) form.append('folder', folder);
    const res = await this.request<ZuminovelUploadResponse>(apiKey, '/upload', {
      method: 'POST',
      body: form,
      isMultipart: true,
    });
    return res.data;
  }
}

export const zuminovelRestClient = new ZuminovelRestClient();
