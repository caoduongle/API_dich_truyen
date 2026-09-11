import React, { useState } from 'react';
import { Languages, Mail, Phone, X } from 'lucide-react';
import { Seal } from '../ui/Seal';
import { Button } from '../ui/Button';

export function AppFooter() {
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  return (
    <>
      <footer className="bg-parchment border-t border-parchment-2 text-text-muted py-8 mt-12 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b border-parchment-2/60">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-[2px] bg-ink flex items-center justify-center border border-parchment-2">
                <Languages className="w-3.5 h-3.5 text-polish" />
              </div>
              <div>
                <span className="font-display font-semibold text-text-main tracking-wider uppercase text-[11px] block">
                  ZHONG-VIET AI TRANSLATOR
                </span>
                <span className="text-[10px] text-text-muted">
                  Bàn Biên Tập Bản Thảo Chu Sa &bull; Tối ưu dịch thuật tiên hiệp, kiếm hiệp
                </span>
              </div>
            </div>

            {/* Links, Policy & Contact */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-text-muted font-medium justify-center md:justify-end">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="hover:text-polish transition-colors cursor-pointer"
              >
                Chính sách bảo mật
              </button>
              <button
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="hover:text-polish transition-colors cursor-pointer"
              >
                Điều khoản sử dụng
              </button>
              <a
                href="https://github.com/caoduongle/API_dich_truyen"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-polish transition-colors inline-flex items-center gap-1"
              >
                Mã nguồn GitHub
              </a>
              <a
                href="mailto:caoduongle22@gmail.com"
                className="hover:text-polish transition-colors inline-flex items-center gap-1"
                title="Gửi email hỗ trợ kỹ thuật"
              >
                <Mail className="w-3.5 h-3.5 text-polish" />
                <span>caoduongle22@gmail.com</span>
              </a>
              <a
                href="tel:+84357077042"
                className="hover:text-polish transition-colors inline-flex items-center gap-1"
                title="Gọi đường dây nóng hỗ trợ"
              >
                <Phone className="w-3.5 h-3.5 text-polish" />
                <span>+84 357 077 042</span>
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
            <p className="text-text-muted">
              &copy; {new Date().getFullYear()} ZHONG-VIET AI TRANSLATOR. Giữ toàn quyền bảo lưu.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="bg-ink px-2 py-0.5 rounded-[2px] text-[10px] text-text-main border border-parchment-2">
                IndexedDB Persistent Storage
              </span>
              <span className="bg-ink px-2 py-0.5 rounded-[2px] text-[10px] text-text-main border border-parchment-2">
                Gemini 2.5 Pro &amp; Flash Ready
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Modal Chính Sách Bảo Mật & Quyền Riêng Tư */}
      {showPrivacyModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="privacy-modal-title"
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
          onClick={() => setShowPrivacyModal(false)}
        >
          <div
            className="bg-parchment border border-parchment-2 rounded-md max-w-lg w-full p-6 shadow-2xl relative text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-parchment-2 mb-4">
              <div className="flex items-center gap-2">
                <Seal character="隱" size="sm" tone="polish" />
                <h3 id="privacy-modal-title" className="font-display font-bold text-text-main text-base">
                  Chính Sách Bảo Mật
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="text-text-muted hover:text-text-main p-1 rounded-sm cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-text-muted leading-relaxed">
              <p>
                <strong className="text-text-main">1. Lưu Trữ Cục Bộ (IndexedDB):</strong> Toàn bộ dữ liệu tác phẩm, các chương truyện dịch và từ điển thuật ngữ được lưu trữ 100% trong trình duyệt của bạn (IndexedDB client-side). Không có dữ liệu truyện nào bị gửi hay thu thập trái phép lên máy chủ từ xa.
              </p>
              <p>
                <strong className="text-text-main">2. Bảo Mật Khóa API:</strong> Khóa Gemini API Key của bạn được lưu an toàn tại localStorage trình duyệt của bạn, chỉ được dùng để gửi yêu cầu dịch thuật trực tiếp đến Google AI.
              </p>
              <p>
                <strong className="text-text-main">3. Quyền Sở Hữu Bản Quyền:</strong> Toàn bộ bản dịch thuộc quyền sở hữu của người dùng. Hệ thống cung cấp công cụ xuất file TXT/EPUB để bạn toàn quyền sao lưu và quản lý.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setShowPrivacyModal(false)}>
                Đã hiểu và đồng ý
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Điều Khoản Sử Dụng */}
      {showTermsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="terms-modal-title"
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
          onClick={() => setShowTermsModal(false)}
        >
          <div
            className="bg-parchment border border-parchment-2 rounded-md max-w-lg w-full p-6 shadow-2xl relative text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-parchment-2 mb-4">
              <div className="flex items-center gap-2">
                <Seal character="約" size="sm" tone="polish" />
                <h3 id="terms-modal-title" className="font-display font-bold text-text-main text-base">
                  Điều Khoản Sử Dụng
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="text-text-muted hover:text-text-main p-1 rounded-sm cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-text-muted leading-relaxed">
              <p>
                <strong className="text-text-main">1. Tính Chất Công Cụ:</strong> Đây là công cụ hỗ trợ dịch thuật bằng AI (Google Gemini), hoạt động dựa trên Khóa API do chính người dùng tự cung cấp. Chất lượng bản dịch phụ thuộc vào mô hình AI của bên thứ ba và không được đảm bảo tuyệt đối chính xác.
              </p>
              <p>
                <strong className="text-text-main">2. Trách Nhiệm Người Dùng:</strong> Người dùng chịu trách nhiệm về nội dung văn bản đưa vào dịch cũng như bản dịch tạo ra, bao gồm việc tuân thủ bản quyền tác phẩm gốc và pháp luật hiện hành khi sử dụng hoặc phát hành bản dịch.
              </p>
              <p>
                <strong className="text-text-main">3. Giới Hạn Trách Nhiệm:</strong> Phần mềm được cung cấp "nguyên trạng" (as-is), miễn phí và mã nguồn mở. Chúng tôi không chịu trách nhiệm cho bất kỳ thiệt hại nào phát sinh từ việc sử dụng công cụ, bao gồm nhưng không giới hạn ở mất dữ liệu hoặc chi phí phát sinh từ Khóa API của bạn.
              </p>
              <p>
                <strong className="text-text-main">4. Thay Đổi Điều Khoản:</strong> Điều khoản có thể được cập nhật theo thời gian. Việc tiếp tục sử dụng phần mềm sau khi có thay đổi đồng nghĩa với việc bạn chấp nhận các điều khoản mới.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setShowTermsModal(false)}>
                Đã hiểu và đồng ý
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
