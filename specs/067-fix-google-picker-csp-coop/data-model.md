# Data Model: Fix Google Picker CSP & COOP

**Feature**: 067-fix-google-picker-csp-coop
**Date**: 2026-08-23

---

## Security Headers Configuration

Tính năng này không thay đổi database entity hay storage schema, mà điều chỉnh cấu hình HTTP Response Headers và options khởi tạo client library:

### 1. HTTP Response Headers (CSP)

| Directive | Giá trị cấu hình | Mục đích |
|-----------|------------------|----------|
| `frame-src` | `https://drive.google.com https://docs.google.com https://accounts.google.com https://content.googleapis.com` | Cho phép nhúng iframe Google Picker và Google Account auth |
| `script-src` | `'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com` | Nạp Google API client library (gapi) và GIS |
| `connect-src` | `'self' ws: wss: https://www.googleapis.com https://accounts.google.com https://content.googleapis.com https://oauth2.googleapis.com https://apis.google.com` | Thực hiện API requests đến Google Drive và Google APIs |
| `style-src` | `'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com` | Nạp Google Fonts và inline styles của Picker UI |
| `font-src` | `'self' https://fonts.gstatic.com data:` | Nạp Google Web Fonts |
| `img-src` | `'self' data: blob: https: *.googleusercontent.com` | Nạp thumbnails tệp Google Drive và avatars |

### 2. Client Service (`googlePickerService.ts`)

| Phương thức / Cấu hình | Giá trị | Mục đích |
|-----------------------|---------|----------|
| `pickerBuilder.setOrigin(...)` | `window.location.origin` | Xác thực origin cho iframe `postMessage` của Google Picker |
