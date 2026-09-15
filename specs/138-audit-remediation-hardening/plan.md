# Implementation Plan: Khắc Phục Kiểm Toán & Gia Cố Tính Nhất Quán (138-audit-remediation-hardening)

**Branch**: `138-audit-remediation-hardening` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/138-audit-remediation-hardening/spec.md`

## Summary

Kế hoạch này triển khai khắc phục toàn diện các điểm kỹ thuật còn tồn đọng sau đợt refactor theo kết quả kiểm toán:
1. **P1: Ghi nhận lỗi cuộc gọi chuẩn xác**: Khắc phục lỗi gọi `recordFailure()` hai lần trong `geminiClient.ts` bằng cách dùng cờ kiểm soát per-attempt.
2. **P1: Bảo toàn trạng thái nghỉ của khóa khi reload**: Mở rộng schema `sessionStorage` của `localQuotaTracker.ts` để lưu trữ và phục hồi chính xác các trạng thái `QuotaExhausted`, `RateLimited`, `Cooldown`, tôn trọng chu kỳ làm mới lúc 00:00 PST.
3. **P1: Tuần tự hóa thao tác lưu dự án**: Xây dựng hàng đợi ghi tuần tự (sequential promise chain) cho các thao tác lưu dự án trong `useProjects.ts`, loại bỏ nguy cơ race condition.
4. **P1: Nâng cấp thuật toán băm khóa sang SHA-256**: Thay thế thuật toán băm 32-bit yếu bằng SHA-256 chuẩn mật mã học trên cả trình duyệt và Node.js, kèm bộ nhớ đệm đồng bộ.
5. **P2: Chuẩn hóa tài liệu và mô hình bảo mật**: Cập nhật `docs/model-system.md` sang kiến trúc client-direct SPA; đồng bộ `SECURITY.md` và `.env.example`.
6. **P2: Thống nhất hợp đồng và ngữ nghĩa phân đoạn song ngữ**: Đồng bộ kiểu `BilingualSplitOptions` và tăng cường bảo vệ ranh giới đoạn văn.
7. **P2: Minh bạch hóa kết quả truy vấn cơ sở dữ liệu**: Phân định rõ dữ liệu rỗng và lỗi truy cập.

---

## Technical Context

**Language/Version**: TypeScript 5.8+, ECMAScript 2022+  
**Primary Dependencies**: React 19, Vite 6, Tailwind CSS v4, `@google/genai` (direct client SDK), `clsx`, `tailwind-merge`, `motion`, `lucide-react`  
**Storage**: IndexedDB (`src/services/db.ts`) cho dữ liệu bản thảo & dự án; `sessionStorage` cho hạn ngạch và trạng thái sức khỏe khóa (`src/services/localQuotaTracker.ts`); Google Drive v3 REST API (đồng bộ đám mây tùy chọn qua OAuth 2.0 PKCE)  
**Testing**: Vitest (`vitest run`), React Testing Library  
**Target Platform**: Trình duyệt hiện đại (Chrome, Firefox, Edge, Safari) - Thuần Client-side Single Page Application (SPA)  
**Project Type**: Web Application (Pure Client-side SPA)  
**Performance Goals**:
- Thời gian tra cứu mã băm khóa: < 0.1ms với in-memory cache
- Độ trễ hàng đợi lưu trữ dự án: < 5ms bổ sung trên mỗi lần ghi, đảm bảo không nghẽn UI
- Tốc độ khôi phục trạng thái hạn ngạch khi reload: < 1ms từ `sessionStorage`  
**Constraints**:
- Không thêm bất kỳ thư viện ngoài (zero new dependencies)
- Tuân thủ nghiêm ngặt 3 cổng kiểm tra chất lượng: `npm run lint`, `npm test`, `npm run build` phải vượt qua 100% không lỗi
- Không làm thay đổi schema cốt lõi của `src/types.ts` hoặc cấu trúc lưu trữ IndexedDB

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Nguyên tắc Hiến pháp | Trạng thái | Đánh giá tuân thủ |
|:---|:---:|:---|
| **I. Cổng chất lượng nghiêm ngặt** | ✅ ĐẠT | Bắt buộc chạy `npm run lint`, `npm test`, `npm run build` trước khi báo cáo hoàn thành; không skip test. |
| **II. Tối thiểu hóa phụ thuộc** | ✅ ĐẠT | Tận dụng Web Crypto API có sẵn trong trình duyệt và Node.js Crypto; không cài thêm gói ngoài. |
| **III. Phân định ranh giới MVC** | ✅ ĐẠT | Hàng đợi ghi lưu trữ đặt tại Service/Storage layer; Hook `useProjects` chỉ điều phối; Component View không bị ảnh hưởng. |
| **IV. Bất biến Schema cốt lõi** | ✅ ĐẠT | Giữ nguyên các interface trong `src/types.ts` và schema IndexedDB; chỉ mở rộng trường nội bộ của `sessionStorage`. |
| **V. Commit nguyên tử & Đồng bộ tài liệu** | ✅ ĐẠT | Đồng bộ 1:1 giữa mã nguồn và `docs/model-system.md`, `SECURITY.md`, `.env.example`. |

---

## Project Structure

### Documentation (this feature)

```text
specs/138-audit-remediation-hardening/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (this file)
├── research.md          # Technical decisions and trade-offs
├── data-model.md        # State models and storage schemas
├── quickstart.md        # Step-by-step verification guide
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── contracts/
    ├── quota-tracker.contract.ts   # Quota tracker contract
    ├── project-queue.contract.ts   # Write queue contract
    └── bilingual-split.contract.ts # Unified bilingual split contract
```

### Source Code Modifying Plan

```text
src/
├── services/
│   ├── gemini/
│   │   └── geminiClient.ts           # [MODIFY] Thêm cờ attemptFailureRecorded chống đếm lặp lỗi
│   ├── localQuotaTracker.ts          # [MODIFY] Lưu và phục hồi đầy đủ trạng thái Quota/Circuit Breaker, chuẩn hóa SHA-256
│   ├── projectStorageQueue.ts        # [NEW] Module điều phối hàng đợi ghi tuần tự cho IndexedDB
│   ├── db.ts                         # [MODIFY] Tích hợp queue ghi và làm rõ log lỗi storage
│   └── translation/
│       └── bilingualSplit.ts         # [MODIFY] Thống nhất interface BilingualSplitOptions và bảo vệ ranh giới đoạn
├── hooks/
│   └── useProjects.ts                # [MODIFY] Sử dụng enqueueProjectSave cho các thao tác cập nhật dự án
├── docs/
│   └── model-system.md               # [MODIFY] Cập nhật sang kiến trúc thuần client-direct SPA
├── SECURITY.md                       # [MODIFY] Chuẩn hóa thuật ngữ bảo mật và CSP whitelist
└── .env.example                      # [MODIFY] Xóa tuyên bố mã hóa IndexedDB không chính xác
```

---

## Detailed Implementation Strategy

### Bước 1: Khắc phục lỗi ghi nhận `recordFailure` hai lần trong `geminiClient.ts`
- Khai báo cờ `let attemptFailureRecorded = false;` bên trong vòng lặp thử khóa.
- Trong khối `if (!response.ok)`: gọi `localQuotaTracker.recordFailure(...)` và gán `attemptFailureRecorded = true`.
- Trong khối `catch (err)`: chỉ gọi `localQuotaTracker.recordFailure(...)` nếu `!attemptFailureRecorded`.
- Reset cờ khi chuyển sang khóa tiếp theo.

### Bước 2: Bảo toàn trạng thái Quota / Circuit Breaker trong `localQuotaTracker.ts`
- Cập nhật `saveToStorage()`: tuần tự hóa thêm `circuitBreakerStatus`, `cooldownUntil`, `lastTransitionAt`, `consecutiveErrors`, `consecutiveSuccesses`.
- Cập nhật `loadFromStorage()`:
  - Nếu khác ngày (PST): reset bộ đếm ngày, giải phóng `QuotaExhausted` về `Healthy`.
  - Nếu cùng ngày (PST):
    - `QuotaExhausted` giữ nguyên với mốc mở khóa 00:00 PST.
    - `RateLimited` / `Cooldown` giữ nguyên nếu `now < cooldownUntil`; nếu đã hết hạn thì phục hồi về `Healthy`.
    - `AuthFailed` luôn giữ nguyên.

### Bước 3: Nâng cấp thuật toán băm khóa sang SHA-256 chuẩn
- Trong `localQuotaTracker.ts` (và tiện ích băm):
  - Xây dựng thuật toán băm SHA-256 chuẩn mật mã học cho môi trường trình duyệt.
  - Tích hợp bộ nhớ đệm `keyHashCache` (`Map<string, string>`) giúp hàm `hashApiKey(key)` giữ nguyên tính chất đồng bộ và tốc độ tức thì (< 0.1ms).
  - Cung cấp thêm `hashApiKeyAsync` cho luồng khởi tạo bất đồng bộ nếu cần.

### Bước 4: Xây dựng Hàng đợi Ghi Dự án Tuần tự `projectStorageQueue.ts`
- Xây dựng chuỗi Promise tuần tự đảm bảo các lần gọi `saveProjectToDB` diễn ra lần lượt theo thứ tự FIFO.
- Cập nhật `src/hooks/useProjects.ts`:
  - Thay thế các lệnh gọi fire-and-forget `saveProjectToDB(updatedToSave)` bằng `enqueueProjectSave(updatedToSave)`.

### Bước 5: Thống nhất Hợp đồng và Ngữ nghĩa `bilingualSplit.ts`
- Hỗ trợ hàm `splitBilingualAdaptively` nhận cả `(sourceText, rawText, targetParts)` hoặc đối tượng `BilingualSplitOptions`.
- Cải thiện thuật toán ghép đoạn văn để bảo vệ tính toàn vẹn câu/đoạn khi số đoạn văn hai bên không cân đối.

### Bước 6: Đồng bộ Tài liệu Kỹ thuật
- `docs/model-system.md`: Sửa sơ đồ tuần tự và mô tả sang Client-Direct SPA.
- `SECURITY.md`: Thay "Zero-Server-Knowledge" bằng "Client-Direct", chuẩn hóa danh sách CSP.
- `.env.example`: Xóa cụm từ "mã hóa IndexedDB".

---

## Verification Plan

### Automated Tests
```bash
# Kiểm tra riêng từng mô-đun được sửa
npm test -- src/services/gemini/__tests__/geminiClient.test.ts
npm test -- src/services/__tests__/localQuotaTracker.test.ts
npm test -- src/hooks/__tests__/useProjects.test.ts
npm test -- src/services/translation/__tests__/bilingualSplit.test.ts

# Bắt buộc toàn bộ suite kiểm tra chất lượng
npm run lint    # tsc --noEmit
npm test        # vitest run (Toàn bộ 700+ tests pass)
npm run build   # tsc && vite build
```
