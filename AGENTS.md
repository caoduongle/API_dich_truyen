# AGENTS.md

## Dự án
Công cụ dịch tiểu thuyết Trung → Việt bằng AI (Gemini). Frontend: React 19 + Vite +
TypeScript + Tailwind v4. Backend: Express + ioredis, chạy trong cùng repo (`server/`).
Dữ liệu chương/dự án lưu ở IndexedDB phía client (`src/services/db.ts`).

## Lệnh bắt buộc chạy trước khi báo cáo "xong việc"
```
npm run lint    # tsc --noEmit — PHẢI sạch, không có lỗi type
npm test        # vitest run  — PHẢI pass toàn bộ, không được xóa/skip test để né lỗi
npm run build   # vite build + esbuild server — PHẢI build thành công
```
Nếu đang sửa UI và có khả năng dùng trình duyệt (browser agent/Chrome tool): chạy
`npm run dev`, mở app, **chụp ảnh màn hình trước và sau** mỗi màn hình được sửa. Đừng
báo cáo "đã cải thiện UI" nếu chưa thực sự nhìn thấy nó chạy.

## Quy tắc thiết kế UI/UX
Đọc `.agents/rules/design-system.md` **trước khi** viết hoặc sửa bất kỳ component nào.
File đó định nghĩa bảng màu, font, mô-típ nhận diện (con dấu triện), thang z-index,
và danh sách "cấm kỵ" để tránh giao diện kiểu "AI slop" chung chung.

## Không được tự ý làm (deny-list)
- Không sửa logic dịch/gọi API Gemini trong `server/` hoặc `src/services/` khi nhiệm vụ
  là UI — nếu cần đổi, dừng lại và hỏi trước.
- Không đổi schema IndexedDB (`src/services/db.ts`) hoặc cấu trúc `types.ts` khi chỉ
  làm UI.
- Không đổi nội dung tiếng Việt hiển thị cho người dùng (nhãn, thông báo) trừ khi
  đó chính là yêu cầu.
- Không thêm dependency mới nếu có thể làm bằng những gì đã cài (xem
  `.agents/rules/design-system.md` để biết những gì đã có: `motion`, `clsx`,
  `tailwind-merge`, `lucide-react`).
- Không gộp nhiều màn hình không liên quan vào một diff khổng lồ — mỗi lần chỉ sửa
  1-2 màn hình/module, để Implementation Plan còn review được.
- **Gặp lỗi "Failed to resolve import 'X' ... Does the file exist?"**: đây là thiếu
  package trong `node_modules`, KHÔNG phải file sai. Fix đúng là `npm install X`,
  KHÔNG phải xóa import/viết lại code để né dùng package đó — việc này đã xảy ra
  thật với `clsx`/`tailwind-merge` trong `src/lib/cn.ts` (bị viết lại thành nối
  chuỗi thủ công để né lỗi thay vì cài package), làm mất khả năng merge className
  an toàn mà toàn bộ `src/components/ui/` phụ thuộc vào. Nếu thấy `cn.ts` không
  import `clsx`/`tailwind-merge` nữa, đó là dấu hiệu bị revert — khôi phục lại.

## Cấu trúc primitives đã có (đừng tạo trùng)
`src/lib/cn.ts`, `src/components/ui/{Button,Badge,Seal,GenreMark,EmptyState,Kbd}.tsx`.
Xem chi tiết cách dùng trong `.agents/rules/design-system.md`.
