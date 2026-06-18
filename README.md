# AI Dịch Truyện Trung-Việt — Phiên bản Hoàn Chỉnh

Phần mềm dịch truyện chữ Trung Quốc sang tiếng Việt sử dụng Google Gemini AI. Đây là bản hợp nhất đầy đủ tính năng từ hai nguồn gốc.

---

## Tính năng chính

### 🤖 Dịch AI 2 Giai Đoạn
- **Dịch thô (Phase 1)**: Dịch sát nghĩa, bảo toàn cấu trúc, tự động phát hiện thuật ngữ mới
- **Biên tập (Phase 2)**: Chuốt văn phong thuần Việt, linh hoạt xưng hô theo thể loại

### ⚙️ Xoay vòng đa API Key
- Hỗ trợ nhiều API keys Gemini hoạt động song song
- Tự động fallback khi một key hết quota hoặc bị lỗi
- Nhập sỉ keys từ clipboard

### 📚 Từ Điển Thông Minh (Glossary)
- Nhập từ điển thủ công hoặc trích xuất tự động từ văn bản Trung
- Import từ file hướng dẫn Markdown (.md) với phân tích AI
- **Hàng Chờ Kiểm Duyệt (Pending Queue)**: Tự động phát hiện và giữ lại các thuật ngữ trùng lặp để user xem xét trước khi thêm
- Tìm kiếm vị trí xuất hiện thuật ngữ trong các chương đã dịch

### 📖 Quản Lý Dự Án
- Nhiều bộ truyện, nhiều chương
- Thể loại & tông giọng (Tiên Hiệp, Võ Hiệp, Ngôn Tình, Đô Thị, Huyền Huyễn...)
- Theo dõi tiến trình dịch (not_started / in_progress / completed)
- Xuất bản dịch: chỉ tiếng Việt hoặc song ngữ Trung-Việt (.txt)
- Sao lưu / khôi phục dự án (.json)

### ⚡ Dịch Tự Động Toàn Bộ (Auto Translator)
- Dịch nhiều chương liên tiếp không cần can thiệp thủ công
- Cơ chế chia nhỏ Divide & Conquer cho văn bản dài
- Tự động trích xuất thuật ngữ mới, lọc trùng lặp đưa vào hàng chờ
- Export JSONL để fine-tune model riêng

### 📊 Gióng Hàng & Fine-Tuning
- Gióng hàng câu Trung-Việt theo từng đoạn
- Export JSONL chuẩn cho fine-tuning model dịch cá nhân

---

## Cài đặt

```bash
npm install
```

## Cấu hình

Tạo file `.env` dựa trên `.env.example`:
```
GEMINI_API_KEY=your_key_here
```

## Chạy

```bash
npm run dev
```

Mở trình duyệt tại `http://localhost:3000`

---

## Cấu trúc

```
src/
├── types.ts                   # Định nghĩa types (GlossaryItem, PendingGlossaryItem, Chapter, StoryProject...)
├── App.tsx                    # Root app, quản lý state toàn cục + pendingGlossary handlers
├── components/
│   ├── TranslatorWorkspace.tsx # Mặt trận dịch thuật (dịch thô + biên tập)
│   ├── AutoTranslator.tsx      # Dịch tự động toàn bộ + deduplication queue
│   ├── GlossaryManager.tsx     # Từ điển + hàng chờ kiểm duyệt trùng lặp
│   └── ProjectList.tsx         # Quản lý dự án + export + progress bar
└── data/
    └── examples.ts             # Dữ liệu ví dụ mẫu
server.ts                       # Express server + Gemini API endpoints
```

---

## API Endpoints (server.ts)

| Endpoint | Method | Mô tả |
|---|---|---|
| `/api/health` | GET | Kiểm tra server |
| `/api/analyze-glossary` | POST | Trích xuất thuật ngữ từ văn bản Trung |
| `/api/analyze-guidelines` | POST | Phân tích file hướng dẫn Markdown |
| `/api/translate-raw` | POST | Dịch thô giai đoạn 1 |
| `/api/polish-translation` | POST | Biên tập chuốt văn phong giai đoạn 2 |
| `/api/align-chapter` | POST | Gióng hàng Trung-Việt (export JSONL) |
| `/api/extract-glossary` | POST | Trích xuất thuật ngữ (format đơn giản) |
