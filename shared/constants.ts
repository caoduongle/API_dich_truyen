/**
 * Hệ thống Hằng số Toàn cục Dùng chung (Global Shared Constants)
 * Quản lý tập trung mọi ngưỡng, kích thước buffer, thời gian chờ và giới hạn của hệ thống.
 */

// --- CẤU HÌNH MÁY CHỦ (SERVER CONFIG) ---
export const SERVER_CONFIG = {
  /** Giới hạn kích thước payload JSON body (15MB để nạp các chương truyện dài) */
  BODY_SIZE_LIMIT: '15mb',
  /** Cổng mặc định khi chạy server */
  DEFAULT_PORT: 3000,
  /** Cửa sổ thời gian tính rate limit (1 phút) */
  RATE_LIMIT_WINDOW_MS: 60 * 1000,
  /** Số request tối đa cho phép trong mỗi cửa sổ rate limit trên một IP */
  RATE_LIMIT_MAX_REQUESTS: 60,
  /** Cửa sổ thời gian tính rate limit riêng cho đăng nhập (15 phút) */
  AUTH_RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
  /** Số lần thử đăng nhập tối đa cho phép trong mỗi cửa sổ trên một IP (10 lần / 15 phút) */
  AUTH_RATE_LIMIT_MAX_REQUESTS: 10,
} as const;

// --- CẤU HÌNH DỊCH THUẬT & TRÍ TUỆ NHÂN TẠO (AI SERVICE CONFIG) ---
export const AI_SERVICE_CONFIG = {
  /**
   * Khoảng cách tối thiểu giữa 2 request liên tiếp trên cùng 1 API key (4620ms ~ 13 req/phút)
   * Giúp tránh lỗi Rate Limit (429) của gói miễn phí Gemini (15 RPM).
   */
  MIN_REQUEST_INTERVAL_PER_KEY_MS: 4620,
  /** Thời gian ngắt mạch (circuit breaker cooldown) khi API key gặp lỗi cạn quota: 5 phút */
  BLACKLIST_COOLDOWN_MS: 5 * 60 * 1000,
  /** Số lần thử lại tối đa khi gặp lỗi quá tải máy chủ AI (503 Overloaded) */
  MAX_OVERLOAD_RETRIES: 2,
  /** Chu kỳ chạy dọn dẹp các key hết hạn / hết thời gian ngắt mạch: 10 phút */
  CLEANUP_INTERVAL_MS: 10 * 60 * 1000,
  /** Ngưỡng thời gian coi một API key không còn hoạt động: 30 phút */
  STALE_KEY_THRESHOLD_MS: 30 * 60 * 1000,
  /** Thời gian sống của cache phân đoạn dịch (phút) */
  CHUNK_CACHE_TTL_MINUTES: 60,
} as const;

// --- GIỚI HẠN XỬ LÝ TỪ ĐIỂN (GLOSSARY LIMITS) ---
export const GLOSSARY_LIMITS = {
  /** Giới hạn ký tự gửi đến AI khi phân tích trích xuất thực thể/nhân vật từ văn bản truyện */
  MAX_CHARS_FOR_GLOSSARY_ANALYSIS: 8000,
  /** Giới hạn ký tự gửi đến AI khi phân tích cẩm nang dịch thuật (.md) */
  MAX_CHARS_FOR_GUIDELINES_ANALYSIS: 4000,
  /** Số lượng từ vựng tối đa hiển thị nhanh trên thanh công cụ bàn dịch */
  WORKSPACE_GLOSSARY_VISIBLE_LIMIT: 100,
  /** Kích thước phân trang mặc định trong bảng từ điển */
  DEFAULT_PAGE_SIZE: 20,
} as const;

// --- CẤU HÌNH GIAO DIỆN NGƯỜI DÙNG (UI & VIRTUAL LIST CONFIG) ---
export const UI_CONFIG = {
  /** Chiều cao của mỗi dòng chương trong danh sách ảo (px) */
  VIRTUAL_LIST_ITEM_HEIGHT: 72,
  /** Chiều cao khung nhìn cuộn của danh sách chương ảo (px) */
  VIRTUAL_LIST_CONTAINER_HEIGHT: 400,
  /** Số item đệm trước/sau vùng nhìn thấy của danh sách ảo */
  VIRTUAL_LIST_OVERSCAN: 10,
  /** Thời gian hiển thị mặc định của thông báo Toast (ms) */
  TOAST_DEFAULT_DURATION_MS: 4000,
  /** Thời gian hiển thị Toast có nút Undo (ms) */
  TOAST_UNDO_DURATION_MS: 6000,
} as const;

// --- CẤU HÌNH LƯU TRỮ TRÌNH DUYỆT (STORAGE CONFIG) ---
export const STORAGE_CONFIG = {
  /** Tỷ lệ phần trăm dung lượng đĩa đã dùng kích hoạt cảnh báo người dùng (80%) */
  NEAR_LIMIT_PERCENT: 80,
  /** Dung lượng trống tối thiểu kích hoạt cảnh báo (100MB) */
  NEAR_LIMIT_MIN_BYTES: 100 * 1024 * 1024,
  /** Tên cơ sở dữ liệu IndexedDB */
  DB_NAME: 'ai-story-translator-db',
  /** Phiên bản schema cơ sở dữ liệu IndexedDB hiện tại */
  DB_VERSION: 4,
} as const;
