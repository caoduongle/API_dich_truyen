# AI Dịch Truyện Trung-Việt — Phiên bản Hoàn Chỉnh

Phần mềm dịch truyện chữ Trung Quốc sang tiếng Việt sử dụng sức mạnh của **Google Gemini AI**. Đây là công cụ đắc lực hỗ trợ dịch thuật với chất lượng cao nhờ quy trình dịch 2 giai đoạn, kết hợp cùng hệ thống quản lý từ điển (Glossary) thông minh.

---

## 🌟 Tính năng nổi bật

### 🤖 Dịch AI 2 Giai Đoạn (Độc quyền)
- **Giai đoạn 1 (Dịch thô)**: Dịch sát nghĩa, bảo toàn cấu trúc câu, tự động phân tích và phát hiện thuật ngữ mới.
- **Giai đoạn 2 (Biên tập)**: Chuốt lại văn phong thuần Việt, mượt mà và linh hoạt điều chỉnh xưng hô theo từng thể loại truyện (Tiên Hiệp, Võ Hiệp, Ngôn Tình,...).

### ⚙️ Xoay vòng đa API Key (Multi-Key Management)
- Hỗ trợ nhập và sử dụng nhiều API keys Gemini cùng lúc.
- Hệ thống tự động chuyển đổi (fallback) sang key khác khi key hiện tại hết lượt (quota) hoặc gặp lỗi.
- Hỗ trợ dán (paste) hàng loạt keys từ clipboard vô cùng tiện lợi.

### 📚 Từ Điển Thông Minh (Glossary)
- Trích xuất và gợi ý thuật ngữ tự động từ văn bản gốc tiếng Trung.
- **Hàng Chờ Kiểm Duyệt (Pending Queue)**: Tự động gom các thuật ngữ mới, lọc trùng lặp để người dùng xem xét trước khi thêm vào từ điển chính.
- Hỗ trợ Import từ điển từ file Markdown (.md) thông qua phân tích AI.

### 📖 Quản Lý Dự Án Toàn Diện
- Hỗ trợ tạo và quản lý nhiều bộ truyện, nhiều chương khác nhau.
- Theo dõi tiến trình dịch trực quan (Chưa dịch / Đang dịch / Đã hoàn thành).
- Xuất bản dịch linh hoạt: Chỉ tiếng Việt hoặc song ngữ (Trung-Việt).
- Tính năng Export/Import dự án dạng file `.json` giúp dễ dàng sao lưu và chia sẻ.

### ⚡ Dịch Tự Động Hàng Loạt (Auto Translator)
- Dịch liên tiếp nhiều chương không cần thao tác thủ công.
- Tự động chia nhỏ (Divide & Conquer) để xử lý các văn bản có độ dài vượt quá giới hạn của AI.

### 🧠 Danh Sách Mô Hình AI Hỗ Trợ & Quản Lý Vòng Đời (Model Lifecycle)
- **Mô hình Khuyên dùng (Active)**:
  - `gemini-3.1-flash-lite`: Nhanh, chi phí tối ưu, độ trễ thấp (Mặc định).
  - `gemini-2.5-flash`: Độ ổn định cao, văn phong tốt, xử lý ngữ cảnh dài.
  - `gemini-2.5-pro`: Khả năng suy luận mạnh mẽ nhất, phục vụ các đoạn văn khó hoặc văn phong cổ trang phức tạp.
  - `gemma-4-31b-it`: Hỗ trợ mô hình mã nguồn mở cục bộ.
- **Tự động chuyển đổi mô hình hết hạn (Shutdown Migration)**:
  - Hệ thống tự động nhận diện các phiên bản cũ đã ngừng hoạt động (`gemini-2.0-flash`, `gemini-1.5-flash`,...) và chuyển đổi mượt mà sang mô hình kế thừa tương đương mà không làm gián đoạn hay crash ứng dụng.

---

## 🚀 Hướng dẫn Cài đặt

Dự án yêu cầu cài đặt sẵn [Node.js](https://nodejs.org/) (khuyến nghị bản LTS 18.x hoặc 20.x).

**Bước 1:** Clone hoặc tải mã nguồn dự án về máy tính của bạn (hoặc mở trực tiếp thư mục mã nguồn).
```bash
git clone <url-repo-của-bạn>
cd ai-dich-truyen-trung-viet-full
```

**Bước 2:** Cài đặt các thư viện, gói phụ thuộc (Dependencies).
```bash
npm install
```

---

## ⚙️ Cấu hình Hệ thống

Trước khi chạy, bạn cần thiết lập biến môi trường cho dự án.

**Bước 1:** Tạo file `.env` bằng cách copy từ file mẫu `.env.example`:
```bash
cp .env.example .env
```
*(Trên Windows, bạn có thể copy và đổi tên file thủ công từ trình duyệt file).*

**Bước 2:** Mở file `.env` và điền API Key mặc định của hệ thống (nếu có):
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
> **Lưu ý:** Bạn có thể tạo API Key miễn phí tại [Google AI Studio](https://aistudio.google.com/). Người dùng cuối cũng có thể tự nhập API key riêng của họ trực tiếp trên giao diện Web mà không cần sửa file `.env`.

---

## 💻 Cách sử dụng (Chạy ứng dụng)

**Khởi động môi trường phát triển (Development):**
```bash
npm run dev
```

Sau khi dòng chữ `Server fully started and listening on http://localhost:3000` xuất hiện, ứng dụng đã khởi động thành công.
👉 **Truy cập vào trình duyệt tại địa chỉ: http://localhost:3000**

### Hướng dẫn thao tác cơ bản trên Web:
1. **Thiết lập API Key**: Tại giao diện chính, bấm vào nút **"Cấu hình AI"** hoặc biểu tượng bánh răng ở góc trên để dán API Key cá nhân của bạn (có thể dán nhiều key một lúc).
2. **Tạo Dự án Mới**: Tạo một dự án truyện mới, điền tên truyện, chọn thể loại (việc chọn đúng thể loại rất quan trọng để AI định hướng văn phong và xưng hô).
3. **Thêm Chương**: Dán văn bản tiếng Trung cần dịch vào phần thêm chương.
4. **Dịch Thuật**: 
   - Nhấn **"Dịch & Phân tích" (Dịch thô)** để hệ thống tiến hành lấy bản thô và trích xuất danh sách thuật ngữ từ văn bản gốc.
   - Kiểm tra các thuật ngữ xuất hiện ở mục "Hàng chờ" bên cạnh. Duyệt và ấn Thêm (Add) nếu thuật ngữ đó đúng và bạn muốn nó áp dụng cho các lần dịch sau.
   - Sau khi có bản dịch thô và đã xử lý từ điển, nhấn **"Chuốt văn phong" (Biên tập)** để AI dựa vào đó viết lại một bản dịch hoàn chỉnh và mượt mà nhất.
5. **Xuất file**: Khi đã dịch xong một hoặc nhiều chương, bạn có thể bấm **Export Dự án** hoặc lưu các chương dưới dạng file `.txt`.

---

## 📦 Build cho Production (Triển khai)

Nếu bạn muốn build dự án để đưa lên server chạy thực tế (không phải môi trường dev):

**Bước 1:** Đóng gói (Build) dự án.
```bash
npm run build
```

**Bước 2:** Khởi chạy server production (sau khi đã build).
```bash
npm run start
```

---

## 📂 Cấu trúc Thư mục

```text
ai-dich-truyen-trung-viet-full/
├── src/
│   ├── types.ts                   # Định nghĩa kiểu dữ liệu (GlossaryItem, Chapter...)
│   ├── App.tsx                    # Component gốc, quản lý state toàn cục React
│   ├── components/                # Chứa các khối giao diện UI
│   │   ├── TranslatorWorkspace.tsx # Khu vực làm việc chính (Dịch thô + Biên tập)
│   │   ├── AutoTranslator.tsx      # Chức năng dịch tự động hàng loạt
│   │   ├── GlossaryManager.tsx     # Quản lý từ điển & hàng chờ kiểm duyệt
│   │   └── ProjectList.tsx         # Quản lý danh sách truyện và chương
│   └── hooks/                     # Custom hooks (useAIConfig,...)
├── server/
│   ├── routes/                    # Định tuyến API cho Backend (api.ts)
│   ├── controllers/               # Xử lý logic nghiệp vụ cho từng endpoint
│   ├── middleware/                # Rate limiter, kiểm soát lỗi
│   └── services/                  # Các hàm gọi giao tiếp trực tiếp với Gemini API
├── server.ts                      # Điểm khởi chạy của Backend (Express + Vite Middleware)
├── vite.config.ts                 # Cấu hình đóng gói giao diện của Vite
└── package.json                   # Quản lý các thư viện NPM và Scripts khởi chạy
```

## 🛠 Danh sách API Endpoints (Dành cho Backend)

| Endpoint | Method | Mô tả tính năng |
|---|---|---|
| `/api/health` | GET | Kiểm tra trạng thái hoạt động của máy chủ |
| `/api/analyze-glossary` | POST | Trích xuất các thuật ngữ/danh từ riêng từ đoạn văn bản Trung |
| `/api/translate-raw` | POST | Thực hiện quá trình dịch thô (Phase 1) |
| `/api/polish-translation` | POST | Thực hiện biên tập, chuốt lại văn phong (Phase 2) |
| `/api/extract-glossary` | POST | Trích xuất thuật ngữ đơn giản theo kiểu (Từ gốc -> Hán Việt) |
