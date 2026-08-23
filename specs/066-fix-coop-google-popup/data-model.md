# Data Model: Fix COOP and CSP for Google OAuth Popup

**Feature**: 066-fix-coop-google-popup
**Date**: 2026-08-23

---

## Security Headers Configuration

Tính năng này không thay đổi database entity hay storage schema, mà điều chỉnh cấu hình HTTP Response Headers được tạo bởi Express middleware:

### HTTP Response Headers

| Header | Giá trị cấu hình | Ý nghĩa | Môi trường áp dụng |
|--------|------------------|---------|-------------------|
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` | Giữ `window.opener` cho phép popup Google GIS gửi token về ứng dụng chính | Production & Development |
| `Content-Security-Policy` | `script-src 'self' https://accounts.google.com https://apis.google.com; connect-src 'self' ws: wss: https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://apis.google.com; frame-src https://accounts.google.com; ...` | Cho phép nạp script, frame và network requests đến Google | Production (Tắt ở Development để hỗ trợ Vite HMR) |
| `X-Content-Type-Options` | `nosniff` | Chống MIME sniffing (Helmet default) | Production & Development |
