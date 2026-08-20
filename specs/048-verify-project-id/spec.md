# Feature Specification: Xác Nhận projectId Thay Vì Tin Tuyệt Đối (Verify Project ID Over Blind Trust)

**Feature Branch**: `048-verify-project-id`  
**Created**: 2026-08-20  
**Status**: Draft  
**Input**: User description: "TASK 11 — XÁC NHẬN projectId THAY VÌ TIN TUYỆT ĐỐI. Mục tiêu: projectId user nhập không đồng nghĩa provider đã xác minh. Phân biệt: userDeclaredProject, providerVerifiedProject, unknownProject. Scheduler: Nếu group chỉ có: userDeclaredProject thì không được coi chắc chắn: same provider quota bucket trừ khi user explicitly cấu hình group như vậy. Thiết kế: Quota group cần metadata: source (user, provider, inferred) hoặc tương đương. Tests: same declared project, different declared project, provider verified project, unknown project."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Phân Định 3 Trạng Thái Xác Thực Dự Án (Project Verification State Classification) (Priority: P1) 🎯 MVP

Hệ thống quản lý `projectId` với 3 trạng thái phân định rành mạch:
1. **`userDeclaredProject` (Dự án do người dùng tự khai báo)**:
   - `source = 'user'`, `status = 'declared'`.
   - Được nhập từ UI hoặc payload cấu hình, chưa có bằng chứng xác nhận từ Google Cloud / Gemini API.
2. **`providerVerifiedProject` (Dự án đã được nhà cung cấp xác minh)**:
   - `source = 'provider'`, `status = 'verified'`.
   - Được xác thực qua phản hồi từ Google GenAI API (ví dụ: HTTP header, token introspection, hoặc discovery probe).
3. **`unknownProject` (Chưa rõ thông tin dự án)**:
   - `source = 'inferred'` hoặc `'user'`, `status = 'unknown'`.
   - Khóa API hoạt động độc lập, không có thông tin `projectId`.

**Why this priority**: Ngăn ngừa lỗ hổng giả định sai (False Assumption) khi người dùng nhập trùng tên dự án dẫn đến việc hệ thống gộp nhầm hạn ngạch thực tế phía Google.

**Independent Test**:
- Kiểm tra metadata của Quota Group khi đăng ký với `projectId` từ người dùng $\to$ `source = 'user'`, `status = 'declared'`.
- Kiểm tra metadata khi xác thực qua provider probe $\to$ `source = 'provider'`, `status = 'verified'`.
- Kiểm tra khi không truyền `projectId` $\to$ `source = 'inferred'`, `status = 'unknown'`.

---

### User Story 2 - Ngữ Nghĩa Bộ Lập Lịch & Cách Ly Quota Bucket (Scheduler Quota Bucket Semantics) (Priority: P1) 🎯 MVP

Bộ lập lịch (`quotaService`) áp dụng nguyên tắc an toàn cho Provider Quota Bucket:
1. **Nếu group chỉ mang trạng thái `userDeclaredProject`**:
   - Bộ lập lịch **không được tự động suy diễn rằng các khóa này chia sẻ cùng 1 hạn ngạch provider (Same Provider Quota Bucket)**, trừ khi người dùng đã explicitly cấu hình các khóa đó vào cùng 1 Quota Group cụ thể.
   - Nếu các khóa được đăng ký tự động/ngầm định chỉ dựa trên chuỗi `projectId` do người dùng khai báo mà không có cấu hình explicit group, hệ thống coi chúng là các bucket độc lập để tránh nghẽn oan.
2. **Nếu group mang trạng thái `providerVerifiedProject`**:
   - Hệ thống đảm bảo 100% các khóa thuộc cùng một Provider Quota Bucket được điều phối nhịp độ chung theo hạn ngạch xác thực.
3. **Nếu group mang trạng thái `unknownProject`**:
   - Áp dụng cơ chế cô lập an toàn mặc định (Default Fallback Isolation).

**Why this priority**: Tránh tình trạng điều phối nhầm rate-limit/pacing khi 2 API key thuộc 2 tài khoản Google khác nhau nhưng người dùng vô tình đặt cùng tên project `my-project`.

---

## Acceptance Scenarios (4 Mandatory Test Scenarios) *(mandatory)*

1. **Scenario 1 (Same Declared Project)**:
   - **Given**: 2 API keys cùng mang chuỗi `projectId = "prj-alpha"` do người dùng khai báo (`source = 'user'`).
   - **When**: Người dùng **không** tạo explicit group chung mà để hệ thống tự động quản lý.
   - **Then**: Hệ thống gán metadata `status = 'declared'`, `source = 'user'`; chỉ chia sẻ chung group/bucket nếu có explicit group configuration từ người dùng.
2. **Scenario 2 (Different Declared Project)**:
   - **Given**: 2 API keys với 2 `projectId` khác nhau (`"prj-alpha"` và `"prj-beta"`).
   - **When**: Đăng ký vào hệ thống.
   - **Then**: Hệ thống phân định thành 2 nhóm riêng biệt với metadata tương ứng.
3. **Scenario 3 (Provider Verified Project)**:
   - **Given**: Khóa API được xác thực chính thức từ Google GenAI API với `projectId = "verified-prj-123"`.
   - **When**: QuotaService cập nhật metadata.
   - **Then**: `source = 'provider'`, `status = 'verified'`, và được bảo đảm điều phối chung Provider Quota Bucket.
4. **Scenario 4 (Unknown Project)**:
   - **Given**: Khóa API không có thông tin project.
   - **When**: Đăng ký qua `ensureKeyGroup(key)`.
   - **Then**: `source = 'inferred'`, `status = 'unknown'`, mỗi key hoạt động trong bucket an toàn độc lập.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI định nghĩa rõ ràng kiểu dữ liệu `ProjectMetadata`:
  ```typescript
  export type ProjectBindingSource = 'user' | 'provider' | 'inferred';
  export type ProjectVerificationStatus = 'declared' | 'verified' | 'unknown';

  export interface ProjectMetadata {
    projectId?: string;
    source: ProjectBindingSource;
    status: ProjectVerificationStatus;
    verifiedAtMs?: number;
  }
  ```
- **FR-002**: `QuotaGroup` PHẢI chứa trường `projectMetadata?: ProjectMetadata`.
- **FR-003**: Khi đăng ký QuotaGroup qua `registerQuotaGroup`, nếu `projectMetadata` không được truyền vào tường minh:
  - Nếu có `input.projectId`: Gán `source = 'user'`, `status = 'declared'`.
  - Nếu không có `input.projectId`: Gán `source = 'inferred'`, `status = 'unknown'`.
- **FR-004**: Cung cấp API cập nhật xác minh dự án `verifyGroupProject(groupId: string, verifiedProjectId: string)`:
  - Cập nhật `projectId = verifiedProjectId`, `source = 'provider'`, `status = 'verified'`, `verifiedAtMs = Date.now()`.
- **FR-005**: Bộ lập lịch Scheduler PHẢI phân biệt giữa `userDeclaredProject` và `providerVerifiedProject` khi đánh giá quota bucket.
- **FR-006**: Toàn bộ 4 kịch bản kiểm thử bắt buộc (`same declared project`, `different declared project`, `provider verified project`, `unknown project`) PHẢI được cài đặt và pass 100%.
- **FR-007**: Không gây breaking changes cho các API hiện hữu (`/api/quota/groups`, `/api/quota/status`).
- **FR-008**: Vượt qua toàn diện Quality Gates của Hiến pháp (`npm run lint`, `npm test`, `npm run build`).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% Quota Groups có metadata nguồn gốc và trạng thái xác minh dự án chuẩn xác.
- **SC-002**: 0% suy diễn sai về Provider Quota Bucket khi chỉ có `userDeclaredProject`.
- **SC-003**: Toàn bộ 4 ca kiểm thử bắt buộc đạt tỉ lệ pass 100%.
- **SC-004**: Vượt qua toàn diện Quality Gates của Hiến pháp (`npm run lint`, `npm test`, `npm run build`) với 0 lỗi.

---

## Assumptions

- Thông tin `projectId` do người dùng nhập là khai báo mức logic (user-declared) trừ khi có API introspection hoặc provider probe xác minh.
