# Feature Specification: Kích Hoạt Di Trú Hạn Mức Runtime, Nhất Quán Lưu Trữ Drive & Phân Đoạn Theo Ngân Sách Token (140-runtime-migration-drive-consistency)

**Feature Branch**: `140-runtime-migration-drive-consistency`

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "Yêu cầu xử lý 3 vấn đề kỹ thuật trọng tâm theo đánh giá kiểm toán:
- P1: Xác minh và nối kích hoạt tự động `migrateCustomLimits()` vào runtime lifecycle và scheduler trước khi đọc `getStoredCustomLimits()`, tránh việc người dùng cũ nâng cấp bị mất cấu hình hạn mức cá nhân do scheduler tra cứu SHA-256 mới khi dữ liệu lưu trữ vẫn ở mã băm cũ.
- P2: Hợp nhất ranh giới tuần tự hóa lưu trữ dự án giữa UI (`projectStorageQueue.ts`) và Google Drive services (`driveBundleSync.ts`, `driveProjectSync.ts`, `driveGranularSync.ts`); đồng thời thiết lập ranh giới giao dịch nguyên tử (atomic transaction boundary) cho tiến trình Drive bundle pull nhằm ngăn ngừa tình trạng partial-commit khi lưu dự án thất bại sau khi đã ghi chapters.
- P3: Tối ưu hóa thuật toán phân đoạn song ngữ `splitBilingualAdaptively` theo ngân sách token thực tế (token-budget aware packing), gom đoạn lũy kế thông minh để bảo đảm từng chunk bám sát giới hạn `maxTokensPerChunk` ngay cả khi kích thước các đoạn văn phân bổ lệch nhau."

---

## Bối Cảnh & Mục Tiêu (Context & Goals)

Hệ thống dịch thuật đã hoàn thành xuất sắc các mục tiêu tái cấu trúc cơ bản về phân tách module, tách bạch chỉ số vòng đời yêu cầu (Logical vs Provider metrics) và chuẩn hóa mã băm SHA-256. Tuy nhiên, báo cáo rà soát snapshot mới nhất đã chỉ ra 3 điểm then chốt cần được đóng kín để đạt tính toàn vẹn và độ tin cậy tuyệt đối:

1. **Điểm kích hoạt di trú cấu hình hạn mức (Custom Limits Migration Activation)**:
   - Thuật toán di trú `migrateCustomLimits(apiKeys)` đã được cài đặt và kiểm thử đơn vị đầy đủ, nhưng trong chu trình thực thi thực tế (runtime lifecycle), việc nạp cấu hình `getStoredCustomLimits()` ở một số điểm (như `initKeySchedule` trong `geminiKeyScheduler.ts` hoặc khi nạp API keys trong `useAIConfig.ts`) có thể diễn ra trước khi migration được gọi.
   - Khi đó, người dùng nâng cấp từ bản cũ (vốn lưu trữ `maxRpd` dưới mã băm 32-bit cũ) sẽ bị scheduler bỏ qua hạn mức cá nhân do tra cứu theo SHA-256 mới mà không tìm thấy bản ghi. Cần bảo đảm `migrateCustomLimits(apiKeys)` được kích hoạt tự động ngay khi danh sách API keys được nạp vào bộ nhớ hoặc trước khi scheduler tra cứu hạn ngạch.

2. **Hợp nhất ranh giới tuần tự hóa lưu trữ & Giao dịch nguyên tử cho Drive Sync**:
   - Hiện tại, giao diện UI sử dụng `enqueueProjectSave()` qua `projectStorageQueue.ts`, trong khi các dịch vụ Google Drive sync vẫn gọi trực tiếp `saveProjectToDB()`. Dù `saveProjectToDB()` đã có hàng đợi Promise chain nội tại, sự tồn tại song song của hai lớp trừu tượng tạo ra nguy cơ phân mảnh kiến trúc. Cần hợp nhất `enqueueProjectSave()` ủy quyền trực tiếp cho `saveProjectToDB()` để duy trì một nguồn chân lý tuần tự hóa duy nhất cho mọi caller.
   - Trong quá trình kéo gói dự án từ Google Drive (`pullBundle()` trong `driveBundleSync.ts`), các thao tác ghi hiện diễn ra rời rạc: `saveChaptersToDB()` -> `saveCrdtStates()` -> `saveProjectToDB()`. Nếu bước cập nhật thông tin dự án cuối cùng thất bại, cơ sở dữ liệu sẽ bị rơi vào trạng thái dở dang (partial-commit: chapters đã ghi nhưng metadata dự án chưa đồng bộ). Cần cung cấp cơ chế ghi nguyên tử cho gói dự án trên IndexedDB.

3. **Phân đoạn song ngữ thông minh theo ngân sách Token (Token-Budget Packing)**:
   - Thuật toán `splitBilingualAdaptively` hiện áp dụng công thức chia đều số đoạn văn theo tỷ lệ `ceil(totalTokens / maxTokensPerChunk)`. Khi một chương truyện có một vài đoạn văn miêu tả chiến đấu hoặc thoại cực dài xen kẽ các đoạn cực ngắn, việc chia đều số đoạn có thể dẫn đến việc một chunk vượt quá ngân sách `maxTokensPerChunk`.
   - Cần bổ sung cơ chế gom đoạn lũy kế theo trọng số token thực tế để tối ưu hóa kích thước từng chunk, vừa giữ nguyên vẹn ranh giới đoạn văn vừa không để chunk nào vượt ngưỡng cho phép (trừ phi bản thân đoạn văn đơn lẻ đã lớn hơn ngưỡng).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tự Động Di Trú Hạn Mức Cá Nhân Khi Nạp Khóa & Khởi Tạo Scheduler (Priority: P1) 🎯 MVP

Là một người dùng đã tùy chỉnh hạn mức ngày (`maxRpd`) cho các khóa API trong phiên bản trước, tôi muốn khi mở ứng dụng hoặc khi hệ thống điều phối bắt đầu phiên dịch, các cấu hình hạn mức cũ của tôi được tự động nhận diện và chuyển đổi sang mã băm SHA-256 mới mà không đòi hỏi bất kỳ thao tác thủ công nào, bảo đảm hạn mức cá nhân luôn có hiệu lực ngay từ lượt dịch đầu tiên.

**Why this priority**: Ngăn ngừa việc người dùng bị mất cấu hình hạn mức cá nhân và vô tình sử dụng vượt quá giới hạn mong muốn khi nâng cấp phiên bản ứng dụng.

**Independent Test**:
- Nạp vào `localStorage` cấu hình hạn mức cá nhân lưu dưới mã băm cũ (chuỗi hex 8 ký tự lặp, ví dụ `maxRpd: 100`).
- Gọi hàm nạp khóa `migrateAndLoadApiKeys()` hoặc khởi tạo điều phối `initKeySchedule([testKey])`:
  - Cấu hình trong `localStorage` được tự động chuyển sang mã băm SHA-256 chuẩn (64 ký tự hex).
  - Trạng thái hạn mức được scheduler tra cứu chính xác, phản ánh đúng `maxRpd: 100`.
  - Mã băm cũ được dọn dẹp sạch sẽ khỏi bộ nhớ lưu trữ.

**Acceptance Scenarios**:
1. **Given** người dùng có cấu hình hạn mức lưu dưới mã băm cũ trong `localStorage`, **When** ứng dụng tải danh sách khóa thông qua `migrateAndLoadApiKeys()`, **Then** hệ thống tự động kích hoạt di trú và chuyển đổi cấu hình sang SHA-256.
2. **Given** hệ thống điều phối `geminiKeyScheduler.ts` chuẩn bị phiên dịch, **When** gọi hàm `initKeySchedule(apiKeys)`, **Then** hàm tự động kích hoạt `migrateCustomLimits(apiKeys)` trước khi tra cứu hạn mức khả dụng của các khóa.
3. **Given** hàm đọc cấu hình `getStoredCustomLimits(apiKeys?)` được gọi với danh sách khóa, **When** tồn tại bản ghi cũ tương ứng với các khóa này, **Then** hàm tự động thực hiện di trú và trả về đối tượng cấu hình đã được chuẩn hóa 100% sang SHA-256.

---

### User Story 2 - Hợp Nhất Tuần Tự Hóa Lưu Trữ & Giao Dịch Nguyên Tử Cho Drive Sync (Priority: P2)

Là một người dùng sử dụng tính năng đồng bộ đám mây Google Drive song song với việc dịch truyện trên giao diện, tôi muốn mọi thao tác ghi dữ liệu dự án (từ UI, Drive bundle pull, Drive granular sync) đều đi qua cùng một cơ chế tuần tự hóa duy nhất, và tiến trình tải gói dự án từ Drive phải bảo đảm tính nguyên tử (all-or-nothing), để không bao giờ xảy ra tình trạng mất dữ liệu do ghi đè hoặc cơ sở dữ liệu bị hỏng trạng thái dở dang.

**Why this priority**: Bảo vệ tính toàn vẹn dữ liệu của các bộ truyện lớn khi người dùng vừa chỉnh sửa vừa có tiến trình đồng bộ ngầm của Google Drive chạy song song.

**Independent Test**:
- Kích hoạt đồng thời 2 thao tác cập nhật dự án từ UI thông qua `enqueueProjectSave()` và 2 thao tác ghi từ Google Drive sync: Cả 4 thao tác được xếp vào cùng một hàng đợi Promise chain tuần tự theo `projectId`, không có thao tác nào bị nhảy cóc hay ghi đè snapshot cũ.
- Giả lập lỗi I/O phát sinh tại bước cuối cùng khi đang thực hiện `pullBundle()`: Toàn bộ quá trình đồng bộ được rollback an toàn, không có chương hay trạng thái CRDT nào bị commit dở dang khi metadata dự án chưa được cập nhật.

**Acceptance Scenarios**:
1. **Given** các thao tác lưu dự án phát sinh từ giao diện người dùng (`useProjects.ts`) và từ các dịch vụ đồng bộ Google Drive (`driveBundleSync`, `driveProjectSync`, `driveGranularSync`), **When** gửi yêu cầu lưu trữ, **Then** tất cả các nguồn gọi đều được điều hướng qua cùng một ranh giới tuần tự hóa duy nhất theo `projectId`.
2. **Given** hàm `enqueueProjectSave()` trong `projectStorageQueue.ts`, **When** được gọi, **Then** hàm ủy quyền xử lý trực tiếp cho hàng đợi nội tại của `saveProjectToDB()`, loại bỏ sự trùng lặp và bảo đảm tính nhất quán hàng đợi.
3. **Given** tiến trình kéo gói dự án `pullBundle()` trong `driveBundleSync.ts`, **When** thực thi cập nhật dữ liệu xuống IndexedDB, **Then** toàn bộ các chương, trạng thái CRDT và thông tin dự án được ghi thông qua một giao dịch nguyên tử (Atomic Multi-Store Operation / Transaction Boundary).
4. **Given** một lỗi xảy ra trong quá trình ghi dữ liệu gói dự án, **When** giao dịch bị hủy, **Then** cơ sở dữ liệu IndexedDB giữ nguyên vẹn snapshot trước khi đồng bộ, không xuất hiện các chương mồ côi hoặc sai lệch phiên bản.

---

### User Story 3 - Phân Đoạn Song Ngữ Thích Ứng Theo Ngân Sách Token Thực Tế (Priority: P3)

Là một người dùng dịch các chương truyện có độ dài đoạn văn phân bổ không đều (nhiều đoạn ngắn xen lẫn các đoạn miêu tả cực dài), tôi muốn thuật toán phân đoạn song ngữ gom các đoạn văn theo ngân sách token thực tế thay vì chỉ chia đều số đoạn, bảo đảm các khối phân đoạn phục vụ chuốt văn vừa kiểm soát chặt chẽ kích thước token vừa giữ vẹn toàn cấu trúc văn bản.

**Why this priority**: Nâng cao chất lượng chuốt văn của Gemini, tránh việc một khối văn bản bị vượt quá token limit do chứa một đoạn văn quá dài trong khi các khối khác lại quá ngắn.

**Independent Test**:
- Cung cấp văn bản gồm 6 đoạn văn với kích thước token lần lượt là: 150, 200, 1800, 100, 150, 200.
- Gọi `splitBilingualAdaptively` với `maxTokensPerChunk = 1000`:
  - Thuật toán tự động gom đoạn 1 và 2 (350 tokens) thành Chunk 1.
  - Đoạn 3 (1800 tokens) đứng riêng trong Chunk 2 trọn vẹn mà không bị cắt vụn giữa chừng.
  - Các đoạn 4, 5, 6 (450 tokens) được gom thành Chunk 3.
  - Mỗi chunk bảo đảm tính đồng bộ ranh giới đoạn văn 1:1 giữa tiếng Trung và tiếng Việt.

**Acceptance Scenarios**:
1. **Given** văn bản đầu vào có độ dài đoạn văn phân bổ không đồng đều và tùy chọn `maxTokensPerChunk` được thiết lập, **When** thực hiện phân đoạn song ngữ, **Then** thuật toán gom các đoạn văn liên tiếp theo tổng lũy kế kích thước token thực tế sao cho không vượt quá `maxTokensPerChunk` khi có thể.
2. **Given** một đoạn văn đơn lẻ có kích thước token lớn hơn `maxTokensPerChunk`, **When** phân đoạn, **Then** đoạn văn đó được giữ nguyên vẹn trong một khối độc lập (không bị cắt ngang câu chữ) và các đoạn văn kế tiếp bắt đầu một khối mới.
3. **Given** văn bản song ngữ (Trung - Việt), **When** phân đoạn theo trọng số token, **Then** các ranh giới đoạn văn tương ứng giữa hai ngôn ngữ được ánh xạ tỷ lệ chính xác, không tạo ra bất kỳ chunk nào bị rỗng nội dung.

---

## Edge Cases

- **Người dùng không có API Key nào được lưu nhưng mở ứng dụng**: Quá trình di trú hạn mức kiểm tra mảng khóa an toàn, bỏ qua di trú mà không sinh ra lỗi hay làm gián đoạn giao diện.
- **Dữ liệu cấu hình `customLimits` trong `localStorage` bị hỏng cấu trúc JSON**: Hàm đọc và di trú bắt lỗi an toàn (safe fallback), ghi đè bằng bộ nhớ tạm và ghi log cảnh báo mà không làm crash ứng dụng.
- **Tiến trình đồng bộ Google Drive ngầm bị mất mạng đột ngột giữa lúc đang ghi gói dự án**: Giao dịch nguyên tử IndexedDB tự động rollback hoặc hủy tác vụ, bảo đảm các chương cũ không bị thay thế nửa vời.
- **Văn bản đầu vào chỉ có đúng 1 đoạn văn duy nhất nhưng vượt quá `maxTokensPerChunk`**: Thuật toán trả về đúng 1 chunk duy nhất chứa trọn vẹn đoạn văn đó với `estimatedTokens` chính xác, không bị rơi vào vòng lặp vô tận.
- **Độ dài đoạn văn giữa văn bản nguồn (Trung) và văn bản thô (Việt) lệch nhau nghiêm trọng (ví dụ 20 đoạn Trung vs 3 đoạn Việt)**: Thuật toán kẹp giới hạn số phần chia tối đa theo bên có ít đoạn văn hơn, bảo đảm mỗi chunk luôn có ít nhất 1 đoạn văn ở cả hai ngôn ngữ.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hàm nạp khóa API `migrateAndLoadApiKeys()` trong `src/hooks/useAIConfig.ts` PHẢI tự động gọi hàm di trú `migrateCustomLimits()` với danh sách các khóa vừa tải được.
- **FR-002**: Hàm khởi tạo lịch trình khóa `initKeySchedule()` trong `src/services/gemini/geminiKeyScheduler.ts` PHẢI tự động gọi `migrateCustomLimits(rawKeys)` trước khi thực hiện tra cứu cấu hình qua `getStoredCustomLimits()`.
- **FR-003**: Hàm `getStoredCustomLimits()` trong `src/utils/customLimitsStorage.ts` PHẢI hỗ trợ tham số tùy chọn `apiKeys?: string[]` và tự động thực thi di trú trước khi trả về dữ liệu nếu tham số này được cung cấp.
- **FR-004**: Hàm `enqueueProjectSave()` trong `src/services/projectStorageQueue.ts` PHẢI ủy quyền trực tiếp và đồng bộ với hàng đợi Promise chain nội tại của `saveProjectToDB()` trong `src/services/db.ts`.
- **FR-005**: Mọi tác vụ lưu trữ thông tin dự án từ các module đồng bộ Google Drive (`driveBundleSync.ts`, `driveProjectSync.ts`, `driveGranularSync.ts`) PHẢI chia sẻ cùng một ranh giới tuần tự hóa duy nhất theo `projectId` với giao diện người dùng.
- **FR-006**: Module `src/services/db.ts` PHẢI cung cấp hàm lưu trữ gói nguyên tử `atomicSaveProjectBundle(project, chapters, crdtStates?)` thực thi trên một giao dịch đa store (multi-store transaction) của IndexedDB.
- **FR-007**: Hàm `pullBundle()` trong `src/services/google-drive/driveBundleSync.ts` PHẢI sử dụng `atomicSaveProjectBundle()` để cập nhật đồng thời chapters, CRDT states và metadata dự án trong một giao dịch duy nhất.
- **FR-008**: Nếu bất kỳ thao tác nào trong `atomicSaveProjectBundle()` gặp lỗi, toàn bộ giao dịch PHẢI bị hủy bỏ (aborted) để bảo đảm cơ sở dữ liệu không rơi vào trạng thái partial-commit.
- **FR-009**: Thuật toán phân đoạn song ngữ `splitBilingualAdaptively()` trong `src/services/translation/bilingualSplit.ts` PHẢI cải tiến cơ chế gom đoạn (chunk packing) dựa trên tổng lũy kế kích thước token của các đoạn văn khi tùy chọn `maxTokensPerChunk` được cung cấp.
- **FR-010**: Thuật toán gom đoạn PHẢI ưu tiên bảo vệ ranh giới đoạn văn hoàn chỉnh, không bao giờ chia cắt một đoạn văn đơn lẻ thành nhiều phần khi phân tách khối song ngữ.
- **FR-011**: Thuật toán phân đoạn PHẢI bảo đảm ánh xạ tỷ lệ chính xác giữa các đoạn văn tiếng Trung và tiếng Việt, ngăn chặn hoàn toàn tình trạng sinh ra khối rỗng ở một trong hai bên ngôn ngữ.
- **FR-012**: Giao diện `splitBilingualAdaptively()` PHẢI duy trì đầy đủ tính tương thích ngược với cú pháp tham số vị trí `(sourceText, rawText, targetParts?)`.
- **FR-013**: Toàn bộ các kiểm thử đơn vị hiện có và mới bổ sung PHẢI vượt qua 100% trên `vitest`.
- **FR-014**: Không có bất kỳ lỗi kiểu dữ liệu TypeScript nào tồn đọng (`npm run lint`).
- **FR-015**: Ứng dụng PHẢI đóng gói production thành công sạch sẽ (`npm run build`).

### Key Entities

- **CustomLimits**: Tập hợp cấu hình giới hạn tốc độ và số lượng yêu cầu hàng ngày (`maxRpm`, `maxRpd`, `maxTpm`) được ánh xạ theo mã băm SHA-256 của từng khóa API.
- **AtomicProjectBundle**: Cấu trúc dữ liệu đại diện cho gói cập nhật toàn vẹn của một dự án, bao gồm metadata dự án, danh sách các chương đầy đủ và các trạng thái CRDT đồng bộ.
- **TokenWeightedChunk**: Khối phân đoạn song ngữ được tính toán dựa trên trọng số token tích lũy thực tế của các đoạn văn, bảo đảm tính cân bằng tải cho các lượt gọi chuốt văn của mô hình AI.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% các trường hợp người dùng nâng cấp từ phiên bản cũ có cấu hình `maxRpd` được nhận diện chính xác bởi `geminiKeyScheduler` ngay từ lượt gọi đầu tiên mà không cần mở lại bảng cài đặt.
- **SC-002**: 100% các thao tác ghi dự án từ UI và Google Drive sync được tuần tự hóa nhất quán qua cùng một hàng đợi theo `projectId`, tỷ lệ xung đột race condition bằng 0%.
- **SC-003**: 100% các lần kéo gói dự án Google Drive (`pullBundle`) tuân thủ tính nguyên tử (all-or-nothing), tỷ lệ xuất hiện trạng thái partial-commit bằng 0%.
- **SC-004**: Giảm thiểu độ lệch kích thước token giữa các khối phân đoạn song ngữ xuống dưới 20% so với giới hạn `maxTokensPerChunk` (khi kích thước các đoạn văn cho phép), trong khi 100% các đoạn văn được bảo toàn nguyên vẹn.
- **SC-005**: Toàn bộ hệ thống vượt qua 100% các cổng chất lượng bắt buộc của dự án (`npm run lint`, `npm test`, `npm run build`) với 0 cảnh báo hoặc lỗi type.

---

## Assumptions

- Việc sử dụng multi-store transaction trên IndexedDB được hỗ trợ đầy đủ trên tất cả các trình duyệt hiện đại (Chrome, Edge, Firefox, Safari) mà không phát sinh thêm thư viện ngoài.
- Thao tác di trú hạn mức cá nhân chỉ yêu cầu thông tin các khóa API đang hoạt động (active keys) có trong phiên làm việc của người dùng.
- Việc tính toán lũy kế token theo đoạn văn bằng hàm `estimateTokenCount` có chi phí xử lý cực thấp (< 5ms cho 10,000 từ) và hoàn toàn phù hợp để thực thi đồng bộ trên main thread.
