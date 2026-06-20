import { Request, Response } from "express";
import { Type } from "@google/genai";
import { generateWithRotation, sleep, isOverloadError } from "../services/geminiService.ts";
import { safeParseJson, findSplitPoint, getGenreStyleGuide } from "../utils/text.ts";
import { checkLeftoverGlossary } from "./glossaryController.ts";
import { isHanEquivalent, validateAndSnapBackEntities, findCanonicalSubstring } from "../utils/sinoNormalize.ts";

// Gọi trực tiếp tác vụ dịch thô từ Gemini API
async function callRawTranslationDirect(
    text: string,
    genre: string,
    tone: string,
    glossary: any[],
    apiKeys: string[] | undefined,
    model: string | undefined,
    startKeyIndex: number = 0,
    description?: string
): Promise<{ rawTranslation: string; discoveredEntities: any[]; successKeyIndex: number }> {
  let glossaryStr = "";
  if (Array.isArray(glossary) && glossary.length > 0) {
    glossaryStr = glossary
        .map((g: any) => `- Trung: [${g.chinese}${g.variants?.length ? ' / ' + g.variants.join(' / ') : ''}] -> Hán Việt: [${g.pinyin}] -> Việt: [${g.vietnamese}] (Loại: ${g.type}, Ghi chú: ${g.note})`)
        .join("\n");
  } else {
    glossaryStr = "(Không có từ điển tùy chọn, dịch tự động dựa trên âm Hán-Việt phổ thông và ngữ cảnh)";
  }

  // Pre-substitution: thay thế cứng từ điển vào source text trước khi dịch
  let substitutedText = text;
  if (Array.isArray(glossary) && glossary.length > 0) {
    const sortedGlossary = [...glossary].sort((a, b) => (b.chinese || "").length - (a.chinese || "").length);
    for (const item of sortedGlossary) {
      if (!item.chinese?.trim() || !item.vietnamese?.trim()) continue;
      const esc = item.chinese.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '$&');
      const regex = new RegExp(esc, 'g');
      
      const occurrences = (substitutedText.match(regex) || []).length;
      if (occurrences > 0) {
        substitutedText = substitutedText.replace(regex, `[${item.vietnamese}]`);
      } else {
        const canonicalSub = findCanonicalSubstring(substitutedText, item.chinese);
        if (canonicalSub) {
          const escCanon = canonicalSub.replace(/[-\/\\^$*+?.()|[\]{}]/g, '$&');
          const regexCanon = new RegExp(escCanon, 'g');
          substitutedText = substitutedText.replace(regexCanon, `[${item.vietnamese}]`);
        }
      }

      // Replace variants if present
      if (Array.isArray(item.variants) && item.variants.length > 0) {
        for (const variant of item.variants) {
          if (!variant || !variant.trim()) continue;
          const escVar = variant.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '$&');
          const regexVar = new RegExp(escVar, 'g');
          const occurrencesVar = (substitutedText.match(regexVar) || []).length;
          if (occurrencesVar > 0) {
            substitutedText = substitutedText.replace(regexVar, `[${item.vietnamese}]`);
          } else {
            const canonicalSubVar = findCanonicalSubstring(substitutedText, variant);
            if (canonicalSubVar) {
              const escCanonVar = canonicalSubVar.replace(/[-\/\\^$*+?.()|[\]{}]/g, '$&');
              const regexCanonVar = new RegExp(escCanonVar, 'g');
              substitutedText = substitutedText.replace(regexCanonVar, `[${item.vietnamese}]`);
            }
          }
        }
      }
    }
  }

  const systemInstruction =
      "Bạn là hệ thống dịch thuật AI cao cấp chuyên dịch truyện chữ Trung Quốc sang tiếng Việt.\n" +
      "Nhiệm vụ của bạn là thực hiện dịch thô Giai đoạn 1 (Translation Draft 1) từ đoạn văn bản tiếng Trung được cung cấp.\n" +
      "YÊU CẦU QUAN TRỌNG NHẤT:\n" +
      "1. Tôn trọng Tuyệt đối các từ khóa, thực thể và đại từ trong bảng Từ điển (Glossary) được cung cấp. Nếu một từ Trung Quốc xuất hiện trong Glossary, bạn PHẢI dịch chính xác bằng từ tiếng Việt tương ứng.\n" +
      "2. Dịch chính xác nghĩa đơn và bối cảnh câu chữ. Phân biệt rõ ràng người nam là 'hắn/y/chàng', người nữ là 'nàng/cô/y', người già là 'lão', v.v. dựa trên giới tính quy định.\n" +
      "3. Bản dịch thô này cần đủ sát nghĩa gốc chữ Trung, cấu trúc dễ hiểu, không bỏ sót bất kỳ chi tiết hay câu văn nào.\n" +
      "4. Trong quá trình đọc hiểu tiếng Trung gốc, hãy tinh mắt phát hiện NGAY các tên nhân vật mới, địa danh mới, chiêu thức võ công/ma thuật/bí kĩ mới xuất hiện mà CHỬA có trong Từ điển (Glossary) được đối chiếu.\n" +
      // Thêm vào cuối systemInstruction của Phase 1:
      `\n5. Phong cách phù hợp thể loại: ${getGenreStyleGuide(genre)}`+
      "Trích xuất chúng và điền vào trường 'vietnamese' như sau: NẾU là phiên âm từ tên tiếng Anh/phương Tây (ví dụ: 阿诗娜 = Athena, 盖伊 = Guy), hãy khôi phục TÊN GỐC TIẾNG ANH.\n" +
      "Nếu có kèm danh từ chỉ loại hoặc đồ vật đi liền phía sau (như 茶, 镇, 城, 国), bắt buộc phải dịch danh từ đó sang tiếng Việt và đưa lên đứng trước tên tiếng Anh (ví dụ: 阿帕茶 -> 'Trà Abbacchio' chứ không phải 'Abbacchio Tea', 伦敦城 -> 'Thành London').\n" +
      "NẾU là tên thuần Trung không có gốc tiếng Anh, dùng phiên âm Hán-Việt hoặc nghĩa tiếng Việt mượt mà.\n" +
      "6. ĐẶC BIỆT QUAN TRỌNG về trường 'chinese' trong discoveredEntities: Bạn PHẢI copy CHÍNH XÁC ký tự Hán như chúng xuất hiện trong VĂN BẢN TIẾNG TRUNG GỐC được cung cấp. TUYỆT ĐỐI KHÔNG tự ý chuyển đổi giữa phồn thể và giản thể. Nếu văn bản gốc viết phồn thể thì trả về phồn thể, giản thể thì trả về giản thể." +
      "7. Khi sử dụng thuật ngữ từ ngoặc vuông [Tên_Việt] trong văn bản đánh dấu, hãy viết KHÔNG có ngoặc vuông trong bản dịch cuối cùng. Ví dụ: [Philomena] → viết 'Philomena', KHÔNG viết '[Philomena]'." +
      (description && description.trim() ? `\n8. BẮT BUỘC TUÂN THỦ nguyên tắc xưng hô và phong cách dịch đặc biệt của truyện: ${description.trim()}` : "");

  const prompt = `--- THÔNG TIN TRUYỆN ---
Thể loại: ${genre || "Tiên Hiệp"}
Tông giọng: ${tone || "Trang nghiêm cổ kính"}
${description && description.trim() ? `Nguyên tắc dịch thuật & Quy tắc xưng hô từ cẩm nang:\n${description.trim()}` : ""}

--- TỪ ĐIỂN TÊN NHÂN VẬT & THUẬT NGỮ (ĐÃ CÓ - BẮT BUỘC TUÂN THỦ) ---
${glossaryStr}

--- VĂN BẢN TIẾNG TRUNG GỐC ---
${text}

--- VĂN BẢN TIẾNG TRUNG ĐÃ ĐÁNH DẤU TỪ ĐIỂN ---
(Các tên đã được thay sẵn trong ngoặc vuông [Tên_Việt]. Bắt buộc dùng đúng tên này khi dịch)
${substitutedText}`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      rawTranslation: {
        type: Type.STRING,
        description: "Bản dịch tiếng Việt thô sát nghĩa gốc, cấu trúc trôi chảy dễ hiểu, không bỏ sót bất cứ câu thơ hay lời thoại nào."
      },
      discoveredEntities: {
        type: Type.ARRAY,
        description: "Danh sách các tên riêng nhân vật mới, địa danh mới, chiêu thức võ học/phép thuật mới chưa hề có trong bảng từ điển được cung cấp.",
        items: {
          type: Type.OBJECT,
          properties: {
            chinese: { type: Type.STRING, description: "Từ chữ Trung gốc, ví dụ: '楚风' hoặc '裁决之刃'" },
            pinyin: { type: Type.STRING, description: "Phiên âm Hán-Việt chuẩn của từ đó, ví dụ: 'Sở Phong' hoặc 'Tài Quyết Chi Nhận'" },
            vietnamese: {
              type: Type.STRING,
              description: "Tên gốc tiếng Anh nếu là từ phiên âm ngoại quốc, kèm dịch nghĩa danh từ chỉ loại lên trước nếu có hậu tố chỉ đồ vật/địa danh (ví dụ: 阿帕茶 -> 'Trà Abbacchio' thay vì 'Abbacchio Tea'). Nếu thuần Trung, dùng Hán-Việt."
            },
            type: {
              type: Type.STRING,
              enum: ["character", "location", "term", "phrase", "other"],
              description: "Phân loại: nhân vật (character), địa danh (location), chiêu thức/ma thuật/vũ khí/bí kíp (term), thành ngữ (phrase), khác (other)."
            },
            note: { type: Type.STRING, description: "Dự đoán mô tả vai trò/giới tính dựa theo ngữ cảnh truyện, ví dụ: 'Ma pháp sư trẻ tuổi' hoặc 'Thần thú thời cổ đại' hoặc 'Chiêu thức của mục thiên tông'" }
          },
          required: ["chinese", "pinyin", "vietnamese", "type", "note"]
        }
      }
    },
    required: ["rawTranslation", "discoveredEntities"]
  };

  const rotationResult = await generateWithRotation(
      apiKeys,
      model,
      systemInstruction,
      prompt,
      schema,
      0.3,
      startKeyIndex
  );
  const resultText = rotationResult.text;
  if (!resultText) {
    throw new Error("Không nhận được phản hồi dịch từ AI.");
  }

  let parsed: any;
  try {
    parsed = safeParseJson(resultText);
  } catch (err) {
    console.error("[JSON Extract Failure] Nội dung lỗi thô:", resultText);
    throw new Error(`Mô hình trả về văn bản không thể giải mã JSON: ${resultText.substring(0, 100)}`);
  }

  let finalRawTranslation = parsed?.rawTranslation || "";
  let finalDiscoveredEntities = Array.isArray(parsed?.discoveredEntities) ? parsed.discoveredEntities : [];
  finalDiscoveredEntities = validateAndSnapBackEntities(finalDiscoveredEntities, text);

  // 💡 CƠ CHẾ KHÔI PHỤC KEY (KEY HEALING) DÀNH RIÊNG CHO GEMMA
  if (!finalRawTranslation || finalRawTranslation.trim() === "") {
    const altKey = parsed?.translation || parsed?.text || parsed?.vietnamese || parsed?.output || parsed?.raw_translation;
    if (altKey && altKey.trim() !== "") {
      finalRawTranslation = altKey;
    }
    else if (resultText && resultText.trim().length > 30) {
      if (!resultText.includes('"rawTranslation"') && !resultText.includes('"translation"')) {
        finalRawTranslation = resultText;
      }
    }
  }

  return {
    rawTranslation: finalRawTranslation || "",
    discoveredEntities: finalDiscoveredEntities,
    successKeyIndex: rotationResult.successKeyIndex
  };
}

// Chia để trị tích hợp cơ chế thực thi song song kết hợp Giãn cách lũy tiến chống nghẽn Quota
async function translateRawWithContentSplit(
    text: string,
    genre: string,
    tone: string,
    glossary: any[],
    apiKeys: string[] | undefined,
    model: string | undefined,
    depth = 0,
    startKeyIndex: number = 0,
    description?: string
): Promise<{ rawTranslation: string; discoveredEntities: any[]; successKeyIndex: number }> {
  if (text.length < 150 || depth > 4) {
    return callRawTranslationDirect(text, genre, tone, glossary, apiKeys, model, startKeyIndex, description);
  }

  // Sleep Backoff: Tránh gửi dồn dập các nhánh đệ quy song song cùng lúc
  if (depth > 0) {
    await sleep(depth * 600);
  }

  try {
    const result = await callRawTranslationDirect(text, genre, tone, glossary, apiKeys, model, startKeyIndex, description);

    if (!result.rawTranslation || result.rawTranslation.trim().length === 0) {
      // 💡 ĐƯỜNG LUI PLAIN-TEXT CỨU NGUY CHO DÒNG GEMMA
      if (model && model.toLowerCase().includes('gemma')) {
        console.warn("[Gemma Fallback] Phát hiện Gemma lỗi cấu trúc JSON. Kích hoạt cuộc gọi cứu nguy Plain-Text...");

        const plainResult = await generateWithRotation(
            apiKeys,
            model,
            `Bạn là dịch giả truyện chuyên nghiệp. Hãy dịch đoạn văn sau sang tiếng Việt theo thể loại ${genre} với tông giọng ${tone}. Tuyệt đối KHÔNG trả về định dạng JSON, không giải thích, chỉ trả ra văn bản dịch thuần túy.`,
            text,
            undefined,
            0.3,
            startKeyIndex
        );

        if (plainResult.text && plainResult.text.trim().length > 0) {
          return {
            rawTranslation: plainResult.text.trim(),
            discoveredEntities: [],
            successKeyIndex: plainResult.successKeyIndex
          };
        }
      }

      throw new Error("Bản dịch thu được bị trống rỗng (nghi ngờ vi phạm bộ lọc an toàn ngầm của Google).");
    }
    return result;
  } catch (error: any) {
    const errorMsg = (error.message || "").toLowerCase();
    if (error.message && error.message.startsWith("ALL_KEYS_EXHAUSTED")) {
      throw error;
    }

    const isSafetyOrEmpty = errorMsg.includes("safety") ||
        errorMsg.includes("block") ||
        errorMsg.includes("content") ||
        errorMsg.includes("trống") ||
        errorMsg.includes("empty") ||
        errorMsg.includes("finishreason") ||
        errorMsg.includes("filter") ||
        errorMsg.includes("candidate");

    if (isSafetyOrEmpty) {
      console.warn(`[Divide & Conquer Split] Phát hiện vi phạm bộ lọc / lỗi rỗng tại Độ sâu ${depth}. Tiến hành giãn cách và chia nhỏ văn bản dài ${text.length} ký tự...`);

      // Chờ hồi quota cục bộ trước khi bóc tách sâu hơn
      await sleep((depth + 1) * 750);

      const splitIdx = findSplitPoint(text);
      const part1 = text.substring(0, splitIdx).trim();
      const part2 = text.substring(splitIdx).trim();

      if (part1.length === 0 || part2.length === 0) {
        throw error;
      }

      console.log(`[Divide & Conquer Split] Chia thành: Phần A (${part1.length} ký tự) & Phần B (${part2.length} ký tự)`);
      const [res1, res2] = await Promise.all([
        translateRawWithContentSplit(part1, genre, tone, glossary, apiKeys, model, depth + 1, startKeyIndex, description),
        translateRawWithContentSplit(part2, genre, tone, glossary, apiKeys, model, depth + 1, startKeyIndex, description)
      ]);
      return {
        rawTranslation: (res1.rawTranslation + "\n\n" + res2.rawTranslation).trim(),
        discoveredEntities: [...(res1.discoveredEntities || []), ...(res2.discoveredEntities || [])],
        successKeyIndex: res2.successKeyIndex
      };
    }
    throw error;
  }
}

// Gọi trực tiếp tác vụ chuốt văn phong văn học Giai đoạn 2
async function callPolishDirect(
    sourceText: string,
    rawTranslation: string,
    genre: string,
    tone: string,
    glossary: any[],
    additionalInstructions: string,
    apiKeys: string[] | undefined,
    model: string | undefined,
    startKeyIndex: number = 0,
    description?: string
): Promise<{ polishedTranslation: string; successKeyIndex: number }> {
  let glossaryStr = "";
  if (Array.isArray(glossary) && glossary.length > 0) {
    glossaryStr = glossary
        .map((g: any) => `- Trung: [${g.chinese}${g.variants?.length ? ' / ' + g.variants.join(' / ') : ''}] -> Dịch: [${g.vietnamese}] (${g.note})`)
        .join("\n");
  }

  let substitutedSourceText = sourceText || "";
  const matchedTermsList: string[] = [];
  let totalMatchOccurrences = 0;
  if (Array.isArray(glossary) && glossary.length > 0) {
    const sortedGlossary = [...glossary].sort((a, b) => {
      const lenA = (a.chinese || "").length;
      const lenB = (b.chinese || "").length;
      return lenB - lenA;
    });
    for (const item of sortedGlossary) {
      if (!item.chinese || !item.chinese.trim()) continue;
      const chineseTerm = item.chinese.trim();
      const esc = chineseTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '$&');
      const regex = new RegExp(esc, 'g');

      const occurrences = (substitutedSourceText.match(regex) || []).length;
      if (occurrences > 0) {
        matchedTermsList.push(`- ${chineseTerm} -> [${item.vietnamese || ""}] (Khớp ${occurrences} lần)`);
        totalMatchOccurrences += occurrences;
        substitutedSourceText = substitutedSourceText.replace(regex, `[${item.vietnamese || ""}]`);
      } else {
        const canonicalSub = findCanonicalSubstring(substitutedSourceText, item.chinese);
        if (canonicalSub) {
          const escCanon = canonicalSub.replace(/[-\/\\^$*+?.()|[\]{}]/g, '$&');
          const regexCanon = new RegExp(escCanon, 'g');
          const occurrencesCanon = (substitutedSourceText.match(regexCanon) || []).length;
          if (occurrencesCanon > 0) {
            matchedTermsList.push(`- ${canonicalSub} (dạng gốc của ${chineseTerm}) -> [${item.vietnamese || ""}] (Khớp ${occurrencesCanon} lần)`);
            totalMatchOccurrences += occurrencesCanon;
            substitutedSourceText = substitutedSourceText.replace(regexCanon, `[${item.vietnamese || ""}]`);
          }
        }
      }

      // Replace variants if present
      if (Array.isArray(item.variants) && item.variants.length > 0) {
        for (const variant of item.variants) {
          if (!variant || !variant.trim()) continue;
          const varTerm = variant.trim();
          const escVar = varTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '$&');
          const regexVar = new RegExp(escVar, 'g');
          
          const occurrencesVar = (substitutedSourceText.match(regexVar) || []).length;
          if (occurrencesVar > 0) {
            matchedTermsList.push(`- ${varTerm} (biến thể của ${chineseTerm}) -> [${item.vietnamese || ""}] (Khớp ${occurrencesVar} lần)`);
            totalMatchOccurrences += occurrencesVar;
            substitutedSourceText = substitutedSourceText.replace(regexVar, `[${item.vietnamese || ""}]`);
          } else {
            const canonicalSubVar = findCanonicalSubstring(substitutedSourceText, varTerm);
            if (canonicalSubVar) {
              const escCanonVar = canonicalSubVar.replace(/[-\/\\^$*+?.()|[\]{}]/g, '$&');
              const regexCanonVar = new RegExp(escCanonVar, 'g');
              const occurrencesCanonVar = (substitutedSourceText.match(regexCanonVar) || []).length;
              if (occurrencesCanonVar > 0) {
                matchedTermsList.push(`- ${canonicalSubVar} (dạng gốc biến thể ${varTerm} của ${chineseTerm}) -> [${item.vietnamese || ""}] (Khớp ${occurrencesCanonVar} lần)`);
                totalMatchOccurrences += occurrencesCanonVar;
                substitutedSourceText = substitutedSourceText.replace(regexCanonVar, `[${item.vietnamese || ""}]`);
              }
            }
          }
        }
      }
    }
  }

  const systemInstruction =
      "Bạn là biên tập văn học lâu năm chuyên chuốt văn phong truyện dịch chữ Trung - Việt.\n" +
      "Nhiệm vụ của bạn là nâng cấp bản dịch bằng cách tham khảo bản Dịch thô Giai đoạn 1 và dựa sát vào bản Gốc tiếng Trung đã thế từ điển để cho ra bản dịch mượt mà tinh tế nhất.\n\n" +
      "CÁC NGUYÊN TẮC BIÊN TẬP HOÀY MỸ:\n" +
      "1. Văn phong thuần Việt hoàn toàn: Bẻ gãy cấu trúc ngữ pháp Trung Quốc lủng củng của bản dịch thô thành cách biểu đạt trôi chảy, giàu hình ảnh, nhịp điệu của tiếng Việt tự nhiên.\n" +
      "2. Xưng hô chuẩn xác, có hồn: Biến đổi linh hoạt xưng hô dựa trên văn cảnh và mối quan hệ nhân vật (ta - ngươi, huynh - muội, chàng - nàng, hắn, nàng, cụ, tiền bối, v.v.). Đảm bảo tính nghệ thuật và biểu cảm cao.\n" +
      "3. Nhất quán thuật ngữ: Trọng dụng tuyệt đối các thuật ngữ nằm trong ngoặc vuông '[Tên_Dịch]' tại văn bản đã thế từ điển, nhưng khi viết bản dịch cuối cùng TUYỆT ĐỐI KHÔNG giữ lại dấu ngoặc vuông. Ví dụ: [Philomena] → viết 'Philomena', KHÔNG viết '[Philomena]'.\n" +
      `4. Phù hợp thể loại: ${getGenreStyleGuide(genre)}\n` +
      "5. Chỉ trả về bản dịch hoàn thiện, tuyệt đối không kèm bất kỳ lời dẫn giải hay phân tích nào." +
      (description && description.trim() ? `\n6. BẮT BUỘC TUÂN THỦ nguyên tắc xưng hô và phong cách dịch đặc biệt của truyện: ${description.trim()}` : "");

  const prompt = `--- BỐI CẢNH DỰ ÁN ---
Thể loại: ${genre || "Tiên Hiệp"}
Tông giọng cốt lõi: ${tone || "Dịch thuần Việt mượt mà"}
${description && description.trim() ? `Nguyên tắc dịch thuật & Quy tắc xưng hô từ cẩm nang:\n${description.trim()}` : ""}
Từ điển đối chiếu: 
${glossaryStr || "Không có từ điển đặc biệt"}

--- CHỈ THỊ BIÊN TẬP THÊM CỦA NGƯỜI DÙNG ---
${additionalInstructions || "Không có chỉ thị thêm.\nHãy tối ưu văn phong thuần Việt mượt mà nhất có thể."}

--- THỐNG KÊ TỪ ĐIỂN KHỚP TRONG BẢN GỐC ---
Sự trùng chiêu từ điển: Đã tìm thấy ${matchedTermsList.length} thuật ngữ trong từ điển khớp với văn bản bản gốc tiếng Trung (tổng số lần xuất hiện: ${totalMatchOccurrences} lần).
Các thuật ngữ được tìm thấy:
${matchedTermsList.join("\n") || "(Không khớp thuật ngữ nào trong từ điển)"}

--- VĂN BẢN TIẾNG TRUNG GỐC CHƯA DỊCH (BẢN RAW CHƯA THAY THẾ) ---
${sourceText || "(Không cung cấp tiếng Trung gốc)"}

--- VĂN BẢN TRUNG GỐC ĐÃ ĐƯỢC THẾ TỰ ĐỘNG TỪ ĐIỂN ---
(Hãy dựa trực tiếp vào các đại lượng trong dấu ngoặc vuông '[Nghĩa_Ví_Dụ]' để dịch đồng dạng)
${substitutedSourceText || "(Trống)"}

--- BẢN DỊCH THÔ GIAI ĐOẠN 1 (BẢN THAM KHẢO Ý CHÍNH) ---
${rawTranslation}

Nhiệm vụ của bạn: Hãy lấy bản dịch thô làm bản tham khảo ý chính để chuyển tải mượt mà ngữ nghĩa, lấy bản gốc đã thế từ điển làm bản gốc chuẩn tuyệt đối về danh xưng và tên riêng để biên tập nâng cấp biên dịch.
Hãy cho ra sản phẩm dịch tuyệt diệu:`;

  const rotationResult = await generateWithRotation(
      apiKeys,
      model,
      systemInstruction,
      prompt,
      undefined,
      0.5,
      startKeyIndex
  );
  const polishedText = rotationResult.text;
  return { polishedTranslation: polishedText || "", successKeyIndex: rotationResult.successKeyIndex };
}

// Chia để trị chuốt văn tích hợp cơ chế thực thi song song song kèm giãn cách hồi Quota
async function polishWithContentSplit(
    sourceText: string,
    rawTranslation: string,
    genre: string,
    tone: string,
    glossary: any[],
    additionalInstructions: string,
    apiKeys: string[] | undefined,
    model: string | undefined,
    depth = 0,
    startKeyIndex: number = 0,
    description?: string
): Promise<{ polishedTranslation: string; successKeyIndex: number }> {
  if (rawTranslation.length < 150 || depth > 4) {
    return callPolishDirect(sourceText, rawTranslation, genre, tone, glossary, additionalInstructions, apiKeys, model, startKeyIndex, description);
  }

  if (depth > 0) {
    await sleep(depth * 600);
  }

  try {
    const result = await callPolishDirect(sourceText, rawTranslation, genre, tone, glossary, additionalInstructions, apiKeys, model, startKeyIndex, description);
    if (!result.polishedTranslation || result.polishedTranslation.trim().length === 0) {
      throw new Error("Bản biên tập thu được trống rỗng (nghi ngờ vi phạm bộ lọc an toàn ngầm của Google).");
    }
    return result;
  } catch (error: any) {
    const errorMsg = (error.message || "").toLowerCase();
    if (error.message && error.message.startsWith("ALL_KEYS_EXHAUSTED")) {
      throw error;
    }

    const isSafetyOrEmpty = errorMsg.includes("safety") ||
        errorMsg.includes("block") ||
        errorMsg.includes("content") ||
        errorMsg.includes("trống") ||
        errorMsg.includes("empty") ||
        errorMsg.includes("finishreason") ||
        errorMsg.includes("filter") ||
        errorMsg.includes("candidate");

    if (isSafetyOrEmpty) {
      console.warn(`[Divide & Conquer Split Polish] Phát hiện vi phạm bộ lọc / lỗi rỗng biên tập ở Độ sâu ${depth}. Tiến hành chia nhỏ bản dịch thô...`);

      await sleep((depth + 1) * 750);

      const rawSplitIdx = findSplitPoint(rawTranslation);
      const raw1 = rawTranslation.substring(0, rawSplitIdx).trim();
      const raw2 = rawTranslation.substring(rawSplitIdx).trim();

      let src1 = "";
      let src2 = "";
      if (sourceText) {
        const srcSplitIdx = findSplitPoint(sourceText);
        src1 = sourceText.substring(0, srcSplitIdx).trim();
        src2 = sourceText.substring(srcSplitIdx).trim();
      }

      if (raw1.length === 0 || raw2.length === 0) {
        throw error;
      }

      console.log(`[Divide & Conquer Split Polish] Chia bản thô: Phần A (${raw1.length} ký tự) & Phần B (${raw2.length} ký tự)`);
      const [res1, res2] = await Promise.all([
        polishWithContentSplit(src1, raw1, genre, tone, glossary, additionalInstructions, apiKeys, model, depth + 1, startKeyIndex, description),
        polishWithContentSplit(src2, raw2, genre, tone, glossary, additionalInstructions, apiKeys, model, depth + 1, startKeyIndex, description)
      ]);
      return {
        polishedTranslation: (res1.polishedTranslation + "\n\n" + res2.polishedTranslation).trim(),
        successKeyIndex: res2.successKeyIndex
      };
    }
    throw error;
  }
}

// 2. API: Thực hiện dịch thô Giai đoạn 1 bảo lưu đồng bộ danh xưng
export async function translateRaw(req: Request, res: Response): Promise<void> {
  try {
    const { text, genre, tone, description, glossary, apiKeys, model, startKeyIndex = 0, chapterId, sourceChapterId } = req.body;
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Văn bản gốc không hợp lệ." });
      return;
    }

    const { rawTranslation, discoveredEntities, successKeyIndex } = await translateRawWithContentSplit(
        text,
        genre,
        tone,
        glossary,
        apiKeys,
        model,
        0,
        startKeyIndex,
        description
    );

    const resolvedChapterId = sourceChapterId || chapterId;
    const finalEntities = resolvedChapterId
      ? (Array.isArray(discoveredEntities) ? discoveredEntities : []).map(ent => ({ ...ent, sourceChapterId: resolvedChapterId }))
      : (Array.isArray(discoveredEntities) ? discoveredEntities : []);

    res.json({
      rawTranslation: rawTranslation || "",
      discoveredEntities: finalEntities,
      successKeyIndex
    });
  } catch (error: any) {
    console.error("Lỗi dịch thô:", error);
    res.status(500).json({ error: error.message || "Đã xảy ra lỗi khi thực hiện dịch thô.", ...(isOverloadError(error) ? { errorType: 'overload' } : {}) });
  }
}

// 3. API: Thực hiện biên tập văn phong mượt mà Giai đoạn 2
export async function polishTranslation(req: Request, res: Response): Promise<void> {
  try {
    const { sourceText, rawTranslation, genre, tone, description, glossary, additionalInstructions, apiKeys, model, startKeyIndex = 0, isExtractionEnabled, chapterId, sourceChapterId } = req.body;
    if (!rawTranslation || typeof rawTranslation !== "string") {
      res.status(400).json({ error: "Bản dịch thô không hợp lệ." });
      return;
    }

    let newlyDiscoveredDuringPolish: any[] = [];
    let keyIndexAfterCheck = startKeyIndex;

    if (sourceText && isExtractionEnabled !== false) {
      console.log("[Polish API] Tiến hành kích hoạt rà soát bổ sung thuật ngữ bị sót...");
      const checkResults = await checkLeftoverGlossary(sourceText, glossary || [], apiKeys, model, startKeyIndex);
      keyIndexAfterCheck = checkResults.successKeyIndex;
      if (Array.isArray(checkResults.items) && checkResults.items.length > 0) {
        const resolvedChapterId = sourceChapterId || chapterId;
        newlyDiscoveredDuringPolish = resolvedChapterId
          ? checkResults.items.map((item: any) => ({ ...item, sourceChapterId: resolvedChapterId }))
          : checkResults.items;
        console.log(`[Polish API] Phát hiện thêm ${newlyDiscoveredDuringPolish.length} thuật ngữ bị bỏ sót during rà soát!`);
      }
    }

    const activeGlossary = [...(glossary || [])];
    if (newlyDiscoveredDuringPolish.length > 0) {
      newlyDiscoveredDuringPolish.forEach((item: any) => {
        const ext = activeGlossary.some((gItem: any) => isHanEquivalent(gItem.chinese, item.chinese));
        if (!ext) {
          activeGlossary.push({
            id: 'glo_polish_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            chinese: item.chinese.trim(),
            pinyin: item.pinyin.trim(),
            vietnamese: item.vietnamese.trim(),
            type: item.type,
            note: item.note.trim()
          });
        }
      });
    }

    const { polishedTranslation, successKeyIndex } = await polishWithContentSplit(
        sourceText,
        rawTranslation,
        genre,
        tone,
        activeGlossary,
        additionalInstructions,
        apiKeys,
        model,
        0,
        keyIndexAfterCheck,
        description
    );

    res.json({
      polishedTranslation: polishedTranslation || "",
      newlyDiscoveredDuringPolish,
      successKeyIndex
    });
  } catch (error: any) {
    console.error("Lỗi tối ưu văn phong:", error);
    res.status(500).json({ error: error.message || "Đã xảy ra lỗi khi tối ưu biên tập.", ...(isOverloadError(error) ? { errorType: 'overload' } : {}) });
  }
}
