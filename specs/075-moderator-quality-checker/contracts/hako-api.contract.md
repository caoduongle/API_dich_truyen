# Contract: Hako Read-Only API Endpoints

**Feature**: `075-moderator-quality-checker`
**Date**: 2026-08-27
**Status**: Completed

## 1. Overview
Read-only server endpoints to fetch public novel metadata and chapter content from Hako / Docln without cookies or authentication credentials.

---

## 2. Endpoints

### 2.1 Fetch Novel Metadata & Chapter List

- **Method**: `POST`
- **Route**: `/api/hako/novel-info`
- **Request Body**:
```json
{
  "url": "https://ln.hako.vn/truyen/1234-ten-truyen"
}
```

- **Success Response (`200 OK`)**:
```json
{
  "url": "https://ln.hako.vn/truyen/1234-ten-truyen",
  "title": "Tên Truyện",
  "author": "Tên Tác Giả",
  "artist": "Tên Họa Sĩ",
  "description": "Tóm tắt truyện...",
  "coverUrl": "https://i.docln.net/...",
  "volumes": [
    {
      "volumeTitle": "Tập 01 - Khởi đầu",
      "chapters": [
        {
          "url": "https://ln.hako.vn/truyen/1234-ten-truyen/c12345-chuong-1",
          "title": "Chương 01: Mở màn",
          "order": 1
        }
      ]
    }
  ],
  "fetchedAt": "2026-08-27T02:00:00.000Z"
}
```

- **Error Responses**:
  - `400 Bad Request`:
    ```json
    {
      "error": "URL truyện không hợp lệ. Vui lòng nhập liên kết từ ln.hako.vn hoặc docln.net.",
      "code": "INVALID_HAKO_URL"
    }
    ```
  - `429 Too Many Requests`:
    ```json
    {
      "error": "Hako đang tạm thời giới hạn tần suất truy cập. Vui lòng chờ 1-2 phút rồi thử lại.",
      "code": "HAKO_RATE_LIMITED",
      "retryAfterSeconds": 60
    }
    ```
  - `403 Forbidden` / Bot Challenge:
    ```json
    {
      "error": "Hako đang kích hoạt cơ chế bảo vệ chống bot (Cloudflare). Vui lòng thử lại sau ít phút.",
      "code": "HAKO_BOT_CHALLENGE",
      "retryAfterSeconds": 90
    }
    ```
  - `404 Not Found`:
    ```json
    {
      "error": "Không tìm thấy thông tin truyện tại liên kết này hoặc truyện đã bị chuyển sang chế độ riêng tư.",
      "code": "HAKO_NOVEL_NOT_FOUND"
    }
    ```

---

### 2.2 Fetch Chapter Content

- **Method**: `POST`
- **Route**: `/api/hako/chapter-content`
- **Request Body**:
```json
{
  "url": "https://ln.hako.vn/truyen/1234-ten-truyen/c12345-chuong-1"
}
```

- **Success Response (`200 OK`)**:
```json
{
  "url": "https://ln.hako.vn/truyen/1234-ten-truyen/c12345-chuong-1",
  "title": "Chương 01: Mở màn",
  "volumeTitle": "Tập 01",
  "content": "Nội dung văn bản tiếng Việt của chương...",
  "wordCount": 2450,
  "fetchedAt": "2026-08-27T02:00:00.000Z"
}
```

- **Error Responses**:
  - `400 / 404 / 429 / 403` with standard structured JSON error format matching above.
