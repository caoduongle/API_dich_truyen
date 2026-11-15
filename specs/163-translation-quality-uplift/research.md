# Phase 0 Research: Nâng cao chất lượng dịch truyện (Translation Quality Uplift)

**Feature**: `163-translation-quality-uplift`
**Date**: 2026-11-15
**Spec**: [spec.md](./spec.md) | **Repo Review**: [repo-review.md](./repo-review.md)

Tài liệu này giải quyết toàn bộ các quyết định kỹ thuật để thực thi các yêu cầu `FR-001` đến `FR-025` trong phạm vi kiến trúc Pure Client-Side SPA hiện tại.

---

## R1. Lọc từ điển theo ngữ cảnh & Thay thế tiền xử lý an toàn (FR-001, FR-002, FR-003, FR-004)

- **Decision**:
  1. Tạo module thuần `src/lib/glossaryMatch.ts` cung cấp:
     - `selectRelevantGlossary(sourceText, glossary, options)`: Quét `sourceText` (khớp cả chính xác lẫn biến thể phồn/giản qua `canonicalizeHan` trong `src/lib/sinoNormalize.ts`) để chỉ lấy các mục thực sự xuất hiện trong đoạn văn, cộng với các mục được đánh dấu `isPinned === true` (giới hạn an toàn tối đa 50 mục ghim). Dùng thống nhất cho cả 3 giai đoạn: Dịch thô (`buildRawTranslationPayload`), Chuốt văn (`buildPolishTranslationPayload`), và Kiểm duyệt QA (`buildQaCritiquePayload`).
     - `substituteGlossaryTermsSafely(sourceText, glossary)`:
       - Chỉ chú thích/thay thế vào văn bản nguồn đối với các mục từ điển có độ dài chữ Hán $\ge 2$ ký tự (`Array.from(term.trim()).length >= 2`).
       - Các mục chỉ có $1$ ký tự Hán (ví dụ họ `林`, `萧`, `叶`) **không bao giờ** bị thay thế cứng vào văn bản nguồn để tránh làm hỏng từ ghép thông dụng (`森林` → `森[Lâm]`), nhưng vẫn được liệt kê trong bảng từ điển tham chiếu gửi cho AI nếu ký tự đó xuất hiện trong văn bản.
       - Trong `buildRawTranslationPayload`, khi chú thích từ điển vào văn bản nguồn chưa có ngoặc vuông, sử dụng dạng chú thích nội tuyến giữ nguyên chữ Hán gốc kèm nghĩa Việt `Chữ_Hán[Tên_Việt]` (hoặc `[Tên_Việt]` nếu đầu vào đã đánh dấu sẵn) dưới tiêu đề `--- VĂN BẢN TIẾNG TRUNG GỐC ---` (hoặc `--- VĂN BẢN TIẾNG TRUNG (ĐÃ ĐÁNH DẤU TỪ ĐIỂN) ---` khi văn bản đầu vào đã có sẵn ngoặc vuông). Cách này vừa gửi văn bản nguồn đúng 1 lần, vừa giữ nguyên mặt chữ Hán gốc tại chỗ cho AI và tương thích 100% với các kiểm thử hiện có (`prompts.test.ts`, `directTranslationEngine.test.ts`).
       - Thực hiện thay thế một lượt (single-pass) ưu tiên cụm dài nhất trước (longest-match-first) trên cả dạng gốc và dạng chuẩn hóa phồn/giản, bảo đảm không thay thế chồng lấn bên trong đoạn `[...]` đã thay.
       - Áp dụng cùng quy tắc ngưỡng $\ge 2$ ký tự Hán và longest-match-first cho `fallbackSinoVietnameseLine` trong `src/services/translation/rawTranslation.ts` và cho `useGlossaryApply.ts` (khi tạo `processedSourceText`).
       - Trong `chapterTranslationService.ts`, luôn truyền `chapter.sourceText` gốc làm nguồn đối chiếu cho `selectRelevantGlossary`, `evaluatePolishRoundFidelity`, `runDeterministicTranslationChecks` và `repairChapterCriticalIssuesDirect` ngay cả khi chương có `processedSourceText`.
     - `resolveGlossaryConflicts(glossary)`: Khi có nhiều mục trùng chữ Hán chuẩn hóa nhưng khác `vietnamese`, chọn tất định theo thứ tự ưu tiên: `isPinned === true` > `origin === 'manual'` > `origin === 'guideline'` > `origin === 'scanned'`, nếu hòa thì ưu tiên mục có `createdAt` mới nhất (hoặc vị trí cuối cùng), đồng thời trả về danh sách cảnh báo xung đột.
- **Rationale**:
  - Loại bỏ hoàn toàn lỗi làm vỡ từ ghép tiếng Trung do mục từ điển 1 ký tự (F1).
  - Giảm 60–90% kích thước phần từ điển trong prompt với dự án có $\ge 200$ mục (F2, SC-005), đồng thời khắc phục việc QA chỉ cắt mù 150 mục đầu tiên.
- **Alternatives considered**:
  - *Dùng bộ tách từ tiếng Trung (Chinese word segmenter như结巴/jieba-wasm)*: Bị loại vì vi phạm nguyên tắc tối thiểu hóa dependency của Constitution II và làm tăng kích thước bundle đáng kể. Ngưỡng độ dài ký tự Hán $\ge 2$ kết hợp ưu tiên cụm dài nhất giải quyết trực tiếp 99%+ trường hợp khớp nhầm họ/đơn tự trong tiểu thuyết mạng mà không cần thêm thư viện.

---

## R2. Mở rộng Schema Hồ sơ nhân vật & Bảo toàn khi đồng bộ (FR-008, FR-008a–c, SC-010)

- **Decision**:
  1. Mở rộng `GlossaryItem` (và `PendingGlossaryItem`, `GlossaryEntry`) trong `src/types.ts` với các trường tùy chọn (additive, optional):
     - `isPinned?: boolean`: Đánh dấu thuật ngữ/nhân vật cốt lõi luôn được ưu tiên.
     - `characterProfile?: CharacterProfile`: Chỉ áp dụng khi `type === 'character'`, gồm:
       - `gender?: 'male' | 'female' | 'neutral' | 'unknown'`
       - `defaultSelfPronoun?: string` (ngôi tự xưng mặc định: `ta`, `bản tọa`, `thiếp`, `tôi`...)
       - `defaultNarrativePronoun?: string` (đại từ ngôi thứ 3 trong lời dẫn: `hắn`, `y`, `chàng`, `nàng`, `cô`, `lão`...)
       - `relations?: Array<{ targetName: string; selfPronoun: string; targetPronoun: string; note?: string }>` (quy tắc xưng hô 2 chiều với nhân vật/vai trò cụ thể).
  2. Tương thích ngược & Đồng bộ (FR-008a, FR-008b):
     - IndexedDB lưu object JSON trong store `projects` (`keyPath: 'id'`); trường tùy chọn không đòi hỏi tăng DB schema version và đọc trực tiếp được mọi dự án/bản sao lưu cũ.
     - Tạo hàm `mergeGlossaryPreservingProfiles(localGlossary, remoteGlossary)` sử dụng trong `driveBundleSync.ts` (`pullBundle`) và `driveProjectSync.ts` (monolithic pull): khi bản kéo về từ thiết bị cũ không có `characterProfile` hoặc `isPinned` cho một mục trùng `id` hoặc trùng chữ Hán chuẩn hóa với bản local, tự động giữ lại `characterProfile` và `isPinned` của local.
- **Rationale**:
  - Người dùng đã chọn Phương án A trong phiên làm rõ (2026-11-15). Cấu trúc tùy chọn bảo đảm 100% tương thích ngược với dữ liệu cũ và cho phép kiểm tra tất định đại từ theo giới tính.
- **Alternatives considered**:
  - *Tạo bảng/store IndexedDB riêng cho CharacterProfile*: Bị loại vì làm phức tạp hóa giao dịch lưu trữ, xuất/nhập JSON và đồng bộ Google Drive, trong khi nhân vật vốn đã là một `GlossaryItem` có `type === 'character'`.

---

## R3. Ngữ cảnh liên tục giữa các phân đoạn và giữa các chương (FR-006, FR-007)

- **Decision**:
  1. Định nghĩa `ContinuityContext` trong `src/services/translation/types.ts`:
     - `previousSourceTail?: string` (1–2 đoạn văn cuối của phân đoạn/chương trước, tối đa 350 ký tự).
     - `previousTranslationTail?: string` (1–2 đoạn văn cuối của bản dịch chương/phân đoạn trước, tối đa 500 ký tự).
  2. **Giữa các phân đoạn trong cùng chương (FR-006)**:
     - Trong `rawWithContentSplitDirect` và `polishWithContentSplitDirect`, khi văn bản được chia thành các phân đoạn $C_0, C_1, \dots, C_{k-1}$, phân đoạn $C_i$ ($i > 0$) luôn nhận `previousSourceTail` trích từ cuối $C_{i-1}$ (và `previousTranslationTail` nếu có sẵn như trong `polishWithContentSplitDirect`).
     - Vì `previousSourceTail` được trích từ mảng `chunks` trước khi gọi API, cơ chế này hoạt động ngay cả khi các phân đoạn chạy song song (`concurrencyLimit = 2`).
     - Khối ngữ cảnh được đóng khung rõ trong prompt: `[NGỮ CẢNH LIỀN TRƯỚC — CHỈ ĐỌC ĐỂ GIỮ MẠCH TRUYỆN & XƯNG HÔ, TUYỆT ĐỐI KHÔNG DỊCH LẠI]` và **bắt buộc đặt TRƯỚC** tiêu đề `--- VĂN BẢN TIẾNG TRUNG GỐC ---` để phần văn bản sau tiêu đề này luôn chỉ chứa đúng nội dung cần dịch của phân đoạn hiện tại.
     - Thêm bước hậu kiểm `stripDuplicatedContinuityOverlap` để cắt bỏ nếu AI vô tình dịch lặp lại câu ngữ cảnh ở đầu phân đoạn $C_i$.
  3. **Giữa các chương liên tiếp (FR-007)**:
     - Trong `executeSingleChapterTranslation` (`src/services/chapterTranslationService.ts`) và `useWorkspaceState.ts`, xác định chương đứng liền trước trong mảng `project.chapters`. Nếu chương trước đã có trong IndexedDB và có bản dịch hoàn chỉnh (`polishedTranslation || rawTranslation`), trích tối đa 2 đoạn cuối làm `ContinuityContext`. Nếu chưa dịch hoặc đang dịch song song, bỏ qua ngay mà không chờ.
- **Rationale**:
  - Giữ mạch xưng hô và ngôi kể tại ranh giới cắt chunk và mở đầu chương mới với chi phí token rất nhỏ ($\le 250$ token/lượt) và không làm chậm chế độ dịch song song.
- **Alternatives considered**:
  - *Gọi AI tóm tắt chương trước làm context*: Bị loại vì tốn thêm lượt gọi API và tăng độ trễ.

---

## R4. Cấu trúc Prompt, Thứ tự ưu tiên & Chống thêm thắt khi chuốt văn (FR-010, FR-011, FR-012, FR-019)

- **Decision**:
  1. **Chuẩn hóa chỉ dẫn GĐ1 (`buildRawTranslationPayload`)**:
     - Sửa lỗi đánh số mục 5–9 (tách riêng mục 5 trích xuất thực thể, mục 6 khôi phục tên nước ngoài/danh từ chỉ loại, mục 7 bảo toàn chữ Hán phồn/giản gốc, mục 8 bỏ ngoặc vuông `[Tên_Việt]`, mục 9 phong cách thể loại, mục 10 quy tắc cẩm nang).
     - Chỉ gửi **1 khối văn bản nguồn duy nhất** (bản đã đánh dấu `[Tên_Việt]` an toàn cho từ $\ge 2$ ký tự), xóa bỏ việc gửi lặp cả bản gốc lẫn bản đánh dấu (F3).
     - Ghi rõ bảng thứ tự ưu tiên quy tắc (FR-019) ở cả 3 giai đoạn:
       `(1) Bảo toàn 100% nội dung & cấu trúc đoạn 1-1 > (2) Cẩm nang & quy tắc xưng hô của truyện > (3) Hồ sơ nhân vật & Từ điển > (4) Yêu cầu biên tập bổ sung > (5) Phong cách thể loại/tông giọng mặc định`.
  2. **Chuốt văn trung thành nguyên tác (`buildPolishTranslationPayload` & `callPolishDirectCore`)**:
     - Giữ nguyên chuỗi fallback trong `[YÊU CẦU BIÊN TẬP BỔ SUNG TỪ NGƯỜI DÙNG]` để bảo toàn kiểm thử hiện có (`prompts.test.ts`) và Constitution Principle IV, đồng thời bổ sung quy tắc bắt buộc ở cấp cao nhất trong `systemInstruction` và `[HƯỚNG DẪN BIÊN TẬP VĂN HỌC]`: ưu tiên tuyệt đối trung thành nguyên tác, nghiêm cấm thêm thắt tình tiết, tên riêng hoặc hình ảnh không có trong nguồn (FR-010).
     - Trong `callPolishDirectCore`, khi `params.roundIndex !== undefined`, sử dụng đúng `strategy.temperature` từ `getPolishStrategyForRound(roundIndex, totalRounds)` (`0.4, 0.5, 0.55, 0.6, 0.65` như đã được kiểm thử trong `text.test.ts`) thay vì biểu thức cố định `roundIndex === 2 ? 0.5 : 0.3` (FR-012); khi không truyền cả `temperature` lẫn `roundIndex`, giữ mặc định `0.3`.
  3. **Cổng hậu kiểm độ trung thành sau mỗi lượt chuốt (`evaluatePolishRoundFidelity`) (FR-011)**:
     - Sau mỗi lượt chuốt $j$, đối chiếu `candidatePolished` với `sourceText` và `previousRoundText` trên 3 tín hiệu tất định:
       1. Số lượng vi phạm từ điển (`checkGlossaryCompliance`): không được cao hơn `previousRoundText` đối với các thuật ngữ đã dịch đúng ở `previousRoundText`.
       2. Cụm tên riêng viết hoa mới phát sinh (`detectUngroundedProperNouns` áp dụng từ lượt $j \ge 2$ trở đi): phát hiện cụm $\ge 2$ từ viết hoa liên tiếp trong `candidatePolished` không nằm ở đầu câu/sau dấu câu và **các âm tiết (không phân biệt hoa/thường) hoàn toàn chưa từng xuất hiện** trong `previousRoundText`, `rawTranslation`, `sourceText` hay `glossary` (tránh báo giả khi lượt chuốt viết hoa lại tên môn phái/địa danh đã có ở dạng chữ thường).
       3. Độ lệch cấu trúc đoạn văn (`validateParagraphParity`) và tỉ lệ sót chữ Hán.
     - Nếu bất kỳ tín hiệu nào suy thoái so với `previousRoundText`, hủy kết quả lượt $j$, giữ lại `previousRoundText`, ghi log cảnh báo cụ thể và dừng sớm vòng lặp chuốt của chương đó.
- **Rationale**:
  - Chặn đứng hiện tượng "văn hoa nhưng bịa đặt" hoặc rơi mất thuật ngữ từ điển khi chạy nhiều vòng chuốt văn (F7, F8).
- **Alternatives considered**:
  - *Dùng một lời gọi AI riêng sau mỗi lượt chuốt để chấm điểm trung thành*: Bị loại vì làm nhân đôi chi phí API của GĐ2; bộ kiểm tra tất định chạy dưới 2ms trên trình duyệt.

---

## R5. Kiểm duyệt mở rộng, Hợp nhất lỗi tất định + AI & Sửa có mục tiêu theo đoạn (FR-005, FR-009, FR-013–FR-018, FR-024, FR-025)

- **Decision**:
  1. **Mở rộng phân loại lỗi QA (`QaIssueType`)**:
     - Bổ sung `'mistranslation' | 'pronoun' | 'raw_leak'` vào union type hiện có (`'omission' | 'addition' | 'repetition' | 'terminology' | 'other'`).
     - Cập nhật schema JSON trong `buildQaCritiquePayload`, validator `isQaCritiqueIssue` trong `src/lib/text.ts`, và bảng tiêu đề `QA_TYPE_TITLES` trong `src/services/auditBridgeService.ts`.
     - Bổ sung trường tùy chọn `paragraphIndex?: number` (chỉ số đoạn 0-based), `source?: 'deterministic' | 'ai_critique'`, `repaired?: boolean` vào `DirectQaCritiqueIssue`.
  2. **Kiểm tra tất định (`runDeterministicTranslationChecks`)**:
     - Chạy tự động cuối mỗi chương (không tốn quota AI):
       - Kiểm tra tuân thủ từ điển (`checkGlossaryCompliance`, FR-005).
       - Kiểm tra nhất quán đại từ theo giới tính nhân vật (`checkCharacterPronounConsistency`, FR-009): Với các đoạn văn có đúng 1 nhân vật đã khai báo `gender: 'male' | 'female'` hoặc `defaultNarrativePronoun`, kiểm tra sự xuất hiện của đại từ ngôi thứ 3 ngược giới tính (ví dụ nhân vật `male` nhưng câu dẫn dùng `nàng/cô ấy`, hoặc nhân vật `female` nhưng câu dẫn dùng `hắn/gã`).
       - Nếu chương/phân đoạn có cờ `isPartial === true` (đã qua đường cứu nguy phiên âm Hán-Việt dự phòng), gắn nhãn cảnh báo cấp chương thay vì báo tràn ngập lỗi từ điển/Hán tự giả.
     - Hợp nhất & khử trùng lặp (`mergeAndDeduplicateQaIssues`) với kết quả AI QA Critique theo `(paragraphIndex, categoryGroup)` (FR-015). Để bảo toàn hợp đồng `resolveChapterQaIssues` (`src/types/runtimeHardening.ts`) và các kiểm thử `chapterTranslationService.test.ts`:
       - Chỉ ghi đè `chapter.qaIssues` khi `enableAiQaCritique && qaRunSucceeded`; nếu `qaCritiqueDirect` ném lỗi hoặc `enableAiQaCritique = false`, giữ nguyên `chapter.qaIssues` cũ.
       - Chỉ gắn thêm thuộc tính `paragraphIndex` vào object lỗi khi tìm thấy đoạn văn khớp thật sự (`idx >= 0`) trong `translatedText`, không gắn các thuộc tính `undefined` dư thừa làm sai lệch cấu trúc dữ liệu của lỗi AI gốc.
  3. **Sửa có mục tiêu theo đoạn (`repairChapterCriticalIssuesDirect` trong `src/services/translation/targetedRepair.ts`)**:
     - Sử dụng hàm gióng đoạn `mapTranslatedParagraphToSourceWindow(paragraphIndex, sourceParagraphs, translatedParagraphs)` có tính đến độ lệch dòng tiêu đề chương (`isChapterTitleLine`) và cửa sổ $\pm 1$ đoạn nguồn để không lấy nhầm đoạn tiếng Trung khi số đoạn lệch nhẹ trong ngưỡng cho phép.
     - Chỉ dịch lại đúng các đoạn văn (`paragraphIndex`) có lỗi `critical` (hoặc khi người dùng bấm sửa trên lỗi đó), kèm 1 đoạn trước và 1 đoạn sau làm ngữ cảnh chỉ-đọc, cùng trích đoạn tiếng Trung tương ứng và bảng từ điển/hồ sơ nhân vật.
     - Hậu kiểm đoạn vừa sửa bằng `validateTranslationOutput` + `runDeterministicTranslationChecks` trên đoạn đó. Nếu đạt và không phát sinh lỗi mới, ghép đúng đoạn đó vào mảng đoạn văn (các đoạn khác giữ nguyên từng ký tự, FR-016, FR-017). Nếu thất bại hoặc gặp `AbortSignal`/`CONTENT_BLOCKED`/hết quota, giữ nguyên đoạn cũ và bảo lưu lỗi gốc (FR-018).
     - Cài đặt tùy chọn `enableAutoTargetedRepair` (mặc định `false`, lưu `localStorage` khóa `'enable_auto_targeted_repair'` trong `useAIConfig`, hiển thị trong `TranslationQualitySection.tsx`); khi bật chỉ chạy tối đa 1 lượt sửa tự động sau QA cho mỗi chương (FR-024, FR-025).
- **Rationale**:
  - Kết hợp ưu thế tốc độ/độ chính xác 100% của kiểm tra tất định cho từ điển & đại từ với khả năng hiểu ngữ nghĩa sâu của AI QA Critique, đồng thời tiết kiệm tối đa quota khi sửa lỗi.
- **Alternatives considered**:
  - *Dịch lại toàn bộ chương khi QA phát hiện lỗi critical*: Bị loại vì tốn 100% quota của cả chương và có nguy cơ làm hỏng các đoạn đã dịch tốt.

---

## R6. Bộ mẫu đánh giá chất lượng & Công cụ đo lường lặp lại được (FR-020, SC-001–SC-011)

- **Decision**:
  - Tạo bộ dữ liệu mẫu cố định `src/services/translation/__tests__/fixtures/qualityEvalCorpus.ts` và bộ chấm điểm tất định `src/services/translation/qualityEvaluator.ts`.
  - Bộ mẫu gồm 5 kịch bản đại diện (từ điển 1 ký tự vs từ ghép, từ điển 250 mục + biến thể phồn/giản, hội thoại qua ranh giới tách đoạn giữa nam/nữ, chuốt văn nhiều lượt có tên riêng bịa thêm, và bản dịch cài sẵn 5 loại lỗi QA).
  - `qualityEvaluator.ts` xuất hàm `runQualityEvaluationSuite()` tính toán bảng chỉ số tất định và so sánh với baseline trước khi sửa để kiểm chứng tự động trong Vitest (`src/services/translation/__tests__/qualityEvaluation.test.ts`).
- **Rationale**:
  - Đáp ứng yêu cầu chứng minh cải thiện chất lượng bằng số liệu đo được, chạy 100% offline trong `npm test` mà không cần gọi Gemini API.
- **Alternatives considered**:
  - *Chỉ kiểm thử bằng LLM-as-a-judge trực tuyến*: Bị loại vì không tất định, tốn quota của người dùng và không chạy được trong cổng CI `npm test`.
