export const VALID_TABS = ['translate', 'auto-translate', 'glossary', 'history', 'projects', 'hako-checker'] as const;
export type TabType = typeof VALID_TABS[number];

export const TAB_METADATA: Record<TabType, { title: string; desc: string }> = {
  'translate': {
    title: 'Bàn Dịch Thuật',
    desc: 'Không gian dịch thuật song ngữ Trung - Việt gióng hàng thời gian thực, tích hợp tra cứu từ điển và đối chiếu ngữ cảnh AI.',
  },
  'auto-translate': {
    title: 'Dịch Tự Động Toàn Bộ',
    desc: 'Quy trình dịch thuật tự động 2 pha (dịch thô & mài giũa) xử lý hàng loạt chương tiểu thuyết với độ nhất quán cao.',
  },
  'glossary': {
    title: 'Từ Điển Nhân Vật & Thuật Ngữ',
    desc: 'Quản lý kho từ vựng, tên nhân vật, địa danh và thuật ngữ chuyên ngành tiếng Hán cho tác phẩm.',
  },
  'history': {
    title: 'Lịch Sử Chương Dịch',
    desc: 'Theo dõi tiến trình phiên bản, đối chiếu bản thảo trước sau và khôi phục các phân đoạn dịch.',
  },
  'projects': {
    title: 'Quản Lý Tiểu Thuyết',
    desc: 'Danh sách và thông tin các bộ truyện, thống kê tiến độ chương và thiết lập cấu hình riêng cho từng tác phẩm.',
  },
  'hako-checker': {
    title: 'Kiểm Định Chất Lượng Hako',
    desc: 'Công cụ rà soát lỗi chính tả, từ cấm, định dạng đoạn văn theo tiêu chuẩn biên tập tiểu thuyết mạng Hako.',
  },
};
