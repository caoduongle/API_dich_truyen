# Implementation Plan: Mở Rộng Độ Sâu Đệ Quy Lên 4 Cấp, Phân Đôi Nhị Phân & Cô Lập Nhánh Lỗi (132-binary-split-max-depth-4)

**Branch**: `132-binary-split-max-depth-4` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/132-binary-split-max-depth-4/spec.md`

---

## Summary

Nâng cấp cơ chế phân đoạn thích ứng đệ quy (Divide & Conquer) trong [`directTranslationEngine.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/services/directTranslationEngine.ts):
1. Mở rộng trần độ sâu đệ quy tối đa từ 2 lên **4 cấp** (`retryDepth` từ 0 đến 3, chạm trần khi `>= 4`).
2. Chuẩn hóa quy luật chia đoạn thành **chia đôi nhị phân thuần túy (`partsCount = 2`)** tại mọi cấp độ sâu, loại bỏ logic chia 3 phần.
3. Triển khai **cô lập nhánh lỗi (Isolated Sub-branch Recursion)**: Các phân đoạn con dịch thành công được giữ nguyên 100%, chỉ có phân đoạn con bị lỗi mới tiếp tục chia đôi đệ quy sâu hơn.
4. **Loại bỏ hoàn toàn cơ chế phân rã dịch từng dòng (`Line-by-Line Fallback`)** để triệt tiêu nguy cơ tắc nghẽn RPM/TPM và đứt gãy ngữ cảnh.
5. Cứu nguy trực tiếp tại trần độ sâu 4: Phiên âm Hán-Việt kết hợp từ điển cho Giai đoạn 1; giữ nguyên bản dịch thô cho Giai đoạn 2.
6. Ghép nối kết quả tuần tự bảo toàn 100% thứ tự ngữ nghĩa ban đầu.

---

## Technical Context

**Language/Version**: TypeScript 5.7+, Node.js 20+  
**Primary Dependencies**: React 19, `@google/genai` (browser SDK), `vitest`  
**Storage**: Client-side IndexedDB (`src/services/db.ts`)  
**Testing**: `vitest run` (`src/services/__tests__/directTranslationEngine.test.ts`, `chapterTranslationService.test.ts`)  
**Target Platform**: Pure Client-Side SPA (Web Browser Chrome / Firefox / Safari)  
**Project Type**: Web SPA (Pure Client-side, Zero backend)  
**Performance Goals**: Không phát sinh thêm request API đơn dòng; 0% lãng phí token dịch lại trên các nhánh con đã thành công.  
**Constraints**: Tuân thủ nghiêm ngặt 5 nguyên tắc Hiến pháp (Constitution): không sửa IndexedDB schema, không thêm dependency mới, không phá vỡ MVC.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc | Đánh giá | Ghi chú tuân thủ |
|---|---|---|
| **I. Strict Quality Gates** | PASS | Bắt buộc chạy `npm run lint`, `npm test`, `npm run build` vượt qua 100% trước khi hoàn thành. |
| **II. Dependency Minimization** | PASS | Sử dụng các hàm xử lý chuỗi và thuật toán sẵn có trong `src/lib/text.ts`, không cài thêm thư viện ngoài. |
| **III. Strict Concern Separation (MVC)** | PASS | Toàn bộ logic sửa đổi nằm ở tầng Model/Service (`src/services/directTranslationEngine.ts`), không ảnh hưởng giao diện hay component. |
| **IV. Immutable Core Schemas** | PASS | Không thay đổi schema IndexedDB trong `db.ts` hay cấu trúc thực thể lõi trong `types.ts`. |
| **V. Atomic Commits & Documentation** | PASS | Cập nhật đồng bộ các tài liệu đặc tả và kế hoạch trong `specs/132-binary-split-max-depth-4/`. |

---

## Project Structure

### Documentation (this feature)

```text
specs/132-binary-split-max-depth-4/
├── spec.md              # Đặc tả nghiệp vụ và tiêu chí nghiệm thu
├── plan.md              # Kế hoạch kiến trúc và triển khai (file này)
├── research.md          # Các quyết định kỹ thuật cốt lõi (Phase 0)
├── data-model.md        # Cấu trúc dữ liệu và máy trạng thái phân đoạn (Phase 1)
├── contracts/
│   └── translation-engine.contract.ts # Định nghĩa interface hợp đồng
├── quickstart.md        # Hướng dẫn kiểm thử và xác thực kịch bản (Phase 1)
└── checklists/
    └── requirements.md  # Checklist chất lượng đặc tả
```

### Source Code (repository root)

```text
src/
└── services/
    ├── directTranslationEngine.ts          # [MODIFY] Nâng max_depth lên 4, chia đôi nhị phân, cô lập nhánh lỗi, bỏ line-by-line
    ├── chapterTranslationService.ts        # [REVIEW] Kiểm tra tính tương thích của log chẩn đoán
    └── __tests__/
        ├── directTranslationEngine.test.ts # [MODIFY] Cập nhật các kịch bản test US1, US2, US3 phù hợp với max_depth 4 và binary split
        └── chapterTranslationService.test.ts # [VERIFY] Xác nhận chạy pass sạch
```

---

## Proposed Changes by Component

### [Translation Engine Core]

#### [MODIFY] [`src/services/directTranslationEngine.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/services/directTranslationEngine.ts)
- **Hàm `rawWithContentSplitDirect`**:
  - Đổi điều kiện trần đệ quy: từ `retryDepth < 2` thành `retryDepth < 4`.
  - Đổi số phần chia: luôn là `partsCount = 2` (`splitTextAdaptively(text, 2)`), loại bỏ `retryDepth >= 1 ? 3 : 2`.
  - Đảm bảo tính cô lập nhánh: khi duyệt qua các `chunks`, nhánh con nào gọi `rawWithContentSplitDirect` thành công thì giữ nguyên trong `translatedChunks`; nếu nhánh con lỗi thì chính nhánh con đó đệ quy sâu hơn với `retryDepth + 1`.
  - **Xóa bỏ hoàn toàn Tier 2 (Line-by-Line Fallback)**: Xóa bỏ khối mã `text.split(/\r?\n/)` gửi API từng dòng.
  - Khi `retryDepth >= 4` hoặc `chunks.length <= 1`: Gọi thẳng `fallbackSinoVietnameseLine(text, params.glossary)` để cứu nguy phân đoạn, phát sự kiện `onSplitRetry` với `tier: 'sino-fallback', partsCount: 1`.
- **Hàm `polishWithContentSplitDirect`**:
  - Đổi điều kiện trần đệ quy: từ `depth >= 2` thành `depth >= 4`.
  - Đổi số phần chia: luôn là `partsCount = 2` cho cả `sourceParts` và `rawParts`.
  - Khi chạm trần `depth >= 4` hoặc không thể chia thêm: Trả về `rawTranslation` tương ứng kèm `isPartial: true`.

#### [MODIFY] [`src/services/__tests__/directTranslationEngine.test.ts`](file:///e:/tailieuhoctap/laptrinhnangcao/th/merged/src/services/__tests__/directTranslationEngine.test.ts)
- Cập nhật test US2: Thay thế kiểm tra `tier === 'line-by-line'` bằng kiểm tra đệ quy nhị phân đến độ sâu 4 và kích hoạt `sino-fallback` trực tiếp mà không qua dịch từng dòng.
- Bổ sung test case cho **Isolated Sub-branch Recursion**: Kiểm tra kịch bản 4 đoạn mà đoạn 3 lỗi -> chỉ đoạn 3 đệ quy chia đôi, đoạn 1, 2, 4 giữ nguyên không bị gọi lại.

---

## Verification Plan

### Automated Tests
```bash
# 1. Chạy test suite của engine dịch
npm test src/services/__tests__/directTranslationEngine.test.ts

# 2. Chạy toàn bộ test dịch chương
npm test src/services/__tests__/chapterTranslationService.test.ts

# 3. Kiểm tra tính toàn vẹn type
npm run lint

# 4. Chạy toàn bộ test project
npm test

# 5. Build kiểm tra gói sản phẩm
npm run build
```

### Manual Verification
- Chạy thử nghiệm dịch chương truyện mẫu tại giao diện Bàn dịch (`npm run dev`), quan sát log tiến trình để xác nhận thông điệp hiển thị `phân đoạn thích ứng (chia 2 phần)` qua các cấp độ sâu 1, 2, 3, 4 và không xuất hiện log `dịch phân rã từng dòng`.
