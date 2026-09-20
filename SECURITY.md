# Chính sách Bảo mật (Security Policy)

Dự án **AI Dịch Truyện Trung - Việt (Bàn Biên Tập Bản Thảo Chu Sa)** hoạt động theo kiến trúc **thuần Client-side Single Page Application (SPA)**, luôn đặt tính an toàn, bảo vệ dữ liệu bản thảo và quyền riêng tư của người dùng lên hàng đầu.

---

## Các phiên bản được hỗ trợ (Supported Versions)

Chúng tôi chỉ phát hành các bản vá bảo mật cho nhánh chính (`main`) và các phiên bản phát hành mới nhất:

| Phiên bản | Được hỗ trợ bảo mật |
|:---|:---|
| `main` branch (phiên bản mới nhất) | :white_check_mark: Có |
| Các phiên bản cũ hơn | :x: Không |

---

## Báo cáo lỗ hổng bảo mật (Reporting a Vulnerability)

Nếu bạn phát hiện bất kỳ lỗ hổng hoặc rủi ro an toàn thông tin nào trong dự án, xin vui lòng **KHÔNG tạo issue công khai trên GitHub**.

Vui lòng báo cáo an toàn theo một trong các kênh sau:
1. **GitHub Security Advisory**: Truy cập tab [Security > Advisories](../../security/advisories) của kho chứa và chọn **"Report a vulnerability"**.
2. **Email liên hệ**: Gửi thông tin chi tiết đến `caoduongle22@gmail.com`.

### Thông tin cần cung cấp khi báo cáo:
- Mô tả chi tiết lỗ hổng và phạm vi ảnh hưởng (ví dụ: rò rỉ secret trong client state, prompt injection, bypass CSP, XSS, sai sót trong cơ chế mã hóa/xác thực).
- Các bước cụ thể để tái hiện lỗi (Proof of Concept - PoC).
- Môi trường thử nghiệm (Trình duyệt, Hệ điều hành, Node.js version khi build).
- Đề xuất phương án khắc phục (nếu có).

### Cam kết phản hồi:
- Chúng tôi sẽ xác nhận tiếp nhận thông tin báo cáo trong vòng **48 giờ**.
- Tiến hành đánh giá mức độ nghiêm trọng và phát hành bản vá bảo mật trong thời gian sớm nhất.
- Ghi nhận đóng góp của người báo cáo (Responsible Disclosure Credit) sau khi bản vá được phát hành.

---

## Mô hình bảo mật Client-Side cốt lõi

1. **Kiến trúc Client-Direct & Lưu trữ Cục bộ (Không trung gian máy chủ)**:
   - Khóa API (Gemini API Key) do người dùng cung cấp được quản lý trực tiếp trên trình duyệt: lưu tạm thời trong `sessionStorage` cho phiên làm việc hiện tại, và được đồng bộ vào `localStorage['app_ui_prefs'].savedKeys` khi tùy chọn "Ghi nhớ API Key trên trình duyệt này" (`rememberKeys`) được bật. Khi người dùng tắt tùy chọn này, toàn bộ khóa được xóa sạch khỏi `localStorage` và chỉ tồn tại tạm thời trong `sessionStorage` của tab.
   - Ứng dụng **hoàn toàn không có máy chủ trung gian**, API key chỉ được gửi trực tiếp từ trình duyệt tới Google Gemini API (`generativelanguage.googleapis.com`).
   - Mọi thao tác kiểm tra tình trạng key, đo đạc quota và truy vấn danh sách model đều thực hiện Client-Direct qua `directGeminiClient.ts` và `modelVerificationService.ts`.
   - Chuỗi API key được ẩn / mask trên giao diện người dùng và tự động làm sạch trong log console/chẩn đoán. Lưu ý: Không nên bật tùy chọn ghi nhớ khóa khi sử dụng trên máy tính công cộng hoặc thiết bị dùng chung.

2. **Xác thực Google OAuth 2.0 PKCE từ Trình duyệt**:
   - Tính năng đồng bộ Google Drive sử dụng luồng OAuth 2.0 Authorization Code với PKCE (Proof Key for Code Exchange) hoặc Google Identity Services Token Client chạy trực tiếp trên trình duyệt.
   - Token chỉ yêu cầu phạm vi tối thiểu (`drive.file` / `drive.appdata`) để chỉ truy cập các tệp do chính ứng dụng tạo ra, không thể đọc các tài liệu cá nhân khác của người dùng.

3. **Điều tiết Hạn mức Cục bộ (Client-Side Local Quota Tracker)**:
   - Thay thế hoàn toàn Redis server-side, hệ thống sử dụng `localQuotaTracker.ts` chạy trên bộ nhớ trình duyệt để quản lý hạn mức Request Per Minute (RPM) và Request Per Day (RPD), tự động luân chuyển giữa các API key khi gặp Rate Limit (429) hoặc tạm ngắt mạch (circuit breaker cooldown).

4. **Phòng thủ AI & Chống Prompt Injection**:
   - Dữ liệu chương truyện và cẩm nang do người dùng tải lên được xem là **Untrusted Data**.
   - Tự động làm sạch các ký tự điều khiển tàng hình (Unicode Zero-Width `\u200B`–`\u200D`, `\uFEFF`, Directional formatting, Unicode Tag range `\u{E0000}`–`\u{E007F}`).
   - Chỉ thị hệ thống của AI được bọc trong khung bảo vệ văn học nghiêm ngặt (`ANTI_INJECTION_DEFENSE_DIRECTIVE` & `LITERARY_TRANSLATION_FRAMING`), ngăn chặn mọi nỗ lực ghi đè prompt hoặc trích xuất quy tắc dịch thuật.

5. **Chính sách bảo mật trình duyệt khắt khe (CSP via `vercel.json`)**:
   - Ứng dụng triển khai chính sách `Content-Security-Policy` nghiêm ngặt, loại bỏ wildcard:
     - `default-src 'self'`
     - `connect-src 'self' https://generativelanguage.googleapis.com https://www.googleapis.com https://accounts.google.com https://content.googleapis.com https://oauth2.googleapis.com https://apis.google.com https://zuminovel.com`
     - `frame-ancestors 'none'` ngăn chặn hoàn toàn tấn công Clickjacking
     - `object-src 'none'` ngăn chặn nhúng plugin Flash/Java nguy hiểm
     - Kích hoạt đầy đủ `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, và HSTS.

6. **Lưu trữ Bản thảo Cục bộ (IndexedDB) & Luồng Truyền Dữ liệu Client-Direct**:
   - Bản thảo và từ điển lưu trữ cục bộ trong IndexedDB của trình duyệt người dùng qua `src/services/db.ts`. Ứng dụng hoạt động thuần Client-side, hoàn toàn không có máy chủ backend tiếp nhận hay lưu trữ nội dung truyện.
   - Khi người dùng thực hiện dịch thuật, trau chuốt, trích xuất thuật ngữ hoặc kiểm định chất lượng AI, các đoạn văn bản tương ứng được trình duyệt gửi trực tiếp tới Google Gemini API qua kết nối HTTPS mã hóa.
   - Dữ liệu chỉ được gửi tới dịch vụ lưu trữ đám mây khi người dùng chủ động kích hoạt đồng bộ Google Drive cá nhân, hoặc xuất file (TXT/EPUB) về thiết bị.

---

## Danh mục kiểm tra khi triển khai (Deployment Checklist)

Trước khi triển khai lên môi trường tĩnh (Vercel, Cloudflare Pages, GitHub Pages):
- [ ] Xác nhận cấu hình header bảo mật trong `vercel.json` (hoặc cấu hình tương đương trên web server).
- [ ] Chạy kiểm thử tự động và build production: `npm run lint && npm test && npm run build`.
- [ ] Đảm bảo không commit file cấu hình cục bộ hoặc API key thử nghiệm vào git repository.
