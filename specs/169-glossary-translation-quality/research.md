# Phase 0 Research: Cải Tiến Từ Điển Để Cải Thiện Chất Lượng Dịch

**Feature**: `169-glossary-translation-quality` | **Date**: 2026-11-27

## Tổng quan quyết định kỹ thuật

Không còn điểm mơ hồ (`NEEDS CLARIFICATION`) nào sau bước `/speckit-clarify`. Mọi quyết định dưới đây đều bám sát kiến trúc Pure Client-Side SPA (React 19 + TypeScript + Vite + Tailwind CSS v4 + IndexedDB + Gemini SDK/REST client) và nguyên tắc MVC (`src/lib/`, `src/services/` ↔ `src/hooks/` ↔ `src/components/`).

---

### Decision 1: Truyền ngữ cảnh từ điển đầy đủ và nhóm theo vai trò đồng nhất qua cả 3 pha (Raw, Polish, QA)
- **Decision**:
  - Thêm helper thuần túy `groupGlossaryByRole(entries, matchedInSource)` trong `src/lib/glossaryMatch.ts` để phân nhóm các mục xuất hiện trong văn bản theo thứ tự vai trò ưu tiên: (1) Nhân vật có `characterProfile`, (2) Nhân vật khác, (3) Địa danh (`location`), (4) Thuật ngữ/Bí kíp (`term`), (5) Thành ngữ/Khác (`phrase`/`other`), và tách riêng nhóm mục ghim tham chiếu (`isPinned && !matched`).
  - Bổ sung đầy đủ `type`, `note`, `variants`, và `characterProfile` vào `formatPolishGlossaryLine` trong `src/services/ai/prompts.ts` (khớp 100% thông tin ngữ cảnh với `buildRawTranslationPayload` và `buildQaCritiquePayload`), đồng thời nhóm tiêu đề phân khu rõ ràng trong prompt.
- **Rationale**:
  - Hiện tại `formatPolishGlossaryLine` trong `buildPolishTranslationPayload` chỉ in `- [chinese / variants] -> [vietnamese] (Bắt buộc dùng bản dịch này + profile)`, làm mất hoàn toàn trường `note` (ghi chú ngữ cảnh/vai vế/sắc thái) và `type`. Chuốt văn nhiều lượt vì thế thiếu ngữ cảnh và dễ chỉnh lệch sắc thái.
  - Sắp xếp và phân nhóm theo vai trò giúp mô hình ưu tiên chú ý nhân vật + quy tắc xưng hô trước khi đọc tới vật phẩm hay mục ghim phụ trợ.
- **Alternatives considered**:
  - Giữ nguyên danh sách phẳng theo thứ tự tạo trong mảng `project.glossary` → Bị loại vì khi có hàng trăm từ điển, các mục nhân vật quan trọng bị trôi xuống dưới cuối và bước chuốt văn vẫn thiếu `note`.

---

### Decision 2: Thống nhất giải quyết xung đột bao gồm cả trùng qua `variants` và chuẩn hóa Giản/Phồn thể
- **Decision**:
  - Mở rộng `resolveGlossaryConflicts` trong `src/lib/glossaryMatch.ts` dùng chung một bộ khóa chuẩn hóa `canonicalizeHan` trên cả `item.chinese` lẫn các dạng chuỗi trong `item.variants`, sử dụng cấu trúc Union-Find nhẹ hoặc nhóm tương đương để phát hiện và chọn duy nhất 1 `winningItem` cho mỗi cụm từ tương đương theo comparator tất định hiện có:
    `isPinned > origin (manual > guideline > scanned) > hasCharacterProfile > chineseLength > createdAt > id`.
  - Đếm xung đột dựa trên việc nhóm có >= 2 nghĩa tiếng Việt khác nhau (không phân biệt hoa/thường sau chuẩn hóa), giữ nguyên tính tương thích ngược với dữ liệu cũ không có `variants`.
- **Rationale**:
  - Hiện tại `resolveGlossaryConflicts` chỉ nhóm theo `canonicalizeHan(item.chinese)`. Nếu mục A có `chinese = "张三"` và mục B có `chinese = "小三", variants = ["张三"]`, cả hai không bị gộp trong khâu chọn mục thắng cuộc và cũng không báo xung đột. Union trên `chinese` + `variants` bảo đảm 1 nguồn sự thật duy nhất giữa bước dịch, QA và Chẩn đoán Sức khỏe từ điển.
- **Alternatives considered**:
  - Chỉ kiểm tra trùng ở UI `useGlossaryDuplicates.ts` → Bị loại vì logic dịch và kiểm tra ở `src/services/` cần chạy độc lập không phụ thuộc hook UI.

---

### Decision 3: Khớp thuật ngữ không chồng lấn (Longest-Match Span Masking) cho kiểm tra tuân thủ từ điển
- **Decision**:
  - Trích xuất logic quét vị trí khớp dài nhất không chồng lấn thành helper `findNonOverlappingParagraphTerms(sourceParagraph, candidateItems)` trong `src/lib/glossaryMatch.ts`.
  - Thứ tự quét trên đoạn gốc: sắp xếp ứng viên theo độ dài ký tự giảm dần (mỗi ứng viên gồm `chinese` và `variants`, hỗ trợ `canonicalizeHan` / `findCanonicalSubstring` tương tự `substituteGlossaryTermsSafely`). Khi một vị trí `[start, end)` đã bị cụm dài hơn chiếm chỗ (`claimed`), không cho phép cụm ngắn hơn nằm lọt trong vùng đã đánh dấu khớp nữa; đối với từ đơn 1 chữ Hán, giữ nguyên điều kiện không kẹp giữa chữ Hán khác.
  - `checkGlossaryCompliance` trong `src/services/translation/translationValidation.ts` dùng kết quả `findNonOverlappingParagraphTerms(srcSlice, checkableItems)` thay cho việc kiểm tra độc lập từng mục qua `paragraphContainsGlossaryTerm`.
- **Rationale**:
  - Khắc phục triệt để bug báo lỗi giả khi từ điển vừa có `"张三丰"` (`"Trương Tam Phong"`) vừa có `"三丰"` (`"Tam Phong"`) hoặc `"张"` (`"Trương"`).
  - Nếu `"三丰"` xuất hiện lại ở một vị trí khác ngoài `"张三丰"` trong cùng đoạn văn, vị trí mới đó chưa bị mask nên vẫn được kiểm tra chính xác (đáp ứng đủ FR-004 và FR-005).
- **Alternatives considered**:
  - Kiểm tra đơn giản bằng chuỗi `includes` → Không phân biệt được vị trí lồng nhau vs vị trí xuất hiện độc lập trong cùng đoạn văn.

---

### Decision 4: Ưu tiên từ loại trừ theo chương hiện tại, lọc nhiễu và tự động gợi ý giới tính an toàn
- **Decision**:
  - **Ưu tiên danh sách loại trừ (`prioritizeKnownTermsForChapter`)**: Trong `src/lib/glossaryMatch.ts`, tạo hàm nhận `(sourceText, knownGlossary, maxLimit = 150)`. Thuật toán đặt toàn bộ mục xuất hiện trực tiếp trong `sourceText` (kể cả Giản/Phồn thể và `variants`) lên đầu danh sách trước, rồi mới điền phần dư bằng các mục `isPinned` và mới nhất cho tới tối đa `maxLimit`. Cập nhật `buildAnalyzeGlossaryPayload` (`src/services/ai/prompts.ts`) và `useGlossaryScan.ts` để sử dụng hàm này thay vì `.map(g => g.chinese)` + `.slice(0, 150)` mù quáng.
  - **Lọc từ nhiễu (`isNoisyGlossaryTerm`)**: Lọc bỏ các đại từ/hư từ/cụm phổ thông vô nghĩa (như `我`, `你`, `他`, `她`, `它`, `我们`, `你们`, `他们`, `她们`, `它们`, `这里`, `那里`, `什么`, `没有`, `可以`, `自己`, `已经`, `一个`, ...) hoặc chuỗi toàn dấu câu/số/khoảng trắng trong `classifyDiscoveredEntitiesForGlossary` (`src/lib/glossaryMatch.ts`) và `useGlossaryScan.ts`. Nếu bị coi là nhiễu ở bước nhận diện thực thể mới: không thêm thẳng vào `glossary`; loại bỏ nếu hoàn toàn rác hoặc đẩy kiểm duyệt khi cần review.
  - **Tự động gợi ý giới tính nhân vật mới (`inferCharacterGenderFromContext`)**: Khi thực thể mới có `type === 'character'` và chưa có trong từ điển, phân tích `note` (vd: `"cô gái"`, `"thiếu nữ"`, `"nữ chính"`, `"tiểu thư"`, `"mẫu thân"`, `"sư tỷ"`, `"phu nhân"` → `'female'`; `"thiếu niên"`, `"nam chính"`, `"nam tử"`, `"sư huynh"`, `"phụ thân"`, `"lão giả"` → `'male'`) kết hợp với đoạn ngữ cảnh `sourceParagraph` đơn chủ thể (chỉ suy luận khi không đồng thời chứa dấu hiệu cả hai giới như `她` lẫn `他`). Gán `characterProfile: { gender }` cho mục mới; giữ `undefined` (không đoán bừa) nếu bằng chứng mơ hồ; không bao giờ ghi đè `manual` / `isPinned` / `characterProfile` đã tồn tại.
- **Rationale**:
  - Tái sử dụng hoàn toàn 1 helper thuần trong `src/lib/glossaryMatch.ts`, dùng chung cho cả quét thuật ngữ sỉ (`useGlossaryScan`) và trích xuất thực thể trong lúc dịch (`classifyDiscoveredEntitiesForGlossary`), không thêm external dependency.
- **Alternatives considered**:
  - Gọi thêm một AI call riêng chỉ để đoán giới tính và lọc nhiễu → Tốn thêm API quota 15 RPM vốn đang rất chặt (Feature 168); suy luận tất định từ `note` + `sourceParagraph` có độ trễ < 1ms và không tốn request API.

---

### Decision 5: Chẩn đoán Sức khỏe Từ điển & Lọc 1 chạm (FR-010, FR-011)
- **Decision**:
  - Thêm hàm thuần `computeGlossaryHealth(glossary)` trong `src/lib/glossaryMatch.ts` trả về `GlossaryHealthReport`:
    - `conflictGroupCount` và `conflictItemIds`: Đếm số nhóm xung đột có >= 2 bản dịch tiếng Việt khác nhau từ `resolveGlossaryConflicts` (tránh lặp code với luồng dịch).
    - `missingProfileCharIds`: Các mục có `type === 'character'` nhưng thiếu cả `characterProfile?.gender` (hoặc `gender === 'unknown'`) lẫn `characterProfile?.defaultNarrativePronoun`.
    - `incompleteViIds`: Các mục thiếu bản dịch tiếng Việt hoặc `vietnamese.trim().length === 0`.
  - Tạo sub-component `GlossaryHealthBar.tsx` trong `src/components/glossary-manager/` tuân thủ design system **Mực & Chu Sa** (dùng `Badge`, `Button`, `cn()`, `lucide-react`, không dùng emoji nền tảng, bảng màu `parchment` / `polish` / `amber-950/amber-300`). Cho phép bật/tắt `healthFilter` (`'all' | 'conflicts' | 'missing_profile' | 'incomplete'`) trong `useGlossaryState` và kết hợp mượt mà với các bộ lọc tìm kiếm/loại/nguồn/ngày hiện có.
- **Rationale**:
  - Đảm bảo 100% nhất quán giữa số lượng lỗi Sức khỏe từ điển hiển thị và hành vi giải quyết xung đột khi dịch.
- **Alternatives considered**:
  - Mở panel riêng như `DuplicatePanel` cho cả 3 loại vấn đề → Gây phân mảnh giao diện; thanh pill chẩn đoán lọc trực tiếp trên `GlossaryTable` cho phép vừa thấy ngay trạng thái sức khỏe, vừa dùng ngay thanh thao tác hàng loạt (như gán giới tính hàng loạt cho mục thiếu hồ sơ!) chỉ với 1 chạm.

---

### Decision 6: Chọn nhiều dòng & Thanh thao tác hàng loạt 4 hành động (FR-013, FR-014)
- **Decision**:
  - Lưu `selectedIds: Set<string>` trong `useGlossaryState.ts`, tự động `useEffect` lọc bỏ ID không còn trong `glossary`.
  - Hỗ trợ: checkbox từng dòng trong `GlossaryTableRow`, checkbox "Chọn trang hiện tại" ở header bảng, và nút nhanh "Chọn toàn bộ N mục đang lọc" / "Bỏ chọn" trong `GlossaryBulkActionBar.tsx`.
  - Triển khai 4 hành động nguyên tử qua `bulkUpdateGlossary` (ưu tiên gọi `onUpdateProject({ ...activeProject, glossary: nextGlossary })` trong 1 lần cập nhật state/DB, fallback lặp `onUpdateGlossaryItem` / `onDeleteGlossaryItem` nếu caller không truyền `onUpdateProject`):
    1. `bulkDeleteSelected()`: Hỏi xác nhận qua `showConfirm` nêu rõ số mục sẽ xóa.
    2. `bulkSetPinnedSelected(isPinned: boolean)`: Gắn/bỏ `isPinned`.
    3. `bulkSetTypeSelected(type: GlossaryType)`: Cập nhật phân loại hàng loạt.
    4. `bulkSetGenderSelected(gender: CharacterGender)`: Chỉ cập nhật `characterProfile.gender` cho các mục `item.type === 'character'`, giữ nguyên hoàn toàn `defaultSelfPronoun`, `defaultNarrativePronoun`, `relations` thông qua `normalizeCharacterProfile`, và thông báo rõ số nhân vật đã cập nhật (cũng như bỏ qua an toàn các mục không phải nhân vật nếu tập chọn hỗn hợp).
  - Đồng thời sửa nhỏ bug trong `saveEdit` (`useGlossaryState.ts#L503-513`): spread `...currentItem` trước khi ghi đè các trường sửa nhanh inline để không làm mất `isPinned`, `variants`, `characterProfile`, `sourceChapterId` khi sửa nhanh một dòng trên bảng!
- **Rationale**:
  - Xử lý tập chọn hỗn hợp an toàn, không xóa nhầm `characterProfile` của các mục đã chỉnh sửa kỹ, và cập nhật 1 lần cho hàng trăm mục chỉ trong vài mili-giây.
- **Alternatives considered**:
  - Thực hiện vòng lặp gọi `onUpdateGlossaryItem` / `onDeleteGlossaryItem` từng phần tử khi có `onUpdateProject` → Gây N lần render & N lần ghi IndexedDB khi chọn 50–200 mục.

---

### Decision 7: Nhập tệp 2 chế độ (`Chỉ thêm thuật ngữ` vs `Thay toàn bộ thuật ngữ`) (FR-015, FR-016)
- **Decision**:
  - Định nghĩa `export type GlossaryImportMode = 'append' | 'replace_all'` và `prepareFileDeduplicatedItems(parsedItems)` trong `src/services/glossaryIO.ts`. Mở rộng `GlossaryImportPreview` với trường `allValidItems: Omit<GlossaryItem, 'id'>[]` chứa toàn bộ danh sách mục hợp lệ (đã khử trùng nội bộ tệp và giữ nguyên `variants`, `isPinned`, `characterProfile`, `createdAt`, `origin`) sẵn sàng cho chế độ `replace_all`.
  - Cập nhật `ImportGuidelinesModal.tsx`: hiển thị bộ chọn 2 chế độ rõ ràng (`Chỉ thêm thuật ngữ` mặc định vs `Thay toàn bộ thuật ngữ`).
    - Khi chọn `Chỉ thêm thuật ngữ`: giữ nguyên phần xử lý `conflicts` (`review` / `skip` / `overwrite`).
    - Khi chọn `Thay toàn bộ thuật ngữ`: ẩn phần xử lý xung đột với từ điển cũ, hiển thị khối cảnh báo màu hổ phách (`amber-950/40 border-amber-800/50`) nêu rõ tổng số mục hiện tại (`existingGlossaryCount`) sẽ bị thay thế bởi `importPreview.allValidItems.length` mục mới và xác nhận hàng chờ kiểm duyệt (`pendingGlossary` / `reviewQueue`) vẫn được giữ nguyên; chặn nút xác nhận nếu `allValidItems.length === 0`.
  - Cập nhật `confirmImport(strategy, importMode = 'append')` trong `useGlossaryState.ts`: khi `importMode === 'replace_all'`, yêu cầu xác nhận kép qua `showConfirm` nếu chưa xác nhận (hoặc modal warning rõ ràng + `showConfirm` an toàn), chặn nếu `allValidItems.length === 0`, tạo ID mới cho các mục nhập vào, cập nhật `activeProject.glossary` (và chỉ `glossary`, **không** đụng `activeProject.pendingGlossary` và `reviewQueue`), xóa `selectedIds`.
- **Rationale**:
  - Đáp ứng trọn vẹn cả luồng UI có preview/cảnh báo lẫn tính an toàn dữ liệu khi người dùng nhập nhầm tệp rỗng hoặc lỗi.
- **Alternatives considered**:
  - Dùng lại `onAddGlossaryItems` cho chế độ thay toàn bộ → Không xóa được các mục cũ và dễ trộn lẫn mục mới với rác cũ.
