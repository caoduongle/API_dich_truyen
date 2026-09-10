# Data Model: QA Critique Target Text Locating Field

## Entity: DirectQaCritiqueIssue

Represents an individual quality assurance issue identified during the AI critique phase.

### Fields

| Field Name | Type | Required | Description | Validation Rules |
|------------|------|----------|-------------|------------------|
| `type` | `string` | Yes | Classification of the quality defect | Must be one of: `'omission'`, `'addition'`, `'repetition'`, `'terminology'`, `'other'` |
| `severity` | `string` | Yes | Defect severity rating | Must be one of: `'critical'`, `'warning'`, `'info'` |
| `targetText` | `string` | Yes | Verbatim Vietnamese excerpt from polished translation | Exact substring match of translated text, or `""` if `type === 'omission'` with no translated counterpart |
| `description` | `string` | Yes | Natural language explanation of the defect and affected Chinese/Vietnamese content | Non-empty string |

---

## Entity: DirectQaCritiqueResult

The structured aggregate output returned by `qaCritiqueDirect()`.

### Fields

| Field Name | Type | Required | Description | Validation Rules |
|------------|------|----------|-------------|------------------|
| `isValid` | `boolean` | Yes | Whether the translation passed QA checks without defects | Default: `true` if empty issues |
| `issues` | `DirectQaCritiqueIssue[]` | Yes | List of detected critique issues | Array of valid `DirectQaCritiqueIssue` objects |
| `successKeyIndex` | `number` | Yes | Index of the API key that successfully completed the call | Non-negative integer |

---

## Gemini JSON Schema Representation

```json
{
  "type": "OBJECT",
  "properties": {
    "isValid": {
      "type": "BOOLEAN",
      "description": "true nếu không phát hiện bất kỳ lỗi nghiêm trọng nào về bỏ sót, thêm thắt hoặc lặp lại. false nếu phát hiện lỗi."
    },
    "issues": {
      "type": "ARRAY",
      "description": "Danh sách các vấn đề phát hiện được.",
      "items": {
        "type": "OBJECT",
        "properties": {
          "type": {
            "type": "STRING",
            "enum": ["omission", "addition", "repetition", "terminology", "other"],
            "description": "Loại lỗi phát hiện: omission (bỏ sót), addition (thêm thắt), repetition (lặp lại), terminology (sai từ điển), other (khác)."
          },
          "severity": {
            "type": "STRING",
            "enum": ["critical", "warning", "info"],
            "description": "Mức độ nghiêm trọng của lỗi."
          },
          "targetText": {
            "type": "STRING",
            "description": "Đoạn trích NGUYÊN VĂN câu/đoạn tiếng Việt bị lỗi trong bản dịch để định vị. Nếu là lỗi bỏ sót (omission) hoàn toàn không có trong bản dịch thì để chuỗi rỗng (\"\")."
          },
          "description": {
            "type": "STRING",
            "description": "Mô tả chi tiết lỗi phát hiện được, ghi rõ nội dung tiếng Trung bị ảnh hưởng và lỗi tiếng Việt tương ứng."
          }
        },
        "required": ["type", "severity", "targetText", "description"]
      }
    }
  },
  "required": ["isValid", "issues"]
}
```
