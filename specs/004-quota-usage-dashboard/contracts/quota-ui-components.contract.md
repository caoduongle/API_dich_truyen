# Contract: Quota UI Components & Design System Specs

**Status**: Approved | **Date**: 2026-08-19

## 1. `QuotaPanel.tsx` Props & Contract

```typescript
export interface QuotaPanelProps {
  apiKeys: string[];
  selectedModel: string;
}
```

### Yêu cầu Giao diện & Hành vi:
- **Tải dữ liệu tự động**: Khi tab "Quota & Hạn mức" được kích hoạt, tự động gọi `fetchQuotaStatus()` để lấy snapshot mới nhất.
- **Nút Làm mới**: Có nút làm mới (Refresh) kèm hiệu ứng loading xoay tròn nhẹ (`lucide-react` `RotateCw`).
- **Thẻ Thống kê Khóa**:
  - Tiêu đề: Khóa #X kèm `maskedKey` (font `font-mono`).
  - Huy hiệu Trạng thái:
    - `Hoạt động` (Active - `tone="polish"` hoặc `tone="neutral"`).
    - `Ngắt mạch Cooldown` (Warning/Danger - kèm đồng hồ đếm ngược `mm:ss` tự giảm theo từng giây).
  - Chỉ số: `RPM` (phút này), `RPD` (hôm nay theo giờ PST), `Tổng request`, `Lỗi`.
  - Thanh tiến độ (% so với giới hạn người dùng tự đặt):
    - Dưới 70%: tone trung tính / xanh nhẹ.
    - 70% - 90%: tone warning / amber.
    - Trên 90%: tone polish / chu sa.
- **Mở rộng xem chi tiết theo Model**: Click để xem bảng phân tích số lượng request từng model (`gemini-2.5-flash`, `gemini-2.5-pro`, v.v.).
- **Nút "Kiểm tra Model"**: Gọi `fetchModelsForKey(index)` và hiển thị modal hoặc danh sách các model khả dụng được upstream xác nhận.
- **Tuân thủ Design System**:
  - Không hardcode màu lạ. Dùng `bg-ink`, `bg-parchment`, `bg-parchment-2`, `text-text-main`, `text-text-muted`, `text-polish`.
  - Bo góc `rounded-[2px]` cho input/badge, `rounded-md` cho card.

---

## 2. `ApiSettings.tsx` Tab Switcher Contract

```typescript
type SettingsTab = 'config' | 'quota';
```

- Header hiển thị tab switcher dạng 2 nút liền kề:
  - Tab 1: `Cấu hình AI` (Form hiện tại: Chọn model, chất lượng dịch, danh sách input keys).
  - Tab 2: `Quota & Hạn mức` (Hiển thị component `QuotaPanel`).
- Chuyển đổi tab tức thì, không làm mất state các khóa đang nhập ở tab 1.
