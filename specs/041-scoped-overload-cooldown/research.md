# Phase 0 Research: Scoped Overload Cooldown Architecture

**Feature**: `041-scoped-overload-cooldown`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Nghiên Cứu Cơ Chế Quá Tải Của Google GenAI (Upstream Semantics)

### Bản Chất Lỗi HTTP 503 ("The model is overloaded")
- Trên hạ tầng Google AI Studio / Vertex AI, các họ mô hình khác nhau (`Gemini Pro`, `Gemini Flash`, `Gemini Flash-Lite`, `Gemma`) được phục vụ bởi các cụm phần cứng GPU/TPU và hàng đợi riêng biệt.
- Khi `gemini-2.5-pro` bị quá tải do lưu lượng suy luận cao, cụm của `gemini-2.5-flash` và `gemini-3.1-flash-lite` thường vẫn hoàn toàn thông thoáng và phản hồi với độ trễ thấp.
- **Vấn đề cũ**: Một biến toàn cục `overloadCooldownUntil` process-wide sẽ chặn đứng toàn bộ mọi request của tất cả các mô hình và tất cả các dự án, gây thiệt hại nghiêm trọng đến trải nghiệm người dùng.

---

## 2. Phân Vùng Phạm Vi Cooldown 4 Cấp Độ (4-Tier Scoped Hierarchy)

```
                            ┌────────────────────────────────────────┐
                            │        Provider-Wide Cooldown          │
                            │  - Kích hoạt khi >= 2 models AND       │
                            │    >= 2 groups đồng thời lỗi trong 5s  │
                            └───────────────────┬────────────────────┘
                                                │
                                                ▼
                            ┌────────────────────────────────────────┐
                            │        Model-Specific Cooldown         │
                            │  - Chỉ áp dụng cho Model bị 503        │
                            │  - Các Model khác: delayMs = 0         │
                            └───────────────────┬────────────────────┘
                                                │
                                                ▼
                            ┌────────────────────────────────────────┐
                            │          QuotaGroup Cooldown           │
                            │  - Chỉ áp dụng cho Project bị 429/503  │
                            │  - Các Project khác: delayMs = 0       │
                            └───────────────────┬────────────────────┘
                                                │
                                                ▼
                            ┌────────────────────────────────────────┐
                            │          Key-Specific Cooldown         │
                            │  - Chỉ áp dụng cho Key bị 401/429      │
                            │  - Các Key khác trong nhóm: bình thường│
                            └────────────────────────────────────────┘
```

---

## 3. Ma Trận Quyết Định Điều Phối (Scheduling Decision Matrix)

| Sự Kiện | Phạm Vi Ảnh Hưởng | Xử Lý Của Scheduler Authority |
|---|---|---|
| Model A gặp 503 Overloaded | Chỉ Model A | Kích hoạt `modelCooldowns[Model A] = now + 3000ms`. Request tới Model B được cấp quyền ngay tức thì (`delayMs = 0`). |
| Group A gặp 429/503 | Chỉ Group A | Kích hoạt `group.cooldownUntilMs = now + 5000ms`. Request tới Group B được cấp quyền ngay tức thì (`delayMs = 0`). |
| Key 1 gặp 401 Auth Failed | Chỉ Key 1 | Đánh dấu `key1.healthState = AuthFailed`. Nhóm chuyển sang Key 2 để hoàn thành request. |
| Nhiều Model & Group đồng thời 503 | Toàn Provider | Kích hoạt `providerOutageUntilMs = now + 5000ms` để bảo vệ ứng dụng khỏi sự cố sập mạng diện rộng. |

---

## 4. Kịch Bản Kiểm Thử Bắt Buộc

1. `model A overloaded`: Model A nhận 503 $\to$ Model A vào Cooldown.
2. `model B remains usable`: Model B tiếp tục được cấp quyền với `delayMs = 0`.
3. `project A overloaded`: Group A nhận 429/503 $\to$ Group A vào Cooldown.
4. `project B remains usable`: Group B tiếp tục được cấp quyền với `delayMs = 0`.
5. `provider-wide outage`: 2 model và 2 group lỗi trong 5s $\to$ kích hoạt Provider Outage.
6. `recovery`: Hết TTL $\to$ tự động phục hồi về `Available` / `Healthy`.
