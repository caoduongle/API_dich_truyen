# Contract: Direct Gemini Client API Interface

## Protocol Details

* **Transport**: HTTPS 1.1 / HTTP/2 Direct Fetch
* **Base URL**: `https://generativelanguage.googleapis.com/v1beta/models`
* **Target Endpoint**: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
* **Authentication**: Header `x-goog-api-key: <API_KEY>` (compatible with both Auth keys and legacy Standard keys)

---

## Request Format

```http
POST /v1beta/models/gemini-2.5-flash:generateContent HTTP/1.1
Host: generativelanguage.googleapis.com
Content-Type: application/json
x-goog-api-key: AQ..._USER_AUTH_KEY_OR_AIZA...

{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "--- THÔNG TIN TRUYỆN ---\nThể loại: Tiên Hiệp\n..."
        }
      ]
    }
  ],
  "systemInstruction": {
    "parts": [
      {
        "text": "[CHỈ THỊ BẢO VỆ AN TOÀN VÀ PHÒNG THỦ DỮ LIỆU ĐẦU VÀO]..."
      }
    ]
  },
  "generationConfig": {
    "temperature": 0.3,
    "responseMimeType": "application/json",
    "responseSchema": {
      "type": "OBJECT",
      "properties": {
        "rawTranslation": { "type": "STRING" },
        "discoveredEntities": { "type": "ARRAY", "items": { "type": "OBJECT" } }
      },
      "required": ["rawTranslation", "discoveredEntities"]
    }
  }
}
```

---

## Response Processing & Key Rotation Rules

| HTTP Status | Interpretation | Client Action |
| :--- | :--- | :--- |
| **200 OK** | Successful Generation | Parse candidate `parts[0].text` with `safeParseJson`. Return structured translation. |
| **429 Too Many Requests** | Key Quota / RPM Exceeded | Advance `currentKeyIndex = (currentKeyIndex + 1) % keys.length`. If all keys exhausted, wait with exponential backoff or notify user. |
| **503 / 500 Server Error** | Provider Overload / Transient Glitch | Retry request with next key or backoff up to 3 attempts. |
| **400 / 403 / 404** | Invalid Key / Expired / Forbidden | Mark key as invalid and advance to next available key in personal list. |
| **AbortError** | User canceled / stopped translation | Abort immediately without retrying. |
