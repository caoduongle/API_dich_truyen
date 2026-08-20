# Phase 0 Research: Model Verification Tri-State & Explicit Probe Architecture

**Feature**: `043-model-verification-unknown-not-true`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Phân Tích Logic Hiện Tại & Vấn Đề (Bug Audit)

### Logic Cũ Gây Sai Semantics
Trong `server/services/modelInfoService.ts`:
- **Điểm 1 (Dòng 66-70)**:
  ```typescript
  if (Array.isArray(m.supportedGenerationMethods)) {
    return m.supportedGenerationMethods.includes('generateContent');
  }
  return true; // BUG: Thiếu metadata -> coi như hỗ trợ!
  ```
- **Điểm 2 (Dòng 291)**:
  ```typescript
  const methods = info.supportedGenerationMethods || [];
  const canGenerate = methods.length === 0 || methods.some(m => m.toLowerCase().includes('generatecontent'));
  // BUG: Mảng rỗng hoặc thiếu trường -> canGenerate = true!
  ```

### Hậu Quả:
- Các mô hình không hỗ trợ sinh văn bản (Text Embedding, Semantic Search, Audio/Vision-only) hoặc các phản hồi lỗi từ Google API bị gán nhầm thành mô hình dịch thuật hợp lệ (`verified = true`). Khi người dùng dịch truyện bằng các mô hình này, hệ thống sẽ gặp lỗi 400 và lãng phí hạn ngạch.

---

## 2. Kiến Trúc 3 Trạng Thái Năng Lực (Tri-State Model Capability)

```
                            ┌────────────────────────────────────────┐
                            │    Google AI Studio Model Metadata     │
                            └───────────────────┬────────────────────┘
                                                │
                                                ▼
                            ┌────────────────────────────────────────┐
                            │ evaluateModelGenerationCapability(...) │
                            └───────────────────┬────────────────────┘
                                                │
                   ┌────────────────────────────┼────────────────────────────┐
                   │                            │                            │
                   ▼                            ▼                            ▼
        ┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
        │     'supported'     │      │    'unsupported'    │      │      'unknown'      │
        │ - Có generateContent│      │ - Không có generate │      │ - Thiếu/Rỗng/Dị tật │
        │ - verified = true   │      │ - verified = false  │      │ - CHƯA verified     │
        └─────────────────────┘      └─────────────────────┘      └──────────┬──────────┘
                                                                             │
                                                                             ▼
                                                                  ┌─────────────────────┐
                                                                  │   Explicit Probe    │
                                                                  │ (Thăm dò thực tế)   │
                                                                  └──────────┬──────────┘
                                                                             │
                                                                   ┌─────────┴─────────┐
                                                                   │                   │
                                                                   ▼                   ▼
                                                             Probe Thành công   Probe Thất bại
                                                           (verified = true)  (verified = false)
```

---

## 3. Kịch Bản Kiểm Thử Bắt Buộc

1. `capability present`: Metadata có `"generateContent"` $\to$ `supported = true, verified = true`.
2. `capability absent`: Metadata có `["embedContent"]` $\to$ `supported = false, verified = false`.
3. `capability missing`: Metadata là `undefined`/`null` $\to$ trạng thái `unknown` (KHÔNG phải `true`).
4. `malformed metadata`: Metadata là chuỗi/object sai kiểu $\to$ trạng thái `unknown` an toàn.
5. `verification success`: Trạng thái `unknown` + Explicit Probe thành công $\to$ `verified = true`.
6. `verification failure`: Trạng thái `unknown` + Explicit Probe thất bại $\to$ `verified = false`.
