# Bản Thảo Chu Sa

**Ứng dụng dịch và biên tập truyện Trung - Việt bằng Gemini AI**

Bản Thảo Chu Sa là một **Single-Page Application (SPA) chạy phía trình duyệt** cho quy trình dịch và biên tập tiểu thuyết Trung - Việt. Quy trình chính gồm **dịch thô → chuốt văn → kiểm tra chất lượng**.

Dữ liệu dự án và chương được lưu cục bộ trong **IndexedDB**. Gemini được gọi trực tiếp từ trình duyệt bằng API key do người dùng cấu hình. Google Drive là tính năng tùy chọn cho sao lưu, khôi phục và đồng bộ.

## Tính năng chính

### Dịch AI 3 giai đoạn

- **Dịch thô:** dịch nguyên tác Trung - Việt và trích xuất thực thể/thuật ngữ cần theo dõi.
- **Chuốt văn:** biên tập bản dịch theo ngữ cảnh, thể loại, tone và glossary của dự án.
- **QA Critique:** đối chiếu nguyên tác và bản dịch để phát hiện lỗi sai nghĩa, bỏ sót, bất nhất và các vấn đề cần biên tập.

### Quản lý Gemini API key

Ứng dụng có `localQuotaTracker` để quản lý việc sử dụng nhiều API key phía client, gồm xoay vòng key, cooldown, circuit breaker và theo dõi request/token.

Khóa API được lưu tạm thời trong `sessionStorage` (phiên làm việc) và được đồng bộ vào `localStorage['app_ui_prefs'].savedKeys` khi người dùng bật tùy chọn "Ghi nhớ API key" để tránh phải nhập lại. Khi tắt tùy chọn này, khóa sẽ được xóa sạch khỏi `localStorage` và chỉ lưu trong phiên tab hiện tại. Ứng dụng không khuyến nghị bật ghi nhớ trên máy tính công cộng.

Đây là cơ chế quản lý phía ứng dụng, không thay thế quota do Google/Gemini áp dụng.


### Lưu trữ và đồng bộ

- **IndexedDB:** lưu dự án, chương và dữ liệu biên tập.
- **Yjs / y-indexeddb:** hỗ trợ dữ liệu CRDT và cộng tác.
- **Google Drive:** sao lưu, khôi phục và đồng bộ hai chiều.
- **localStorage / sessionStorage:** lưu một số thiết lập và trạng thái runtime phía client.

### Hako Quality Checker

Kết hợp kiểm tra rule-based và AI để phát hiện các vấn đề như sót Hán tự/raw, placeholder chưa xóa, đoạn lặp, bất nhất tên riêng/xưng hô, thuật ngữ và sai nghĩa/bỏ sót.

### Công cụ biên tập

- Glossary và quick term analysis
- Tìm và thay thế
- Highlight / jump-to-issue
- Viết lại câu/đoạn bằng AI
- Lịch sử chương
- Xuất TXT/EPUB
- 4 theme: Tối, Sáng, Sepia, Tùy chỉnh

## Kiến trúc

```text
Browser
│
├── React 19 + TypeScript + Tailwind CSS v4
├── UI / Presentation
├── Hooks / State orchestration
├── Services / Business logic
├── IndexedDB / localStorage / sessionStorage
├── Browser → Google Gemini API
└── Browser → Google Drive API (tùy chọn)
```

Chi tiết kiến trúc xem [`docs/architecture.md`](docs/architecture.md).

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

## Yêu cầu

- Node.js 24 LTS.
- npm
- Trình duyệt hiện đại hỗ trợ ES2022, IndexedDB và Web Crypto API.

Node.js chỉ cần cho development/build; production có thể chạy dưới dạng static site.

## Cài đặt

```bash
git clone https://github.com/caoduongle/API_dich_truyen.git
cd API_dich_truyen
npm install
```

Khi sử dụng Google Drive/Picker, tạo `.env` từ `.env.example`:

```bash
cp .env.example .env
```

### Biến môi trường

```env
VITE_PUBLIC_URL="https://api-dich-truyen.onrender.com"
VITE_BASE_URL="/"
VITE_GOOGLE_CLIENT_ID=""
VITE_GOOGLE_PICKER_API_KEY=""
VITE_GOOGLE_APP_ID=""
```

Gemini API key cho dịch thuật được cấu hình từ giao diện ứng dụng.

## Chạy local

### Development

```bash
npm run dev
```

Mặc định:

```text
http://localhost:5173
```

### Production build

```bash
npm run build
```

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

## Deployment

Repo có sẵn cấu hình cho một số hình thức static deployment:

### Render

Sử dụng `render.yaml`.

```text
Build command: npm run build
Publish directory: dist
```

### Cloudflare Pages / Netlify

Có `public/_headers` cho các nền tảng hỗ trợ `_headers`.

```text
Build command: npm run build
Publish directory: dist
```

### Vercel

Sử dụng `vercel.json`.

```text
Build command: npm run build
Output directory: dist
```

### Docker / Nginx

Repo có `Dockerfile` multi-stage để build static assets và phục vụ bằng Nginx. Có thể tùy chỉnh domain và subpath khi build qua `--build-arg`:

```bash
docker build \
  --build-arg VITE_PUBLIC_URL="https://example.com" \
  --build-arg VITE_BASE_URL="/" \
  -t ai-dich-truyen .
docker run --rm -p 80:80 ai-dich-truyen
```

Khi dùng Google OAuth/Picker, cần cấu hình authorized origins và các thiết lập tương ứng trên Google Cloud Console.

## Bảo mật và quyền riêng tư

- Gemini API được gọi trực tiếp từ trình duyệt.
- API key Gemini không đi qua backend của dự án.
- Dữ liệu dự án/chương được lưu cục bộ trong IndexedDB.
- Google Drive chỉ được sử dụng khi người dùng bật đồng bộ.
- Deployment configs có CSP và các HTTP security headers.
- Ứng dụng có các lớp xử lý input để giảm rủi ro prompt injection và dữ liệu điều khiển tàng hình.

API key chạy phía client **không được xem là tuyệt đối an toàn**. Credential vẫn nằm trong môi trường trình duyệt, vì vậy nên giới hạn quyền và hạn mức của key theo nhu cầu thực tế.

Xem [`SECURITY.md`](SECURITY.md) để biết thêm về bảo mật và báo cáo lỗ hổng.

## Cấu trúc thư mục

```text
.
├── src/
│   ├── components/              # UI
│   ├── hooks/                   # state orchestration
│   ├── context/                 # React contexts
│   ├── config/                  # constants / metadata
│   ├── i18n/                    # localization
│   ├── lib/                     # utilities / algorithms
│   ├── services/                # AI, DB, Drive, CRDT, translation
│   ├── utils/                   # application utilities
│   └── types/                   # domain types
├── public/                      # static assets / headers
├── docs/                        # technical documentation
├── specs/                       # feature specifications
├── .agents/                     # project agent rules
├── .specify/                    # Spec Kit data
├── .env.example
├── render.yaml
├── vercel.json
├── Dockerfile
├── vite.config.ts
└── package.json
```

## Tài liệu

- [Kiến trúc hệ thống](docs/architecture.md)
- [Quota, scheduling và key health](docs/quota-and-scheduling.md)
- [Security Policy](SECURITY.md)
- [LLM project context](public/llms.txt)

## Phát triển

Trước khi merge thay đổi, nên chạy:

```bash
npm run lint
npm test
npm run build
```

## License

MIT License. Xem [LICENSE](LICENSE).