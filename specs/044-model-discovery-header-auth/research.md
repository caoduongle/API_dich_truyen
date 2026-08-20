# Phase 0 Research: Header-Based Authentication for Google Model Discovery

**Feature**: `044-model-discovery-header-auth`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Nghiên Cứu Giao Thức Bảo Mật HTTP Header (Google GenAI API Contract)

### Chuẩn Xác Thực HTTP Của Google
Google Generative Language API (v1beta) hỗ trợ 2 phương thức xác thực:
1. **Query Parameter (Không khuyến nghị)**: `?key=<API_KEY>` — Dễ bị lưu vết trong Server Access Logs, Proxy Logs, URL caches, và Browser history.
2. **HTTP Header (Khuyến nghị & Chuẩn bảo mật)**: `x-goog-api-key: <API_KEY>` — Header được mã hóa qua kênh truyền TLS/HTTPS và không bao giờ xuất hiện trong URL access logs của các proxy trung gian.

---

## 2. Rà Soát Các Điểm Gọi HTTP Trong Server

| Điểm Gọi Trong Code | Hàm | URL Mới (Sạch) | Header Xác Thực |
|---|---|---|---|
| `modelInfoService.ts:70` | `fetchModelsFromGoogle` | `https://generativelanguage.googleapis.com/v1beta/models` | `x-goog-api-key: <KEY>` |
| `modelInfoService.ts:217` | `fetchSingleModelFromGoogle` | `https://generativelanguage.googleapis.com/v1beta/models/{modelId}` | `x-goog-api-key: <KEY>` |
| `modelInfoService.ts:268` | `probeModelGeneration` | `https://generativelanguage.googleapis.com/v1beta/models/{modelId}:generateContent` | `x-goog-api-key: <KEY>` |

---

## 3. Kịch Bản Kiểm Thử Bắt Buộc

1. `URL does not contain key`: Khẳng định `url` được gửi qua `fetch` hoàn toàn không chứa `?key=` hay giá trị của key.
2. `header contains key`: Khẳng định options headers của `fetch` có thuộc tính `'x-goog-api-key': '<API_KEY>'`.
3. `logs do not contain key`: Khẳng định mọi thông điệp lỗi và logs không bao giờ rò rỉ plaintext API key.
