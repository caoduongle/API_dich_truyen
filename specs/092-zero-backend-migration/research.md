# Research & Architecture Decisions: Zero Backend Migration

**Feature**: `092-zero-backend-migration`  
**Date**: 2026-09-05  
**Spec**: [spec.md](./spec.md)

---

## 1. Direct Client-to-Gemini API Integration

### Decision
Sử dụng trực tiếp thư viện `@google/genai` (hoặc direct `fetch` tới REST endpoint `https://generativelanguage.googleapis.com/v1beta/models`) từ trình duyệt người dùng với API key cá nhân được lưu tạm thời (`sessionStorage`) hoặc mã hóa trong IndexedDB.

### Rationale
- **Bảo mật tối đa**: Máy chủ trung gian không còn là vector tấn công hay điểm thu thập API key/nội dung truyện.
- **Chi phí vận hành bằng 0**: Loại bỏ hoàn toàn chi phí CPU/RAM/băng thông proxy backend.
- **Độ trễ thấp nhất**: Giảm thiểu 1 chặng mạng trung gian (Browser -> Server -> Google API -> Server -> Browser biến thành Browser -> Google API -> Browser).

### Alternatives Considered
- *Server Proxy với Ephemeral Keys*: Trình duyệt gửi key lên server cho từng request để server gọi Google. Bị loại bỏ vì vẫn phụ thuộc vào server Node.js đang chạy, chi phí hosting và nguy cơ rò rỉ log.
- *Serverless Functions (Cloudflare Workers / Vercel Functions)*: Vẫn là backend trung gian, phức tạp hóa việc deploy và vướng giới hạn execution timeout (thường 10s-30s) đối với các request dịch dài.

---

## 2. Client-Side Quota Tracking & Key Health State Machine

### Decision
Xây dựng `src/services/localQuotaTracker.ts` quản lý hạn mức và sức khỏe khóa API cục bộ trong bộ nhớ trình duyệt:
- **Sliding Window 60s**: Theo dõi RPM (Requests Per Minute) và TPM (Tokens Per Minute) theo cửa sổ trượt 60 giây.
- **PST Midnight Daily Reset**: Tính toán mốc 00:00:00 theo múi giờ `America/Los_Angeles` bằng `Intl.DateTimeFormat` để reset hạn ngạch ngày RPD đồng bộ chuẩn xác với Google AI Studio.
- **Circuit Breaker**: Chuyển trạng thái `Closed` (bình thường) ➔ `Open` (cooldown 3s - 60s khi gặp 429/503) ➔ `HalfOpen` (thử nghiệm với 2 lần gọi thành công liên tiếp trước khi mở lại hoàn toàn).
- **Key Hashing & Masking**: Sử dụng Web Crypto API (SHA-256) để tạo `keyHash` định danh và `maskApiKey` hiển thị `AIzaSy...opqr` bảo vệ an toàn cho khóa.

### Rationale
- Quản lý hạn mức chuẩn xác theo cơ chế của Google AI Studio mà không cần Redis hay server trung gian.
- Ngăn chặn triệt để tình trạng người dùng spam gây cạn kiệt quota hoặc bị Google khóa API key.

### Alternatives Considered
- *LocalStorage Counter đơn giản*: Chỉ đếm tổng số request trong ngày. Bị loại bỏ vì không kiểm soát được burst rate 15 RPM, dẫn đến lỗi 429 liên tục khi dịch phân đoạn.
- *Redis Token Bucket qua REST API*: Bị loại bỏ vì đòi hỏi phải có Redis server phân tán lúc runtime.

---

## 3. Quản lý Tài liệu & Đồng bộ Real-Time (CRDT)

### Decision
Loại bỏ WebSocket Relay Server (`server/services/websocketRelayService.ts`, `server.ts`) và Redis Pub/Sub. Đưa `crdtDocManager.ts` và `useChapterCRDT.ts` về chế độ:
- **Lưu trữ Cục bộ Bền vững**: Sử dụng `y-indexeddb` để lưu trữ tài liệu `Y.Doc` cục bộ, offline-first.
- **Cộng tác Bất đồng bộ**: Sử dụng đồng bộ hai chiều Google Drive (`googleDriveSyncService.ts`, `driveBundleSync.ts`, `driveGranularSync.ts`) qua OAuth 2.0 PKCE và Google Drive API.

### Rationale
- Phần lớn nhu cầu dịch tiểu thuyết là cá nhân dịch hoặc biên tập viên duyệt theo chương độc lập.
- Việc duy trì WebSocket relay và Redis chỉ để hỗ trợ live cursor/awareness tạo ra gánh nặng hạ tầng khổng lồ (phải cấu hình `ulimit -n 65535`, xử lý reconnection, race conditions trong RAM).
- Google Drive API cung cấp khả năng chia sẻ file theo folder dự án (`AI_Dich_Truyen_Data/`) với cơ chế giải quyết xung đột thông minh và miễn phí 100%.

### Alternatives Considered
- *WebRTC Peer-to-Peer*: Không cần server relay gói tin nhưng vẫn cần signaling server để thiết lập kết nối WebRTC ban đầu, độ ổn định kém qua các mạng NAT/firewall phức tạp.
- *BaaS (Supabase Realtime / Liveblocks / PartyKit)*: Phát sinh chi phí, phụ thuộc vào dịch vụ bên thứ ba và vi phạm tiêu chí tự chủ dữ liệu.

---

## 4. Đóng gói & Triển khai Static Hosting

### Decision
- Chuyển `vite.config.ts`: `outDir: 'dist'`.
- Lệnh build: `"build": "tsc && vite build"`.
- Cấu hình file tĩnh cho hosting:
  - `public/_headers`: Cấu hình CSP, HSTS, Permissions-Policy và COOP (`same-origin-allow-popups` hỗ trợ Google OAuth) cho Cloudflare Pages và Netlify.
  - `vercel.json`: Cấu hình SPA rewrites về `/index.html` và HTTP security headers cho Vercel.
  - `Dockerfile`: Multi-stage build với Nginx Alpine phục vụ thư mục `dist/`.

### Rationale
- Đảm bảo ứng dụng chạy được trên 100% các nền tảng static hosting hiện đại.
- Không cần cấu hình server-side rendering (SSR) hay tiến trình nền Node.js.
- Bảo mật CSP chặt chẽ đồng thời tương thích hoàn hảo với Google Identity Services (OAuth PKCE và Google Picker).

### Alternatives Considered
- *GitHub Pages thuần (không rewrites)*: Yêu cầu chuyển sang HashRouter (`/#/workspace`), làm xấu URL. Bằng cách hỗ trợ Cloudflare Pages / Vercel / Netlify với rewrite rules, ứng dụng giữ được HTML5 History API sạch sẽ.
