# Data Model: Multi-tier Fallback & Split Retry Resilience for Flash-Lite

**Feature**: `124-harden-untranslated-split-retry`  
**Date**: 2026-09-12  
**Status**: Completed

## 1. Entities & Data Structures

Các cấu trúc dữ liệu phục vụ cơ chế cứu nguy phân cấp đa tầng (in-memory):

### 1.1. Mở rộng `SplitRetryEventInfo`

Cập nhật `SplitRetryEventInfo` để hỗ trợ phản ánh các tầng cứu nguy đa dạng:

```typescript
export interface SplitRetryEventInfo {
  stage: 'raw' | 'polish';
  depth: number;
  partsCount: number;
  reason: string;
  /** Tầng cứu nguy: 'split' (chia nhỏ), 'line-by-line' (dịch từng dòng), 'sino-fallback' (phiên âm dự phòng) */
  tier?: 'split' | 'line-by-line' | 'sino-fallback';
}
```

### 1.2. Mở rộng `DirectRawTranslationParams`

Bổ sung cờ đánh dấu lượt thử lại tăng cường:

```typescript
export interface DirectRawTranslationParams {
  text: string;
  genre: string;
  tone: string;
  glossary: GlossaryItem[];
  apiKeys: string[];
  model?: string;
  startKeyIndex?: number;
  description?: string;
  enableSegmentTranslation?: boolean;
  signal?: AbortSignal;
  onSplitRetry?: (info: SplitRetryEventInfo) => void;
  /** Đánh dấu cuộc gọi này là một lượt thử lại cứu nguy cần gia cố chỉ thị chống chữ Hán */
  isRetry?: boolean;
}
```

---

## 2. Multi-tier Lifecycle & State Machine

```
[Bắt đầu dịch thô toàn văn bản]
           │
           ▼
[Kiểm tra độ dài (> 2000 token)?]
           ├── CÓ: Chia 2 phần thích ứng, mỗi phần chạy với retryDepth = 0
           └── KHÔNG: Chạy trực tiếp callRawDirectCore
                     │
                     ▼
           [Kết quả kiểm định chất lượng]
           ├── Hợp lệ (<= 10% chữ Hán) ──► [Ghép nối & Hoàn thành GĐ1]
           │
           └── Lỗi UNTRANSLATED_CHINESE_LEFTOVER hoặc rỗng
                     │
                     ▼
           [Tầng 1: Thử lại chia nhỏ (retryDepth < 2)]
           ├── CÓ thể chia nhỏ:
           │    ├── Phát log: Cứu nguy cấp retryDepth + 1 (chia 2-3 phần)
           │    ├── Bổ sung chỉ thị chống chữ Hán (isRetry: true)
           │    └── Đệ quy thử lại từng phần với retryDepth + 1
           │
           └── KHÔNG thể chia nhỏ hoặc chạm trần (retryDepth >= 2):
                     │
                     ▼
           [Tầng 2: Cứu nguy dịch từng dòng (Line-by-Line Fallback)]
           ├── Gọi callRawDirectCore với enableSegmentTranslation: true
           ├── Phát log: Kích hoạt dịch phân rã từng dòng để cô lập đoạn lỗi
           │
           └── Nếu một dòng đơn lẻ vẫn còn chữ Hán sau dịch dòng:
                     │
                     ▼
           [Tầng 3: Cứu nguy phiên âm Hán-Việt & Từ điển]
           ├── Chuyển đổi các chữ Hán còn sót sang phiên âm Hán-Việt
           ├── Phát log cảnh báo chẩn đoán
           └── Bảo toàn toàn bộ chương, không bao giờ đánh sập cả chương!
```

---

## 3. Invariants & Business Rules

1. **Bảo tồn lượt thử lại**: Việc chia nhỏ văn bản dài ban đầu không làm tiêu hao ngân sách thử lại của các phân đoạn con.
2. **Không bỏ rơi phân đoạn hợp lệ**: Khi 1 trong số $N$ phân đoạn gặp sự cố, các phân đoạn khác đã hoàn thành phải được giữ nguyên vẹn trong bộ nhớ đệm và kết hợp vào bản dịch cuối cùng.
3. **Chống lặp ngữ cảnh**: Khi văn bản đầu vào đã được gắn nhãn từ điển, prompt loại bỏ phần lặp văn bản nguồn thô để giảm tải cho mô hình.
