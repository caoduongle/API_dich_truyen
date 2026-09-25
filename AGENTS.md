# AGENTS.md

## 1. Dự án

Công cụ dịch và biên tập tiểu thuyết Trung → Việt bằng AI Gemini.

Kiến trúc hiện tại:

* Pure Client-Side SPA.
* React 19 + TypeScript + Vite.
* Tailwind CSS v4.
* IndexedDB là nguồn dữ liệu chính phía client.
* Gemini được gọi trực tiếp từ trình duyệt thông qua tầng service hiện có trong `src/services/gemini/`.
* Google Drive là tính năng đồng bộ tùy chọn.
* Yjs / `y-indexeddb` phục vụ các luồng dữ liệu cộng tác hiện có.

Không được tự ý giả định rằng các tài liệu hoặc đặc tả cũ phản ánh kiến trúc hiện tại.

## 2. Thứ tự ưu tiên instruction

Khi xử lý task, áp dụng theo thứ tự:

1. System / platform instructions.
2. Yêu cầu trực tiếp của người dùng.
3. `.specify/memory/constitution.md`.
4. File `AGENTS.md` này.
5. Các rule liên quan trong `.agents/rules/`.
6. Feature specification / plan / contract liên quan trong `specs/`.
7. Comment, README hoặc tài liệu khác chỉ được xem là context nếu không mâu thuẫn với các tầng trên.

Nếu có mâu thuẫn:

* Ưu tiên nguồn có thứ tự cao hơn.
* Không âm thầm dung hòa hai quy tắc trái nhau.
* Nêu rõ xung đột khi nó ảnh hưởng quyết định triển khai.

## 3. Khởi động task

Trước khi sửa code:

1. Kiểm tra trạng thái repository và working tree.
2. Xác định các thay đổi có sẵn của người dùng.
3. Đọc `package.json` và `package-lock.json`.
4. Đọc `.specify/memory/constitution.md`.
5. Đọc các `.agents/rules/*` có liên quan tới task.
6. Xác định architecture và module ownership.
7. Đọc export, caller và utility liên quan trước khi thêm code.
8. Kiểm tra test hiện có.
9. Kiểm tra CI/CD nếu task ảnh hưởng build, test, dependency hoặc security.

Không được overwrite hoặc revert thay đổi có sẵn của người dùng chỉ để làm working tree sạch.

## 4. Architecture & domain boundaries

### View

UI và presentation:

```text
src/components/
src/components/layout/
```

### Controller

State orchestration:

```text
src/hooks/
```

### Model / Service

Business logic, algorithms, AI communication, database access:

```text
src/services/
src/lib/
src/config/
src/utils/
```

Nguyên tắc:

* Service không import component.
* Hook không import component.
* UI không tự tái hiện business logic đã có trong service.
* Ưu tiên tái sử dụng abstraction hiện có.
* Không tạo abstraction mới nếu không có nhu cầu thực tế.

### Gemini

Logic Gemini phải đi qua các abstraction hiện có trong:

```text
src/services/gemini/
src/services/translation/
```

Không tự tạo thêm một đường gọi Gemini khác nếu tầng hiện có có thể tái sử dụng.

### Storage

IndexedDB và các storage client-side hiện có phải được coi là stateful infrastructure.

Không thay đổi schema hoặc semantics storage chỉ để giải quyết một lỗi UI hoặc lỗi cục bộ.

## 5. Quality gates — bắt buộc

Một task chỉ được xem là hoàn thành khi các kiểm tra liên quan đã thực sự chạy.

### Baseline commands

```bash
npm run lint
npm test
npm run build
```

Ý nghĩa:

```text
npm run lint  -> tsc --noEmit
npm test      -> vitest run
npm run build -> tsc && vite build
```

### Security / CI parity

Khi dependency, build, CI hoặc security bị ảnh hưởng, phải kiểm tra thêm:

```bash
npm audit --audit-level=high
```

Kiểm tra `.github/workflows/ci.yml` để bảo đảm local validation không bỏ qua một quality gate mà CI thực thi.

Không được tuyên bố:

* "test pass"
* "build pass"
* "CI pass"
* "đã verify"

nếu command tương ứng chưa thực sự chạy và có kết quả.

Không được xóa, skip, mute hoặc làm yếu assertion chỉ để vượt quality gate.

## 6. Dependency management

Trước khi thêm dependency:

1. Kiểm tra package hiện có trong `package.json`.
2. Kiểm tra utility/component hiện có có thể tái sử dụng hay không.
3. Kiểm tra `package-lock.json`.
4. Xác định lỗi là thiếu dependency thật hay chỉ là `node_modules` chưa đồng bộ.
5. Ưu tiên `npm ci` khi lockfile đã là nguồn sự thật.
6. Chỉ thêm dependency khi thực sự cần.

Không tự ý thêm package chỉ vì một API tiện dụng hơn.

Không thay thế một package/component có sẵn bằng implementation thủ công chỉ để tránh dependency nếu package đó đã là dependency chính thức của project.

## 7. Debugging protocol

Khi gặp lỗi:

1. Reproduce lỗi.
2. Ghi nhận error thực tế.
3. Xác định file/module gây lỗi.
4. Truy nguyên root cause.
5. Kiểm tra các failure path liên quan.
6. Sửa nguyên nhân, không che triệu chứng.
7. Chạy regression tests.
8. Kiểm tra lại lỗi ban đầu.

Phân biệt rõ:

* Fact đã xác minh.
* Hypothesis.
* Assumption.
* Phần chưa verify.

Nếu có nhiều nguyên nhân khả dĩ, không đoán bừa; dùng evidence để loại trừ.

## 8. Scope & change discipline

Không sửa các file không liên quan.

Không gộp nhiều thay đổi độc lập vào cùng một diff.

Thay đổi nhiều module được phép khi:

* các module thuộc cùng một feature hoặc root cause;
* thay đổi có quan hệ trực tiếp;
* diff vẫn review được;
* test coverage cho toàn bộ đường đi đã được kiểm tra.

Không áp dụng máy móc giới hạn số file/module nếu root cause thực sự xuyên tầng.

## 9. Core schema & persistence protection

Các cấu trúc sau được xem là nhạy cảm:

```text
src/types.ts
src/services/db.ts
IndexedDB schema / migration
```

Không thay đổi chúng cho một task UI hoặc refactor không yêu cầu.

Có thể thay đổi khi:

* người dùng yêu cầu rõ ràng; hoặc
* task thực sự cần thay đổi schema/contract.

Khi schema hoặc persistent data thay đổi:

* xác định backward compatibility;
* xác định migration requirement;
* kiểm tra existing data;
* bổ sung regression tests;
* mô tả rollback / migration impact.

Không xóa dữ liệu persistent mà không có authorization rõ ràng.

## 10. UI / UX

Trước khi sửa UI:

```text
.agents/rules/design-system.md
```

phải được đọc và tuân thủ.

Ưu tiên:

* component primitives hiện có;
* `cn()`;
* Button / Badge / Seal / GenreMark / EmptyState / Kbd;
* design tokens hiện tại;
* motion pattern hiện có.

Không tạo component trùng chức năng đã tồn tại.

Không tự ý thay đổi text tiếng Việt, nhãn hoặc thông báo hiện tại trừ khi đó là mục tiêu của task.

### Browser verification

Khi task thay đổi UI:

* Nếu browser tool khả dụng, kiểm tra giao diện thực tế.
* Kiểm tra các trạng thái loading / empty / error.
* Kiểm tra responsive behavior khi có liên quan.
* Chụp before/after khi khả thi và hữu ích.
* Không tuyên bố UI đã được runtime-verified nếu chưa thực sự quan sát nó.

## 11. Data-state requirements

Mọi danh sách hoặc bảng dữ liệu phải xem xét:

```text
Loading
Empty
Error
```

Trong đó:

* Loading dùng primitive hiện có.
* Empty phải có hành động rõ ràng khi phù hợp.
* Error phải có thông báo cụ thể và recovery action khi có thể.

Thiếu trạng thái quan trọng = chưa hoàn thành task UI.

## 12. Security

Không hard-code:

* API keys
* credentials
* access tokens
* private data

Kiểm tra:

* secret leakage;
* unsafe logging;
* injection;
* XSS;
* unsafe HTML/XHTML generation;
* storage exposure;
* authentication / authorization boundaries;
* CSP / security headers;
* unsafe external API calls;
* dependency risks.

Không ghi log raw API key hoặc credential.

Credential phía client phải luôn được xử lý theo các storage boundary hiện có.

## 13. Performance

Không tối ưu chỉ vì code "trông chậm".

Tối ưu khi có:

* profiling evidence;
* measurable bottleneck;
* clear algorithmic reason;
* hoặc requirement cụ thể.

Tránh:

* memoization dư thừa;
* abstraction không cần thiết;
* dependency mới chỉ để tối ưu một trường hợp nhỏ;
* tối ưu làm code khó bảo trì hơn mà không có lợi ích đo được.

## 14. Testing strategy

Test phải xác nhận behavior có ý nghĩa nghiệp vụ, không chỉ tái hiện implementation hiện tại.

Khi sửa:

* utility → test edge cases;
* service → test success + failure paths;
* hook → test state transitions;
* UI → test user-visible behavior khi phù hợp;
* persistence → test migration / concurrency / failure behavior nếu liên quan;
* retry / quota / network → test boundary conditions.

Không viết test mà assertion không thể fail khi logic nghiệp vụ bị phá vỡ.

## 15. Git diff review

Sau khi sửa:

1. Kiểm tra `git diff`.
2. Kiểm tra danh sách file thay đổi.
3. Xác nhận mọi thay đổi đều thuộc task.
4. Tìm accidental formatting hoặc cleanup ngoài scope.
5. Kiểm tra secret hoặc dữ liệu nhạy cảm bị đưa vào diff.
6. Kiểm tra test mới / test sửa có đúng mục đích.

Không báo hoàn thành nếu diff còn thay đổi ngoài scope mà không có lý do.

## 16. Documentation synchronization

Chỉ cập nhật documentation khi behavior, architecture, public contract hoặc developer workflow thực sự thay đổi.

Khi cần cập nhật, kiểm tra tối thiểu:

```text
README.md
AGENTS.md
docs/*
specs/*
```

Không sửa tài liệu chỉ để làm diff đẹp.

Không duy trì các mô tả architecture đã bị superseded như thể chúng vẫn hoạt động.

## 17. Autonomous decisions

Agent có thể tự quyết định implementation detail khi:

* nằm trong scope;
* reversible;
* không tạo external obligation;
* không thay đổi quyền truy cập;
* không xóa dữ liệu;
* phù hợp architecture hiện tại.

Phải dừng và yêu cầu direction khi quyết định có thể:

* thay đổi persistent schema đáng kể;
* tạo breaking change;
* thay đổi authentication / permissions;
* ảnh hưởng production;
* gây chi phí bên ngoài;
* hoặc tạo ra behavior substantially different mà không có safe default.

## 18. Blocker protocol

Khi bị blocker:

1. Xác nhận blocker bằng evidence.
2. Thử các phương án an toàn còn trong scope.
3. Hoàn thành phần không bị block.
4. Nói rõ chính xác phần nào bị block.
5. Chỉ ra thông tin hoặc action duy nhất còn thiếu.
6. Không giả vờ hoàn thành.

## 19. Completion report

Báo cáo cuối task phải nêu:

```text
Files changed
Root cause
Implementation
Tests/checks executed
Actual results
Remaining limitations
```

Chỉ ghi kết quả đã được xác minh.

Không dùng "PASS" cho một check chưa chạy.

Không mô tả partial work như hoàn thành.

## 20. Final checklist

Trước khi kết thúc task:

* [ ] Đã hiểu architecture hiện tại.
* [ ] Đã đọc Constitution và relevant project rules.
* [ ] Đã kiểm tra working tree trước khi sửa.
* [ ] Không overwrite thay đổi có sẵn của người dùng.
* [ ] Đã sửa root cause.
* [ ] Không có unrelated changes.
* [ ] Đã xem xét edge cases.
* [ ] Đã kiểm tra security implications.
* [ ] Đã thêm hoặc cập nhật test phù hợp.
* [ ] `npm run lint` đã được chạy.
* [ ] `npm test` đã được chạy.
* [ ] `npm run build` đã được chạy.
* [ ] Security/CI checks đã được kiểm tra khi có liên quan.
* [ ] Đã review final diff.
* [ ] Mọi completion claim đều có evidence.

**Completion status phải phản ánh đúng trạng thái thực tế của repository.**
