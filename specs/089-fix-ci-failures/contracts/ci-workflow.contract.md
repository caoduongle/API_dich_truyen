# Interface Contract: CI Workflow & Path Sanitization

**Feature**: `089-fix-ci-failures`  
**Date**: 2026-09-05  

---

## 1. Function Contract: `sanitizeFilename`

### Chữ Ký Hàm
```typescript
function sanitizeFilename(rawFilename: string): string;
```

### Preconditions
- `rawFilename`: chuỗi đầu vào bất kỳ đại diện cho tên tệp hoặc đường dẫn tệp do client tải lên.

### Postconditions
- Loại bỏ toàn bộ tiền tố đường dẫn cha (`..`, `/`, `\`).
- Chuẩn hóa các dấu gạch chéo ngược Windows (`\`) thành `/` trước khi bóc tách `basename`.
- Thay thế các ký tự không an toàn thành dấu gạch dưới `_`.
- Nếu kết quả rỗng hoặc không hợp lệ, trả về `upload_${timestamp}`.

### Contract Test Cases
| Input | Output Kỳ Vọng | Ghi Chú |
|---|---|---|
| `"../../../etc/passwd"` | `"passwd"` | POSIX Directory Traversal |
| `"..\\..\\windows\\system32\\cmd.exe"` | `"cmd.exe"` | Windows Directory Traversal trên cả Linux và Win |
| `"my novel.txt"` | `"my novel.txt"` | Tên tệp có dấu cách an toàn |
| `"truyện_tiên_hiệp_123.epub"` | `"truyện_tiên_hiệp_123.epub"` | Ký tự Unicode tiếng Việt được bảo toàn |

---

## 2. Pipeline Contract: GitHub Actions CI Execution Order

### Workflow Contract (.github/workflows/ci.yml)
1. **Trigger**: Push hoặc Pull Request vào nhánh `main`.
2. **Environment**: `ubuntu-latest`, Node.js `20.x`.
3. **Step Sequence**:
   - `Type check`: `npm run lint` -> exit code 0.
   - `Build`: `npm run build` -> sinh đầy đủ thư mục `dist/client` và `dist/server`, exit code 0.
   - `Run tests`: `npm test` -> thực thi 100% test cases bao gồm `quickstartVerification.test.ts`, exit code 0.
