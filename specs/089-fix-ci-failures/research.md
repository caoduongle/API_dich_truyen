# Technical Research & Architectural Decisions: Sửa Lỗi CI/CD

**Feature**: `089-fix-ci-failures`  
**Date**: 2026-09-05  

---

## 1. Nghiên Cứu Lỗi 1: Xử Lý Đường Dẫn Đa Nền Tảng (Windows vs POSIX) trong `sanitizeFilename`

### Vấn Đề
- Hàm `sanitizeFilename(rawFilename: string)` trong `server/utils/fileValidation.ts` sử dụng `path.basename(rawFilename)`.
- Mô-đun `path` của Node.js phụ thuộc vào nền tảng:
  - Khi chạy trên Windows: `path` trỏ tới `path.win32`, nhận diện cả hai ký tự phân cách `/` và `\`.
  - Khi chạy trên Linux / GitHub Actions runner: `path` trỏ tới `path.posix`, chỉ nhận diện `/` là dấu phân cách thư mục, còn `\` được xem là một ký tự thông thường trong tên tệp.
- Do đó, khi tệp kiểm thử `server/utils/__tests__/fileValidation.test.ts` kiểm tra chuỗi `..\\..\\windows\\system32\\cmd.exe`, trên môi trường Linux hàm `path.basename` trả về nguyên xi chuỗi `..\\..\\windows\\system32\\cmd.exe`.
- Sau đó, biểu thức chính quy khử trùng ký tự đặc biệt biến toàn bộ dấu `\` thành `_`, dẫn đến kết quả trả về `.._.._windows_system32_cmd.exe` thay vì `cmd.exe`.

### Quyết Định Kiến Trúc
- **Giải Pháp Được Chọn**: Chuẩn hóa toàn bộ dấu gạch chéo ngược (`\`) thành gạch chéo xuôi (`/`) trước khi gọi `path.basename()`.
  ```typescript
  const normalizedPath = rawFilename.replace(/\\/g, "/");
  const baseName = path.basename(normalizedPath).trim();
  ```
- **Lý Do Lựa Chọn**:
  - Dấu gạch chéo xuôi `/` được cả POSIX và Windows API hỗ trợ làm ký tự phân cách đường dẫn chuẩn.
  - Phép thay thế `rawFilename.replace(/\\/g, "/")` có chi phí tính toán $O(n)$, an toàn tuyệt đối, không làm thay đổi ngữ nghĩa của các tên tệp hợp lệ và không yêu cầu import thêm bất kỳ thư viện bên thứ ba nào.
- **Các Phương Án Đã Xem Xét & Bác Bỏ**:
  - *Sử dụng `path.win32.basename()`*: Bác bỏ vì nếu input là đường dẫn Unix chứa `/` trên một số biến thể thì hàm của win32 có thể không xử lý tối ưu trên toàn bộ case, và việc chuẩn hóa dấu phân cách mang tính tổng quát hơn cho cả hai nền tảng.
  - *Viết parser tách chuỗi thủ công*: Bác bỏ vì phức tạp không cần thiết và tiềm ẩn rủi ro bỏ sót edge cases.

---

## 2. Nghiên Cứu Lỗi 2: Phụ Thuộc Tài Nguyên Tĩnh & Thứ Tự Thực Thi trong CI Workflow

### Vấn Đề
- Bộ kiểm thử `server/__tests__/quickstartVerification.test.ts` khởi tạo một ứng dụng Express phục vụ tài nguyên tĩnh trực tiếp từ thư mục `dist/client`:
  ```typescript
  const distClient = path.join(process.cwd(), "dist", "client");
  app.use(express.static(distClient));
  ```
  Các kịch bản kiểm thử (Scenarios 1-4) gửi HTTP request đến `/robots.txt`, `/sitemap.xml`, `/llms.txt`, và Scenario 5 quét đệ quy thư mục `dist/` để xác nhận không có tệp `.map` nào bị rò rỉ.
- Tuy nhiên, trong workflow `.github/workflows/ci.yml`, thứ tự ban đầu là:
  ```yaml
  - name: Run tests
    run: npm test
  - name: Build
    run: npm run build
  ```
- Khi chạy trên runner sạch của GitHub Actions, thư mục `dist/` chưa hề tồn tại tại thời điểm `npm test` kích hoạt, dẫn đến 4/5 scenario thất bại với mã lỗi HTTP 404 Not Found và `ENOENT: no such file or directory, scandir 'dist'`.

### Quyết Định Kiến Trúc
- **Giải Pháp Được Chọn**: Đảo ngược thứ tự thực thi trong `.github/workflows/ci.yml`, đưa bước `Build` lên trước bước `Run tests`.
  ```yaml
  - name: Build
    run: npm run build

  - name: Run tests
    run: npm test
  ```
- **Lý Do Lựa Chọn**:
  - `npm run build` thực hiện cả `vite build` (biên dịch frontend và sao chép toàn bộ static files từ `public/` sang `dist/client`) và `esbuild` (đóng gói backend sang `dist/server/server.cjs`).
  - Đảm bảo môi trường kiểm thử tương thích 100% với trạng thái runtime thực tế.
  - Không cần sửa đổi cấu hình build hay mã nguồn kiểm thử; sourcemap đã được tắt mặc định trong `vite.config.ts` nên kịch bản kiểm tra file `.map` vượt qua tự nhiên.
- **Các Phương Án Đã Xem Xét & Bác Bỏ**:
  - *Tạo thư mục `dist/client` giả lập hoặc mock trong test*: Bác bỏ vì vi phạm mục đích kiểm thử verification/integration thực tế của `quickstartVerification.test.ts`.
