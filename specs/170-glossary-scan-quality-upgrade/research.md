# Phase 0 Research: Cải Tiến Chất Lượng Quét Thuật Ngữ Cho Mô Hình Tốc Độ Cao

**Feature**: `170-glossary-scan-quality-upgrade` | **Date**: 2026-11-27

## Tổng quan nguyên nhân thực tế & chiến lược giải quyết

Phân tích bộ 592 mục do mô hình nhẹ (`gemini-3.5-flash-lite`) trích xuất cho thấy 5 điểm nghẽn cốt lõi trong pipeline hiện tại (`glossaryPrompts.ts` → `prompts.ts` → `directGlossaryEngine.ts` → `useGlossaryScan.ts` / `useWorkspaceState.ts`):
1. Mô hình nhẹ trượt sang **Bính âm tiếng Phổ thông** (`huò zūn`, `Yì Tiān Lěi`, `Dào Gé Lā Sī`, `Jichang`, `Yuan`, `Hai`) hoặc để sót chữ Hán (`秦局`) trong cột `pinyin`/`vietnamese`, và để rò chữ Hán vào `note` (`đi cùng 李倩`, `'见鬼群'`, `梧桐 và 十里亭`).
2. Mô hình nhẹ trích xuất tràn lan **từ phổ thông** (`电脑`, `步行街`, `匿名`), **câu nói** (`我想看鬼`), **mã ngắn** (`A1`, `A2`), **từ đơn 1 chữ Hán rủi ro** (`海`, `昆`, `鸢`).
3. **Mảnh cắt cụt / biến thể thừa** với mục đã tồn tại (`苍一` khi đã có `钱仓一`, `魏成` vs `魏成和`, `陈明` vs `陈明警官`, `保罗` vs `保罗船长`, `天马` vs `天马博士`, `长兰` vs `长兰小区`, `消失的国度` vs `消失的古国`, `侥幸` vs `侥幸2`).
4. **Thiếu neo ngữ cảnh Vòng 1**: `useGlossaryScan.ts` chỉ truyền `knownChineseTerms` khi `loop > 1` (Vòng 1 truyền `[]`), chưa truyền nghĩa tiếng Việt tham chiếu của từ điển hiện có, và chưa truyền `genre`/`tone`/`description` của dự án.
5. **Thiếu cổng hậu kiểm phân 3 luồng & chẩn đoán lỗi định dạng**: `useGlossaryScan.ts` và `useWorkspaceState.ts` chưa có cổng đánh giá 3 mức (`accept` / `review` / `reject`) nên từ lỗi/nghi ngờ lọt thẳng vào `glossary`.

---

### Decision 1: Tách module thuần `src/lib/glossaryScanQuality.ts` cho bộ lọc & cổng hậu kiểm quét
- **Decision**: Tạo module thuần mới `src/lib/glossaryScanQuality.ts` chứa toàn bộ detector ngôn ngữ (Bính âm, rò chữ Hán trong note), bộ lọc từ phổ thông/mã ngắn/câu dài, kiểm tra chồng lấn mảnh cắt với từ điển sẵn có, và hàm hợp nhất `evaluateScannedTermCandidate` + `classifyScannedGlossaryBatch`.
- **Rationale**: Giữ `src/lib/glossaryMatch.ts` (đã ~1.200 dòng) gọn gàng dễ bảo trì theo `repo-engineering-review`, đồng thời tái dùng lại các primitive có sẵn trong `glossaryMatch.ts` (`countHanChars`, `isNoisyGlossaryTerm`, `inferCharacterGenderFromContext`, `prioritizeKnownTermsForChapter`) và `sinoNormalize.ts` (`canonicalizeHan`, `isHanEquivalent`).
- **Alternatives considered**: Nhồi thêm ~350 dòng vào `glossaryMatch.ts` → Gây phình to file và khó tách biệt unit test cho riêng bài toán scan quality.

---

### Decision 2: Bộ phát hiện Bính âm tiếng Phổ thông & Rò rỉ chữ Hán không tốn API call
- **Decision**:
  - **`detectMandarinPinyin(text)`**: Phát hiện:
    1. Thanh điệu Bính âm (`ā á ǎ à ē é ě è ī í ǐ ì ō ó ǒ ò ū ú ǔ ù ǖ ǘ ǚ ǜ`).
    2. Tổ hợp Bính âm tiếng Hoa không tồn tại trong âm Hán-Việt chuẩn (ví dụ: `zh`, `sh`, `q+nguyên âm`, `x+i/u/a/e/o` như `xiǎo/xiao`, `zhe`, `zhu`, `shu`, `jichang`, `weier`, `tianma`, `guang`, v.v. khi chuỗi không có thanh sắc/hỏi/ngã/nặng tiếng Việt đặc trưng hoặc có âm tiết đặc thù như `zūn`, `yì`, `kūn`, `wú`, `nì`). Lưu ý cẩn trọng tránh false positive với tên tiếng Anh thật như `Robert`, `Hall`, `Jack`, `Alice`, `Edward`, `Wilson`, `Will` khi nằm ở cột `vietnamese`!
  - **`containsHanChars(text)`** và **`sanitizeScannedNote(note)`**: Nếu `pinyin` chứa Han hoặc Mandarin Pinyin → định tuyến `review` (không tự động thêm vào từ điển chính). Nếu `note` chứa Han → thử làm sạch phần chữ Hán/ngoặc thô; nếu phần tiếng Việt sạch còn lại đủ nghĩa (`>= 6` ký tự và chứa chữ cái tiếng Việt) thì giữ bản sạch, ngược lại đưa `review`.
  - **Kiểm tra cột `vietnamese` nghi ngờ Bính âm**: Nếu từ gốc hoàn toàn chữ Hán (`countHanChars(chinese) >= 1`) và `vietnamese` có dấu thanh điệu Bính âm HOẶC trùng khớp hoàn toàn/chỉ là dạng Bính âm không dấu của `pinyin` kiểu Bính âm (như `Yuan`, `Hai`) mà không phải từ Hán-Việt/tiếng Anh rõ ràng → định tuyến `review` với lý do cụ thể.
- **Rationale**: Chạy hoàn toàn tất định < 1ms trên client, 0 API call bổ sung, chặn triệt để 100% trường hợp `huò zūn`, `Yì Tiān Lěi`, `秦局`, `đi cùng 李倩`.
- **Alternatives considered**: Gọi thêm 1 AI pass sửa phiên âm → Tốn gấp đôi RPM (rất nguy hiểm trên free tier 15 RPM của `flash-lite`).

---

### Decision 3: Phân tách dứt khoát "Loại bỏ nhiễu (Reject)" vs "Cần kiểm duyệt (Review)" vs "Chấp nhận (Accept)"
- **Decision**:
  - **`reject` (loại thẳng khỏi từ điển & hàng chờ)**:
    1. Thực thể rỗng, toàn số/dấu câu, hoặc chứa dấu câu ngắt câu bên trong `chinese` (`，`, `。`, `！`, `？`, `;`, `:`).
    2. Mã ký tự Latinh-số ngắn không chứa chữ Hán (`^[A-Za-z]{1,2}[-_]?\d{1,3}$`, ví dụ `A1`, `A2`, `B12`).
    3. Đại từ/hư từ/cụm câu vô nghĩa trong `isNoisyGlossaryTerm` + tập từ phổ thông/danh từ sinh hoạt/cụm câu mệnh lệnh dài (`电脑`, `匿名`, `步行街`, `我想看鬼`, `暗度陈仓`, `图灵测试`, v.v.) hoặc chuỗi > 10 chữ Hán (cấu trúc câu nguyên văn).
    4. Cụm `phrase` phổ thông không phải tên riêng nhân vật/địa danh/vật phẩm (ví dụ thành ngữ thông thường như `暗度陈仓`).
  - **`review` (đưa vào `pendingGlossary` / `reviewQueue` kèm lý do tiếng Việt)**:
    1. `ent.needsReview === true` (hallucination / snap-back thất bại).
    2. Trùng chữ Hán hoặc trùng nghĩa Việt với mục đã có trong từ điển.
    3. Thuật ngữ đơn âm tiết (đúng 1 ký tự Hán, vd `海`, `昆`, `鸢`).
    4. Lỗi Bính âm / sót chữ Hán ở `pinyin`, `vietnamese`, hoặc `note` không làm sạch được hoàn toàn.
    5. **Chồng lấn mảnh cắt / biến thể dư thừa (`detectSubTermOrCompositeOverlap`)**: Ứng viên là chuỗi con liên tiếp (`>= 2` chữ Hán) nằm trong một mục dài đã có (vd `苍一` trong `钱仓一`, `魏成` trong `魏成和`, `长兰` trong `长兰小区`, `保罗` trong `保罗船长`) HOẶC mục đã có nằm lọt bên trong ứng viên dài kèm hậu tố chức danh/chỉ loại (`天马博士` vs `天马`, `陈明警官` vs `陈明`, `何方岛` vs `何方`, `先驱者的荣耀徽章` vs `先驱者的荣耀`) mà không có bằng chứng xuất hiện độc lập ngoài cụm dài trong `sourceText` → định tuyến `review` (không tự động nhét thêm bản trùng cắt cụt vào từ điển chính!).
  - **`accept` (thêm thẳng vào từ điển chính)**: Đạt toàn bộ kiểm tra trên, giữ làm sạch `note` nếu cần và tự gợi ý `characterProfile.gender` an toàn từ `inferCharacterGenderFromContext`.
- **Rationale**: Bảo vệ an toàn tuyệt đối cho các tên có tính danh từ thường hoặc biệt danh ngắn (`苍一` khi thực sự đứng độc lập, hay tên 1 chữ nếu truyện dùng thật) bằng cách cho vào hàng chờ 1 chạm thay vì xóa mất, đồng thời dọn sạch 100% rác rõ rệt.
- **Alternatives considered**: Từ chối cứng mọi 1-char và mọi sub-term → Có thể làm mất cách gọi tên ngắn hợp lệ khi người dùng thực sự muốn duyệt thêm tay.

---

### Decision 4: Truyền ngữ cảnh dự án & neo từ điển đã biết ngay từ Vòng 1
- **Decision**:
  - Sửa typo nghiêm trọng tại `src/services/ai/glossaryPrompts.ts#L28` (đang viết nhầm ví dụ `'萬劍歸宗' thì trả về đúng '萬劍归宗'`).
  - Nâng cấp `buildEntityExtractionInstruction('analyze' | 'extract')` và `buildEntitySchema`: bổ sung chỉ dẫn tiêu chuẩn Hán-Việt rõ ràng + ví dụ âm tính **CẤM Bính âm** (`CẤM viết 'huò zūn', 'Yì Tiān Lěi', '秦局' ở cột pinyin — phải viết Hán-Việt 'Hoắc Tôn', 'Dịch Thiên Lỗi', 'Tần Cục'`), **CẤM chữ Hán trong `note`**, **CẤM trích xuất từ phổ thông / mã ngắn (`A1`, `A2`) / câu thoại / mảnh cắt của từ đã có**.
  - Mở rộng `AnalyzeGlossaryDirectParams` và `BuildAnalyzeGlossaryPromptParams`:
    - `genre?: string`, `tone?: string`, `description?: string`
    - `knownGlossaryEntries?: Array<{ chinese: string; vietnamese: string; isPinned?: boolean }>`
  - Tạo helper `prioritizeKnownAnchorEntriesForChapter(sourceText, knownGlossary, maxLimit)` trong `src/lib/glossaryScanQuality.ts` (tái dùng logic khớp chương từ `glossaryMatch.ts`) để gửi tối đa 150 mục liên quan nhất **ngay tại Vòng 1** kèm nghĩa Việt chuẩn (`- 钱仓一 => Tiền Thương Nhất`) giúp mô hình nhẹ khóa chặt phong cách đặt tên ngay từ chương đầu và vòng đầu.
  - Nối ngữ cảnh dự án (`genre`, `tone`, `description`, `knownGlossaryEntries`) ở cả `useGlossaryScan.ts` (tất cả `loop >= 1`) lẫn `useWorkspaceState.ts` (`handleAnalyzeGlossary`, quét đơn chương).
- **Rationale**: Không phát sinh bất kỳ API call nào thêm; tận dụng trực tiếp prompt đang có để mô hình nhẹ (`flash-lite`) hiểu đúng phong cách truyện và từ vựng đã chốt ngay từ Vòng 1.

---

### Decision 5: Thống kê Telemetry sau phiên quét (`useGlossaryScan.ts`)
- **Decision**: Bổ sung bộ đếm cộng dồn `scanStats = { acceptedCount, reviewCount, rejectedCount }` suốt vòng đời phiên quét trong `useGlossaryScan.ts` và xuất dòng log tổng kết rõ ràng khi hoàn tất/tạm dừng (`[Tổng kết hậu kiểm] Đã thêm: X thuật ngữ | Chờ duyệt nghi ngờ: Y mục | Đã lọc nhiễu: Z mục`).
- **Rationale**: Người dùng nắm ngay mức độ lọc nhiễu và kiểm tra hàng chờ ngay sau khi quét.

---

### Decision 6: Mở rộng Sức khỏe Từ điển phát hiện lỗi định dạng cũ (`FR-010`)
- **Decision**:
  - Mở rộng `GlossaryHealthReport` trong `src/lib/glossaryMatch.ts` thêm `formatIssueIds: string[]` (đếm các mục có `detectMandarinPinyin(item.pinyin)` hoặc `containsHanChars(item.pinyin)` hoặc `containsHanChars(item.note)`). Tính vào `totalIssueItems`.
  - Mở rộng `GlossaryHealthFilter` thêm `'format_issues'`.
  - Thêm pill lọc thứ 4 `"Lỗi phiên âm / ghi chú"` trong `GlossaryHealthBar.tsx` (giữ đúng design system **Mực & Chu Sa**, icon `lucide-react`, tông amber cảnh báo) và nối lọc trong `useGlossaryState.ts`.
- **Rationale**: Giúp người dùng mở ngay bộ 592 mục hiện tại lên là thấy và lọc ra ngay các mục như `huò zūn`, `秦局`, `đi cùng 李倩` để sửa nhanh (hoặc dùng thao tác hàng loạt).
