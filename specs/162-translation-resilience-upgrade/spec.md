# Feature Specification: Translation Resilience Upgrade (Adaptive Splitting, Safety Compliance & Lossless Fallback)

**Feature Branch**: `162-translation-resilience-upgrade`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "/speckit-specify /repo-engineering-review Tạo một feature specification để nâng cấp Translation Resilience của repository hiện tại. Mục tiêu: Cải thiện cơ chế adaptive recursive splitting hiện có để giảm retry không cần thiết, giảm kích thước context khi xảy ra lỗi, bảo toàn thứ tự và coverage của toàn bộ source, đồng thời tránh tạo thêm một Gemini client/pipeline riêng. Cấu hình an toàn tối đa cho tiểu thuyết mạng (getPermissiveSafetySettings BLOCK_NONE). Bắt buộc tuân thủ: AGENTS.md, Constitution, zero-backend, không tạo Gemini client thứ 2, không reframing né filter trái quyết định safety của provider, không đổi API key khi CONTENT_BLOCKED, outcome classification có cấu trúc, adaptive split boundary, retry chỉ trên branch lỗi, 100% source coverage, deterministic lossless fallback, bounded concurrency, AbortSignal, cumulative timeout, thống kê telemetry."

---

## 1. Problem Statement

Hệ thống dịch thuật tiểu thuyết mạng client-side hiện tại vận hành qua pipeline 3 giai đoạn (Phase 1: Dịch thô & trích xuất thực thể `rawTranslation.ts`, Phase 2: Chuốt văn phong `polishTranslation.ts`, Phase 3: QA kiểm định). Trong quá trình xử lý các chương truyện dài, chứa văn cảnh kiếm hiệp, huyền huyễn hoặc các cảnh giao tranh gay cấn, hệ thống gặp phải các vấn đề nghiêm trọng về tính bền vững (Resilience) và hiệu năng:

1. **Phân loại lỗi thiếu cấu trúc (Fragile Substring Matching)**:
   Bộ nhận diện lỗi tái thử phân đoạn `isAdaptiveSplitRetryableError` trong `src/services/translation/translationValidation.ts` phụ thuộc hoàn toàn vào việc dò tìm chuỗi ký tự (`msg.includes('bộ lọc an toàn')`, `msg.includes('SAFETY')`, `msg.includes('UNTRANSLATED_CHINESE_LEFTOVER')`). Khi định dạng lỗi từ SDK hoặc Google API thay đổi, hoặc khi các ngoại lệ cấu trúc (`GeminiRequestError`) được ném ra, cơ chế này dễ bỏ sót lỗi hoặc kích hoạt phân đoạn sai lệch.

2. **Lãng phí Quota do xoay vòng khóa và tái thử khi bị chặn nội dung (Deterministic Content Block Retries)**:
   Mặc dù tầng client cấp thấp (`geminiClient.ts`) đã chặn xoay vòng API key khi gặp lỗi `CONTENT_BLOCKED`, ở tầng dịch thuật (`rawTranslation.ts`), thuật toán chia đoạn vẫn áp dụng cơ chế dịch chuyển chỉ số khóa (`(currentKeyIdx + i) % apiKeys.length`) và thử lại cùng một mẫu câu mà không phân biệt giữa lỗi ngẫu nhiên/nhất thời (transient 429/503) và lỗi tất định do chính nội dung kích hoạt bộ lọc của nhà cung cấp.

3. **Nguy cơ mất mát dữ liệu nguồn và lệch ranh giới khi chia tách (Loss of Source Coverage & Monotonicity)**:
   Thuật toán chia tách hiện thời (`splitTextAdaptively` trong `src/lib/text.ts` và `splitBilingualAdaptively` trong `src/services/translation/bilingualSplit.ts`) áp dụng các thao tác `trim()` độc lập trên các lát cắt mà không xác thực rằng phép ghép nối sau cùng tái tạo chính xác 100% văn bản nguồn. Nếu một đoạn văn hoặc câu bị cắt phạm vi, nguy cơ mất câu hoặc đứt gãy ngữ cảnh cục bộ là hiện hữu.

4. **Thiếu cấu hình an toàn chính quy cho thể loại tiểu thuyết (Missing Permissive Safety Configuration)**:
   Module dựng yêu cầu `src/services/gemini/geminiRequestBuilder.ts` hiện không truyền mảng cấu hình an toàn `safetySettings`. Do đó, Google Gemini áp dụng mức kiểm duyệt mặc định, dẫn tới tỷ lệ dương tính giả rất cao (chặn nhầm các mô tả võ thuật, kiếm khí, sát thương thông thường trong tiểu thuyết tiên hiệp).

5. **Thiếu cơ chế đồng bộ giới hạn thời gian tích lũy (Cumulative Operation Timeout)**:
   Một chương truyện khi bị phân rã đệ quy sâu có thể tạo ra cây thực thi nhiều nhánh con. Dù mỗi cuộc gọi đơn lẻ có thời gian chờ (60s), toàn bộ tác vụ dịch chương truyện không có trần thời gian tích lũy (`cumulativeTimeoutMs`), dẫn tới tình trạng treo giao diện hoặc dịch kéo dài vô hạn khi nhiều nhánh cùng gặp sự cố.

6. **Bất đối xứng về xử lý đồng thời giữa các pha (Concurrency Asymmetry)**:
   Trong khi Phase 2 (`polishTranslation.ts`) đã sử dụng `mapWithConcurrencyLimit` giới hạn 2 tác vụ đồng thời, Phase 1 (`rawTranslation.ts`) vẫn xử lý tuần tự từng chunk bằng vòng lặp `for...of`, làm tăng đáng kể độ trễ hoàn thành chương truyện. Đồng thời, cả hai pha đều chưa phản ứng tức thời với `AbortSignal` ở cấp độ hàng đợi nhánh con.

---

## 2. Current Architecture Analysis

### 2.1. Hiện trạng Codebase

| Thành phần / Tệp tin | Trách nhiệm hiện tại | Trạng thái & Hạn chế xác minh từ code |
| :--- | :--- | :--- |
| `src/services/gemini/geminiRequestBuilder.ts` | Tạo URL và cấu trúc payload JSON cho Gemini API | **Thiếu**: Chưa thiết lập `safetySettings: BLOCK_NONE` cho 4 danh mục an toàn (`HARASSMENT`, `HATE_SPEECH`, `SEXUALLY_EXPLICIT`, `DANGEROUS_CONTENT`). |
| `src/services/gemini/geminiClient.ts` | Điều phối thực thi, xoay vòng khóa API và Cumulative Deadline cho từng request đơn | **Đã có**: Dừng xoay vòng khóa khi gặp `CONTENT_BLOCKED` (Spec 160). **Thiếu**: Chưa nhận diện deadline toàn cục truyền từ tầng dịch thuật đệ quy. |
| `src/services/gemini/geminiErrorClassifier.ts` | Phân loại lỗi HTTP/RPC thành `GeminiRequestError` | **Đã có**: Phân loại `CONTENT_BLOCKED`, `RATE_LIMIT_RPM`, `QUOTA_EXHAUSTED_RPD`. Phục vụ tốt cho transport. |
| `src/services/translation/translationValidation.ts` | Nhận diện lỗi tái thử trong pipeline dịch thuật | **Hạn chế nghiêm trọng**: Dùng `err.message.includes()` tìm chuỗi string thô. Thiếu mô hình trạng thái kết quả có cấu trúc. |
| `src/services/translation/rawTranslation.ts` | Phase 1: Dịch thô & trích xuất thực thể | **Hạn chế**: Xử lý chunk tuần tự; xoay key khi split (`(currentKeyIdx + i) % keys.length`); fallback Hán-Việt thô sơ; không có thống kê telemetry hoàn chỉnh; không kiểm tra coverage nguồn. |
| `src/services/translation/polishTranslation.ts` | Phase 2: Chuốt văn phong | **Đã có**: `mapWithConcurrencyLimit(chunks, 2)`. **Hạn chế**: Chưa hủy tức thì hàng đợi khi `signal.aborted`; chưa có báo cáo tỷ lệ coverage và thống kê phân nhánh chi tiết. |
| `src/services/translation/bilingualSplit.ts` | Phân đoạn song ngữ Trung - Việt theo đoạn văn | **Đã có**: Heuristic đóng gói token lũy kế (`maxTokensPerChunk`). **Hạn chế**: Có thể lệch cận khi `targetParts` làm tròn chỉ số; thiếu kiểm định bảo toàn nguyên vẹn 100% ký tự nguồn. |
| `src/lib/text.ts` | Tiện ích văn bản, `splitTextAdaptively` | **Hạn chế**: Cắt đoạn có `trim()` làm mất khoảng trắng ranh giới; chưa có bộ kiểm định phân vùng đơn điệu (monotonic partition validator). |

### 2.2. Tránh triển khai lại chức năng đã có (Anti-Duplication Guard)

Hệ thống **tuyệt đối không** xây dựng lại:
1. Không tạo client hoặc transport Gemini mới: tiếp tục đi qua `callGeminiDirect()` trong `src/services/directGeminiClient.ts` và bộ điều phối `geminiClient.ts`.
2. Không thay thế bộ theo dõi hạn mức `localQuotaTracker.ts`.
3. Không thay thế cơ chế xử lý đồng thời `mapWithConcurrencyLimit` trong `src/lib/concurrency.ts`, mà tái sử dụng nó đồng bộ cho cả Phase 1 và Phase 2.
4. Không thay đổi cấu trúc cơ sở dữ liệu IndexedDB (`src/services/db.ts`) hay các giao diện người dùng chính.

---

## 3. Constraints & Architectural Directives

1. **Zero-Backend SPA Preservation**: Mọi xử lý tiếp tục chạy 100% trên trình duyệt người dùng qua Client SDK/REST Fetch, không tạo bất kỳ backend proxy hay relay trung gian nào.
2. **Tuân thủ Quyết định An toàn của Provider (Safety Policy Compliance)**:
   - **Cấu hình chính quy**: Áp dụng cấu hình chuẩn của Google API `safetySettings` với ngưỡng `BLOCK_NONE` cho 4 danh mục vi phạm để giải phóng văn cảnh kiếm hiệp/tiên hiệp/huyền huyễn khỏi các cảnh báo dương tính giả.
   - **Tuyệt đối cấm Jailbreak / Reframing né filter**: Không dùng các thủ thuật tiền xử lý làm biến dạng nội dung, đánh lừa hoặc làm trái quyết định kiểm duyệt nội dung của nhà cung cấp.
   - **Tất định hóa khi bị chặn**: Khi phản hồi vẫn là `CONTENT_BLOCKED` sau khi đã cấu hình `BLOCK_NONE`, hệ thống ghi nhận quyết định an toàn này là tất định (deterministic), KHÔNG xoay vòng thử API key khác, KHÔNG gửi lại cùng một prompt, và lập tức kích hoạt nhánh cứu nguy bảo toàn dữ liệu (Lossless Fallback).
3. **Bảo tồn Schema cốt lõi**: Giữ nguyên `src/types.ts` và IndexedDB schema hiện hành. Các trạng thái nâng cấp chỉ tồn tại trong phạm vi dịch vụ dịch thuật (`src/services/translation/types.ts`).
4. **Bảo toàn Văn bản Gốc 100% (100% Source Coverage Invariant)**: Tổng hợp nội dung các phân đoạn sau khi chia tách và dịch thuật phải bao phủ đầy đủ toàn bộ văn bản gốc ban đầu, không được bỏ sót, gộp cụt hoặc làm biến mất câu chữ.

---

## 4. User Scenarios & Acceptance Criteria *(mandatory)*

### User Story 1 - Phân đoạn thích ứng và phục hồi cục bộ khi gặp lỗi nội dung (Priority: P1)

Là một dịch giả đang dịch các chương tiểu thuyết tiên hiệp có chứa các trường đoạn chiến đấu ác liệt hoặc từ ngữ đặc thù, tôi muốn hệ thống tự động chia nhỏ chính xác vị trí bị lỗi để cách ly đoạn văn có vấn đề, dịch thành công các đoạn còn lại và kích hoạt cứu nguy chuyển ngữ Hán-Việt cho riêng phần bị chặn mà không làm hỏng toàn bộ chương truyện.

**Why this priority**: Các đoạn văn bản nhạy cảm thường chỉ chiếm 1-2 câu trong một chương 3.000 từ. Nếu toàn bộ chương thất bại chỉ vì 1 câu bị nhà cung cấp từ chối, năng suất biên dịch bị đình trệ nghiêm trọng.

**Independent Test**: Cung cấp một khối văn bản gồm 4 đoạn, trong đó đoạn 3 chứa từ khóa kích hoạt `CONTENT_BLOCKED`. Xác nhận hệ thống phân đoạn đệ quy, dịch thành công đoạn 1, 2, 4 bằng AI, chuyển đoạn 3 sang chế độ cứu nguy bảo tồn thuật ngữ Hán-Việt, trả về kết quả ghép nối hoàn chỉnh gắn nhãn `isPartial: true`.

**Acceptance Scenarios**:

1. **Given** một văn bản đầu vào gặp lỗi `CONTENT_BLOCKED` ở cấp độ toàn chương, **When** hệ thống kích hoạt cơ chế phân đoạn thích ứng đệ quy, **Then** hệ thống chia đôi văn bản theo ranh giới ngữ nghĩa tự nhiên (`\n\n`) thành 2 nhánh con và chỉ tái thử trên từng nhánh con độc lập.
2. **Given** một nhánh con chứa đoạn văn bị từ chối an toàn đạt đến giới hạn độ sâu tối đa (`maxDepth`), **When** nhánh con này không thể phân rã thêm, **Then** hệ thống áp dụng cơ chế cứu nguy từ điển Hán-Việt không mất mát (`fallbackSinoVietnameseLine`), bảo tồn toàn bộ số lượng câu/chữ mà không xoay vòng sang API key khác.
3. **Given** một chương truyện có một số nhánh hoàn thành bằng AI và một số nhánh hoàn thành qua cứu nguy, **When** quá trình dịch kết thúc, **Then** kết quả trả về gắn cờ `isPartial: true`, cung cấp đầy đủ thực thể đã trích xuất từ các nhánh thành công và báo cáo thống kê phân đoạn minh bạch.

---

### User Story 2 - Cấu hình an toàn chuẩn xác cho tiểu thuyết mạng (Priority: P1)

Là người dùng dịch tiểu thuyết tiên hiệp/võ hiệp, tôi muốn các yêu cầu gửi tới Gemini API tự động kích hoạt cấu hình an toàn cho phép tối đa (`BLOCK_NONE` cho 4 danh mục vi phạm) thông qua API chính quy của Google, để giảm thiểu tối đa các trường hợp hệ thống AI chặn nhầm văn cảnh miêu tả chiêu thức, chém giết, đao kiếm.

**Why this priority**: Mức kiểm duyệt mặc định của Gemini thường xuyên chặn nhầm các phân cảnh hành động trong tiểu thuyết, gây ra tỷ lệ lỗi giả tạo và kích hoạt phân tách không cần thiết.

**Independent Test**: Kiểm tra cấu trúc payload tạo bởi `buildPayload` trong `geminiRequestBuilder.ts`, xác nhận mảng `safetySettings` luôn chứa đầy đủ 4 hạng mục tiêu chuẩn với ngưỡng `BLOCK_NONE`.

**Acceptance Scenarios**:

1. **Given** một yêu cầu dịch thô hoặc chuốt văn phong được chuẩn bị gửi tới Gemini, **When** payload yêu cầu được khởi tạo, **Then** payload chứa trường `safetySettings` với đầy đủ 4 danh mục: `HARM_CATEGORY_HARASSMENT`, `HARM_CATEGORY_HATE_SPEECH`, `HARM_CATEGORY_SEXUALLY_EXPLICIT`, `HARM_CATEGORY_DANGEROUS_CONTENT`, đều có `threshold: HarmBlockThreshold.BLOCK_NONE`.
2. **Given** một văn bản hành động kiếm hiệp được gửi đi với cấu hình an toàn tối đa, **When** Gemini API tiếp nhận và xử lý, **Then** yêu cầu được thực thi suôn sẻ mà không bị chặn giả bởi các bộ lọc ngữ cảnh thông thường.

---

### User Story 3 - Bảo đảm tính toàn vẹn và bao phủ 100% nguồn (Priority: P1)

Là một biên tập viên, tôi muốn đảm bảo rằng quá trình chia nhỏ văn bản và ghép lại không làm rơi rụng bất kỳ ký tự, dòng văn hay dấu câu nào của bản gốc, đồng thời các thuật ngữ từ điển được bảo vệ nguyên vẹn cấu trúc.

**Why this priority**: Rủi ro lớn nhất của cơ chế chia đoạn đệ quy là việc mất mát nội dung (omission) ở các điểm tiếp giáp ranh giới chia cắt (boundary cut points).

**Independent Test**: Chạy một bộ kiểm thử chia đoạn trên các văn bản có định dạng phức tạp (dòng trắng liên tiếp, thụt đầu dòng, ký tự đặc biệt, thuật ngữ trong ngoặc vuông `[...]`), xác minh hàm ghép nối và xác thực bao phủ trả về kết quả 100% khớp với cấu trúc đoạn gốc.

**Acceptance Scenarios**:

1. **Given** một văn bản nguồn tiếng Trung bất kỳ, **When** thuật toán phân rã thành các phân đoạn `TranslationChunk[]`, **Then** phép nối các phân đoạn nguồn tái tạo hoàn hảo văn bản ban đầu mà không tạo ra khoảng trắng thừa hay làm rụng ký tự biên.
2. **Given** các thuật ngữ đặc biệt hoặc placeholder đã thiết lập trong văn bản, **When** phân đoạn diễn ra, **Then** các điểm cắt không bao giờ rơi vào giữa chừng một thực thể đang được đóng ngoặc bảo vệ (`[...]` hoặc placeholder tokens).
3. **Given** sau khi toàn bộ các chunk được dịch và ghép nối lại, **When** hệ thống kiểm định tính toàn vẹn sau ghép nối (`verifyPostMergeIntegrity`), **Then** hệ thống xác nhận số lượng phân đoạn hợp lệ và không có đoạn văn nào bị trống rỗng bất thường.

---

### User Story 4 - Giới hạn đồng thời và đồng bộ thời gian chờ toàn cục (Priority: P2)

Là một người dùng dịch các chương truyện dài, tôi muốn hệ thống kiểm soát chặt chẽ số lượng yêu cầu gọi đồng thời (tối đa 2 cuộc gọi song song) và áp dụng một hạn định thời gian tích lũy chung cho toàn bộ chương, để tránh làm nghẽn mạng, tránh bị Google phạt 429 và không để tiến trình dịch bị treo vô hạn.

**Why this priority**: Khi một chương phân nhánh thành 4 hoặc 8 mảnh, nếu bắn toàn bộ đồng thời sẽ gây quá tải tức thì lên API key (RPM spike). Đồng thời, nếu không có Cumulative Timeout, tổng thời gian chờ có thể lên tới hàng chục phút.

**Independent Test**: Mô phỏng dịch một chương truyện bị phân tách thành 4 phân đoạn, xác nhận tại mọi thời điểm chỉ có tối đa 2 cuộc gọi API đang thực thi; mô phỏng việc trôi qua quá hạn định tích lũy (Cumulative Deadline), xác nhận hệ thống ngắt các tác vụ đang chờ và trả về bản dịch kết hợp an toàn.

**Acceptance Scenarios**:

1. **Given** một tác vụ dịch thô (Phase 1) hoặc chuốt văn phong (Phase 2) phân rã thành 4 phân đoạn, **When** tiến trình thực thi được kích hoạt, **Then** hệ thống thực thi qua bộ điều phối đồng thời có giới hạn (`mapWithConcurrencyLimit`), duy trì tối đa 2 cuộc gọi đồng thời.
2. **Given** người dùng nhấn nút Hủy (Abort) trên giao diện hoặc tín hiệu `AbortSignal` được kích hoạt, **When** tín hiệu phát đi, **Then** tất cả các nhánh con đang đợi trong hàng queue hoặc đang gọi API lập tức dừng lại, giải phóng tài nguyên.
3. **Given** một tác vụ dịch kéo dài vượt quá thời gian hạn định tích lũy cho phép (`cumulativeTimeoutMs`), **When** hạn định bị vi phạm, **Then** các nhánh con chưa hoàn tất lập tức áp dụng cứu nguy tất định và hoàn tất phiên dịch với cảnh báo quá hạn.

---

### User Story 5 - Đo lường và báo cáo vi phân nhánh (Telemetry & Observability) (Priority: P3)

Là một lập trình viên và người dùng nâng cao, tôi muốn nhận được báo cáo chi tiết về số lần phân tách, số lần thử lại, các nhánh con bị lỗi và thời gian thực thi sau mỗi chương dịch, để tôi có thể theo dõi độ ổn định của API và chất lượng chương truyện.

**Why this priority**: Hiện tại hệ thống chỉ bắn sự kiện qua callback `onSplitRetry` mà không lưu trữ hay trả về cấu trúc thống kê hoàn chỉnh trong kết quả cuối, gây khó khăn cho việc gỡ lỗi và hiển thị trạng thái trên giao diện.

**Independent Test**: Gọi hàm dịch với một văn bản có kích hoạt phân tách, kiểm tra đối tượng kết quả trả về, xác minh trường `telemetry` chứa đầy đủ các chỉ số thống kê.

**Acceptance Scenarios**:

1. **Given** một lượt dịch hoàn tất qua nhiều tầng phân nhánh, **When** kết quả trả về, **Then** đối tượng kết quả chứa cấu trúc `telemetry` bao gồm: `totalSplits`, `retriedBranches`, `fallbackBranches`, `failedBranchKeys`, và `executionDurationMs`.
2. **Given** một nhánh bị rơi vào cơ chế cứu nguy, **When** ghi nhận telemetry, **Then** lý do lỗi gốc (`reason`), cấp độ sâu (`depth`) và phạm vi đoạn văn tương ứng được ghi nhận chính xác.

---

## 5. Requirements *(mandatory)*

### 5.1. Functional Requirements (Yêu cầu Chức năng)

- **FR-001 (Structured Outcome Classification)**:
  Hệ thống PHẢI định nghĩa bảng phân loại kết quả dịch thuật và phân nhánh có cấu trúc tường minh (`TranslationOutcomeType` gồm `SUCCESS`, `RETRYABLE`, `TERMINAL`, `PARTIAL`). Bãi bỏ hoàn toàn việc kiểm tra lỗi bằng cách dò tìm chuỗi tự do (`msg.includes`) trong `translationValidation.ts`.
- **FR-002 (Permissive Safety Configuration Injection)**:
  Module `geminiRequestBuilder.ts` PHẢI tích hợp cấu hình `safetySettings` mặc định sử dụng `HarmBlockThreshold.BLOCK_NONE` cho cả 4 danh mục vi phạm chuẩn (`HARM_CATEGORY_HARASSMENT`, `HARM_CATEGORY_HATE_SPEECH`, `HARM_CATEGORY_SEXUALLY_EXPLICIT`, `HARM_CATEGORY_DANGEROUS_CONTENT`) nhằm ngăn chặn việc kiểm duyệt nhầm văn cảnh truyện kiếm hiệp/huyền huyễn.
- **FR-003 (Deterministic Non-Retry on CONTENT_BLOCKED)**:
  Khi một cuộc gọi API nhận mã lỗi `CONTENT_BLOCKED`, hệ thống PHẢI coi đó là lỗi tất định do nội dung. Hệ thống TUYỆT ĐỐI KHÔNG xoay vòng thử API key khác và TUYỆT ĐỐI KHÔNG thử lại cùng một prompt với cùng ranh giới văn bản. Chỉ được phép chia nhỏ phạm vi văn bản nếu chưa đạt `maxDepth`. Nếu không thể chia nhỏ hơn, lập tức chuyển sang cứu nguy tất định.
- **FR-004 (Monotonic Boundary Split Selection)**:
  Thuật toán chia đoạn PHẢI tuân thủ thứ bậc ranh giới tự nhiên: Dấu phân đoạn cảnh (`***`, `---`) $\rightarrow$ Xuống dòng đôi (`\n\n`) $\rightarrow$ Xuống dòng đơn (`\n`) $\rightarrow$ Dấu câu ngắt câu tiếng Trung/Việt (`。`, `！`, `？`, `……`, `.`). Điểm chia cắt TUYỆT ĐỐI KHÔNG được cắt ngang giữa một thực thể đóng ngoặc bảo vệ (`[...]`, placeholder tokens).
- **FR-005 (100% Source Coverage Invariant)**:
  Trước khi chia đoạn, hệ thống PHẢI lập chỉ mục độ dài và số lượng đoạn văn bản gốc. Sau khi phân đoạn, hàm ghép nối kiểm tra PHẢI đảm bảo tổng các phân đoạn tái tạo chính xác 100% ký tự nguồn mà không có sự xê dịch hay mất mát.
- **FR-006 (Isolated Fault-Branch Recursion)**:
  Khi một chương truyện đã được chia thành các phân đoạn, nếu một phân đoạn gặp lỗi có thể chia tiếp (`RETRYABLE` hoặc `CONTENT_BLOCKED` khi `depth < maxDepth`), hệ thống CHỈ thực hiện đệ quy trên phân đoạn bị lỗi đó. Các phân đoạn anh em (sibling chunks) đã thành công TUYỆT ĐỐI KHÔNG bị dịch lại.
- **FR-007 (Configurable Recursion Limits)**:
  Độ sâu đệ quy tối đa PHẢI được cấu hình qua tham số `maxDepth` (mặc định là 3, tối đa không quá 4). Mỗi lần phân đoạn chỉ chia nhị phân thành 2 phần (`partsCount = 2`) để kiểm soát số lượng nút lá tối đa là $2^3 = 8$ (hoặc $2^4 = 16$).
- **FR-008 (Deterministic Lossless Fallback)**:
  - Đối với Phase 1 (Dịch thô): Khi một nút lá thất bại hoàn toàn (terminal failure do bộ lọc an toàn hoặc quá độ sâu), hệ thống PHẢI áp dụng bộ cứu nguy Hán-Việt kết hợp từ điển (`fallbackSinoVietnameseLine`). Tuyệt đối không xóa bỏ hay làm mất đoạn văn gốc; toàn bộ nội dung được cứu nguy và trả về kèm cờ `isPartial: true`.
  - Đối với Phase 2 (Chuốt văn phong): Khi một nút lá thất bại, hệ thống bảo tồn nguyên vẹn đoạn dịch thô tương ứng (`rawTranslation`), đảm bảo không mất mát nội dung và cấu trúc đoạn văn bản.
- **FR-009 (Bounded Concurrency Control)**:
  Cả Phase 1 (`rawTranslation.ts`) và Phase 2 (`polishTranslation.ts`) PHẢI thực thi việc gọi API cho các phân đoạn con thông qua cơ chế giới hạn luồng đồng thời `mapWithConcurrencyLimit`, với giới hạn mặc định là 2 tác vụ đồng thời (`concurrencyLimit = 2`).
- **FR-010 (Fast Abort Propagation)**:
  Mọi vòng lặp phân đoạn và hàng đợi xử lý PHẢI kiểm tra `signal?.aborted` trước khi điều phối cuộc gọi kế tiếp. Khi tín hiệu hủy được kích hoạt, hệ thống lập tức từ chối các tác vụ còn lại và ném ra `AbortError`.
- **FR-011 (Cumulative Operation Timeout)**:
  Tác vụ dịch toàn chương PHẢI hỗ trợ tham số thời hạn tích lũy `cumulativeTimeoutMs` (mặc định: 120.000ms). Thời gian còn lại phải được trừ dần cho các nhánh đệ quy con. Nếu hết thời gian, các nhánh đang chạy sẽ tự động chuyển sang cơ chế cứu nguy lossless để kịp trả về kết quả cho người dùng.
- **FR-012 (Observability & Telemetry Stats)**:
  Kết quả trả về của cả dịch thô và chuốt văn phong PHẢI bổ sung trường `telemetry`:
  ```ts
  telemetry: {
    totalSplits: number;
    retriedBranches: number;
    fallbackBranches: number;
    failedBranchKeys: string[];
    executionDurationMs: number;
    outcome: 'SUCCESS' | 'PARTIAL';
  }
  ```
- **FR-013 (Placeholder & Glossary Integrity Preservation)**:
  Bộ kiểm định sau ghép nối PHẢI xác nhận rằng mọi placeholder hoặc thuật ngữ được bảo hộ bằng ngoặc vuông hoặc token định danh không bị cắt vỡ hay làm sai lệch vị trí sau quá trình phân rã và hợp nhất.

---

### 5.2. Non-Functional Requirements (Yêu cầu Phi chức năng)

- **NFR-001 (Zero-Backend Compliance)**: Toàn bộ thuật toán phân đoạn, kiểm định tính toàn vẹn và cơ chế cứu nguy vận hành hoàn toàn trong môi trường JavaScript client-side (trình duyệt).
- **NFR-002 (Algorithmic Efficiency)**: Thuật toán dò tìm điểm chia cắt và kiểm tra bao phủ nguồn phải đạt độ phức tạp thời gian tuyến tính $O(N)$ theo độ dài văn bản, không sử dụng regex có nguy cơ Catastrophic Backtracking.
- **NFR-003 (Strict Quality Gates)**: Toàn bộ mã nguồn mới phải vượt qua 100% các quality gates: `npm run lint` (`tsc --noEmit`), `npm test` (`vitest run`), và `npm run build` (`tsc && vite build`).
- **NFR-004 (Type Safety & Backward Compatibility)**: Giữ nguyên khả năng tương thích ngược của các hàm xuất khẩu công khai (`translateRawDirect`, `polishTranslationDirect`, `callGeminiDirect`). Các tham số mới (`maxDepth`, `cumulativeTimeoutMs`, `concurrencyLimit`) phải ở dạng tùy chọn (optional).

---

## 6. Key Entities & Data Contracts

### 6.1. Translation Resilience Contracts (`src/services/translation/types.ts`)

```typescript
export type TranslationOutcomeType = 
  | 'SUCCESS'     // Hoàn thành 100% bằng AI không qua fallback
  | 'PARTIAL'     // Hoàn thành nhưng có ít nhất 1 nhánh chuyển sang cứu nguy lossless
  | 'RETRYABLE'   // Lỗi nhất thời có thể thử lại (Rate Limit, Server 503)
  | 'TERMINAL';   // Lỗi không thể phục hồi (Auth lỗi, Request cấu trúc hỏng)

export interface SplitBranchTelemetry {
  totalSplits: number;
  retriedBranches: number;
  fallbackBranches: number;
  failedBranchKeys: string[];
  executionDurationMs: number;
  outcome: 'SUCCESS' | 'PARTIAL';
}

export interface MonotonicTextPartition {
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
  estimatedTokens: number;
}

export interface SourceCoverageReport {
  isComplete: boolean;
  originalCharLength: number;
  partitionedCharLength: number;
  missingRanges: Array<{ start: number; end: number }>;
}
```

### 6.2. Permissive Safety Settings Schema (`src/services/gemini/types.ts`)

```typescript
export enum HarmCategory {
  HARM_CATEGORY_HARASSMENT = 'HARM_CATEGORY_HARASSMENT',
  HARM_CATEGORY_HATE_SPEECH = 'HARM_CATEGORY_HATE_SPEECH',
  HARM_CATEGORY_SEXUALLY_EXPLICIT = 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  HARM_CATEGORY_DANGEROUS_CONTENT = 'HARM_CATEGORY_DANGEROUS_CONTENT',
}

export enum HarmBlockThreshold {
  BLOCK_NONE = 'BLOCK_NONE',
  BLOCK_LOW_AND_ABOVE = 'BLOCK_LOW_AND_ABOVE',
  BLOCK_MEDIUM_AND_ABOVE = 'BLOCK_MEDIUM_AND_ABOVE',
  BLOCK_ONLY_HIGH = 'BLOCK_ONLY_HIGH',
}

export interface GeminiSafetySetting {
  category: HarmCategory | string;
  threshold: HarmBlockThreshold | string;
}
```

---

## 7. Edge Cases & Resilience Behaviors

| Tình huống ngoại lệ (Edge Case) | Hành vi ứng phó chuẩn của hệ thống |
| :--- | :--- |
| **Văn bản chỉ gồm 1 câu cực ngắn bị `CONTENT_BLOCKED`** | Không thể chia đôi thêm (`partsCount <= 1`). Lập tức kích hoạt cứu nguy từ điển Hán-Việt (`fallbackSinoVietnameseLine`), trả về câu đã cứu nguy kèm nhãn `isPartial: true`, KHÔNG xoay vòng key, KHÔNG gọi lại API. |
| **Cả 2 nhánh con đều bị lỗi khác nhau (1 nhánh 503, 1 nhánh CONTENT_BLOCKED)** | Nhánh 503 kích hoạt xoay vòng key hoặc retry có giãn cách (exponential backoff). Nhánh `CONTENT_BLOCKED` lập tức chia nhỏ tiếp hoặc chuyển sang cứu nguy lossless. Hai nhánh vận hành hoàn toàn độc lập. |
| **Người dùng bấm Hủy (Abort) khi đang ở độ sâu `depth = 3`** | `AbortSignal` kích hoạt hủy fetch đang bay, đồng thời vòng điều phối `mapWithConcurrencyLimit` từ chối khởi chạy các nhánh đang đợi trong queue và trả về `AbortError` ngay lập tức. |
| **Độ dài chương truyện quá lớn (> 10.000 chữ) gây cạn kiệt Cumulative Timeout** | Khi đồng hồ đếm ngược `remainingDeadlineMs <= 1000ms`, các nhánh con chưa kịp gửi yêu cầu tự động áp dụng cứu nguy lossless cục bộ để ghép thành bản dịch hoàn chỉnh trả về cho người dùng thay vì báo lỗi đỏ toàn bộ. |
| **Điểm cắt rơi trúng vào tên nhân vật được đánh dấu `[Sở Phong]`** | Hàm định vị ranh giới an toàn kiểm tra chỉ số cắt nằm trong khoảng mở/đóng ngoặc `[` và `]`. Nếu có xung đột, điểm cắt tự động dịch chuyển lùi về trước ký tự `[` gần nhất. |
| **Văn bản tiếng Trung không có dấu xuống dòng nào (nguyên một khối text liền)** | Hàm tìm điểm cắt câu tự động quét các dấu câu `。`, `！`, `？`, `……` trong biên độ $\pm 15\%$ vị trí giữa đoạn để ngắt câu an toàn. |

---

## 8. Test Strategy & Quality Assurance

Để thỏa mãn quy định tại Hiến pháp và AGENTS.md, chiến lược kiểm thử bảo đảm:
1. **Unit Tests cho Bộ kiểm định Phân vùng đơn điệu (`monotonicSplit.test.ts`)**:
   - Kiểm tra tính bất biến: Ghép nối $K$ phần tử luôn trả về chính xác chuỗi gốc $S$.
   - Kiểm tra không cắt ngang ngoặc vuông `[...]` và placeholder.
   - Kiểm tra văn bản đa dòng, đơn dòng, và không dấu dòng.
2. **Unit Tests cho Module Payload An toàn (`geminiRequestBuilder.test.ts`)**:
   - Xác minh `buildPayload` luôn đính kèm mảng `safetySettings` với 4 danh mục và ngưỡng `BLOCK_NONE`.
3. **Integration Tests cho Luồng Cứu nguy Độc lập Nhánh (`directTranslationEngine.test.ts`)**:
   - Mô phỏng nhánh trái thành công, nhánh phải bị `CONTENT_BLOCKED`: xác minh nhánh trái chỉ gọi API đúng 1 lần, nhánh phải kích hoạt cứu nguy, kết quả cuối cùng chứa cả 2 phần với `isPartial: true`.
   - Xác minh tuyệt đối KHÔNG xoay vòng API key khi gặp lỗi `CONTENT_BLOCKED`.
4. **Concurrency & Abort Tests (`concurrencyResilience.test.ts`)**:
   - Xác minh tối đa 2 cuộc gọi diễn ra đồng thời dù có 4 hay 8 chunks.
   - Xác minh việc ngắt quãng qua `AbortController` dừng tiến trình ngay tức khắc.
5. **Quality Gates Bắt buộc**:
   - `npm run lint` (`tsc --noEmit`) đạt 0 lỗi.
   - `npm test` (`vitest run`) đạt 100% pass, không tắt, skip hay làm yếu assertion nào.
   - `npm run build` (`tsc && vite build`) đóng gói thành công.

---

## 9. Migration & Compatibility Impact

- **IndexedDB & Schema**: Không thay đổi schema DB hay các bảng trong Dexie. Toàn bộ tính năng tương thích 100% với dữ liệu hiện có của người dùng.
- **API Signatures**: Các hàm `translateRawDirect`, `polishTranslationDirect` giữ nguyên chữ ký hàm cơ bản, chỉ bổ sung các thuộc tính tùy chọn trong params (`maxDepth?`, `concurrencyLimit?`, `cumulativeTimeoutMs?`) và bổ sung trường `telemetry?` trong kết quả trả về.
- **Rollback Safety**: Nếu cần thu hồi, hệ thống hoàn toàn có thể quay lại logic chia đoạn trước đó mà không ảnh hưởng tới các bản dịch đã lưu trong IndexedDB.

---

## 10. Files / Modules Dự kiến Thay đổi

1. `src/services/gemini/types.ts`: Bổ sung định nghĩa `HarmCategory`, `HarmBlockThreshold`, `GeminiSafetySetting`.
2. `src/services/gemini/geminiRequestBuilder.ts`: Thêm `getPermissiveSafetySettings()` và đưa vào `buildPayload()`.
3. `src/services/translation/types.ts`: Bổ sung `TranslationOutcomeType`, `SplitBranchTelemetry`, mở rộng `DirectRawTranslationResult` có thêm `isPartial` và `telemetry`.
4. `src/services/translation/translationValidation.ts`: Thay thế hàm dò tìm chuỗi bằng nhận diện mã lỗi cấu trúc `isAdaptiveSplitRetryableOutcome(err: unknown)`.
5. `src/services/translation/bilingualSplit.ts`: Nâng cấp thuật toán phân đoạn bảo đảm tính đơn điệu và 100% coverage, loại bỏ rủi ro lệch cận khi làm tròn.
6. `src/lib/text.ts`: Tối ưu hóa `splitTextAdaptively` để bảo toàn khoảng trắng ranh giới và tránh cắt ngang thực thể bảo vệ.
7. `src/services/translation/rawTranslation.ts`: Tích hợp `mapWithConcurrencyLimit(chunks, 2)`, điều phối retry chỉ trên nhánh hỏng, hủy nhanh với `AbortSignal`, gắn telemetry và kiểm định tính toàn vẹn trước/sau ghép nối.
8. `src/services/translation/polishTranslation.ts`: Đồng bộ hóa cơ chế Cumulative Timeout, kiểm định coverage và telemetry.
9. Các test suite liên quan: `src/services/__tests__/directTranslationEngine.test.ts`, `src/services/gemini/__tests__/geminiRequestBuilder.test.ts`, `src/services/translation/__tests__/bilingualSplit.test.ts`, và bổ sung các kịch bản kiểm thử phân nhánh mới.

---

## 11. Success Criteria *(mandatory)*

- **SC-001 (Zero Lost Content)**: 100% các tác vụ phân đoạn và ghép nối tái tạo đầy đủ văn bản nguồn, tỷ lệ sót/mất chữ đạt 0%.
- **SC-002 (Zero Key Burning on Content Moderation)**: 100% các cuộc gọi gặp lỗi `CONTENT_BLOCKED` dừng ngay tại khóa hiện tại, số lần xoay vòng API key phụ trên cùng một prompt bị chặn đạt 0.
- **SC-003 (Bounded Concurrency & Latency)**: Tối đa 2 cuộc gọi API diễn ra đồng thời cho mỗi tác vụ dịch chia đoạn, không xảy ra xung đột hạn ngạch do bùng nổ đồng thời.
- **SC-004 (Graceful Partial Recovery)**: Khi một đoạn văn trong chương bị chặn bởi bộ lọc an toàn, các đoạn văn hợp lệ khác trong chương vẫn được dịch thành công bằng AI, và đoạn văn bị chặn được cứu nguy bảo toàn cấu trúc thay vì làm thất bại toàn bộ chương.
- **SC-005 (Comprehensive Verification)**: Toàn bộ các kiểm tra nghiêm ngặt `npm run lint`, `npm test`, và `npm run build` thực thi hoàn tất không có lỗi.

---

## 12. Assumptions

- Người dùng sở hữu ít nhất 1 khóa Gemini API hợp lệ có quyền gọi model chỉ định.
- Nhà cung cấp Google Gemini API tôn trọng cấu hình `safetySettings: BLOCK_NONE` cho các dự án hợp lệ trên Google AI Studio.
- Các thiết bị của người dùng có đủ bộ nhớ RAM trình duyệt để xử lý các chuỗi văn bản dài đến 50.000 ký tự trong bộ nhớ tạm thời mà không bị crash tab.
