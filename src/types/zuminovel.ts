/**
 * Types cho ZumiNovel Publish API (https://zuminovel.com/publish/api)
 *
 * Nguồn: chụp màn hình tài liệu API do người dùng cung cấp trực tiếp (không có
 * bản public index được vì trang tài liệu nằm sau đăng nhập / bị chặn crawl).
 * Base URL xác nhận qua các đoạn code mẫu trong tài liệu: https://zuminovel.com/api/external
 *
 * Lưu ý: phần thân JSON lỗi (error body) không được tài liệu chụp lại đầy đủ,
 * chỉ có bảng mã lỗi + mô tả. zuminovelRestClient.ts xử lý phòng thủ (đọc nhiều
 * field có thể có: code/error/message) thay vì giả định một schema lỗi cứng.
 */

export const ZUMINOVEL_API_BASE_URL = 'https://zuminovel.com/api/external';

/** Giới hạn do tài liệu công bố: 50 request / phút / API key. */
export const ZUMINOVEL_RATE_LIMIT_PER_MINUTE = 50;

// ---- Danh sách truyện sở hữu: GET /external/novels ----

export interface ZuminovelNovel {
  id: string;
  title: string;
  slug: string;
}

export interface ZuminovelListNovelsResponse {
  success: true;
  data: ZuminovelNovel[];
}

// ---- Danh sách chương: GET /external/novels/{id_or_slug}/chapters ----

export interface ZuminovelChapterSummary {
  id: string;
  title: string;
  volume?: string;
  volumeOrder?: number;
  order: number;
  status: string; // vd 'published' — Zumi không liệt kê đầy đủ enum trong tài liệu
  isVIP: boolean;
  createdAt: string;
}

export interface ZuminovelListChaptersResponse {
  success: true;
  count: number;
  data: ZuminovelChapterSummary[];
}

// ---- Đăng chương mới: POST /external/chapters ----

export interface ZuminovelCreateChapterPayload {
  /** Bắt buộc nếu không có novelId. */
  novelSlug?: string;
  /** Bắt buộc nếu không có novelSlug. */
  novelId?: string;
  title: string;
  /** Nội dung HTML, mỗi đoạn bọc trong thẻ <p>...</p>. */
  content: string;
  volume?: string;       // mặc định 'Volume 1' nếu bỏ trống
  volumeOrder?: number;  // mặc định 1
  order?: number;        // mặc định: tự động (chương cuối + 1)
  isVIP?: boolean;       // mặc định false
  price?: number;        // đơn vị VND/Zumi, mặc định 0
  isAdult?: boolean;     // mặc định false
}

export interface ZuminovelCreateChapterResult {
  id: string;
  slug: string;
  order: number;
}

export interface ZuminovelCreateChapterResponse {
  success: true;
  message: string;
  data: ZuminovelCreateChapterResult;
}

// ---- Cập nhật chương: PUT /external/chapters/{chapter_id} ----
// Hỗ trợ kiểu PATCH: chỉ gửi field muốn đổi, field còn lại giữ nguyên.

export type ZuminovelUpdateChapterPayload = Partial<
  Omit<ZuminovelCreateChapterPayload, 'novelSlug' | 'novelId'>
>;

export interface ZuminovelUpdateChapterResult {
  id: string;
  title: string;
}

export interface ZuminovelUpdateChapterResponse {
  success: true;
  message: string;
  data: ZuminovelUpdateChapterResult;
}

// ---- Xóa chương: DELETE /external/chapters/{chapter_id} ----
// CẢNH BÁO (theo tài liệu): xóa vĩnh viễn, chương đã có độc giả mua sẽ mất quyền đọc.
// Không có ảnh chụp response mẫu — giả định theo khuôn chung success/message của các endpoint khác.

export interface ZuminovelDeleteChapterResponse {
  success: true;
  message?: string;
}

// ---- Tải ảnh lên: POST /external/upload (multipart/form-data) ----

export const ZUMINOVEL_UPLOAD_MAX_BYTES = 5 * 1024 * 1024; // 5.0 MB / ảnh

export interface ZuminovelUploadResult {
  url: string;
  key: string;
}

export interface ZuminovelUploadResponse {
  success: true;
  data: ZuminovelUploadResult;
}

// ---- Lỗi ----

/** Các mã lỗi được tài liệu liệt kê tường minh trong mục Safety & Error Handling. */
export type ZuminovelErrorCode =
  | 'API_KEY_REQUIRED'   // 401 — thiếu header X-API-Key
  | 'INVALID_API_KEY'    // 401 — key sai hoặc đã bị vô hiệu hóa
  | 'TOO_MANY_REQUESTS'  // 429 — vượt quá 50 request/phút
  | 'UNAUTHORIZED_ACCESS'; // 403 — key đúng nhưng không có quyền trên tài nguyên

export const ZUMINOVEL_ERROR_MESSAGES: Record<ZuminovelErrorCode, string> = {
  API_KEY_REQUIRED: 'Thiếu API Key trong header X-API-Key.',
  INVALID_API_KEY: 'API Key không chính xác hoặc đã bị vô hiệu hóa.',
  TOO_MANY_REQUESTS: 'Đã vượt quá giới hạn 50 request/phút. Vui lòng thử lại sau.',
  UNAUTHORIZED_ACCESS: 'API Key hợp lệ nhưng không có quyền với tài nguyên này.',
};
