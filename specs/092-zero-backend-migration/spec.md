# Feature Specification: Chuyển API_dich_truyen thành ứng dụng thuần Client-Side (Zero Backend)

**Feature Branch**: `092-zero-backend-migration`  
**Created**: 2026-09-05  
**Status**: Ready for Planning & Implementation  
**Input**: Chuyển đổi toàn bộ hệ sinh thái dịch truyện thành Single Page Application (SPA) tĩnh 100%, loại bỏ hoàn toàn máy chủ Node.js/Express, Redis và WebSocket relay server; đưa toàn bộ quản lý API key, hạn mức quota cá nhân và lưu trữ dữ liệu về phía trình duyệt (IndexedDB / localStorage) và Google Drive cá nhân.

---

## 1. User Scenarios & Testing *(mandatory)*

### User Story 1 - Trải Nghiệm SPA Tĩnh Mở Tự Do Không Cần Máy Chủ (Priority: P1) 🎯 MVP

Là một dịch giả cá nhân hoặc biên tập viên, tôi muốn truy cập và sử dụng công cụ dịch truyện trực tiếp từ bất kỳ trình duyệt web nào (được host tĩnh trên Cloudflare Pages, Netlify, Vercel, hoặc GitHub Pages) mà không cần nhập mật khẩu toàn site (`ACCESS_PASSWORD`), không bị phụ thuộc vào tiến trình backend server trung gian, và toàn bộ dữ liệu truyện cùng API key của tôi được bảo mật tuyệt đối tại trình duyệt của riêng tôi.

**Why this priority**: Đây là mục tiêu tối thượng của quá trình chuyển đổi Zero Backend — loại bỏ chi phí vận hành máy chủ, rủi ro rò rỉ dữ liệu hoặc khóa API tại máy chủ trung gian, và cho phép ứng dụng triển khai tức thì ở mọi nơi.

**Independent Test**:
- Build ứng dụng bằng lệnh `npm run build` (chỉ chạy Vite), sau đó phục vụ thư mục `dist/` bằng một web server tĩnh bất kỳ (ví dụ `npx serve dist` hoặc static host).
- Mở ứng dụng trên trình duyệt: Truy cập thẳng vào trang chủ mà không xuất hiện popup/modal đăng nhập mật khẩu site.
- Nhập khóa API cá nhân, tạo dự án truyện, thực hiện dịch thuật và xuất file: Toàn bộ dữ liệu lưu trong IndexedDB, các cuộc gọi AI gửi trực tiếp tới `generativelanguage.googleapis.com`, và trong DevTools Network tab **không có bất kỳ request nào** gửi tới `/api/*`.

**Acceptance Scenarios**:
1. **Given** một bản build tĩnh được deploy trên hosting không có Node.js runtime, **When** người dùng truy cập ứng dụng lần đầu, **Then** giao diện hiển thị ngay lập tức, không yêu cầu mật khẩu bảo vệ site, không có lỗi kết nối backend.
2. **Given** người dùng cấu hình danh sách API keys của mình, **When** thực hiện dịch thô, mài giũa văn phong, quét thuật ngữ hay kiểm duyệt QA, **Then** toàn bộ quá trình xử lý diễn ra trực tiếp giữa trình duyệt và Google Gemini API.
3. **Given** công cụ tìm kiếm model (`useModelDiscovery`), **When** người dùng mở danh sách model, **Then** hệ thống gọi `listModelsDirect` thay vì gọi endpoint 404 cũ `/api/list-models`.

---

### User Story 2 - Theo Dõi & Quản Lý Hạn Mức Quota Cục Bộ Trên Trình Duyệt (Priority: P1) 🎯 MVP

Là một người dùng sở hữu các khóa Google Gemini API cá nhân, tôi muốn theo dõi trực tiếp trạng thái hạn mức (Key Health, RPM/TPM sliding window, PST midnight reset, circuit breaker) ngay trên giao diện Quota Panel của trình duyệt mà không cần server trung gian làm trọng tài hay tính năng chia sẻ key nhóm.

**Why this priority**: Mỗi người dùng tự quản lý và chịu trách nhiệm về khóa của mình. Việc theo dõi quota cục bộ giúp người dùng chủ động điều phối, tránh vượt ngưỡng hạn mức và bảo vệ khóa an toàn.

**Independent Test**:
- Mở bảng điều khiển Quota (`QuotaPanel.tsx`), kích hoạt dịch truyện để tạo tải.
- Kiểm chứng các chỉ số hạn mức (RPM, TPM, RPD, trạng thái Active/Cooldown/Depleted) nhảy số theo thời gian thực từ `localQuotaTracker.ts`.
- Không có request nào gửi tới `/api/quota-status`, `/api/quota-groups/*` hay `/api/session-keys`.

**Acceptance Scenarios**:
1. **Given** người dùng cấu hình một hoặc nhiều API keys, **When** ứng dụng thực hiện các cuộc gọi AI, **Then** `localQuotaTracker` ghi nhận số token và lượt gọi theo cửa sổ trượt (sliding window) và lưu trữ trạng thái vào localStorage/IndexedDB.
2. **Given** một key bị lỗi hạn mức 429 (Resource Exhausted), **When** tracker phát hiện, **Then** trạng thái key tự động chuyển sang Cooldown/Depleted, tự động xoay vòng sang key kế tiếp và tự phục hồi khi qua chu kỳ đặt lại (nửa đêm giờ PST hoặc sau thời gian chờ).
3. **Given** bảng điều khiển `QuotaPanel`, **When** người dùng mở xem, **Then** toàn bộ dữ liệu hiển thị lấy trực tiếp từ `localQuotaTracker` của client.

---

### User Story 3 - Chia Sẻ & Đồng Bộ Bất Đồng Bộ Qua Google Drive (Priority: P2)

Là một nhóm cộng tác dịch truyện, chúng tôi muốn chia sẻ dự án và đồng bộ tiến độ dịch thông qua Google Drive cá nhân của các thành viên mà không cần duy trì máy chủ WebSocket CRDT hay cơ sở dữ liệu Redis.

**Why this priority**: Thay thế giải pháp cộng tác real-time tốn kém hạ tầng bằng mô hình chia sẻ file bất đồng bộ qua Google Drive (đã hoàn thiện trên client với OAuth 2.0 PKCE và Google Identity Services).

**Independent Test**:
- Đăng nhập Google và kết nối Google Drive trong ứng dụng.
- Thực hiện xuất dự án hoặc đồng bộ tiến độ lên Google Drive (`driveBundleSync.ts`, `driveGranularSync.ts`).
- Kiểm chứng hệ thống hoạt động mượt mà mà không có bất kỳ kết nối WebSocket hay request `/api/ws-ticket` nào.

**Acceptance Scenarios**:
1. **Given** người dùng làm việc trên chương truyện, **When** thực hiện lưu hoặc đồng bộ Drive, **Then** dữ liệu được lưu vào IndexedDB cục bộ và đồng bộ lên Google Drive mà không kết nối WebSocket relay.
2. **Given** mã nguồn workspace, **When** kiểm tra `useChapterCRDT` và thanh trạng thái cộng tác, **Then** toàn bộ logic WebSocket CRDT mồ côi đã được dọn dẹp sạch sẽ, không gây lỗi runtime.

---

### User Story 4 - Triển Khai Hosting Tĩnh & Cấu Hình Bảo Mật Headers (Priority: P2)

Là một nhà phát triển hoặc quản trị viên dự án, tôi muốn triển khai toàn bộ ứng dụng chỉ bằng một thư mục static build lên Cloudflare Pages, Netlify, Vercel hoặc GitHub Pages, với các tiêu đề bảo mật (CSP, HSTS, COOP/COEP) được cấu hình chuẩn tĩnh.

**Why this priority**: Đảm bảo ứng dụng chạy an toàn, tương thích với popup OAuth của Google, và không đòi hỏi cấu hình máy chủ phức tạp.

**Independent Test**:
- Kiểm tra file `public/_headers` và `vercel.json`.
- Triển khai bản build tĩnh và kiểm tra Network response headers: Header CSP cho phép `generativelanguage.googleapis.com` và Google APIs; header `Cross-Origin-Opener-Policy: same-origin-allow-popups` hỗ trợ hoàn hảo Google Sign-In.

**Acceptance Scenarios**:
1. **Given** cấu hình build trong `package.json`, **When** chạy `npm run build`, **Then** chỉ chạy `tsc && vite build`, sinh ra duy nhất thư mục `dist/` mà không biên dịch bất kỳ file server nào.
2. **Given** các file cấu hình `public/_headers` và `vercel.json`, **When** deploy lên Cloudflare Pages/Netlify/Vercel, **Then** các chính sách bảo mật CSP/HSTS/COOP được áp dụng chính xác cho trình duyệt.

---

## 2. Edge Cases & Resilience

- **Thiếu kết nối Internet khi khởi động**: Ứng dụng vẫn mở bình thường từ cache trình duyệt (PWA/SPA), đọc dữ liệu truyện từ IndexedDB; chỉ thông báo khi người dùng kích hoạt tác vụ cần AI hoặc Drive.
- **Xoay vòng key và khôi phục sau lỗi mạng**: `directGeminiClient` và `localQuotaTracker` phối hợp bắt lỗi mạng hoặc lỗi hạn mức, thử lại với key khả dụng tiếp theo.
- **Reset hạn mức theo giờ chuẩn Google (PST Midnight)**: Tracker cục bộ tính toán mốc thời gian nửa đêm theo múi giờ America/Los_Angeles để tự động reset hạn mức ngày (RPD) trong storage client.
- **Trình duyệt ở chế độ ẩn danh (Incognito)**: IndexedDB và localStorage hoạt động trong phiên làm việc; hiển thị khuyến cáo người dùng xuất dữ liệu hoặc đồng bộ Drive để tránh mất mát khi đóng tab.

---

## 3. Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI loại bỏ hoàn toàn các controller, middleware, routes và dịch vụ liên quan đến backend Express trong thư mục `server/`, bao gồm `server.ts`.
- **FR-002**: Hệ thống PHẢI gỡ bỏ cơ chế bảo vệ mật khẩu toàn site (`ACCESS_PASSWORD`), xóa `authController`, `authMiddleware`, `authStore`, các hàm auth trong `src/utils/apiClient.ts` và loại bỏ `AuthModal.tsx` khỏi `src/App.tsx`.
- **FR-003**: Hệ thống PHẢI gỡ bỏ toàn bộ hạ tầng WebSocket CRDT relay và Redis (`websocketRelayService.ts`, `wsTicketService.ts`, `crdtRedisPubSub.ts`, `/api/ws-ticket`), dọn dẹp logic kết nối WebSocket trong `crdtDocManager.ts`, `useChapterCRDT.ts`, và `CollaboratorPresenceBar.tsx`.
- **FR-004**: Hệ thống PHẢI xây dựng module theo dõi hạn mức cục bộ `src/services/localQuotaTracker.ts` để lưu trữ và quản lý Key Health, PST Midnight Reset, Sliding Window RPM/TPM và Circuit Breaker hoàn toàn trên trình duyệt.
- **FR-005**: Hệ thống PHẢI cập nhật `QuotaPanel.tsx` và các component con liên quan để đọc dữ liệu trực tiếp từ `localQuotaTracker`, loại bỏ các cuộc gọi API server `/api/quota-status`, `/api/quota-groups/*` và `/api/session-keys`.
- **FR-006**: Hệ thống PHẢI sửa lỗi gọi endpoint 404 trong `src/hooks/useModelDiscovery.ts` bằng cách thay thế bằng `listModelsDirect` từ `src/services/directGeminiClient.ts` (hoặc dọn dẹp nếu không còn sử dụng).
- **FR-007**: Hệ thống PHẢI đảm bảo không còn bất kỳ lệnh gọi `fetch('/api/...')` nào trong toàn bộ thư mục `src/`.
- **FR-008**: Hệ thống PHẢI cập nhật `package.json`: gỡ bỏ các dependencies backend (`express`, `ioredis`, `ws`, `helmet`, `@types/express`, `@types/ws`, `cookie-parser`), tinh gọn lệnh build thành `"build": "tsc && vite build"`, và preview thành `"preview": "vite preview"`.
- **FR-009**: Hệ thống PHẢI tạo file cấu hình security headers tĩnh `public/_headers` (cho Cloudflare Pages / Netlify) và `vercel.json` (cho Vercel) với đầy đủ CSP, HSTS, và COOP cho Google OAuth.
- **FR-010**: Hệ thống PHẢI cập nhật `.env.example`, xóa sạch các biến backend và chỉ giữ lại các cấu hình client `VITE_GOOGLE_*`.
- **FR-011**: Hệ thống PHẢI dọn dẹp các tệp kiểm thử server trong `server/` và cập nhật các unit tests phía client để đạt trạng thái xanh 100% khi chạy `npx vitest run`.
- **FR-012**: Lệnh `npx tsc --noEmit` PHẢI hoàn thành sạch sẽ với 0 lỗi type.
- **FR-013**: Hệ thống PHẢI cập nhật tài liệu kiến trúc: `README.md`, `docs/architecture.md`, `docs/quota-and-scheduling.md` phản ánh đúng mô hình Pure Client-Side SPA 100%.

---

## 4. Key Entities *(Client-Side State)*

### 4.1 `LocalKeyQuotaRecord`
Bản ghi trạng thái sức khỏe và hạn mức của một API key trên client.
- `keyHash`: Mã băm định danh khóa an toàn (không lưu lộ khóa).
- `status`: Trạng thái (`'active' | 'cooldown' | 'depleted' | 'invalid'`).
- `requestsThisMinute`: Số lượt gọi trong cửa sổ 60s hiện tại.
- `tokensThisMinute`: Số token trong cửa sổ 60s hiện tại.
- `requestsToday`: Số lượt gọi tích lũy trong ngày (tính theo giờ PST).
- `lastUsedTimestamp`: Thời điểm gọi gần nhất.
- `cooldownUntil`: Thời điểm kết thúc cooldown nếu bị 429.

### 4.2 `LocalQuotaSummary`
Bản tóm tắt hạn mức tổng thể hiển thị trên Quota Panel.
- `totalKeys`: Tổng số key đã cài đặt.
- `activeKeys`: Số key đang sẵn sàng hoạt động.
- `coolingKeys`: Số key đang tạm nghỉ do chạm ngưỡng tốc độ.
- `depletedKeys`: Số key đã cạn hạn mức trong ngày.
- `aggregateRpm`: Tổng RPM tức thời của toàn bộ keys.
- `aggregateTpm`: Tổng TPM tức thời của toàn bộ keys.

---

## 5. Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Lệnh `npm run build` chạy thành công và sinh ra duy nhất thư mục tĩnh `dist/` phục vụ web tĩnh, hoàn toàn không có tiến trình Node.js server.
- **SC-002**: Lệnh kiểm tra quét mã nguồn `grep -rn "fetch('/api" src/` và `grep -rn 'fetch("/api' src/` trả về kết quả rỗng (0 kết quả).
- **SC-003**: Thư mục `server/` và file `server.ts` bị loại bỏ 100% khỏi kho lưu trữ mã nguồn.
- **SC-004**: Toàn bộ các gói backend không cần thiết (`express`, `ioredis`, `ws`, `helmet`, v.v.) được gỡ bỏ khỏi `package.json`.
- **SC-005**: Lệnh `npx tsc --noEmit` đạt 0 lỗi type.
- **SC-006**: Toàn bộ kiểm thử tự động `npx vitest run` hoàn thành với tỷ lệ đỗ 100%.
- **SC-007**: Ứng dụng chạy mượt mà trên môi trường serve tĩnh (`npx serve dist`) mà không xuất hiện bất kỳ lỗi mạng 404/500 nào liên quan tới backend.

---

## 6. Assumptions

1. Người dùng sở hữu ít nhất một Google Gemini API key và tự quản lý key trên thiết bị của mình.
2. Trình duyệt của người dùng hỗ trợ các chuẩn web hiện đại: Fetch API, IndexedDB, Web Storage, ES2022+.
3. Nhu cầu cộng tác nhiều người được đáp ứng thông qua chia sẻ tệp đồng bộ trên Google Drive, không cần tính năng gõ đồng thời từng ký tự qua WebSocket.
4. Triển khai sản phẩm nhắm tới các nền tảng hosting tĩnh (Cloudflare Pages, Vercel, Netlify, GitHub Pages, Firebase Hosting, AWS S3/CloudFront).
