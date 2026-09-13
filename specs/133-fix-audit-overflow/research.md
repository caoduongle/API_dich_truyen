# Phase 0 Research: Khắc Phục Lỗi Bị Che Chữ & Cho Phép Cuộn Xem Đầy Đủ Thẻ Lỗi Thẩm Định Chất Lượng (133-fix-audit-overflow)

## Vấn Đề Kỹ Thuật Cần Giải Quyết

Người dùng phản ánh: *"phần thẩm định chất lượng ở tab dịch thuật gặp lỗi bị che chữ; ví dụ khi tìm thấy lỗi mà lỗi quá dài thì chữ bị che mất; không kéo lên được"*.

### 1. Nguyên Nhân Gốc Rễ (Root Cause Analysis)

Qua rà soát mã nguồn tại [`src/components/translator-workspace/UnifiedAuditPanel.tsx`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/components/translator-workspace/UnifiedAuditPanel.tsx):
- **Dòng 660**:
  ```tsx
  {issue.targetText && (
    <div className="bg-ink/80 border border-parchment-2 rounded-[2px] px-2 py-1 text-[11px] font-mono text-text-muted line-clamp-2">
      <span className="text-text-muted/60 mr-1 select-none">Trích đoạn:</span>
      <span className="text-text-main">{issue.targetText}</span>
    </div>
  )}
  ```
- **Cơ chế CSS của `line-clamp-2`**:
  Tailwind `line-clamp-2` thiết lập:
  ```css
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  ```
  Khi thuộc tính `overflow: hidden` được áp dụng, trình duyệt cố định chiều cao ở mức tối đa 2 dòng văn bản và cắt toàn bộ các dòng phía sau kèm dấu `...`. Chuột, con lăn hoặc thao tác kéo cuộn của người dùng hoàn toàn bị vô hiệu hóa ("không kéo lên được").
- **Vấn đề phụ trợ**:
  1. Danh sách các thẻ lỗi (`div` bao ngoài ở dòng 601) có giới hạn cố định `max-h-80` (320px / 20rem). Khi nhiều lỗi xuất hiện hoặc các lỗi dài, không gian hiển thị bị co cụm quá mức.
  2. Đoạn văn bản giải thích lỗi (`issue.message`) và khung xem trước viết lại câu (`pendingPreviews[issue.id]`) chưa có quy tắc ngắt từ triệt để (`break-words whitespace-pre-wrap`) và vùng cuộn tối đa khi AI trả về đoạn văn bản dài.
  3. Sự kiện click trên thẻ lỗi: Thẻ lỗi có `onClick={() => handleIssueCardClick(issue, index)}`. Khi người dùng muốn bôi đen văn bản trong trích đoạn để sao chép hoặc cuộn đọc, sự kiện click có thể nổi bọt (bubble) kích hoạt hành vi chọn vị trí trong trình soạn thảo.

---

## Các Phương Án Kỹ Thuật (Evaluation & Decisions)

### Quyết định 1: Cơ chế hiển thị và cuộn cho trích đoạn văn bản (`targetText`)

| Tiêu chí | Phương án A: Chỉ bỏ `line-clamp-2` cho hiển thị 100% | Phương án B: Giữ cắt dòng và chỉ thêm tooltip | Phương án C: Kết hợp cuộn độc lập (`overflow-y-auto`) & nút Xem thêm / Thu gọn (Được chọn) |
|---|---|---|---|
| **Khả năng kéo cuộn** | Kém (thẻ phình to làm đẩy danh sách) | Không (tooltip khó bôi đen copy) | **Xuất sắc** (cho phép kéo cuộn trực tiếp hoặc mở rộng) |
| **Xử lý đoạn văn dài (>500 ký tự)** | Làm biến dạng chiều cao thẻ lỗi | Tooltip bị tràn màn hình | **Kiểm soát chiều cao gọn gàng**, đọc mượt mà |
| **Trải nghiệm người dùng (UX)** | Dễ rối mắt khi có nhiều lỗi dài | Khó tương tác | **Trực quan, chuẩn thiết kế hiện đại** |

- **Quyết định**: Áp dụng **Phương án C**.
  - Mặc định, khung trích đoạn được áp dụng: `max-h-28 overflow-y-auto break-words whitespace-pre-wrap select-text` kèm thanh cuộn tinh gọn (subtle scrollbar).
  - Đối với các trích đoạn dài (>120 ký tự hoặc chứa ký tự ngắt dòng `\n`), cung cấp nút chuyển đổi nhỏ gọn `"Xem thêm"` / `"Thu gọn"` (`cursor-pointer`).
  - Khi ở trạng thái mở rộng ("Xem thêm"), chiều cao tối đa được nâng lên (`max-h-80` hoặc `max-h-none`) để hiển thị toàn vẹn toàn bộ đoạn văn.
  - Văn bản có class `select-text cursor-text` để người dùng dễ dàng bôi đen chọn từ.

### Quyết định 2: Chống xung đột sự kiện click thẻ (Event Propagation Guard)

- **Vấn đề**: Người dùng nhấp chuột hoặc bôi đen văn bản trong trích đoạn để đọc/sao chép không nên làm kích hoạt hành vi nhấp toàn thẻ (`handleIssueCardClick`), tránh gây nhảy con trỏ chuột trong ô soạn thảo (`activeTextareaRef`) ngoài ý muốn.
- **Quyết định**:
  - Gắn `onClick={(e) => e.stopPropagation()}` trên container trích đoạn văn bản và trên nút "Xem thêm / Thu gọn".
  - Cho phép người dùng nhấp chọn hoặc kéo chuột chọn chữ thoải mái bên trong trích đoạn mà không ảnh hưởng tới trạng thái chọn thẻ tổng thể.

### Quyết định 3: Tối ưu hiển thị tin nhắn lỗi và khung xem trước gợi ý AI

- **Đoạn giải thích lỗi (`issue.message`)**:
  - Bổ sung `break-words whitespace-pre-wrap leading-relaxed` để bảo đảm các chuỗi ký tự dài (như tên riêng tiếng Trung hoặc URL) không bị tràn ngang mép thẻ.
- **Khung xem trước viết lại từ AI (`pendingPreviews[issue.id]`)**:
  - Thêm `max-h-36 overflow-y-auto break-words whitespace-pre-wrap select-text` để nếu AI viết lại một đoạn văn dài nhiều câu, người dùng vẫn cuộn xem đầy đủ toàn văn trước khi nhấn "Áp dụng".

### Quyết định 4: Tối ưu khung danh sách thẻ lỗi (`Issue List Container`)

- **Vấn đề**: `max-h-80` (320px) quá thấp khi hiển thị thẻ lỗi dài.
- **Quyết định**: Nâng chiều cao tối đa lên `max-h-[28rem]` (448px) trên màn hình trung bình và lớn, kết hợp thanh cuộn mượt mà có đệm lề phải (`pr-1.5`) để thanh cuộn không đè lên viền thẻ lỗi.

---

## Đánh Giá Tuân Thủ Hiến Pháp (Constitution Gates)

- **Principle I: Strict Quality Gates**: Tất cả bài kiểm thử hiện có (`UnifiedAuditPanel.test.tsx`) phải tiếp tục pass 100%. Bổ sung bài kiểm thử mới cho hành vi cuộn, mở rộng và ngắt dòng.
- **Principle II: Dependency Minimization**: Sử dụng 100% Tailwind CSS v4, Lucide icons (`ChevronDown`, `ChevronUp`) đã có sẵn trong dự án. Không cài thêm bất kỳ package nào.
- **Principle III: MVC Separation**: Chỉ chỉnh sửa presentation layer trong `src/components/translator-workspace/UnifiedAuditPanel.tsx`. Không động chạm tới `src/services/` hay logic xử lý AI.
- **Principle IV: Immutable Core Schemas**: Không thay đổi interface `UnifiedAuditIssue` hay schema cơ sở dữ liệu.
