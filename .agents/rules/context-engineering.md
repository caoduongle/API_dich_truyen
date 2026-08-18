# Context Engineering & Kỷ luật Agent — harness-context-optimizer

> Áp dụng khi project có cấu hình MCP server `harness-context-optimizer` (xem `.agents/mcp_config.json`). Điều chỉnh từ CLAUDE.md/AGENTS.md của repo [Harness-context-engineering](https://github.com/nguyentrunghieutcu/Harness-context-engineering) (MIT license), thêm phần dành riêng cho Antigravity.

Áp dụng cho mọi task trong project này trừ khi người dùng yêu cầu khác trực tiếp. Ưu tiên cẩn trọng hơn tốc độ với việc không‑trivial; tự chủ với việc nhỏ, rõ ràng.

## Chính sách dùng MCP tool `harness-context-optimizer`

Chỉ gọi tool khi nó thực sự giảm đoán mò hoặc lãng phí token — không gọi chỉ để "trông có vẻ kỹ".

- **Trước khi sửa code không‑trivial**: gọi `retrieve_context` với `paths` hẹp nhất có thể và `query` cụ thể, thay vì tự đọc dàn trải nhiều file hoặc đoán.
- **Trước khi áp dụng convention/quyết định cũ của project**: gọi `memory_search` hoặc `memory_inject`.
- **Sau khi rút ra một convention, quy trình lặp lại, hoặc nguyên nhân bug đáng nhớ**: gọi `memory_save` với đúng tier:
  - `semantic` — fact/convention của project.
  - `procedural` — quy trình, cách làm lặp lại.
  - `episodic` — sự việc/quyết định cụ thể, một lần.
- **Không tự tóm tắt lịch sử hội thoại bằng tay.** Khi session đạt khoảng 30.000 token, gọi `handoff_conversation`; nếu nó trả về trạng thái handoff, mở task mới và chỉ gọi `restore_conversation_handoff` khi thật sự cần lại lịch sử gốc.
- **Sau khi sửa file lớn hoặc thêm file mới**: gọi `reindex_paths` cho đúng phạm vi vừa đổi.
- **Khi nghi ngờ kết quả retrieval bị cũ** (vừa đổi nhánh, sửa nhiều file): gọi `invalidate_cache`.
- **Khi không chắc kích thước prompt hoặc có vừa model không**: dùng `estimate_tokens` và `get_token_budget` thay vì đoán.

## Nguyên tắc làm việc

1. **Nghĩ trước khi code.** Nêu rõ giả định. Nếu không chắc, hỏi thay vì đoán. Nếu có nhiều cách hiểu, trình bày các cách đó. Phản biện nếu có cách đơn giản hơn. Nếu bí, dừng lại và nói rõ điều gì đang khó hiểu — đừng đoán tiếp.
2. **Đơn giản trước.** Viết lượng code tối thiểu để giải quyết đúng vấn đề. Không thêm tính năng chưa ai yêu cầu, không tạo abstraction cho thứ chỉ dùng một lần. Tự hỏi: một kỹ sư senior nhìn vào có thấy overengineer không?
3. **Sửa đúng chỗ cần sửa.** Chỉ động vào phần bắt buộc phải đổi. Không tiện tay "cải thiện" code/comment/format xung quanh, không refactor thứ không hỏng. Bám theo style đã có sẵn.
4. **Làm theo mục tiêu, không theo bước cứng nhắc.** Xác định rõ tiêu chí "xong" rồi lặp cho tới khi đạt, thay vì làm máy móc theo một chuỗi bước cố định.
5. **Dùng model đúng việc.** Dùng cho phân loại, soạn thảo, tóm tắt, trích xuất — việc cần phán đoán. Không dùng cho routing, retry, biến đổi dữ liệu tất định — nếu code giải quyết được thì để code làm.
6. **Token budget không phải gợi ý, là giới hạn.** Mỗi task ~4.000 token, mỗi session ~30.000 token. Gần chạm giới hạn thì handoff và bắt đầu lại, đừng cố nhồi thêm. Vượt giới hạn phải báo rõ, không âm thầm bỏ qua.
7. **Có mâu thuẫn thì chọn, đừng dung hoà.** Nếu hai pattern trong code xung đột, chọn một (thường mới hơn/được test kỹ hơn), giải thích lý do, đánh dấu bản còn lại cần dọn — không trộn hai pattern.
8. **Đọc trước khi viết.** Trước khi thêm code mới, đọc export, nơi gọi tới nó, và utility dùng chung liên quan. "Nhìn có vẻ không liên quan" là giả định nguy hiểm — nếu không chắc vì sao code được cấu trúc vậy, hỏi trước khi đổi.
9. **Test xác nhận đúng mục đích, không chỉ đúng hành vi hiện tại.** Test phải thể hiện được TẠI SAO hành vi đó quan trọng. Test không thể fail dù logic nghiệp vụ đổi là test sai.
10. **Checkpoint sau mỗi bước lớn.** Tóm tắt đã làm gì, đã verify gì, còn lại gì. Đừng tiếp tục từ trạng thái không mô tả lại được — nếu mất dấu, dừng lại và nói rõ.
11. **Theo convention của codebase, kể cả khi không đồng ý.** Nhất quán quan trọng hơn gu cá nhân. Nếu thật sự thấy convention có hại, nêu ra để bàn — đừng âm thầm làm khác.
12. **Báo lỗi rõ ràng, đừng im lặng bỏ qua.** "Đã xong" là sai nếu có phần bị bỏ qua mà không nói. "Test pass" là sai nếu có test bị skip. Mặc định nói rõ điều còn chưa chắc, không giấu đi.
