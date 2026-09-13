# Interface & Interaction Contract: UnifiedAuditPanel Card UI (133-fix-audit-overflow)

## 1. Hợp Đồng Thành Phần (Component Interface Contract)

Thành phần `UnifiedAuditPanel` giữ nguyên các props hiện có để đảm bảo khả năng tương thích 100% với `BilingualEditor`:

```typescript
export interface UnifiedAuditPanelProps {
  hakoIssues: QualityIssue[];
  qaIssues: DirectQaCritiqueIssue[];
  isCheckingQa: boolean;
  onRunAiQaCritique: () => void;
  onIssueClick?: (issue: UnifiedAuditIssue) => void;
  isMismatch?: boolean;
  sourceParaCount?: number;
  translationParaCount?: number;
  qaError?: string | null;
  activeTextareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  onApplyFix?: (issue: UnifiedAuditIssue) => boolean | Promise<boolean>;
  apiKeys?: string[];
  selectedModel?: string;
  genre?: string;
  tone?: string;
  onRewriteSentence?: (params: DirectRewriteSentenceParams) => Promise<string>;
}
```

---

## 2. Hợp Đồng Tương Tác Người Dùng (User Interaction Contract)

### 2.1. Hành vi Cuộn và Chọn Chữ Trong Trích Đoạn

- **Sự kiện click vào vùng trích đoạn**:
  - `onClick={(e) => e.stopPropagation()}`
  - **Mục đích**: Người dùng nhấp chuột hoặc bôi đen văn bản để sao chép KHÔNG kích hoạt `handleIssueCardClick`, không gây nhảy con trỏ trong trình soạn thảo chính.
- **Sự kiện cuộn (Wheel / Touch drag)**:
  - Khi nội dung trích đoạn vượt quá chiều cao tối đa (`max-h-28`), con trỏ chuột bên trong khung cho phép cuộn độc lập mượt mà.
  - Thanh cuộn bên trong khung trích đoạn hiển thị rõ ràng, không làm biến dạng bố cục viền thẻ.

### 2.2. Nút Bấm "Xem thêm / Thu gọn"

- **Điều kiện hiển thị**:
  - `Boolean(issue.targetText && (issue.targetText.length > 120 || issue.targetText.includes('\n')))`
- **Hành vi nhấp chuột**:
  - `onClick={(e) => { e.stopPropagation(); toggleSnippetExpand(issue.id); }}`
  - Nhấp "Xem thêm" -> thêm `issue.id` vào `expandedSnippetIds` -> chiều cao chuyển thành `max-h-none` -> nhãn chuyển thành "Thu gọn".
  - Nhấp "Thu gọn" -> xóa `issue.id` khỏi `expandedSnippetIds` -> chiều cao trở về `max-h-28` -> nhãn chuyển thành "Xem thêm".

### 2.3. Tương Thích Với Bàn Phím (Keyboard Navigation)

- Phím tắt `Alt+J` và `Alt+K` vẫn di chuyển focus giữa các thẻ lỗi như thiết kế ban đầu.
- Khi một thẻ lỗi được focus bằng bàn phím hoặc nhấp chọn, phần tử thẻ vẫn được căn giữa tầm nhìn với `scrollIntoView({ block: 'nearest', behavior: 'smooth' })`.
