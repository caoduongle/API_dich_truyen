# Phase 0 Research: Project ID Verification & Quota Bucket Semantics

**Feature**: `048-verify-project-id`  
**Date**: 2026-08-20  
**Status**: Completed

---

## 1. Phân Tích Hiện Trạng & Rủi Ro Blind Trust

### Vấn Đề
- Trước đây, khi người dùng nhập chuỗi `projectId = "my-project"`, hệ thống có thể ngầm định các keys này thuộc cùng một Google Cloud Project thực tế và gộp chung Provider Quota Bucket.
- **Rủi ro**: Nếu 2 người dùng hoặc 2 tài khoản khác nhau đều đặt tên chuỗi là `my-project` hoặc `test`, hệ thống sẽ điều phối sai nhịp độ (Pacing/RPM), dẫn đến nghẽn oan hoặc tính sai hạn ngạch.

---

## 2. Mô Hình Phân Biệt Nguồn Gốc & Trạng Thái Xác Thực Dự Án

```
                           PROJECT BINDING METADATA
                     ┌──────────────────────────────────┐
                     │ source: 'user'|'provider'|'infe' │
                     │ status: 'decl'|'veri'|'unknown'  │
                     └────────────────┬─────────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            ▼                         ▼                         ▼
   [userDeclaredProject]    [providerVerifiedProject]     [unknownProject]
   - source: 'user'         - source: 'provider'          - source: 'inferred'
   - status: 'declared'     - status: 'verified'          - status: 'unknown'
   - Scheduler: KHÔNG tự    - Scheduler: CHẮC CHẮN        - Scheduler: Cô lập an
     ý coi là same bucket     chia sẻ same provider         toàn độc lập
     trừ khi explicit group   quota bucket
```

---

## 3. Kịch Bản Kiểm Thử Bắt Buộc

1. `same declared project`: 2 keys cùng khai báo `projectId = "prj-alpha"` $\to$ metadata lưu `source = 'user'`, `status = 'declared'`; chỉ chia sẻ bucket nếu có explicit group.
2. `different declared project`: 2 keys khai báo 2 `projectId` khác nhau $\to$ phân bổ vào 2 quota groups độc lập.
3. `provider verified project`: Key được provider xác thực `projectId = "verified-prj"` $\to$ metadata lưu `source = 'provider'`, `status = 'verified'`; được bảo đảm điều phối chung bucket.
4. `unknown project`: Key không có `projectId` $\to$ metadata lưu `source = 'inferred'`, `status = 'unknown'`; mỗi key chạy an toàn theo default fallback isolation.
