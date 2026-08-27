# Contract: Production Content-Security-Policy Header

## Endpoint
- **URL**: `GET /*` (Mọi trang tĩnh và route SPA trong môi trường Production)
- **Header**: `Content-Security-Policy`

## Header Directives Structure

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com; style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https: *.googleusercontent.com; connect-src 'self' ws: wss: https://generativelanguage.googleapis.com https://*.googleapis.com https://www.googleapis.com https://accounts.google.com https://content.googleapis.com https://oauth2.googleapis.com https://apis.google.com; frame-src https://drive.google.com https://docs.google.com https://accounts.google.com https://content.googleapis.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

## Directives Specification

| Chỉ thị | Giá trị cho phép | Mục đích |
|---|---|---|
| `connect-src` | `'self'`, `ws:`, `wss:`, `https://generativelanguage.googleapis.com`, `https://*.googleapis.com`, `https://www.googleapis.com`, `https://accounts.google.com`, `https://content.googleapis.com`, `https://oauth2.googleapis.com`, `https://apis.google.com` | Cho phép WebSocket, Google OAuth, Google Drive Picker và **Google Gemini REST API** (`generativelanguage.googleapis.com`) |
| `frame-src` | `https://drive.google.com`, `https://docs.google.com`, `https://accounts.google.com`, `https://content.googleapis.com` | Cho phép Google Drive File Picker & Auth popup |
| `script-src` | `'self'`, `'unsafe-inline'`, `https://apis.google.com`, `https://accounts.google.com` | Cho phép nạp script Google GIS & GAPI |
| `object-src` | `'none'` | Vô hiệu hóa Flash / Plugin nhúng |
| `frame-ancestors` | `'none'` | Chống Clickjacking |
