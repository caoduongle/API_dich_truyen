# Feature Specification: Fix CSP Gemini Model Discovery & Pacing Interval Delay

**Feature Branch**: `083-fix-csp-pacing-delay`  
**Created**: 2026-08-28  
**Status**: Draft  
**Input**: User description: "Ảnh chụp màn hình ghi nhận 2 vấn đề kỹ thuật đang diễn ra đồng thời: Lỗi chặn kết nối do Content Security Policy (CSP) gây ra lỗi Failed to fetch khi kiểm tra model, và Lỗi logic điều phối nhịp độ hiển thị giá trị âm (-4445ms/call)."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cho phép kết nối trực tiếp đến Gemini API mà không bị chặn bởi Content Security Policy (Priority: P1) 🎯 MVP

**As a** người dùng dịch thuật và quản trị API Key trên ứng dụng,  
**I want** trình duyệt được phép gửi yêu cầu trực tiếp đến Google Gemini API (bao gồm kiểm tra danh sách model và dịch thuật trực tiếp),  
**So that** tôi có thể kiểm tra model, khám phá danh sách model AI và dịch truyện ổn định mà không bị chính sách bảo mật trình duyệt (CSP) chặn kết nối dẫn đến lỗi `Failed to fetch`.

**Why this priority**: Hiện tại trong môi trường production, chính sách bảo mật CSP `connect-src` thiếu domain của Google Gemini API (`generativelanguage.googleapis.com`), khiến tất cả các tác vụ kết nối trực tiếp từ trình duyệt (như lấy danh sách model, kiểm tra model của từng API key) bị trình duyệt chặn hoàn toàn. Đây là lỗi nghiêm trọng làm gián đoạn tính năng khám phá và kiểm tra model.

**Independent Test**: Chạy ứng dụng với cấu hình bảo mật production (bật CSP), nhấn nút "Kiểm tra Model" trên từng API key hoặc mở danh sách model, xác nhận request kết nối đến `generativelanguage.googleapis.com` diễn ra thành công với 0 lỗi vi phạm CSP trong console trình duyệt.

**Acceptance Scenarios**:

1. **Given** ứng dụng đang chạy trong môi trường production có bật CSP, **When** người dùng nhấn nút "Kiểm tra Model" hoặc hệ thống tự động tải danh sách model trực tiếp từ Google Gemini API, **Then** yêu cầu kết nối mạng gửi đến `https://generativelanguage.googleapis.com` hoàn tất thành công mà không bị chặn bởi CSP `connect-src`.
2. **Given** cấu hình bảo mật máy chủ, **When** kiểm tra tiêu đề `Content-Security-Policy` ở môi trường production, **Then** chỉ thị `connect-src` bao gồm `https://generativelanguage.googleapis.com` cùng các domain Google cần thiết khác (`https://accounts.google.com`, `https://oauth2.googleapis.com`, `https://www.googleapis.com`, `https://content.googleapis.com`, `https://apis.google.com`).
3. **Given** bộ kiểm thử bảo mật của máy chủ (`securityHeaders.test.ts`), **When** chạy kiểm thử, **Then** kiểm thử xác nhận `connect-src` chứa chính xác `https://generativelanguage.googleapis.com`.

---

### User Story 2 - Chuẩn hóa hiển thị thời gian điều phối không bị số âm (Priority: P1)

**As a** người dùng theo dõi hạn mức và trạng thái Quota Group,  
**I want** thông số thời gian điều phối (Pacing Interval / Delay) luôn hiển thị giá trị hợp lệ không âm,  
**So that** tôi nhìn thấy trạng thái "Sẵn sàng" hoặc khoảng cách an toàn chính xác thay vì các con số âm gây khó hiểu như `-4445ms/call`.

**Why this priority**: Khi thời điểm an toàn dự kiến đã trôi qua trong quá khứ (key/group đã sẵn sàng gọi ngay), phép trừ thời gian cho ra kết quả âm và hiển thị trực tiếp lên giao diện người dùng (`-4445ms/call`), gây hiểu nhầm về độ trễ và làm giảm chất lượng trải nghiệm người dùng.

**Independent Test**: Mở bảng điều khiển hạn mức (Quota Usage Panel) khi các key/group đang ở trạng thái nhàn rỗi (sẵn sàng gọi ngay), xác minh mục "Điều phối" hiển thị nhãn "Sẵn sàng" hoặc khoảng thời gian hợp lệ $\ge 0\text{ms}$, hoàn toàn không có số âm.

**Acceptance Scenarios**:

1. **Given** một Quota Group hoặc API Key đã sẵn sàng thực hiện yêu cầu ngay (thời gian trễ $\le 0$), **When** hiển thị thông tin điều phối trên giao diện, **Then** hệ thống chuẩn hóa giá trị với cận dưới là $0$ và hiển thị nhãn trạng thái rõ ràng ("Sẵn sàng" hoặc thời lượng $\ge 0\text{ms}$).
2. **Given** một Quota Group có nhịp độ điều phối chu kỳ định trước (ví dụ ~4445ms), **When** hiển thị trên thẻ nhóm quota, **Then** giá trị khoảng cách an toàn hiển thị là số dương (`~4445ms/call`).
3. **Given** bất kỳ giá trị delay hoặc interval nào đưa vào hàm tính toán/render giao diện, **When** giá trị là số âm hoặc không hợp lệ, **Then** giá trị tự động được đưa về $\ge 0$ trước khi trình bày cho người dùng.

---

### User Story 3 - Cải thiện thông báo lỗi và phân loại lỗi kết nối Gemini API (Priority: P2)

**As a** người dùng thao tác cấu hình API và kiểm tra model,  
**I want** nhận được thông báo lỗi rõ ràng, dễ hiểu khi xảy ra sự cố kết nối mạng hoặc vi phạm chính sách trình duyệt,  
**So that** tôi hiểu ngay nguyên nhân sự cố (mạng / CSP / API Key) và biết cách xử lý thay vì chỉ thấy thông báo mơ hồ như `Failed to fetch`.

**Why this priority**: Khi trình duyệt chặn request hoặc gặp lỗi mạng, `fetch` thường chỉ trả về lỗi generic `TypeError: Failed to fetch`. Cung cấp thông điệp cụ thể giúp người dùng phân biệt giữa lỗi mạng/chính sách bảo mật và lỗi sai API key / model không tồn tại.

**Independent Test**: Giả lập lỗi mạng hoặc lỗi kết nối khi gọi kiểm tra model, xác nhận giao diện thông báo lỗi hiển thị mô tả rõ ràng, hướng dẫn người dùng kiểm tra kết nối mạng hoặc chính sách bảo mật thay vì chỉ in lỗi thô.

**Acceptance Scenarios**:

1. **Given** thao tác kiểm tra danh sách model hoặc xác minh model gặp lỗi kết nối trình duyệt (`Failed to fetch` hoặc lỗi mạng), **When** hệ thống bắt lỗi, **Then** thông điệp trả về người dùng giải thích rõ ràng "Không thể kết nối đến Gemini API (Vui lòng kiểm tra mạng hoặc chính sách CSP)" kèm mã trạng thái phù hợp.
2. **Given** giao diện cấu hình API Key và bảng Quota, **When** hiển thị thông báo lỗi kiểm tra model, **Then** lỗi được hiển thị trực quan, dễ đọc, không phá vỡ bố cục giao diện.

---

## Edge Cases

- **Môi trường Development vs Production**: Trong môi trường development (chạy Vite HMR), CSP được tắt để phục vụ live-reload, nhưng môi trường production bật CSP đầy đủ. Đảm bảo cấu hình CSP trong production bao phủ đầy đủ tất cả các endpoint mà client gọi tới.
- **Giá trị Delay âm do độ lệch đồng hồ (Clock Skew) hoặc trễ lịch sử**: Khi thời điểm `targetNextCallTime` đã qua, hiệu số với thời gian thực tế `Date.now()` là số âm. Cần bọc `Math.max(0, ...)` ở mọi điểm tính toán hiển thị và cấp phát lease.
- **API Key chưa cấu hình hoặc rỗng**: Khi người dùng chưa nhập API key hoặc danh sách key rỗng, nút kiểm tra model cần bị vô hiệu hóa hoặc thông báo yêu cầu nhập key trước.
- **Gemini API trả về lỗi 4xx/5xx khác (như 403 Forbidden, 429 Quota Exceeded)**: Hệ thống phải giữ nguyên thông báo chi tiết từ API Google thay vì gộp chung vào lỗi kết nối CSP.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống máy chủ MUST khai báo đầy đủ domain `https://generativelanguage.googleapis.com` trong chỉ thị `connect-src` của Content Security Policy (CSP) ở môi trường production.
- **FR-002**: Toàn bộ các request gọi trực tiếp từ client đến Gemini API (gồm danh sách model, xác minh model, và dịch trực tiếp) MUST được phép kết nối qua mạng mà không bị CSP chặn.
- **FR-003**: Bộ kiểm thử bảo mật tiêu đề HTTP (`securityHeaders.test.ts`) MUST bao gồm kiểm tra sự tồn tại của `https://generativelanguage.googleapis.com` trong `connect-src`.
- **FR-004**: Giao diện hiển thị nhịp độ điều phối (Pacing Interval / Delay) tại Quota Panel và các thành phần liên quan MUST chuẩn hóa giá trị hiển thị không âm ($\ge 0$).
- **FR-005**: Khi thời gian chờ điều phối bằng 0 hoặc nhỏ hơn 0, giao diện MUST hiển thị trạng thái "Sẵn sàng" hoặc định dạng ms hợp lệ (không bao giờ hiển thị số âm dạng `-Xms`).
- **FR-006**: Khi tác vụ kiểm tra model trực tiếp từ client gặp lỗi kết nối trình duyệt (`Failed to fetch` / `SecurityError`), hệ thống MUST cung cấp thông điệp lỗi thân thiện giải thích khả năng lỗi mạng hoặc chính sách bảo mật CSP.
- **FR-007**: Giao diện Quota Panel và API Settings MUST hiển thị thông báo lỗi kiểm tra model một cách trực quan, rõ ràng cho từng API Key.

### Key Entities

- **Security Headers Configuration**: Cấu hình các tiêu đề bảo mật HTTP của máy chủ bao gồm Helmet, Content-Security-Policy (`connect-src`, `script-src`, `style-src`, `frame-src`, etc.), và Cross-Origin-Opener-Policy.
- **Quota Group Scheduling Hint**: Đối tượng chứa thông số nhịp độ điều phối an toàn (`effectiveIntervalMs`, `safetyFloorMs`, `source`) của từng nhóm hạn mức quota.
- **Model Discovery / Inspection State**: Trạng thái kiểm tra, danh sách model được phát hiện, và thông tin lỗi tương ứng cho từng API key.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các yêu cầu kiểm tra danh sách model (`listModelsDirect`) và gọi model Gemini từ client hoàn tất thành công trong môi trường production với 0 lỗi vi phạm CSP `connect-src` trên console trình duyệt.
- **SC-002**: 0% trường hợp giao diện hiển thị giá trị thời gian điều phối là số âm trên toàn bộ các thẻ hạn ngạch Quota Group.
- **SC-003**: 100% các trường hợp lỗi kết nối mạng / CSP khi kiểm tra model hiển thị thông báo thân thiện rõ ràng giúp người dùng chẩn đoán nguyên nhân.
- **SC-004**: Toàn bộ kiểm thử chất lượng (`tsc --noEmit`, `vitest run`, `vite build`) vượt qua 100% không có lỗi.

---

## Assumptions

- Ứng dụng hỗ trợ cơ chế dịch trực tiếp từ trình duyệt đến Google Gemini REST API (`https://generativelanguage.googleapis.com/v1beta/...`) bằng header `x-goog-api-key`.
- Người dùng đã cung cấp API key Gemini hợp lệ khi thực hiện kiểm tra model.
- Cấu hình CSP được quản lý thông qua thư viện `helmet` ở backend Express (`server.ts`).
