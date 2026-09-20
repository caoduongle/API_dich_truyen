# Specifications Directory Index

Tài liệu hướng dẫn và chỉ mục phân loại các bản đặc tả tính năng (feature specifications) của dự án **Bản Thảo Chu Sa**.

---

## 1. Phân Loại Trạng Thái Đặc Tả

Để hỗ trợ lập trình viên và các tác tử AI (AI agents) nắm bắt chính xác kiến trúc hiện tại của dự án mà không bị nhầm lẫn với các mô hình lịch sử:

| Giai đoạn / Nhóm Spec | Trạng thái kiến trúc | Mô tả & Lưu ý cho AI Agent |
| :--- | :--- | :--- |
| **001 – 092** | **Superseded / Legacy Backend** | Giai đoạn thiết kế ban đầu sử dụng Express, Redis, WebSocket relay proxy. **Toàn bộ kiến trúc server/backend này đã bị bãi bỏ hoàn toàn** theo quyết định tại Spec 092 (`092-zero-backend-migration`). AI agents **tuyệt đối không** viện dẫn Redis, Express hay backend APIs khi đọc các tài liệu này. |
| **093 – 137** | **Implemented / Historical Client-Side** | Giai đoạn xây dựng Pure Client-Side SPA: chuyển dịch sang gọi Gemini AI trực tiếp từ trình duyệt (`@google/genai`), lưu trữ IndexedDB cục bộ, đồng bộ Google Drive v3 REST API qua OAuth PKCE, và tối ưu hóa bộ nhớ Hako. |
| **138 – 148** | **Active Hardening / Storage Integrity** | Giai đoạn gia cố bảo mật và toàn vẹn dữ liệu: loại bỏ race condition hồi sinh dự án, hợp nhất hàng đợi tuần tự hóa `projectWriteChains`, manifest xóa nguyên tử, CRDT state ownership và fail-closed semantics. |
| **149 trở đi** | **Current / Active** | Các đặc tả và kế hoạch thực hiện của phiên bản hiện hành. |

---

## 2. Quy Tắc Duy Trì & Tham Chiếu

1. **Bảo tồn lịch sử (Non-destructive)**: Tất cả các thư mục đặc tả lịch sử được giữ nguyên vị trí để không làm gãy các liên kết commit và Git history.
2. **Quy tắc đọc hiểu cho Agent**: Khi tra cứu kiến trúc cơ sở dữ liệu và lưu trữ, hãy luôn tham chiếu các bản đặc tả mới nhất (`141`, `147`, `148`, `149`) và file kiến trúc chuẩn [`docs/architecture.md`](../docs/architecture.md).
