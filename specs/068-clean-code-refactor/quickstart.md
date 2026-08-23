# Quickstart: Clean Code & Modular Refactoring Verification

**Feature**: 068-clean-code-refactor
**Date**: 2026-08-23

---

## 1. Automated Verification Commands

Chạy các lệnh kiểm thử sau sau mỗi batch và khi hoàn thành:

```bash
# 1. Type check
npm run lint

# 2. Chạy toàn bộ 88 test suites (601 tests)
npm test

# 3. Kiểm tra build production
npm run build
```

## 2. Line Count Inspection

Xác nhận không còn file nào trong các module được refactor vượt quá 400 dòng:

```powershell
# Kiểm tra các file backend quota
Get-ChildItem -Path server/services/quota/*.ts | Select-Object Name,@{N='Lines';E={(Get-Content $_.FullName).Count}}

# Kiểm tra các file Google Drive sync
Get-ChildItem -Path src/services/google-drive/*.ts | Select-Object Name,@{N='Lines';E={(Get-Content $_.FullName).Count}}

# Kiểm tra các components đã refactor
Get-ChildItem -Path src/components/quota-panel/*.tsx, src/components/api-settings/*.tsx | Select-Object Name,@{N='Lines';E={(Get-Content $_.FullName).Count}}
```

## 3. Manual Functional Smoke Test

1. **Khởi động ứng dụng**: `npm run dev`.
2. **Quota & Keys**: Mở Cài đặt API → Kiểm tra danh sách Key, kiểm tra Tab Quota → Xác nhận các card thống kê và countdown timer đếm lùi bình thường.
3. **Google Sync**: Mở modal Đồng bộ Google Drive → Xác nhận mở modal với giao diện `ui/Modal`, các nút Đăng nhập / Cấu hình nâng cao hoạt động đúng.
4. **Dịch truyện**: Chọn một chương và bấm dịch thử → Xác nhận luồng gọi API và kiểm tra quota backend hoạt động thông suốt.
