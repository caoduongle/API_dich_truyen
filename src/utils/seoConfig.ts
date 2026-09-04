/**
 * Cấu hình SEO & Canonical URL tập trung cho ứng dụng
 */
export const SEO_CONFIG = {
  siteName: 'AI Dịch Truyện Trung - Việt | Bàn Biên Tập Bản Thảo Chu Sa',
  shortName: 'Bản Thảo Chu Sa',
  defaultDescription: 'Ứng dụng dịch thuật tiểu thuyết Trung - Việt ứng dụng AI với bộ nhớ ngữ cảnh, tự động trích xuất thực thể nhân vật và kiểm định chất lượng Hako.',
  defaultTitle: 'Bàn Biên Tập Bản Thảo Chu Sa',
  author: 'Đội Ngũ Biên Tập Bản Thảo Chu Sa',
  themeColor: '#141210',
  defaultOgImage: '/og-image.svg',

  /**
   * Xác định Base URL theo môi trường trình duyệt hoặc cấu hình build
   */
  getBaseUrl(): string {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin;
    }
    // Hỗ trợ Vite import.meta.env nếu có
    const envUrl = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BASE_URL
      ? String(import.meta.env.VITE_BASE_URL)
      : '';
    if (envUrl && envUrl.startsWith('http')) {
      return envUrl.replace(/\/+$/, '');
    }
    return 'https://dich-truyen.example.com';
  },

  /**
   * Sinh Canonical URL tuyệt đối từ path tương đối
   */
  getCanonicalUrl(path: string = ''): string {
    const trimmed = (path || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
    return trimmed ? `${this.getBaseUrl()}/${trimmed}` : this.getBaseUrl();
  },
};

