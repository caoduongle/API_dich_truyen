# Chính sách Bảo mật (Security Policy)

Dự án **AI Dịch Truyện Trung - Việt (Bàn Biên Tập Bản Thảo Chu Sa)** luôn coi trọng tính an toàn, bảo mật dữ liệu và quyền riêng tư của người dùng.

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
2. **Email liên hệ**: Gửi thông tin chi tiết đến email quản trị viên dự án.

### Thông tin cần cung cấp khi báo cáo:
- Mô tả chi tiết lỗ hổng và phạm vi ảnh hưởng (ví dụ: rò rỉ secret trong log, bypass xác thực, prompt injection, CSRF/XSS, lỗi validation API).
- Các bước cụ thể để tái hiện lỗi (Proof of Concept - PoC).
- Môi trường thử nghiệm (Hệ điều hành, Node.js version, chế độ môi trường `development` hay `production`).
- Đề xuất phương án khắc phục (nếu có).

### Cam kết phản hồi:
- Chúng tôi sẽ xác nhận tiếp nhận thông tin báo cáo trong vòng **48 giờ**.
- Tiến hành đánh giá mức độ nghiêm trọng và phát hành bản vá bảo mật trong thời gian sớm nhất.
- Ghi nhận đóng góp của người báo cáo (Responsible Disclosure Credit) sau khi bản vá được phát hành.

---

## Nguyên tắc bảo mật cốt lõi của dự án

1. **Kiến trúc Đồng bộ Không Tri thức (Zero-Knowledge Session Sync) & Bảo vệ API Key**:
   - API key cá nhân (Gemini, OpenAI, Anthropic) được lưu trữ an toàn trong `sessionStorage` của trình duyệt và **tuyệt đối không bao giờ gửi plaintext** tới máy chủ ứng dụng khi đồng bộ phiên.
   - Trình duyệt chỉ gửi mã băm SHA-256 một chiều (`crypto.subtle.digest`) lên máy chủ để phục vụ quản lý phiên, hạn mức và điều phối (`/api/session-keys`).
   - Các thao tác gọi AI (dịch thuật trực tiếp, tra cứu model, dịch nhanh) được thực hiện Client-Direct từ trình duyệt thẳng đến nhà cung cấp AI.
   - Máy chủ và hệ thống ghi log (`Logger`, Metrics) tự động lọc và thay thế chuỗi API key (`AIza...`, `sk-...`, `sk-ant-...`), token xác thực, mật khẩu bằng `[REDACTED]`.
   - Toàn bộ query parameter nhạy cảm trên URL đều bị xóa khỏi log structured.
2. **Phòng thủ AI & Chống Prompt Injection**:
   - Dữ liệu truyện và cẩm nang do người dùng cung cấp được xem là **Untrusted Data** (không đáng tin cậy).
   - Tự động làm sạch các ký tự điều khiển tàng hình (Unicode Zero-Width `\u200B`–`\u200D`, `\uFEFF`, Directional formatting, Unicode Tag range `\u{E0000}`–`\u{E007F}`).
   - Chỉ thị hệ thống của AI được bọc trong khung bảo vệ văn học nghiêm ngặt (`ANTI_INJECTION_DEFENSE_DIRECTIVE` & `LITERARY_TRANSLATION_FRAMING`), ngăn chặn mọi nỗ lực ghi đè luật dịch thuật.
3. **Kiểm soát truy cập & Giới hạn tần suất (Rate Limiting)**:
   - Endpoint đăng nhập (`POST /api/auth/login`) áp dụng giới hạn riêng biệt: tối đa 10 lần thử trong 15 phút.
   - Các API xử lý nghiệp vụ được giới hạn tần suất theo địa chỉ IP và phiên làm việc (`ioredis` hoặc bộ nhớ trong).
4. **Kiểm tra dữ liệu đầu vào (Input Validation)**:
   - Toàn bộ POST endpoint đều kiểm tra kiểu dữ liệu, giới hạn số lượng và độ dài tối đa trước khi đưa vào luồng xử lý.
5. **Chính sách bảo mật trình duyệt (CSP)**:
   - Ở môi trường Production, Express kích hoạt đầy đủ bộ header Helmet với Content Security Policy hạn chế tối đa nguy cơ XSS/clickjacking (`object-src 'none'`, `frame-ancestors 'none'`).

---

## Danh mục kiểm tra khi triển khai Production (Production Deployment Checklist)

Trước khi mở ứng dụng ra mạng công cộng (Public Internet):
- [ ] Thiết lập biến môi trường `NODE_ENV=production`.
- [ ] Thiết lập `ACCESS_PASSWORD` đủ mạnh nếu muốn giới hạn quyền sử dụng ứng dụng.
- [ ] Cấu hình `REDIS_URL` khi triển khai dạng multi-instance hoặc serverless container (Cloud Run, ECS) để đồng bộ rate limit và session keys.
- [ ] Thiết lập `TRUST_PROXY_HOPS` đúng với số lớp proxy/load balancer phía trước.
- [ ] Đảm bảo file `.env` không bị commit vào git repository.
- [ ] Chạy kiểm thử tự động: `npm run lint`, `npm test`, `npm run build`.
