# Feature Specification: Unified Model Registry, Quota-Aware Scheduling & System Resilience

**Feature Branch**: `013-model-quota-resilience`  
**Created**: 2026-08-19  
**Status**: Draft  
**Input**: User description: "/speckit-specify # ANTIGRAVITY TASK PACK — API_dich_truyen"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Đồng Bộ Hóa Danh Mục Model Toàn Hệ Thống (Unified Model Registry & Lifecycle) (Priority: P1) 🎯 MVP

Là người dùng dịch tiểu thuyết và quản trị viên hệ thống, tôi muốn chọn bất kỳ mô hình AI nào (preset có sẵn, discovered tự động từ Google API, hoặc custom model do tôi tự cấu hình và kiểm chứng) và có thể sử dụng mô hình đó xuyên suốt từ giao diện cấu hình cho tới backend xử lý dịch thuật, sao cho backend và frontend luôn chia sẻ cùng một định nghĩa chuẩn xác về danh mục model, trạng thái vòng đời (active, deprecated, shutdown) và năng lực xử lý (capabilities), ngăn chặn việc backend từ chối vô cớ các model hợp lệ hoặc chấp nhận các model tùy tiện không an toàn.

**Why this priority**: Hiện tại backend còn tồn tại các whitelist tĩnh/cứng hoặc phân mảnh kiểm tra model khiến các model mới được phát hiện (discovered) hoặc custom verified bị từ chối ở tầng dịch thuật, hoặc các model đã bị Google khai tử (shutdown) vẫn hiển thị làm model mặc định.

**Independent Test**:
1. Thêm/khám phá một model mới hợp lệ (ví dụ: `gemini-2.5-flash` hoặc custom model đã verify).
2. Chọn model này trong giao diện Cấu hình AI và lưu thiết lập.
3. Gửi lệnh dịch một đoạn văn / một chương truyện.
4. Xác nhận backend chấp nhận model, ghi nhận thống kê và thực hiện dịch thành công qua Gemini API.
5. Gửi một request dịch với `model` giả mạo tùy ý không tồn tại/chưa verify (ví dụ: `malicious-model-id`); xác nhận backend lập tức từ chối với mã lỗi rõ ràng.
6. Khi một model chuyển sang trạng thái `deprecated`, UI hiển thị cảnh báo và gợi ý model thay thế; khi chuyển sang `shutdown`, hệ thống tự động di chuyển người dùng sang model mặc định/thay thế an toàn mà không làm ứng dụng bị lỗi.

**Acceptance Scenarios**:
1. **Given** một model thuộc nguồn preset, discovered hoặc custom verified có capability `generateContent = true` và status `active`, **When** người dùng chọn model này và gửi yêu cầu dịch, **Then** backend xác thực thành công và tiến hành xử lý với Gemini.
2. **Given** một chuỗi model ID không rõ nguồn gốc hoặc chưa qua xác thực (unverified/malformed), **When** gửi trực tiếp lên API dịch thuật, **Then** backend từ chối với lỗi `MODEL_UNSUPPORTED` / `INVALID_REQUEST` trước khi gọi upstream API.
3. **Given** người dùng đã lưu cấu hình với một model cũ nay đã bị `shutdown`, **When** khởi động ứng dụng hoặc mở phiên làm việc, **Then** hệ thống phát hiện trạng thái không hợp lệ, tự động di chuyển sang `replacementId` hoặc model mặc định an toàn và thông báo cho người dùng.

---

### User Story 2 - Điều Phối API Key Thông Minh & Kiểm Soát Hạn Mức Tiên Lượng (Quota-Aware Scheduling & Predictive Admission Control) (Priority: P1) 🎯 MVP

Là người dùng có nhiều API key cá nhân, tôi muốn hệ thống phân bổ và điều phối từng request dịch vào API key phù hợp nhất dựa trên tình trạng hạn mức thực tế (RPM, TPM, RPD), thời gian chờ nhịp độ (pacing interval), lịch sử lỗi và trạng thái sẵn sàng (Key Health State), đồng thời dự toán lượng token đầu vào/đầu ra trước khi phát lệnh gọi để không bao giờ để một key bị quá tải dẫn đến lỗi 429 hàng loạt.

**Why this priority**: Cơ chế xoay vòng key đơn giản không nhận biết được sức chứa token (TPM) hay nhịp độ RPM của từng key, dẫn đến việc gửi nhầm request nặng vào key đang gần cạn quota hoặc vừa gặp sự cố, làm gián đoạn tiến trình dịch tự động.

**Independent Test**:
1. Cấu hình danh sách gồm nhiều API key với các hạn mức RPM/TPM khác nhau.
2. Gửi một chuỗi các request dịch chương truyện liên tiếp.
3. Quan sát hệ thống lựa chọn key tối ưu (ưu tiên key còn nhiều quota, ít lỗi, hỗ trợ model đang chọn).
4. Khi một key sắp chạm trần TPM trong cửa sổ 1 phút, hệ thống tự động định tuyến các request tiếp theo sang key khác còn dung lượng hoặc giãn nhịp an toàn thay vì gọi mù quáng gây 429.

**Acceptance Scenarios**:
1. **Given** danh sách ứng viên API key, **When** có request dịch đến, **Then** bộ điều phối loại bỏ các key bị disabled/cooldown/không hỗ trợ model, chấm điểm các key còn lại dựa trên quota còn lại, thời gian sử dụng gần nhất và lịch sử lỗi để chọn key tốt nhất.
2. **Given** một request có ước tính token vượt quá dung lượng TPM khả dụng của key hiện tại nhưng key khác còn dung lượng, **When** thực hiện admission control, **Then** request được điều phối sang key có dung lượng mà không làm tăng lỗi.
3. **Given** toàn bộ các key đều đã chạm ngưỡng hạn mức hoặc cooldown, **When** request đến, **Then** hệ thống đưa vào hàng đợi chờ nhịp độ hoặc trả về thông báo dung lượng rõ ràng, tuyệt đối không tạo retry storm.

---

### User Story 3 - Hàng Đợi Request Động, Phân Loại Lỗi & Tự Động Phục Hồi (Request Queue, Error Taxonomy & Circuit Breaker) (Priority: P1) 🎯 MVP

Là người dùng dịch tự động nhiều chương truyện liên tục, tôi muốn các yêu cầu dịch được quản lý qua một hàng đợi có cấu trúc rõ ràng (hỗ trợ kiểm soát đồng thời, hủy tác vụ, timeout, bảo vệ quá tải backpressure), đi kèm bộ phân loại lỗi chuẩn hóa (Error Taxonomy) và cơ chế ngắt mạch (Circuit Breaker) để khi xảy ra sự cố mạng, 429 hay lỗi từ nhà cung cấp, hệ thống tự động áp dụng chiến lược xử lý chính xác (thử lại, chuyển key, tạm dừng làm nguội, hoặc dừng ngay) mà không làm tê liệt toàn bộ hàng đợi.

**Why this priority**: Việc xử lý lỗi dựa trên chuỗi regex rải rác và cơ chế chờ `sleep` tĩnh không có hàng đợi dễ dẫn đến kẹt tiến trình, retry mù quáng các lỗi không thể cứu vãn (như sai API key, vi phạm safety), hoặc gây tràn bộ nhớ khi lượng request tăng cao.

**Independent Test**:
1. Gửi đồng thời 20 request dịch chương vào hệ thống.
2. Kiểm tra hàng đợi điều phối thực thi theo mức độ ưu tiên và nhịp độ quy định mà không làm treo trình duyệt hay backend.
3. Giả lập lỗi mạng tạm thời hoặc 429; xác nhận hệ thống phân loại đúng mã lỗi (`NETWORK_ERROR`, `RATE_LIMITED`) và thực hiện retry có pacing hoặc xoay key.
4. Giả lập lỗi xác thực (`AUTH_FAILED`); xác nhận hệ thống ngưng dùng key hỏng ngay lập tức mà không retry vô ích.
5. Giả lập một model liên tục trả về lỗi 5xx; xác nhận Circuit Breaker chuyển sang trạng thái Open, tạm ngưng gửi request vào model đó và tự động thử lại sau chu kỳ cooldown (Half-Open) để phục hồi.

**Acceptance Scenarios**:
1. **Given** lỗi trả về từ upstream, **When** hệ thống tiếp nhận, **Then** chuẩn hóa thành `AIErrorCode` chuẩn mực và quyết định hành động chính xác (`retry`, `rotate_key`, `cooldown`, `disable_key`, hoặc `fail_immediately`).
2. **Given** một key/model gặp lỗi liên tiếp vượt ngưỡng cấu hình, **When** Circuit Breaker kích hoạt trạng thái `Open`, **Then** các request tiếp theo được chuyển hướng hoặc từ chối ngay lập tức với cảnh báo rõ ràng thay vì tiếp tục gửi request lỗi.
3. **Given** hàng đợi đạt ngưỡng sức chứa tối đa (queue depth limit), **When** nhận thêm request mới, **Then** hệ thống áp dụng backpressure từ chối an toàn kèm mã lỗi quá tải, bảo vệ an toàn bộ nhớ của server.

---

### User Story 4 - Hoạt Động Bền Bỉ Khi Redis Gặp Sự Cố (Redis Graceful Degradation) (Priority: P1) 🎯 MVP

Là quản trị viên và người dùng, tôi muốn hệ thống tiếp tục hoạt động an toàn và ổn định ngay cả khi dịch vụ Redis bị ngắt kết nối hoặc gặp trục trặc, bằng cách tự động chuyển sang cơ chế bảo vệ cục bộ trong bộ nhớ (bounded in-memory fallback rate limiting) cho các tác vụ then chốt (bao gồm bảo vệ 60 req/phút/IP), và tự động đồng bộ lại khi Redis khôi phục mà không làm sập ứng dụng hay rò rỉ bộ nhớ.

**Why this priority**: Sự phụ thuộc tuyệt đối vào Redis có thể biến Redis thành điểm nghẽn đơn lẻ (Single Point of Failure), khiến toàn bộ backend tê liệt khi Redis down hoặc mở toang mọi rào cản bảo vệ.

**Independent Test**:
1. Khởi động server với Redis đang chạy bình thường; kiểm tra rate limiting và quota hoạt động trên Redis.
2. Ngắt kết nối Redis đột ngột; gửi tiếp các request HTTP và request dịch thuật.
3. Xác nhận backend ghi nhận cảnh báo degraded mode, kích hoạt bộ giới hạn in-memory với dung lượng có kiểm soát (LRU/bounded), tiếp tục bảo vệ ngưỡng 60 RPM/IP và xử lý bản dịch bình thường.
4. Khôi phục kết nối Redis; xác nhận hệ thống tự động tái lập kết nối và chuyển dịch mượt mà về Redis distributed mode mà không cần khởi động lại server.

**Acceptance Scenarios**:
1. **Given** Redis bị mất kết nối, **When** có request gửi tới các endpoint nhạy cảm và dịch thuật, **Then** hệ thống chuyển sang bộ đếm in-memory cục bộ có giới hạn kích thước, ghi log cảnh báo suy giảm hiệu năng và vẫn đảm bảo rào chắn bảo vệ.
2. **Given** Redis kết nối lại thành công, **When** phát hiện tín hiệu sẵn sàng, **Then** hệ thống tự động phục hồi về distributed store mà không làm thất thoát dữ liệu đang xử lý.

---

### User Story 5 - Truy Vết Tác Vụ, Tính Bất Biến & Quan Sát Trực Quan (Tracing, Idempotency & Observability UI) (Priority: P2)

Là người dùng dịch truyện, tôi muốn mọi yêu cầu dịch đều có mã định danh duy nhất (`requestId`), hỗ trợ cơ chế chống trùng lặp (`Idempotency-Key`) để không bị dịch trùng hoặc tính phí hai lần khi mạng chập chờn hay bấm nhầm nút; đồng thời tôi có thể quan sát trực quan trạng thái sức khỏe từng API key (Healthy, RateLimited, QuotaExhausted, AuthFailed) và thông số khả dụng của model ngay trên giao diện Cấu hình và Bảng điều khiển Quota.

**Why this priority**: Giúp người dùng kiểm soát hoàn toàn quá trình dịch, tránh lãng phí hạn mức vì gửi trùng request, và tăng tính minh bạch trong việc chẩn đoán lỗi khi key bị gián đoạn.

**Independent Test**:
1. Gửi một request dịch kèm `Idempotency-Key`.
2. Gửi lại chính xác request đó trong khi request đầu đang chạy (pending); xác nhận nhận về cùng kết quả của request đang xử lý mà không gọi Gemini lần 2.
3. Gửi lại request sau khi đã hoàn thành (completed); xác nhận nhận về kết quả đã cache.
4. Mở modal Cấu hình AI / Quota Panel; quan sát huy hiệu trạng thái của từng API key (xanh/vàng/đỏ tương ứng Healthy/RateLimited/AuthFailed) và nhịp độ điều phối động.
5. Kiểm tra log hệ thống; xác nhận `requestId` xuất hiện xuyên suốt từ controller, scheduler đến response mà không lộ bất kỳ API key, token hay dữ liệu bí mật nào.

**Acceptance Scenarios**:
1. **Given** một yêu cầu dịch với `Idempotency-Key`, **When** có yêu cầu trùng lặp được gửi đến, **Then** hệ thống tái sử dụng tiến trình hoặc kết quả đã có, ngăn chặn gọi upstream API lặp lại.
2. **Given** nhật ký và telemetry của hệ thống, **When** ghi nhận thông tin request, **Then** chứa đầy đủ `requestId`, `modelId`, `keyIndex`, thời gian chờ, thời gian sinh token, và hoàn toàn khử/che giấu (redact) các thông tin nhạy cảm.
3. **Given** giao diện người dùng, **When** mở bảng Quota hoặc Model Selector, **Then** hiển thị đầy đủ ngữ cảnh (trạng thái key, TPM khả dụng, cảnh báo model deprecated và gợi ý thay thế) theo đúng bảng màu và quy chuẩn của Design System "Mực & Chu Sa".

---

### User Story 6 - Bộ Đệm Khám Phá Mô Hình Tối Ưu (Model Discovery Cache with Stale-While-Revalidate) (Priority: P2)

Là người dùng, tôi muốn danh sách model khả dụng từ Google API được hiển thị tức thì khi mở ứng dụng dựa trên bộ nhớ đệm an toàn, sau đó tự động làm mới ngầm (Stale-While-Revalidate) hoặc cho phép tôi bấm nút làm mới thủ công, giúp trải nghiệm mượt mà không phải chờ đợi và không làm tiêu hao quota discovery.

**Why this priority**: Việc gọi API discovery liên tục mỗi khi mở modal gây trễ giao diện và lãng phí request, trong khi việc không làm mới lại khiến người dùng không cập nhật được các model mới ra mắt.

**Independent Test**:
1. Mở Cấu hình AI lần đầu: danh sách model được tải và lưu vào cache cục bộ kèm thời gian TTL.
2. Đóng và mở lại Cấu hình AI: danh sách model hiển thị ngay lập tức từ cache.
3. Giả lập cache hết hạn: danh sách cũ vẫn hiển thị ngay lập tức trong khi hệ thống ngầm gọi discovery để cập nhật phiên bản mới.
4. Bấm nút "Làm mới danh mục model": hệ thống chủ động gọi discovery và cập nhật danh sách ngay lập tức.
5. Giả lập Google discovery bị lỗi tạm thời: hệ thống giữ nguyên danh sách hợp lệ đã cache mà không xóa sạch danh mục của người dùng.

**Acceptance Scenarios**:
1. **Given** danh mục model đã được lưu trong cache còn hạn hoặc vừa hết hạn, **When** người dùng mở giao diện, **Then** dữ liệu hiển thị tức thì không có độ trễ tải.
2. **Given** tiến trình discovery ngầm bị thất bại do lỗi mạng, **When** xử lý dữ liệu, **Then** hệ thống giữ lại danh mục đã cache an toàn và ghi nhận log cảnh báo nhẹ.

---

### User Story 7 - Khảo Sát & Kiến Trúc Xử Lý Bản Dịch Dài / Batch (Translation Processing Architecture) (Priority: P2)

Là kiến trúc sư hệ thống và lập trình viên, tôi muốn có sự phân định và đánh giá kiến trúc rõ ràng giữa luồng dịch trực tiếp đồng bộ (Synchronous Streaming / Direct Execution) và mô hình tác vụ bất đồng bộ (Job Architecture) cho các bản dịch dài hoặc dịch hàng loạt, đảm bảo tính đơn giản, trực quan và không sinh ra sự phức tạp quá mức nếu luồng đồng bộ kèm hàng đợi hiện tại vẫn đáp ứng tối ưu trải nghiệm người dùng.

**Why this priority**: Tránh triển khai hệ thống Job bất đồng bộ quá cồng kềnh nếu kiến trúc client-orchestrated queue kết hợp server-side rate-pacing hiện tại đã đảm bảo độ tin cậy và kiểm soát tốt tiến trình dịch từng chương.

**Independent Test**:
1. Đánh giá thời gian phản hồi trung bình của một chương (3 - 15 giây), kích thước batch thông thường và khả năng hiển thị tiến độ trực tiếp trên client.
2. Xác nhận cơ chế hàng đợi tự động trên client (`useAutoTranslationQueue`) kết hợp với backend request admission và idempotency đã giải quyết triệt để vấn đề gián đoạn mạng và browser timeout mà không cần tạo thêm một database job state phức tạp trên server.
3. Nếu duy trì mô hình hybrid (client queue + backend pacing & idempotency), cung cấp đầy đủ tài liệu kiến trúc và lý do kỹ thuật rõ ràng.

**Acceptance Scenarios**:
1. **Given** tài liệu kiến trúc hệ thống, **When** xem xét mô hình xử lý dịch thuật, **Then** có phân tích chi tiết định lượng chứng minh tính phù hợp của kiến trúc đồng bộ/hàng đợi kết hợp idempotency và pacing, đáp ứng đầy đủ tiêu chí không over-engineer.

---

### User Story 8 - Kiểm Thử Hợp Đồng & Bộ Kiểm Thử Hồi Quy Toàn Diện (Contract Tests & Regression Suite) (Priority: P1) 🎯 MVP

Là đội ngũ phát triển, tôi muốn có bộ kiểm thử hợp đồng (Contract Tests) giữa Frontend và Backend để đảm bảo hai bên luôn đồng thuận 100% về cấu trúc dữ liệu (`ModelDefinition`, `AIErrorCode`, `QuotaPayload`, `TranslationRequest/Response`), cùng một bộ kiểm thử hồi quy (Regression Suite) khóa chặt toàn bộ các bất biến kiến trúc quan trọng (từ phân bổ quota, rate limit 60 RPM/IP, đến chuyển đổi trạng thái key và fallback Redis), đảm bảo mọi thay đổi trong tương lai không làm tái phát các lỗi cũ.

**Why this priority**: Đảm bảo an toàn tuyệt đối cho toàn bộ hệ thống, tuân thủ nguyên tắc cốt lõi của Constitution: không bỏ sót lỗi type, không bỏ test, và toàn bộ `lint`, `test`, `build` phải pass 100%.

**Independent Test**:
1. Chạy bộ kiểm thử hợp đồng: xác nhận các schema và type chia sẻ giữa `src/` và `server/` khớp nhau hoàn toàn.
2. Chạy bộ kiểm thử hồi quy: xác nhận mọi kịch bản lỗi kiến trúc (như hardcode 4500ms, whitelist model tĩnh, mất quota khi Redis down, sai sót xử lý key) đều có test case bảo vệ và pass 100%.
3. Thực thi `npm run lint`, `npm test`, `npm run build`: toàn bộ quy trình hoàn tất không có cảnh báo hay lỗi nào.

**Acceptance Scenarios**:
1. **Given** bộ test suite, **When** chạy lệnh `npm test`, **Then** 100% test cases (bao gồm Unit, Integration, Contract và Regression) đều vượt qua.
2. **Given** toàn bộ mã nguồn, **When** chạy `npm run lint` và `npm run build`, **Then** hoàn thành sạch sẽ không có lỗi TypeScript hay build bundle.

---

### Edge Cases

- **Mô hình bị xóa hoặc không còn tồn tại trên Google AI**: Backend trả về `MODEL_NOT_FOUND` (không retry vô ích), thông báo người dùng chọn model khác và đánh dấu model là `shutdown`.
- **Tất cả API key đều bị cạn Quota hoặc Auth Failure**: Hệ thống ngưng dịch tự động ngay lập tức, hiển thị trạng thái cảnh báo trên UI kèm hướng dẫn người dùng bổ sung key hoặc chờ hết chu kỳ reset RPD/TPM.
- **Nhiều tab trình duyệt gửi request cùng lúc**: Backend rate limiter (kết hợp Redis hoặc in-memory fallback) và Idempotency cache xử lý an toàn, phân bổ theo IP/Session mà không gây xung đột dữ liệu.
- **Request dịch chứa nội dung nhạy cảm bị Google Safety Block**: Backend nhận diện mã lỗi `SAFETY_BLOCKED`, không retry mù quáng làm tốn quota, trả về phản hồi cụ thể để người dùng hiệu chỉnh văn bản nguồn.
- **Người dùng chỉnh sửa RPM/TPM tùy biến với giá trị bất thường (<= 0 hoặc cực lớn > 1000)**: Hệ thống tự động kẹp giá trị trong khoảng an toàn (RPM tối thiểu 1, interval tối thiểu 400ms server / 500ms client).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 (Canonical Model Definition)**: Hệ thống MUST sử dụng một cấu trúc dữ liệu chuẩn mực (`ModelDefinition`) đồng nhất giữa Frontend và Backend, bao gồm các trường: `id`, `label`, `source` (`"preset"` | `"discovered"` | `"custom"`), `status` (`"active"` | `"deprecated"` | `"shutdown"`), `capabilities` (`{ generateContent: boolean; structuredOutput?: boolean; vision?: boolean; thinking?: boolean }`), và `replacementId` tùy chọn.
- **FR-002 (Server-Side Model Validation)**: Backend MUST xác thực tính hợp lệ của mọi `model` được yêu cầu dịch dựa trên danh mục chuẩn (preset, discovered đã kiểm chứng, hoặc custom model đã qua bước verify), từ chối ngay lập tức các model tùy tiện không rõ nguồn gốc trước khi gọi Google API.
- **FR-003 (Model Lifecycle Handling)**:
  - Cho phép sử dụng đầy đủ các model có trạng thái `active`.
  - Hiển thị cảnh báo và gợi ý model thay thế cho các model `deprecated`.
  - Loại bỏ hoàn toàn model `shutdown` khỏi danh sách chọn mới và không dùng làm fallback/default.
  - Tự động di chuyển (migration) an toàn các cấu hình cũ đang trỏ vào model `shutdown` sang model mặc định hoặc `replacementId`.
- **FR-004 (Model Capability Layer)**: Mọi tác vụ dịch thuật MUST chỉ cho phép lựa chọn và thực thi với các model có `capabilities.generateContent === true`. Thông tin năng lực chỉ được trích xuất từ metadata chính thức của Google API hoặc preset đáng tin cậy.
- **FR-005 (Quota-Aware Scheduler)**: Bộ điều phối API key MUST quản lý trạng thái sức khỏe của từng key (`KeyHealth`), theo dõi RPM/TPM/RPD khả dụng, thời điểm sử dụng gần nhất, lịch sử lỗi và trạng thái cooldown để chấm điểm và lựa chọn key tối ưu nhất cho mỗi request.
- **FR-006 (Independent Rate Limits)**: Hệ thống MUST duy trì sự độc lập hoàn toàn giữa hai tầng:
  1. Tầng bảo vệ HTTP Anti-Abuse: `60 requests / minute / IP`.
  2. Tầng điều phối hạn mức Gemini theo từng API Key: Quản lý RPM/TPM/RPD và pacing động. Tuyệt đối không quy đồng hay biến đổi hai tầng này thành một.
- **FR-007 (Admission Control & Predictive TPM)**: Trước khi gửi request tới Google API, hệ thống MUST ước tính lượng token tiêu thụ đầu vào/đầu ra và kiểm tra tính khả thi của hạn mức TPM trên key dự định sử dụng. Nếu key không đủ dung lượng, tự động chuyển sang key khác còn sức chứa hoặc đưa vào hàng đợi điều phối nhịp độ.
- **FR-008 (Structured Request Queue)**: Triển khai hàng đợi xử lý request có cấu trúc hỗ trợ: kiểm soát độ sâu hàng đợi (queue depth limit), thời gian chờ tối đa (timeout), hủy tác vụ (cancellation), và cơ chế backpressure chống tràn bộ nhớ.
- **FR-009 (Error Taxonomy & Smart Retry)**: Chuẩn hóa toàn bộ lỗi từ upstream thành danh mục mã lỗi chuẩn (`AIErrorCode`: `RATE_LIMITED`, `QUOTA_EXCEEDED`, `AUTH_FAILED`, `MODEL_NOT_FOUND`, `MODEL_UNSUPPORTED`, `INVALID_REQUEST`, `SAFETY_BLOCKED`, `SERVER_ERROR`, `NETWORK_ERROR`, `TIMEOUT`). Định nghĩa bảng ánh xạ hành động xử lý chính xác cho từng loại lỗi mà không dùng so khớp chuỗi regex tùy tiện.
- **FR-010 (Circuit Breaker Protection)**: Tích hợp cơ chế ngắt mạch (Circuit Breaker) với các trạng thái `Closed`, `Open`, `Half-Open` để bảo vệ hệ thống khi một key hoặc model gặp sự cố lỗi liên tiếp, tự động cách ly và phục hồi sau khoảng thời gian cooldown.
- **FR-011 (Redis Graceful Degradation)**: Khi Redis mất kết nối, hệ thống MUST tự động chuyển sang bộ đếm cục bộ trong bộ nhớ (bounded in-memory rate limiter) với dung lượng có kiểm soát (LRU/Fixed-size), duy trì khả năng phục vụ và bảo vệ 60 RPM/IP, đồng thời tự động kết nối lại khi Redis sẵn sàng.
- **FR-012 (End-to-End Tracing & Safe Logging)**: Mỗi request MUST có một mã định danh `requestId` duy nhất được truyền xuyên suốt từ HTTP Controller, Scheduler, Key Selection đến Gemini Service và phản hồi cuối cùng. Mọi nhật ký (logs) MUST được lọc bỏ (redact) hoàn toàn các thông tin nhạy cảm (API keys, session tokens, prompt bí mật).
- **FR-013 (First-Class API Key Health)**: Quản lý trạng thái API key theo máy trạng thái xác định (`Healthy`, `Degraded`, `RateLimited`, `QuotaExhausted`, `AuthFailed`, `Cooldown`, `Disabled`) kèm quy tắc chuyển đổi và phục hồi rõ ràng.
- **FR-014 (Idempotency Support)**: Hỗ trợ tiêu đề `Idempotency-Key` cho các endpoint dịch thuật, tái sử dụng kết quả đang xử lý (in-flight) hoặc kết quả đã hoàn thành gần nhất, ngăn chặn việc gọi trùng lặp lên Gemini API.
- **FR-015 (Model Discovery Caching & SWR)**: Lưu trữ danh mục model khám phá từ Google API trong bộ nhớ đệm có thời hạn (TTL), áp dụng mô hình Stale-While-Revalidate để hiển thị tức thì trên giao diện và làm mới ngầm, bảo toàn danh mục đã cache nếu quá trình discovery gặp lỗi tạm thời.
- **FR-016 (Observability & Design System UI)**: Hiển thị trực quan trạng thái sức khỏe API key, hạn mức quota khả dụng, thông số nhịp độ điều phối và cảnh báo vòng đời model trên giao diện người dùng, tuân thủ nghiêm ngặt Bảng màu và Ngôn ngữ thiết kế "Mực & Chu Sa".
- **FR-017 (Contract Tests)**: Xây dựng bộ kiểm thử hợp đồng tự động xác thực tính tương thích cấu trúc dữ liệu giữa Frontend và Backend.
- **FR-018 (Comprehensive Regression Suite)**: Xây dựng bộ kiểm thử hồi quy bảo vệ toàn bộ các bất biến kiến trúc cốt lõi của hệ thống.

---

### Key Entities *(include if feature involves data)*

- **ModelDefinition**:
  - `id`: Định danh duy nhất của model (ví dụ: `gemini-2.5-flash`).
  - `label`: Tên hiển thị thân thiện với người dùng.
  - `source`: Nguồn gốc model (`preset` | `discovered` | `custom`).
  - `status`: Trạng thái vòng đời (`active` | `deprecated` | `shutdown`).
  - `capabilities`: Năng lực của model (`generateContent`, `structuredOutput`, `vision`, `thinking`).
  - `replacementId`: Mã model thay thế được khuyến nghị nếu model hiện tại bị deprecated hoặc shutdown.
  - `limits`: Hạn mức định mức mặc định hoặc cấu hình (RPM, TPM, RPD).

- **KeyHealthRecord**:
  - `keyId`: Định danh hoặc chỉ mục che giấu của API key.
  - `state`: Trạng thái sức khỏe (`Healthy`, `Degraded`, `RateLimited`, `QuotaExhausted`, `AuthFailed`, `Cooldown`, `Disabled`).
  - `rpmRemaining` / `tpmRemaining` / `rpdRemaining`: Hạn mức còn lại trong chu kỳ cửa sổ trượt.
  - `consecutiveErrors`: Số lỗi liên tiếp đã ghi nhận.
  - `cooldownUntil`: Mốc thời gian kết thúc làm nguội.
  - `lastUsedAt`: Mốc thời gian thực thi request gần nhất.
  - `supportedModels`: Tập hợp các model được hỗ trợ bởi key.

- **QueuedTranslationRequest**:
  - `requestId`: Mã định danh duy nhất của request.
  - `idempotencyKey`: Khóa chống trùng lặp từ client.
  - `modelId`: Model được yêu cầu.
  - `estimatedTokens`: Lượng token đầu vào/đầu ra dự toán.
  - `priority`: Mức độ ưu tiên của request.
  - `createdAt`: Thời điểm tạo yêu cầu trong hàng đợi.
  - `timeoutMs`: Thời gian chờ tối đa cho phép.

- **AIErrorNormalized**:
  - `code`: Mã phân loại lỗi chuẩn hóa (`AIErrorCode`).
  - `message`: Thông điệp lỗi an toàn cho người dùng.
  - `isRetryable`: Cờ xác định lỗi có thể thử lại hay không.
  - `recommendedAction`: Hành động gợi ý cho bộ điều phối (`retry`, `rotate_key`, `cooldown_key`, `disable_key`, `fail_immediately`).
  - `httpStatus`: Mã trạng thái HTTP tương ứng.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001 (Zero Architectural Drift)**: 100% các model hợp lệ (preset, discovered, custom verified) được frontend và backend công nhận đồng bộ; 0% model tùy ý không hợp lệ có thể vượt qua lớp bảo vệ backend.
- **SC-002 (Accurate Quota Protection)**: Loại bỏ hoàn toàn lỗi 429 do tràn TPM/RPM nhờ cơ chế Admission Control và Pacing động theo từng API key; 0% xung đột giữa HTTP Rate Limit (60 RPM/IP) và Gemini Key Scheduler.
- **SC-003 (Redis Fault-Tolerance)**: Hệ thống duy trì 100% khả năng phục vụ khi Redis ngừng hoạt động nhờ cơ chế in-memory fallback có kiểm soát dung lượng; tự động khôi phục trong vòng dưới 3 giây khi Redis hoạt động trở lại.
- **SC-004 (Duplicate Request Elimination)**: Triệt tiêu 100% các cuộc gọi Gemini trùng lặp phát sinh do mạng chập chờn hoặc bấm đúp nhờ cơ chế `Idempotency-Key`.
- **SC-005 (Model Discovery Performance)**: Giảm thời gian hiển thị danh sách Model Selector xuống dưới 50ms khi mở giao diện nhờ bộ đệm Stale-While-Revalidate.
- **SC-006 (Zero Secret Leakage)**: 100% nhật ký hệ thống, URL và phản hồi lỗi không chứa API key, session token hay nội dung văn bản nhạy cảm.
- **SC-007 (100% Quality Gates Passed)**:
  - `npm run lint` (`tsc --noEmit`) đạt 0 lỗi type.
  - `npm test` (`vitest run`) pass 100% toàn bộ test suites (Unit, Integration, Contract, Regression).
  - `npm run build` tạo bundle thành công không có lỗi.

---

## Assumptions

- **Môi trường triển khai**: Ứng dụng chạy trong môi trường đơn máy chủ hoặc cụm server Node.js/Express, kết nối với Redis (nếu có) và client React 19 trên trình duyệt hiện đại.
- **Hạn mức Google API**: Các thông số RPM/TPM/RPD tuân theo định mức chính thức của Google Gemini API đối với từng model tier (Free / Pay-as-you-go) hoặc giá trị tùy biến hợp lệ do người dùng cung cấp.
- **Tính toán Token**: Ước tính token trước khi gửi request dựa trên thuật toán heuristic/tokenizer nội bộ có sẵn trong codebase với hệ số an toàn (safety buffer) nhằm tránh sai số.
- **Bảo toàn Dữ liệu**: Mọi cấu hình lưu trữ trong IndexedDB của người dùng được duy trì ổn định, schema chỉ mở rộng tương thích ngược nếu cần thiết mà không phá hủy dữ liệu cũ.
