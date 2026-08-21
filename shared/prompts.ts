import {
  LITERARY_TRANSLATION_FRAMING,
  getGenreStyleGuide,
  sanitizePromptInput,
  escapeRegex,
} from './text';
import { findCanonicalSubstring } from './sinoNormalize';

export interface GlossaryEntry {
  chinese: string;
  vietnamese: string;
  pinyin?: string;
  type?: string;
  note?: string;
  variants?: string[];
  [key: string]: any;
}

export interface BuildRawTranslationPromptParams {
  text: string;
  genre: string;
  tone: string;
  description?: string;
  glossary?: GlossaryEntry[];
}

export interface BuildPolishTranslationPromptParams {
  sourceText: string;
  rawTranslation: string;
  genre: string;
  tone: string;
  description?: string;
  glossary?: GlossaryEntry[];
  additionalInstructions?: string;
  isExtractionEnabled?: boolean;
}

export interface BuildQaCritiquePromptParams {
  sourceText: string;
  translatedText: string;
}

/**
 * Xây dựng payload prompt và schema cho Giai đoạn 1: Dịch thô + Trích xuất thực thể
 */
export function buildRawTranslationPayload(params: BuildRawTranslationPromptParams) {
  const { text, genre, tone, description, glossary = [] } = params;

  let glossaryStr = "";
  if (Array.isArray(glossary) && glossary.length > 0) {
    glossaryStr = glossary
      .map((g: any) => `- Trung: [${g.chinese}${g.variants?.length ? ' / ' + g.variants.join(' / ') : ''}] -> Hán Việt: [${g.pinyin || ''}] -> Việt: [${g.vietnamese}] (Loại: ${g.type || 'other'}, Ghi chú: ${g.note || ''})`)
      .join("\n");
  } else {
    glossaryStr = "(Không có từ điển tùy chọn, dịch tự động dựa trên âm Hán-Việt phổ thông và ngữ cảnh)";
  }

  // Pre-substitution: thay thế cứng từ điển vào source text trước khi dịch
  let substitutedText = sanitizePromptInput(text);
  if (Array.isArray(glossary) && glossary.length > 0) {
    const glossaryMap = new Map<string, string>();
    const terms: string[] = [];

    const sortedGlossary = [...glossary].sort((a, b) => (b.chinese || "").length - (a.chinese || "").length);
    for (const item of sortedGlossary) {
      if (!item.chinese?.trim() || !item.vietnamese?.trim()) continue;
      const mainZh = item.chinese.trim();
      const vi = item.vietnamese.trim();
      if (!glossaryMap.has(mainZh)) {
        glossaryMap.set(mainZh, vi);
        terms.push(mainZh);
      }
      if (Array.isArray(item.variants) && item.variants.length > 0) {
        for (const variant of item.variants) {
          if (!variant?.trim()) continue;
          const varZh = variant.trim();
          if (!glossaryMap.has(varZh)) {
            glossaryMap.set(varZh, vi);
            terms.push(varZh);
          }
        }
      }
    }

    terms.sort((a, b) => b.length - a.length);

    if (terms.length > 0) {
      const escapedTerms = terms.map(t => escapeRegex(t));
      const pattern = new RegExp(escapedTerms.join('|'), 'g');
      substitutedText = substitutedText.replace(pattern, (match) => `[${glossaryMap.get(match) || match}]`);
    }

    // Dò các biến thể Hán tự phồn thể / giản thể qua canonical mapping
    for (const item of sortedGlossary) {
      if (!item.chinese?.trim() || !item.vietnamese?.trim()) continue;
      const canonicalSub = findCanonicalSubstring(substitutedText, item.chinese);
      if (canonicalSub && !canonicalSub.startsWith('[')) {
        const escCanon = escapeRegex(canonicalSub);
        const regexCanon = new RegExp(escCanon, 'g');
        substitutedText = substitutedText.replace(regexCanon, `[${item.vietnamese}]`);
      }
    }
  }

  const systemInstruction =
    LITERARY_TRANSLATION_FRAMING +
    "Bạn là hệ thống dịch thuật AI cao cấp chuyên dịch truyện chữ Trung Quốc sang tiếng Việt.\n" +
    "Nhiệm vụ của bạn là thực hiện dịch thô Giai đoạn 1 (Translation Draft 1) từ đoạn văn bản tiếng Trung được cung cấp.\n" +
    "YÊU CẦU QUAN TRỌNG NHẤT:\n" +
    "1. BẮT BUỘC BẢO TỒN NGUYÊN VẸN 100% CẤU TRÚC PHÂN ĐOẠN (PARAGRAPH BREAKS): Mỗi đoạn văn của nguyên tác tiếng Trung PHẢI tương ứng với một đoạn văn trong bản dịch tiếng Việt, ngăn cách nhau bằng dòng trống (\\n\\n). TUYỆT ĐỐI KHÔNG nén các đoạn văn lại thành một khối văn bản duy nhất. Tiêu đề chương PHẢI đứng riêng biệt trên dòng đầu tiên, cách đoạn văn mở đầu ít nhất 1 dòng trống.\n" +
    "2. Tôn trọng Tuyệt đối các từ khóa, thực thể và đại từ trong bảng Từ điển (Glossary) được cung cấp. Nếu một từ Trung Quốc xuất hiện trong Glossary, bạn PHẢI dịch chính xác bằng từ tiếng Việt tương ứng.\n" +
    "3. Dịch chính xác nghĩa đơn và bối cảnh câu chữ. Phân biệt rõ ràng người nam là 'hắn/y/chàng', người nữ là 'nàng/cô/y', người già là 'lão', v.v. dựa trên giới tính quy định.\n" +
    "4. Bản dịch thô này cần đủ sát nghĩa gốc chữ Trung, cấu trúc dễ hiểu, không bỏ sót bất kỳ chi tiết hay câu văn nào.\n" +
    "5. Trong quá trình đọc hiểu tiếng Trung gốc, hãy tinh mắt phát hiện NGAY các tên nhân vật mới, địa danh mới, chiêu thức võ công/ma thuật/bí kĩ mới xuất hiện mà CHƯA có trong Từ điển (Glossary) được đối chiếu.\n" +
    `\n6. Phong cách phù hợp thể loại: ${getGenreStyleGuide(genre)}` +
    "Trích xuất chúng và điền vào trường 'vietnamese' như sau: NẾU là phiên âm từ tên tiếng Anh/phương Tây (ví dụ: 阿诗娜 = Athena, 盖伊 = Guy), hãy khôi phục TÊN GỐC TIẾNG ANH.\n" +
    "Nếu có kèm danh từ chỉ loại hoặc đồ vật đi liền phía sau (như 茶, 镇, 城, 国), bắt buộc phải dịch danh từ đó sang tiếng Việt và đưa lên đứng trước tên tiếng Anh (ví dụ: 阿帕茶 -> 'Trà Abbacchio' chứ không phải 'Abbacchio Tea', 伦敦城 -> 'Thành London').\n" +
    "NẾU là tên thuần Trung không có gốc tiếng Anh, dùng phiên âm Hán-Việt hoặc nghĩa tiếng Việt mượt mà.\n" +
    "7. ĐẶC BIỆT QUAN TRỌNG về trường 'chinese' trong discoveredEntities: Bạn PHẢI copy CHÍNH XÁC ký tự Hán như chúng xuất hiện trong VĂN BẢN TIẾNG TRUNG GỐC được cung cấp. TUYỆT ĐỐI KHÔNG tự ý chuyển đổi giữa phồn thể và giản thể. Nếu văn bản gốc viết phồn thể thì trả về phồn thể, giản thể thì trả về giản thể." +
    "8. Khi sử dụng thuật ngữ từ ngoặc vuông [Tên_Việt] trong văn bản đánh dấu, hãy viết KHÔNG có ngoặc vuông trong bản dịch cuối cùng. Ví dụ: [Philomena] → viết 'Philomena', KHÔNG viết '[Philomena]'." +
    (description && description.trim() ? `\n9. BẮT BUỘC TUÂN THỦ nguyên tắc xưng hô và phong cách dịch đặc biệt của truyện: ${description.trim()}` : "");

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
    type: "OBJECT",
    properties: {
      rawTranslation: {
        type: "STRING",
        description: "Bản dịch tiếng Việt thô sát nghĩa gốc, cấu trúc trôi chảy dễ hiểu, giữ nguyên 100% các đoạn văn ngăn cách bằng dòng trống (\\n\\n), tiêu đề chương ở dòng riêng biệt, không bỏ sót bất cứ câu thơ hay lời thoại nào."
      },
      discoveredEntities: {
        type: "ARRAY",
        description: "Danh sách các tên riêng nhân vật mới, địa danh mới, chiêu thức võ học/phép thuật mới chưa hề có trong bảng từ điển được cung cấp.",
        items: {
          type: "OBJECT",
          properties: {
            chinese: { type: "STRING", description: "Từ chữ Trung gốc, ví dụ: '楚风' hoặc '裁决之刃'" },
            pinyin: { type: "STRING", description: "Phiên âm Hán-Việt chuẩn của từ đó, ví dụ: 'Sở Phong' hoặc 'Tài Quyết Chi Nhận'" },
            vietnamese: {
              type: "STRING",
              description: "Tên gốc tiếng Anh nếu là từ phiên âm ngoại quốc, kèm dịch nghĩa danh từ chỉ loại lên trước nếu có hậu tố chỉ đồ vật/địa danh (ví dụ: 阿帕茶 -> 'Trà Abbacchio' thay vì 'Abbacchio Tea'). Nếu thuần Trung, dùng Hán-Việt."
            },
            type: {
              type: "STRING",
              enum: ["character", "location", "term", "phrase", "other"],
              description: "Phân loại: nhân vật (character), địa danh (location), chiêu thức/ma thuật/vũ khí/bí kíp (term), thành ngữ (phrase), khác (other)."
            },
            note: { type: "STRING", description: "Dự đoán mô tả vai trò/giới tính dựa theo ngữ cảnh truyện, ví dụ: 'Ma pháp sư trẻ tuổi' hoặc 'Thần thú thời cổ đại' hoặc 'Chiêu thức của mục thiên tông'" }
          },
          required: ["chinese", "pinyin", "vietnamese", "type", "note"]
        }
      }
    },
    required: ["rawTranslation", "discoveredEntities"]
  };

  return { systemInstruction, prompt, schema };
}

/**
 * Xây dựng payload prompt và schema cho Giai đoạn 2: Chuốt văn phong
 */
export function buildPolishTranslationPayload(params: BuildPolishTranslationPromptParams) {
  const {
    sourceText,
    rawTranslation,
    genre,
    tone,
    description,
    glossary = [],
    additionalInstructions,
    isExtractionEnabled = false,
  } = params;

  let substitutedSourceText = sanitizePromptInput(sourceText || "");
  const cleanRawTranslation = sanitizePromptInput(rawTranslation);
  const matchedTermsList: string[] = [];
  let totalMatchOccurrences = 0;

  if (Array.isArray(glossary) && glossary.length > 0) {
    const glossaryMap = new Map<string, string>();
    const terms: string[] = [];

    const sortedGlossary = [...glossary].sort((a, b) => {
      const lenA = (a.chinese || "").length;
      const lenB = (b.chinese || "").length;
      return lenB - lenA;
    });

    for (const item of sortedGlossary) {
      if (!item.chinese || !item.chinese.trim()) continue;
      const mainZh = item.chinese.trim();
      const vi = (item.vietnamese || '').trim();
      if (!glossaryMap.has(mainZh)) {
        glossaryMap.set(mainZh, vi);
        terms.push(mainZh);
      }
      if (Array.isArray(item.variants) && item.variants.length > 0) {
        for (const variant of item.variants) {
          if (!variant || !variant.trim()) continue;
          const varZh = variant.trim();
          if (!glossaryMap.has(varZh)) {
            glossaryMap.set(varZh, vi);
            terms.push(varZh);
          }
        }
      }
    }

    terms.sort((a, b) => b.length - a.length);

    if (terms.length > 0) {
      const matchCounts = new Map<string, number>();
      const escapedTerms = terms.map(t => escapeRegex(t));
      const pattern = new RegExp(escapedTerms.join('|'), 'g');
      substitutedSourceText = substitutedSourceText.replace(pattern, (match) => {
        const count = (matchCounts.get(match) || 0) + 1;
        matchCounts.set(match, count);
        totalMatchOccurrences++;
        return `[${glossaryMap.get(match) || match}]`;
      });

      matchCounts.forEach((count, term) => {
        matchedTermsList.push(`${term} -> [${glossaryMap.get(term) || term}] (${count} lần)`);
      });
    }
  }

  const systemInstruction =
    LITERARY_TRANSLATION_FRAMING +
    "BẠN LÀ MỘT BIÊN TẬP VIÊN VĂN HỌC VÀ DỊCH GIẢ TRUNG - VIỆT ĐẠI TÀI.\n" +
    "Nhiệm vụ của bạn là thực hiện chuốt mịn văn phong (Translation Polishing Phase 2) cho bản dịch thô tiếng Việt dựa trên văn bản tiếng Trung đối chiếu.\n" +
    "QUY ĐỊNH BẮT BUỘC:\n" +
    "1. BẮT BUỘC BẢO TỒN NGUYÊN VẸN 100% CẤU TRÚC PHÂN ĐOẠN (PARAGRAPH BREAKS): Mỗi đoạn văn của bản gốc PHẢI tương ứng với một đoạn văn trong bản dịch, ngăn cách nhau bằng dòng trống (\\n\\n). TUYỆT ĐỐI KHÔNG nén các đoạn văn lại thành một khối văn bản duy nhất. Tiêu đề chương PHẢI đứng riêng biệt trên một dòng đầu tiên, cách đoạn văn mở đầu ít nhất 1 dòng trống.\n" +
    "2. Diễn đạt mượt mà thuần Việt, loại bỏ hoàn toàn cấu trúc câu 'sượng', ngữ pháp dịch máy thô cứng (convert/quick translator vibe).\n" +
    "3. Giữ đúng sắc thái, đại từ nhân xưng phù hợp thể loại và tông giọng được yêu cầu.\n" +
    "4. Tuyệt đối không được bỏ sót câu văn, đoạn văn, tình tiết hoặc lời thoại nhân vật nào so với bản gốc.\n" +
    "5. Tôn trọng triệt để các thuật ngữ trong Từ điển riêng đã được định nghĩa.\n" +
    "6. Khi sử dụng thuật ngữ từ ngoặc vuông [Tên_Việt], hãy viết KHÔNG có ngoặc vuông trong bản dịch cuối cùng (ví dụ: [Philomena] → viết 'Philomena')." +
    (isExtractionEnabled ? "\n7. Trong quá trình rà soát đối chiếu, nếu phát hiện thêm thực thể/tên riêng nào chưa có trong từ điển, hãy trích xuất vào discoveredEntities." : "");

  const prompt = `[THÔNG TIN BẢN THẢO]
Thể loại: ${genre}
Tông giọng: ${tone}
${description ? `Mô tả bối cảnh & phong cách: ${description}` : ''}
${additionalInstructions ? `Yêu cầu dịch thuật bổ sung từ người dùng:\n${additionalInstructions}` : ''}

[BẢN DỊCH THÔ GIAI ĐOẠN 1]
${cleanRawTranslation}

[BẢN GỐC TIẾNG TRUNG ĐỐI CHIẾU]
${substitutedSourceText}

${matchedTermsList.length > 0 ? `\n[TỪ ĐIỂN RIÊNG ĐÃ XUẤT HIỆN TRONG ĐOẠN NÀY (${matchedTermsList.length} thuật ngữ, ${totalMatchOccurrences} lần xuất hiện)]:
${matchedTermsList.map(term => {
  const g = glossary.find((item: any) => item.chinese === term || (Array.isArray(item.variants) && item.variants.includes(term)));
  return g ? `- [${g.chinese}${g.variants?.length ? ' / ' + g.variants.join(' / ') : ''}] -> [${g.vietnamese}] (Bắt buộc dùng bản dịch này)` : '';
}).filter(Boolean).join('\n')}` : ''}

[HƯỚNG DẪN BIÊN TẬP VĂN HỌC]
${getGenreStyleGuide(genre)}
- Hãy chuốt lại câu cú tiếng Việt cho mượt mà, bay bổng, loại bỏ hoàn toàn cảm giác "dịch máy", giữ đúng tông giọng ${tone}.
- Đảm bảo mạch văn trôi chảy, danh từ riêng chuẩn xác theo từ điển và âm Hán Việt.
- Giữ nguyên 100% cấu trúc phân đoạn và tiêu đề chương.`;

  const schemaProperties: Record<string, any> = {
    polishedTranslation: {
      type: "STRING",
      description: "Văn bản tiếng Việt sau khi đã được mài giũa văn phong mượt mà, bay bổng, đúng ngữ cảnh, giữ nguyên cấu trúc phân đoạn (\\n\\n) và tiêu đề chương riêng biệt."
    }
  };
  const requiredFields = ["polishedTranslation"];

  if (isExtractionEnabled) {
    schemaProperties.discoveredEntities = {
      type: "ARRAY",
      description: "Danh sách các tên riêng, địa danh, thuật ngữ mới được phát hiện trong lượt rà soát.",
      items: {
        type: "OBJECT",
        properties: {
          chinese: { type: "STRING", description: "Từ chữ Trung gốc" },
          pinyin: { type: "STRING", description: "Phiên âm Hán-Việt" },
          vietnamese: { type: "STRING", description: "Dịch nghĩa tiếng Việt" },
          type: {
            type: "STRING",
            enum: ["character", "location", "term", "phrase", "other"],
            description: "Phân loại"
          },
          note: { type: "STRING", description: "Ghi chú" }
        },
        required: ["chinese", "pinyin", "vietnamese", "type", "note"]
      }
    };
    requiredFields.push("discoveredEntities");
  }

  const schema = {
    type: "OBJECT",
    properties: schemaProperties,
    required: requiredFields
  };

  return { systemInstruction, prompt, schema };
}

/**
 * Xây dựng payload prompt và schema cho Giai đoạn 3: Kiểm duyệt chất lượng QA Critique
 */
export function buildQaCritiquePayload(params: BuildQaCritiquePromptParams) {
  const sourceText = sanitizePromptInput(params.sourceText);
  const translatedText = sanitizePromptInput(params.translatedText);

  const systemInstruction =
    LITERARY_TRANSLATION_FRAMING +
    "Bạn là một chuyên gia kiểm định chất lượng (QA) dịch thuật Trung - Việt chuyên nghiệp.\n" +
    "Nhiệm vụ của bạn là kiểm tra xem bản dịch tiếng Việt có đầy đủ, chính xác so với văn bản gốc tiếng Trung hay không.\n" +
    "Hãy đối chiếu kỹ văn bản gốc tiếng Trung và bản dịch tiếng Việt để phát hiện các lỗi sau:\n" +
    "1. Bỏ sót / cắt xén (Omissions): Những câu, đoạn hoặc chi tiết quan trọng trong bản gốc tiếng Trung bị thiếu trong bản dịch.\n" +
    "2. Thêm thắt / ảo giác (Additions/Hallucinations): Thông tin tự vẽ ra, không hề có trong bản gốc tiếng Trung.\n" +
    "3. Lặp lại nội dung (Repetitions): Câu chữ bị lặp đi lặp lại nhiều lần vô nghĩa trong bản dịch.\n\n" +
    "Bạn PHẢI trả về kết quả dưới định dạng JSON theo schema được yêu cầu, chứa danh sách các lỗi phát hiện được (hoặc mảng trống nếu không có lỗi). Hãy phản hồi cực kỳ nghiêm ngặt và chính xác.";

  const prompt = `--- VĂN BẢN TRUNG GỐC ---
${sourceText}

--- BẢN DỊCH TIẾNG VIỆT ---
${translatedText}

Hãy thực hiện thẩm định kỹ lưỡng từ đầu đến cuối bản dịch.`;

  const schema = {
    type: "OBJECT",
    properties: {
      isValid: {
        type: "BOOLEAN",
        description: "true nếu không phát hiện bất kỳ lỗi nghiêm trọng nào về bỏ sót, thêm thắt hoặc lặp lại. false nếu phát hiện lỗi."
      },
      issues: {
        type: "ARRAY",
        description: "Danh sách các vấn đề phát hiện được.",
        items: {
          type: "OBJECT",
          properties: {
            type: {
              type: "STRING",
              enum: ["omission", "addition", "repetition", "terminology", "other"],
              description: "Loại lỗi phát hiện: omission (bỏ sót), addition (thêm thắt), repetition (lặp lại), terminology (sai từ điển), other (khác)."
            },
            severity: {
              type: "STRING",
              enum: ["critical", "warning", "info"],
              description: "Mức độ nghiêm trọng của lỗi."
            },
            description: {
              type: "STRING",
              description: "Mô tả chi tiết lỗi phát hiện được, ghi rõ nội dung tiếng Trung bị ảnh hưởng và lỗi tiếng Việt tương ứng."
            }
          },
          required: ["type", "severity", "description"]
        }
      }
    },
    required: ["isValid", "issues"]
  };

  return { systemInstruction, prompt, schema };
}
