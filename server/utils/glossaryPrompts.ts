import { Type } from "@google/genai";

/**
 * Trả về phần system instruction chung chứa các quy tắc xử lý tên phiên âm,
 * danh từ chỉ loại tiếng Trung (Athena, Trà Abbacchio, v.v.).
 */
export function buildEntityExtractionInstruction(mode: 'checkLeftover' | 'analyze' | 'extract'): string {
  if (mode === 'checkLeftover') {
    return "QUAN TRỌNG về trường 'vietnamese': Nếu tên nhân vật hoặc địa danh là phiên âm từ tiếng Anh hoặc ngôn ngữ phương Tây (ví dụ: 阿诗娜 = Athena, 盖伊 = Guy), hãy khôi phục và đặt TÊN GỐC TIẾNG ANH vào trường 'vietnamese'.\n" +
           "ĐẶC BIỆT LƯU Ý: Nếu thuật ngữ ngoại quốc có kèm theo danh từ phân loại hoặc đồ vật bằng tiếng Trung ở phía sau (ví dụ: 茶 - trà, 镇 - thị trấn, 河 - sông, 城/市 - thành phố, 🏛️ - điện/tháp...), bạn PHẢI dịch danh từ phân loại đó sang tiếng Việt và ĐẢO LÊN TRƯỚC tên gốc tiếng Anh (Ví dụ: 阿帕茶 phải dịch thành 'Trà Abbacchio' chứ KHÔNG ĐƯỢC để dạng tiếng Anh 'Abbacchio Tea').\n" +
           "Chỉ dùng phiên âm Hán-Việt khi tên/thuật ngữ hoàn toàn gốc Trung Quốc.";
  }
  
  if (mode === 'analyze') {
    return "QUAN TRỌNG về trường 'vietnamese': Nếu tên nhân vật, địa danh trong văn bản là phiên âm từ tiếng Anh hoặc ngôn ngữ phương Tây (ví dụ: 阿诗娜 = Athena, 盖伊 = Guy), hãy khôi phục TÊN GỐC TIẾNG ANH trong trường 'vietnamese'. " +
           "ĐẶC BIỆT LƯU Ý: Nếu từ ngữ gồm tên phiên âm ngoại quốc đi kèm hậu tố danh từ chỉ loại tiếng Trung (như - trà, 镇 - thị trấn, 河 - sông, 城 - thành), bạn phải dịch danh từ chỉ loại đó sang tiếng Việt và xếp lên trước tên gốc tiếng Anh (Ví dụ: 阿帕茶 dịch thành 'Trà Abbacchio' chứ KHÔNG ĐƯỢC để 'Abbacchio Tea'). " +
           "Chỉ dùng phiên âm Hán-Việt khi tên/thuật ngữ là hoàn toàn gốc Trung Quốc không có tên tiếng Anh tương ứng. " +
           "ĐẶC BIỆT QUAN TRỌNG về trường 'chinese': Bạn PHẢI copy CHÍNH XÁC ký tự Hán như chúng xuất hiện trong văn bản gốc được cung cấp. TUYỆT ĐỐI KHÔNG tự ý chuyển đổi giữa phồn thể (繁體字) và giản thể (簡體字). Nếu văn bản gốc viết '萬劍歸宗' thì trả về đúng '萬劍歸宗', không được đổi thành '万剑归宗' hay bất kỳ biến thể nào khác.";
  }

  // extract mode
  return "QUAN TRỌNG về trường 'vietnamese': Nếu tên nhân vật hoặc địa danh là phiên âm từ tiếng Anh hoặc ngôn ngữ phương Tây (ví dụ: 阿诗娜 = Athena, 盖伊 = Guy), hãy khôi phục TÊN GỐC TIÊN ANH trong trường 'vietnamese'. " +
         "ĐẶC BIỆT LƯU Ý: Nếu tên ngoại quốc có danh từ phân loại/đồ vật đi kèm ở hậu tố tiếng Trung (ví dụ: 茶 - trà, 镇 - thị trấn, 城 - thành), hãy dịch danh từ đó sang tiếng Việt rồi đưa lên trước tên tiếng Anh (Ví dụ: 阿帕茶 -> 'Trà Abbacchio' chứ không phải 'Abbacchio Tea').\n" +
         "Chỉ dùng phiên âm Hán-Việt khi tên/thuật ngữ là hoàn toàn gốc Trung Quốc.";
}

/**
 * Trả về JSON schema chuẩn cho một entity chứa các trường chinese, pinyin, vietnamese, type, và note.
 */
export function buildEntitySchema(mode: 'checkLeftover' | 'analyze' | 'extract'): any {
  if (mode === 'checkLeftover') {
    return {
      type: Type.OBJECT,
      properties: {
        chinese: { type: Type.STRING, description: "Từ chữ Trung bị sót" },
        pinyin: { type: Type.STRING, description: "Phiên âm Hán-Việt chuẩn phù hợp" },
        vietnamese: {
          type: Type.STRING,
          description: "Nếu là phiên âm từ tên tiếng Anh/phương Tây, dùng tên tiếng Anh gốc (ví dụ: 阿诗娜 -> 'Athena'). Nếu đi kèm danh từ chỉ loại, dịch từ chỉ loại đó lên trước tên gốc tiếng Anh (ví dụ: 阿帕茶 -> 'Trà Abbacchio' chứ không phải 'Abbacchio Tea'). Nếu là tên thuần Trung, dùng phiên âm Hán-Việt."
        },
        type: {
          type: Type.STRING,
          enum: ["character", "location", "term", "phrase", "other"],
          description: "Kiểu đối tượng bị sót"
        },
        note: { type: Type.STRING, description: "Mô tả vai trò/ý nghĩa dự kiến của đối tượng theo văn cảnh" }
      },
      required: ["chinese", "pinyin", "vietnamese", "type", "note"]
    };
  }

  if (mode === 'analyze') {
    return {
      type: Type.OBJECT,
      properties: {
        chinese: { type: Type.STRING, description: "Từ tiếng Trung gốc, ví dụ '萧炎' hoặc '乌坦城'" },
        pinyin: { type: Type.STRING, description: "Phiên âm Hán Việt chuẩn, ví dụ 'Tiêu Viêm' hoặc 'Ô Thản Thành'" },
        vietnamese: {
          type: Type.STRING,
          description: "Nếu là phiên âm từ tên ngoại quốc, dùng tên tiếng Anh gốc. Nếu có hậu tố danh từ chỉ loại, dịch từ chỉ loại lên đầu (ví dụ: 阿帕茶 -> 'Trà Abbacchio' thay vị 'Abbacchio Tea'). Nếu thuần Trung, dùng Hán-Việt mượt mà."
        },
        type: {
          type: Type.STRING,
          enum: ["character", "location", "term", "phrase", "other"],
          description: "Phân loại: nhân vật (character), địa danh (location), thuật ngữ khác (term/phrase)"
        },
        note: { type: Type.STRING, description: "Mô tả ngắn, ví dụ: 'Nhân vật nam chính, tư chất phi phàm' hoặc 'Nơi sinh ra của Tiêu Viêm'" }
      },
      required: ["chinese", "pinyin", "vietnamese", "type", "note"]
    };
  }

  // extract mode
  return {
    type: Type.OBJECT,
    properties: {
      chinese: { type: Type.STRING, description: "Từ tiếng Trung gốc" },
      pinyin: { type: Type.STRING, description: "Phiên âm Hán-Việt chuẩn" },
      vietnamese: {
        type: Type.STRING,
        description: "Tên tiếng Anh gốc cho từ phiên âm phương Tây, dịch hậu tố phân loại lên trước nếu có (ví dụ: 阿帕茶 -> 'Trà Abbacchio' chứ không phải 'Abbacchio Tea'). Nếu thuần Trung, dùng Hán-Việt."
      },
      type: {
        type: Type.STRING,
        enum: ["character", "location", "term", "phrase", "other"],
      },
      note: { type: Type.STRING, description: "Mô tả ngắn gọn vai trò/ý nghĩa" }
    },
    required: ["chinese", "pinyin", "vietnamese", "type", "note"]
  };
}
