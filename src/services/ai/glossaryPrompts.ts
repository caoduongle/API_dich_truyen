import { ANTI_INJECTION_DEFENSE_DIRECTIVE } from "../../lib/text";

/**
 * Trả về phần system instruction chung chứa các quy tắc xử lý tên phiên âm,
 * danh từ chỉ loại tiếng Trung (Athena, Trà Abbacchio, v.v.).
 */
export function buildEntityExtractionInstruction(
  mode: 'checkLeftover' | 'analyze' | 'extract',
  options?: { loopIndex?: number; totalLoops?: number; hasExclusions?: boolean }
): string {
  const prefix = ANTI_INJECTION_DEFENSE_DIRECTIVE;
  if (mode === 'checkLeftover') {
    return prefix +
           "QUAN TRỌNG về trường 'vietnamese': Nếu tên nhân vật hoặc địa danh là phiên âm từ tiếng Anh hoặc ngôn ngữ phương Tây (ví dụ: 阿诗娜 = Athena, 盖伊 = Guy), hãy khôi phục và đặt TÊN GỐC TIẾNG ANH vào trường 'vietnamese'.\n" +
           "ĐẶC BIỆT LƯU Ý: Nếu thuật ngữ ngoại quốc có kèm theo danh từ phân loại hoặc đồ vật bằng tiếng Trung ở phía sau (ví dụ: 茶 - trà, 镇 - thị trấn, 河 - sông, 城/市 - thành phố, 🏛️ - điện/tháp...), bạn PHẢI dịch danh từ phân loại đó sang tiếng Việt và ĐẢO LÊN TRƯỚC tên gốc tiếng Anh (Ví dụ: 阿帕茶 phải dịch thành 'Trà Abbacchio' chứ KHÔNG ĐƯỢC để dạng tiếng Anh 'Abbacchio Tea').\n" +
           "Chỉ dùng phiên âm Hán-Việt khi tên/thuật ngữ hoàn toàn gốc Trung Quốc.";
  }
  
  if (mode === 'analyze') {
    const loopNote =
      options?.loopIndex && options.loopIndex > 1
        ? ` ĐÂY LÀ LƯỢT RÀ SOÁT THỨ ${options.loopIndex}/${options.totalLoops || options.loopIndex}. Tập trung rà soát sâu các nhân vật phụ, địa danh phụ, vật phẩm đặc hữu còn sót ngoài danh sách thuật ngữ đã biết.`
        : '';
    return prefix +
           "QUY TẮC BẮT BUỘC KHI TRÍCH XUẤT THUẬT NGỮ (DÀNH CHO ĐỘ CHÍNH XÁC CAO):\n" +
           "1. CỘT 'pinyin' (PHIÊN ÂM HÁN-VIỆT): BẮT BUỘC viết phiên âm Hán-Việt chuẩn tiếng Việt (ví dụ: 'Tiền Thương Nhất', 'Dịch Thiên Lỗi', 'Hoắc Tôn', 'Tần Cục'). TUYỆT ĐỐI CẤM điền Bính âm tiếng Phổ thông có/không dấu thanh ('huò zūn', 'Yì Tiān Lěi', 'Dào Gé Lā Sī', 'Jichang', 'Qí Chéng') và TUYỆT ĐỐI CẤM chép lại chữ Hán gốc ('秦局') vào cột 'pinyin'.\n" +
           "2. CỘT 'vietnamese' (TÊN TIẾNG VIỆT): Tên thuần Trung Quốc PHẢI dùng Hán-Việt hoặc nghĩa Việt chuẩn (CẤM để Bính âm như 'Yuan', 'Hai'). Chỉ khôi phục TÊN GỐC TIẾNG ANH nếu là phiên âm ngoại quốc thật (ví dụ: 阿诗娜 -> 'Athena', 盖伊 -> 'Guy'). Nếu kèm danh từ phân loại tiếng Trung ở sau (như 茶, 镇, 河, 城), dịch danh từ đó sang tiếng Việt rồi đặt LÊN TRƯỚC tên tiếng Anh (ví dụ: 阿帕茶 -> 'Trà Abbacchio').\n" +
           "3. CỘT 'note' (GHI CHÚ): Viết 100% bằng tiếng Việt thuần túy, CẤM chép chữ Hán gốc vào mô tả (ví dụ viết 'Nhân viên quay phim đi cùng Lý Thiến', KHÔNG viết 'đi cùng 李倩').\n" +
           "4. CỘT 'chinese': Copy CHÍNH XÁC từng ký tự Hán như bản gốc (TUYỆT ĐỐI KHÔNG tự đổi phồn thể/giản thể; ví dụ bản gốc là '萬劍歸宗' thì giữ nguyên '萬劍歸宗').\n" +
           "5. CẤM TRÍCH XUẤT RÁC: KHÔNG trích xuất đại từ (我/你/他/她/他们), danh từ phổ thông sinh hoạt (电脑, 步行街, 网吧, 匿名), câu văn nguyên vẹn (我想看鬼), thành ngữ đại chúng (暗度陈仓), mã ký hiệu ngắn không chứa chữ Hán (A1, A2), hoặc mảnh tên cắt cụt trùng với tên đầy đủ đã biết (như cắt '仓一' khi đã có '钱仓一')." +
           loopNote;
  }

  // extract mode
  return prefix +
         "QUY TẮC BẮT BUỘC KHI TRÍCH XUẤT THUẬT NGỮ:\n" +
         "- CỘT 'pinyin': BẮT BUỘC viết phiên âm Hán-Việt tiếng Việt chuẩn; CẤM Bính âm ('huò zūn', 'Jichang') và CẤM để chữ Hán.\n" +
         "- CỘT 'vietnamese': Tên thuần Trung dùng Hán-Việt; chỉ khôi phục tên gốc tiếng Anh cho từ phiên âm phương Tây và dịch hậu tố phân loại lên trước nếu có (ví dụ: 阿帕茶 -> 'Trà Abbacchio').\n" +
         "- CỘT 'note': Viết 100% tiếng Việt thuần túy, CẤM lẫn chữ Hán.\n" +
         "- CẤM trích xuất từ phổ thông sinh hoạt (电脑, 步行街), câu nói, mã ngắn (A1, A2) hoặc mảnh tên cắt cụt.";
}

/**
 * Trả về JSON schema chuẩn cho một entity chứa các trường chinese, pinyin, vietnamese, type, và note.
 */
export function buildEntitySchema(mode: 'checkLeftover' | 'analyze' | 'extract'): any {
  if (mode === 'checkLeftover') {
    return {
      type: "OBJECT",
      properties: {
        chinese: { type: "STRING", description: "Từ chữ Trung bị sót" },
        pinyin: { type: "STRING", description: "Phiên âm Hán-Việt chuẩn phù hợp" },
        vietnamese: {
          type: "STRING",
          description: "Nếu là phiên âm từ tên tiếng Anh/phương Tây, dùng tên tiếng Anh gốc (ví dụ: 阿诗娜 -> 'Athena'). Nếu đi kèm danh từ chỉ loại, dịch từ chỉ loại đó lên trước tên gốc tiếng Anh (ví dụ: 阿帕茶 -> 'Trà Abbacchio' chứ không phải 'Abbacchio Tea'). Nếu là tên thuần Trung, dùng phiên âm Hán-Việt."
        },
        type: {
          type: "STRING",
          enum: ["character", "location", "term", "phrase", "other"],
          description: "Kiểu đối tượng bị sót"
        },
        note: { type: "STRING", description: "Mô tả vai trò/ý nghĩa dự kiến của đối tượng theo văn cảnh" }
      },
      required: ["chinese", "pinyin", "vietnamese", "type", "note"]
    };
  }

  if (mode === 'analyze') {
    return {
      type: "OBJECT",
      properties: {
        chinese: { type: "STRING", description: "Từ tiếng Trung gốc (không dấu câu, không lấy câu dài/mã ngắn/từ phổ thông), ví dụ '萧炎' hoặc '乌坦城'" },
        pinyin: { type: "STRING", description: "Phiên âm Hán-Việt tiếng Việt chuẩn (CẤM Bính âm như 'huò zūn'/'Yì Tiān Lěi', CẤM chữ Hán), ví dụ 'Tiêu Viêm' hoặc 'Ô Thản Thành'" },
        vietnamese: {
          type: "STRING",
          description: "Nếu là phiên âm ngoại quốc thật, dùng tên tiếng Anh gốc (đảo danh từ loại lên trước: 阿帕茶 -> 'Trà Abbacchio'). Nếu thuần Trung, dùng Hán-Việt/tiếng Việt (CẤM để Bính âm như 'Yuan')."
        },
        type: {
          type: "STRING",
          enum: ["character", "location", "term", "phrase", "other"],
          description: "Phân loại: nhân vật (character), địa danh (location), thuật ngữ/đạo cụ/tổ chức (term/other); tránh nhầm từ sinh hoạt thường ngày."
        },
        note: { type: "STRING", description: "Mô tả ngắn hoàn toàn bằng tiếng Việt, KHÔNG chứa chữ Hán, ví dụ: 'Nhân vật nam chính, tư chất phi phàm'" }
      },
      required: ["chinese", "pinyin", "vietnamese", "type", "note"]
    };
  }

  // extract mode
  return {
    type: "OBJECT",
    properties: {
      chinese: { type: "STRING", description: "Từ tiếng Trung gốc (chỉ tên riêng/thuật ngữ đặc thù)" },
      pinyin: { type: "STRING", description: "Phiên âm Hán-Việt chuẩn tiếng Việt (CẤM Bính âm và CẤM chữ Hán)" },
      vietnamese: {
        type: "STRING",
        description: "Tên tiếng Anh gốc cho từ phiên âm phương Tây, dịch hậu tố phân loại lên trước nếu có (ví dụ: 阿帕茶 -> 'Trà Abbacchio'). Nếu thuần Trung, dùng Hán-Việt."
      },
      type: {
        type: "STRING",
        enum: ["character", "location", "term", "phrase", "other"],
      },
      note: { type: "STRING", description: "Mô tả ngắn hoàn toàn bằng tiếng Việt, không kèm chữ Hán" }
    },
    required: ["chinese", "pinyin", "vietnamese", "type", "note"]
  };
}
