# Feature Specification: Mã Hóa Khóa API Khi Lưu Trữ (API Key Encryption at Rest)

**Feature Branch**: `042-api-key-encryption-at-rest`  
**Created**: 2026-08-20  
**Status**: Draft  
**Input**: User description: "TASK 05 — API KEY ENCRYPTION AT REST. Mục tiêu: API key không được lưu plaintext trong Redis/server session. Audit: server/services/sessionStore.ts, Redis serialization, session creation, session retrieval, logging, error handling. Desired flow: API key -> server-side encryption -> Redis ciphertext. Encryption key: environment/deployment secret, không nằm trong Redis. Security requirements: API key không được xuất hiện plaintext trong Redis, logs, URL, errors, response payload trừ đúng nơi user cần nhập key. Migration: Sessions cũ chứa plaintext: detect old format -> encrypt -> store encrypted -> remove plaintext representation, không làm crash active session. Tests: encrypt, decrypt, wrong key, corrupted ciphertext, migration, redaction."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mã Hóa Xác Thực API Key Trước Khi Lưu Trữ Vào Redis / Memory (Priority: P1) 🎯 MVP

Khi người dùng khởi tạo hoặc cập nhật phiên làm việc chứa danh sách khóa API, máy chủ phải thực hiện mã hóa xác thực đối xứng (Authenticated Encryption using AES-256-GCM) ngay tại tầng ứng dụng trước khi tuần tự hóa và ghi vào Redis hoặc bộ nhớ máy chủ. Khóa mã hóa chính (Master Encryption Key) được nạp trực tiếp từ biến môi trường của hệ điều hành / deployment secret và tuyệt đối không bao giờ được lưu trữ hay ghi đè vào Redis.

**Why this priority**: Bảo vệ dữ liệu nhạy cảm của người dùng (API Keys) trong trường hợp Redis bị truy cập trái phép, rò rỉ bộ nhớ hoặc dump dữ liệu.

**Independent Test**: Khởi tạo session với mảng khóa `["AIzaSyKey123"]` $\to$ Chuỗi lưu trong Redis có cấu trúc ciphertext `enc:v1:<iv>:<authTag>:<ciphertext>` và không chứa bất kỳ chuỗi con plaintext nào của API key.

**Acceptance Scenarios**:
1. **Scenario 1.1 (Encryption at Rest)**: **Given** danh sách API keys hợp lệ, **When** gọi `sessionStore.createSession(apiKeys)`, **Then** dữ liệu ghi vào Redis là bản mã AES-256-GCM có nhãn phiên bản `enc:v1:`.
2. **Scenario 1.2 (Decryption on Retrieval)**: **Given** session token hợp lệ, **When** gọi `sessionStore.getSessionKeys(sessionToken)`, **Then** hệ thống giải mã chính xác danh sách API keys gốc để phục vụ các yêu cầu gọi AI.

---

### User Story 2 - Nâng Cấp Tự Động & Xóa Bỏ Dữ Liệu Plaintext Cũ (Zero-Downtime Lazy Migration) (Priority: P1) 🎯 MVP

Khi hệ thống tiếp nhận một phiên làm việc cũ đang lưu trữ dưới định dạng plaintext (hoặc định dạng v0 cũ không có nhãn phiên bản `enc:v1:`), hệ thống phải tự động nhận diện, giải mã/đọc dữ liệu, mã hóa lại sang chuẩn bảo mật mới `enc:v1:` và ghi đè cập nhật vào Redis mà không làm gián đoạn phiên làm việc của người dùng (Zero-Downtime Migration). Sau khi nâng cấp, toàn bộ dữ liệu plaintext cũ bị xóa bỏ hoàn toàn khỏi Redis.

**Why this priority**: Đảm bảo quá trình triển khai cập nhật hệ thống diễn ra mượt mà, không làm đăng xuất hay gián đoạn các luồng dịch thuật đang chạy của người dùng hiện hữu.

**Independent Test**: Giả lập một session cũ chứa plaintext JSON `["AIzaSyOldPlaintextKey"]` trong Redis $\to$ Gọi `getSessionKeys` $\to$ Trả về đúng key, đồng thời dữ liệu trong Redis được tự động cập nhật thành ciphertext `enc:v1:...`.

**Acceptance Scenarios**:
1. **Scenario 2.1 (Legacy Detection & Upgrade)**: **Given** session cũ chứa plaintext, **When** người dùng thực hiện request tiếp theo, **Then** hệ thống đọc thành công, tự động mã hóa chuẩn `enc:v1:` và ghi đè lại vào Redis.
2. **Scenario 2.2 (No Active Session Crash)**: **Given** các session cũ đang hoạt động, **When** di trú dữ liệu, **Then** không xảy ra lỗi crash hoặc từ chối dịch vụ.

---

### User Story 3 - Kiểm Soát Tính Toàn Vẹn & Từ Chối An Toàn (Tamper Proofing & Secure Failure) (Priority: P1) 🎯 MVP

Sử dụng cơ chế xác thực Authentication Tag của thuật toán AES-256-GCM để đảm bảo tính toàn vẹn của dữ liệu. Nếu ciphertext bị sửa đổi, cắt xén hoặc khi giải mã bằng sai Master Encryption Key, hệ thống phải phát hiện ngay lập tức, từ chối an toàn (fail-safe) và ném lỗi được chuẩn hóa mà không làm sập tiến trình máy chủ, không làm lộ các byte khóa hay bản mã thô ra ngoài.

**Why this priority**: Ngăn chặn các cuộc tấn công thay đổi bản mã (ciphertext tampering) và xử lý an toàn khi cấu hình sai khóa bí mật giữa các môi trường.

**Independent Test**:
- Chỉnh sửa 1 byte trong ciphertext $\to$ `decryptApiKeys` phát hiện lỗi xác thực GCM Authentication Tag và từ chối.
- Cung cấp sai Master Key $\to$ từ chối giải mã an toàn mà không làm sập ứng dụng.

**Acceptance Scenarios**:
1. **Scenario 3.1 (Wrong Key Rejection)**: **Given** Master Key không khớp, **When** giải mã session, **Then** hệ thống từ chối an toàn và trả về lỗi chuẩn hóa.
2. **Scenario 3.2 (Corrupted Ciphertext Rejection)**: **Given** ciphertext bị biến dạng, **When** giải mã, **Then** GCM integrity check kích hoạt và từ chối xử lý.

---

### User Story 4 - Che Giấu Tuyệt Đối Khóa API Khỏi Logs, Errors, URLs & Payloads (Zero-Leak Redaction) (Priority: P2)

Đảm bảo API keys và Master Encryption Key không bao giờ xuất hiện ở dạng plaintext trong:
- Nhật ký hệ thống (Console Logs / File Logs).
- Thông báo lỗi và Stack Traces trả về cho Client.
- URL Query Parameters (ngăn chặn rò rỉ qua access logs / reverse proxy).
- Response JSON Payload của các API endpoints (chỉ trả về masked key `AIzaSy...1234` hoặc key count).

**Why this priority**: Tuân thủ tiêu chuẩn an toàn thông tin OWASP, ngăn chặn rò rỉ khóa bí mật qua các kênh giám sát hoặc nhật ký trung gian.

**Independent Test**: Kiểm tra toàn bộ phản hồi API và nhật ký viễn trắc $\to$ không chứa bất kỳ chuỗi API key đầy đủ nào.

---

### Edge Cases

- **Master Key rỗng hoặc không được cấu hình**: Tự động sinh dẫn xuất từ salt an toàn nội bộ kèm cảnh báo `WARN` trong môi trường phát triển (Development), yêu cầu bắt buộc `ENCRYPTION_MASTER_KEY` khi chạy Production.
- **Session chứa mảng rỗng `[]`**: Mã hóa và giải mã chuẩn xác mảng rỗng mà không gây lỗi phân tích cú pháp JSON.
- **Dữ liệu trong Redis bị null/undefined**: Trả về `null` an toàn mà không phát sinh ngoại lệ `TypeError`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI mã hóa toàn bộ API keys trước khi lưu vào Redis hoặc bộ nhớ máy chủ bằng thuật toán mã hóa xác thực đối xứng **AES-256-GCM**.
- **FR-002**: Định dạng bản mã lưu trữ PHẢI có cấu trúc phong bì phiên bản chuẩn (**Cipher Envelope Format**):
  $$\text{enc:v1:}\langle\text{iv\_hex}\rangle\text{:}\langle\text{authTag\_hex}\rangle\text{:}\langle\text{ciphertext\_hex}\rangle$$
- **FR-003**: Master Encryption Key PHẢI được lấy từ biến môi trường `ENCRYPTION_MASTER_KEY` (hoặc `SESSION_SECRET`) thông qua thuật toán tạo khóa phái sinh an toàn `scrypt` (32 bytes key + cố định salt an toàn).
- **FR-004**: Master Encryption Key TUYỆT ĐỐI KHÔNG ĐƯỢC lưu trữ hoặc ghi đè vào Redis hay gửi ra ngoài Client.
- **FR-005**: Hệ thống PHẢI có cơ chế **Lazy Migration** tự động: khi đọc session cũ có chứa dữ liệu plaintext hoặc định dạng v0 cũ, hệ thống phải giải mã/đọc thành công, tự động mã hóa lại theo định dạng `enc:v1:` và lưu đè lại vào Redis nhằm xóa bỏ vĩnh viễn dữ liệu plaintext cũ.
- **FR-006**: Quá trình di trú dữ liệu (Migration) TUYỆT ĐỐI KHÔNG ĐƯỢC làm gián đoạn hoặc crash các phiên làm việc đang hoạt động của người dùng.
- **FR-007**: Khi giải mã gặp lỗi do sai Master Key hoặc ciphertext bị can thiệp/hỏng hóc, hệ thống PHẢI xử lý an toàn (fail-safe), ghi log ẩn danh và từ chối phiên làm việc mà không làm sập tiến trình Node.js.
- **FR-008**: Toàn bộ API keys PHẢI được che giấu (redacted/masked) khỏi logs, stack traces, URL parameters, và response JSON payloads (chỉ trả về `keyCount` hoặc masked key `AIzaSy...1234`).
- **FR-009**: Endpoint `/api/session-keys` và `/api/session-keys/status` TUYỆT ĐỐI KHÔNG nhận session token hoặc api keys qua URL query parameters.
- **FR-010**: Toàn bộ 6 kịch bản kiểm thử bắt buộc (`encrypt`, `decrypt`, `wrong key`, `corrupted ciphertext`, `migration`, `redaction`) PHẢI được cài đặt và pass 100%.

---

### Key Entities

- **CipherEnvelope**: Cấu trúc bản mã xác thực:
  - `version: string`: Phiên bản thuật toán mã hóa (ví dụ: `v1`)
  - `iv: Buffer`: Vector khởi tạo ngẫu nhiên 12 bytes
  - `authTag: Buffer`: Thẻ xác thực tính toàn vẹn 16 bytes của GCM
  - `ciphertext: string`: Chuỗi bản mã hex
- **EncryptedSessionData**: Bản ghi phiên làm việc trong Redis:
  - `encryptedKeys: string`: Chuỗi phong bì bản mã `enc:v1:<iv>:<authTag>:<ciphertext>`
  - `createdAt: number`: Thời điểm tạo phiên (epoch ms)
  - `lastAccessedAt: number`: Thời điểm truy cập gần nhất (epoch ms)
  - `expiresAt: number`: Thời điểm hết hạn phiên (epoch ms)

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dữ liệu session mới lưu vào Redis đều mang định dạng bản mã `enc:v1:...` (0% dữ liệu plaintext trong Redis).
- **SC-002**: 100% session cũ chứa plaintext được tự động nâng cấp sang bản mã `enc:v1:` ngay trong lần truy cập đầu tiên với tỉ lệ gián đoạn 0% (Zero Active Session Crash).
- **SC-003**: 100% các trường hợp ciphertext bị can thiệp hoặc sai khóa đều bị phát hiện và từ chối an toàn bởi GCM integrity check.
- **SC-004**: Toàn bộ 6 ca kiểm thử bắt buộc (`encrypt`, `decrypt`, `wrong key`, `corrupted ciphertext`, `migration`, `redaction`) đạt tỉ lệ pass 100%.
- **SC-005**: Vượt qua toàn diện Quality Gates của Hiến pháp (`npm run lint`, `npm test`, `npm run build`) với 0 lỗi.

---

## Assumptions

- Thuật toán `AES-256-GCM` với IV ngẫu nhiên 12 bytes và Auth Tag 16 bytes là tiêu chuẩn công nghiệp hiện đại bảo đảm cả tính bảo mật (Confidentiality) lẫn tính toàn vẹn (Integrity).
- Khóa bí mật phái sinh qua `scrypt` với 32 bytes đảm bảo chống tấn công brute-force và rainbow tables.
