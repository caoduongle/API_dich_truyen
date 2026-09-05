# Contract: Direct Gemini v1beta REST API Contract

**Endpoint**: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`  
**Protocol**: HTTPS (Client Browser Direct)  
**Authentication**: Query param `key={apiKey}`  

---

## Request Format

```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        { "text": "... [User & System Prompt] ..." }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.3,
    "responseMimeType": "application/json",
    "responseSchema": {
      "type": "OBJECT",
      "properties": { ... },
      "required": [ ... ]
    }
  }
}
```

## Response Format (200 OK)

```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          { "text": "{\n  \"suggestions\": [...]\n}" }
        ],
        "role": "model"
      },
      "finishReason": "STOP"
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 1250,
    "candidatesTokenCount": 350,
    "totalTokenCount": 1600
  }
}
```

## Error Handling
- **429 Too Many Requests / Resource Exhausted**: Thử key tiếp theo trong danh sách keys thông qua `callDirectGeminiWithRotation`.
- **400 Bad Request**: Lỗi cú pháp schema hoặc prompt vi phạm chính sách nội dung; ném lỗi trực tiếp hoặc chuyển sang text parsing fallback.
- **503 / 500 Service Unavailable**: Thử lại với exponential backoff hoặc chuyển key tiếp theo.
