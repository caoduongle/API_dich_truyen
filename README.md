# Bản Thảo Chu Sa

**Ứng dụng dịch và biên tập truyện Trung - Việt bằng Gemini AI**

Bản Thảo Chu Sa là một **Single-Page Application (SPA) chạy phía trình duyệt** dành cho quy trình dịch và biên tập tiểu thuyết Trung - Việt. Ứng dụng tập trung vào ba bước chính: **dịch thô → chuốt văn → kiểm tra chất lượng**.

Dữ liệu dự án và chương được lưu cục bộ trong **IndexedDB**. Gemini được gọi trực tiếp từ trình duyệt bằng API key do người dùng cấu hình. Google Drive là lớp tùy chọn cho sao lưu, khôi phục và cộng tác.

> **Kiến trúc runtime:** Pure Client-Side SPA / Zero Backend Runtime. Node.js chỉ cần cho development và build.

---

## Tính năng chính

### Dịch AI 3 giai đoạn

- **Dịch thô:** dịch nguyên tác Trung - Việt và trích xuất thực thể/thuật ngữ cần theo dõi.
- **Chuốt văn:** biên tập bản dịch theo ngữ cảnh, thể loại, tone và glossary của dự án.
- **QA Critique:** đối chiếu nguyên tác và bản dịch để tìm lỗi sai nghĩa, bỏ sót, bất nhất và các vấn đề cần biên tập.

Pipeline được triển khai ở phía client trong `src/services/directTranslationEngine.ts` và `src/services/directGeminiClient.ts`.

### Quản lý nhiều Gemini API key

Ứng dụng có `localQuotaTracker` để quản lý sử dụng API key phía client, bao gồm:

- chọn key khả dụng;
- theo dõi trạng thái key;
- xoay vòng khi gặp lỗi tạm thời hoặc rate limit;
- cooldown và circuit breaker;
- thống kê request/token;
- giới hạn sử dụng tùy chỉnh.

Đây là **client-side quota management**, không phải hệ thống quota chính thức của Google. Hạn mức thực tế vẫn do Gemini/Google áp dụng.

### Lưu trữ cục bộ

- **IndexedDB:** dự án, chương và dữ liệu biên tập.
- **localStorage:** tùy chọn giao diện và một số cache phía client.
- **sessionStorage:** thông tin runtime liên quan đến API key và quota state.
- Schema IndexedDB có migration/versioning.
- Các thao tác ghi có retry và safeguard để giảm nguy cơ snapshot rỗng ghi đè dữ liệu chương đã có.

### CRDT / cộng tác

Ứng dụng sử dụng **Yjs** và `y-indexeddb` cho dữ liệu cộng tác của chương.

Mỗi chương có thể được quản lý bằng một `Y.Doc`; nội dung dịch sử dụng `Y.Text` và metadata sử dụng `Y.Map`. CRDT được kết hợp với lớp IndexedDB/Google Drive để hỗ trợ persistence, đồng bộ và xử lý xung đột.

### Google Drive Sync & Collaboration

Google Drive là tính năng tùy chọn, hỗ trợ:

- Google OAuth và PKCE phía client;
- sao lưu và khôi phục dự án;
- đồng bộ hai chiều;
- lưu dữ liệu theo project/chapter;
- Google Picker cho luồng chia sẻ;
- manifest và reconciliation;
- dữ liệu CRDT cho các luồng cộng tác.

Các module chính nằm trong `src/services/google-drive/` và `src/services/googleDriveSyncService.ts`.

### Hako Quality Checker

Hako Quality Checker kết hợp kiểm tra rule-based và AI để phát hiện các vấn đề như:

- sót Hán tự/raw;
- placeholder hoặc ghi chú dịch giả chưa xóa;
- đoạn lặp;
- bất nhất tên riêng/xưng hô;
- thuật ngữ lệch chuẩn;
- sai nghĩa hoặc bỏ sót.

Kết quả có thể được xem lại, ghi nhận quyết định và liên kết ngược về chương cần sửa.

### Công cụ biên tập

- Glossary và quick term analysis
- Tìm và thay thế
- Highlight / jump-to-issue
- Viết lại câu/đoạn mục tiêu bằng AI
- Lịch sử chương
- Xuất TXT/EPUB
- Theme đọc và biên tập

### Theme system

Ứng dụng có 4 chế độ giao diện:

- Tối
- Sáng
- Sepia
- Tùy chỉnh

Theme sử dụng CSS custom properties tập trung để các component dùng chung design tokens.

---

## Kiến trúc

```text
Browser
│
├── React 19 + TypeScript + Tailwind CSS v4
│
├── Presentation
│   └── src/components/
│
├── Controller / State orchestration
│   └── src/hooks/
│
├── Domain / Services
│   ├── src/services/
│   ├── src/lib/
│   └── src/config/
│
├── Local persistence
│   ├── IndexedDB
│   ├── localStorage
│   └── sessionStorage
│
├── AI
│   └── Browser → Google Gemini API
│
└── Optional cloud sync
    └── Browser → Google Drive API
```

Ranh giới chính của codebase:

```text
components → UI / presentation
hooks      → state orchestration
services   → business logic, persistence, external APIs
lib        → pure utilities / algorithms
config     → constants and registries
types      → domain types
```

Service không phụ thuộc component/hook; hook không phụ thuộc component. Chi tiết kiến trúc xem [`docs/architecture.md`](docs/architecture.md).

---

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| UI | React 19 |
| Ngôn ngữ | TypeScript 5.8 |
| Build | Vite |
| CSS | Tailwind CSS v4 |
| AI | Google Gemini API / `@google/genai` |
| Local database | IndexedDB |
| Collaboration | Yjs / `y-indexeddb` |
| Google sync | Google Drive API |
| Icons | Lucide React |
| Animation | Motion |
| Chinese normalization | OpenCC |
| Archive/export | JSZip |
| Test | Vitest |

---

## Yêu cầu

- Node.js 18+; nên dùng bản LTS.
- npm
- Trình duyệt hiện đại có ES2022, IndexedDB và Web Crypto API.

Node.js chỉ cần cho development/build; production có thể chạy dưới dạng static site.

---

## Cài đặt

```bash
git clone https://github.com/caoduongle/API_dich_truyen.git
cd API_dich_truyen
npm install
```

Tạo `.env` từ `.env.example` khi dùng Google Drive/Picker:

```bash
cp .env.example .env
```

### Biến môi trường

```env
# Base path khi deploy vào subdirectory
VITE_BASE_URL="/"

# Google OAuth Web Client ID
VITE_GOOGLE_CLIENT_ID=""

# Google Picker API key
VITE_GOOGLE_PICKER_API_KEY=""

# Google Cloud Project Number cho Google Picker
VITE_GOOGLE_APP_ID=""
```

Gemini API key cho dịch thuật được cấu hình từ giao diện ứng dụng; không bắt buộc đặt trong `.env`.

---

## Chạy local

### Development

```bash
npm run dev
```

Mặc định Vite sử dụng:

```text
http://localhost:5173
```

### Production build

```bash
npm run build
```

Script build hiện chạy `tsc && vite build` và tạo thư mục `dist/`.

### Preview

```bash
npm run preview
```

### Type check

```bash
npm run lint
```

### Test

```bash
npm test
```

### Quality gate

```bash
npm run lint && npm test && npm run build
```

---

## Deployment

Repo hiện có cấu hình cho các hình thức static deployment sau.

### Render

Có `render.yaml` ở root cho Static Site, gồm SPA rewrite và security headers.

```text
Build command: npm run build
Publish directory: dist
```

### Cloudflare Pages / Netlify

`public/_headers` chứa cấu hình header dùng cho các nền tảng hỗ trợ `_headers`.

```text
Build command: npm run build
Output / Publish directory: dist
```

### Vercel

`vercel.json` cấu hình SPA rewrite và security headers.

```text
Build command: npm run build
Output directory: dist
```

### Docker / Nginx

Repo có `Dockerfile` multi-stage để build static assets và phục vụ bằng Nginx.

```bash
docker build -t ai-dich-truyen .
docker run --rm -p 80:80 ai-dich-truyen
```

Khi bật Google OAuth/Picker, cần cấu hình đúng authorized origins, redirect settings và các thiết lập tương ứng trên Google Cloud Console.

---

## Bảo mật và quyền riêng tư

Kiến trúc hiện tại giảm tối đa dữ liệu phải đi qua server ứng dụng:

- Gemini API được gọi trực tiếp từ trình duyệt.
- API key Gemini không được gửi tới backend của dự án.
- Dữ liệu dự án/chương được lưu cục bộ trong IndexedDB.
- Google Drive chỉ được sử dụng khi người dùng bật tính năng đồng bộ.
- Deployment configs có CSP và các HTTP security headers.
- Prompt input có các lớp xử lý/sanitization để giảm rủi ro prompt injection và dữ liệu điều khiển tàng hình.

### Giới hạn bảo mật của kiến trúc client-side

Client-side **không có nghĩa API key tuyệt đối an toàn**. Credential vẫn tồn tại trong môi trường trình duyệt và phải được bảo vệ cùng với thiết bị/origin chạy ứng dụng. Không nên sử dụng key có quyền hoặc hạn mức cao hơn nhu cầu thực tế.

Xem [`SECURITY.md`](SECURITY.md) để biết chính sách báo cáo lỗ hổng và các nguyên tắc bảo mật của dự án.

---

## Cấu trúc thư mục

```text
.
├── src/
│   ├── components/              # UI / presentation
│   ├── hooks/                   # state orchestration
│   ├── context/                 # React contexts
│   ├── config/                  # constants, models, metadata
│   ├── i18n/                    # localization
│   ├── lib/                     # pure utilities / algorithms
│   ├── services/                # AI, DB, Drive, CRDT, translation
│   │   └── google-drive/        # Drive REST and sync modules
│   ├── utils/                   # application utilities
│   └── types/                   # domain-specific types
├── public/                      # static assets / hosting headers
├── docs/                        # technical documentation
├── specs/                       # feature specs and implementation records
├── .agents/                     # project agent skills/rules
├── .specify/                    # project constitution / Spec Kit data
├── .env.example                 # environment template
├── render.yaml                  # Render Static Site config
├── vercel.json                  # Vercel rewrite / security headers
├── Dockerfile                   # Nginx static image
├── vite.config.ts               # Vite build config
└── package.json
```

---

## Tài liệu

- [Kiến trúc hệ thống](docs/architecture.md)
- [Quota, scheduling và key health](docs/quota-and-scheduling.md)
- [Security Policy](SECURITY.md)
- [LLM project context](public/llms.txt)

> `docs/model-system.md` hiện chứa một số mô tả lịch sử về kiến trúc model cũ. Không dùng tài liệu này làm nguồn duy nhất để xác định kiến trúc runtime hiện tại; hãy ưu tiên source code và `docs/architecture.md`.

---

## Phát triển và đóng góp

Khi thay đổi code, giữ đúng boundary giữa UI, state orchestration và business logic. Với thay đổi ảnh hưởng đến dữ liệu, đồng bộ hoặc AI pipeline, cần kiểm tra cả các test liên quan và regression của IndexedDB/CRDT/Google Drive.

Trước khi merge:

```bash
npm run lint
npm test
npm run build
```

---

## License

Hiện repository chưa có file `LICENSE` ở root. Hãy bổ sung giấy phép rõ ràng trước khi phân phối project như một package mã nguồn mở.