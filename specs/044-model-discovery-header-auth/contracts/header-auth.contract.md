# API & Network Contract: Google Model Discovery Header Auth

**Feature**: `044-model-discovery-header-auth`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Hợp Đồng Outbound HTTP Request

### 1.1 List Models
```http
GET https://generativelanguage.googleapis.com/v1beta/models
Content-Type: application/json
User-Agent: aistudio-build
x-goog-api-key: AIzaSyExampleValidKey123
```

### 1.2 Get Single Model Metadata
```http
GET https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash
Content-Type: application/json
User-Agent: aistudio-build
x-goog-api-key: AIzaSyExampleValidKey123
```

### 1.3 Probe Generate Content
```http
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
Content-Type: application/json
User-Agent: aistudio-build
x-goog-api-key: AIzaSyExampleValidKey123

{
  "contents": [{ "role": "user", "parts": [{ "text": "Ping" }] }],
  "generationConfig": { "maxOutputTokens": 5 }
}
```
*(Tuyệt đối không có `?key=` trong URL)*.
