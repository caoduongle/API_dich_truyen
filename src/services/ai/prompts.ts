import {
  LITERARY_TRANSLATION_FRAMING,
  getGenreStyleGuide,
  getToneStyleGuide,
  sanitizePromptInput,
  getPolishStrategyForRound,
  countParagraphs,
} from '../../lib/text';
import { GENRE_PROFILES, TONE_PROFILES } from '../../config/translationStyles';
import {
  GroupedGlossarySections,
  groupGlossaryByRole,
  normalizeCharacterProfile,
  prioritizeKnownTermsForChapter,
  selectRelevantGlossary,
  substituteGlossaryTermsSafely,
} from '../../lib/glossaryMatch';
import { buildEntityExtractionInstruction, buildEntitySchema } from './glossaryPrompts';

import { ContinuityContext } from "../translation/types";
import { CharacterProfile } from "../../types";

export interface GlossaryEntry {
  chinese: string;
  vietnamese: string;
  pinyin?: string;
  type?: string;
  note?: string;
  variants?: string[];
  isPinned?: boolean;
  characterProfile?: CharacterProfile;
  [key: string]: any;
}

export interface BuildRawTranslationPromptParams {
  text: string;
  genre: string;
  tone: string;
  description?: string;
  glossary?: GlossaryEntry[];
  isRetry?: boolean;
  continuity?: ContinuityContext;
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
  roundIndex?: number;
  totalRounds?: number;
  continuity?: ContinuityContext;
}

export interface BuildQaCritiquePromptParams {
  sourceText: string;
  translatedText: string;
  genre?: string;
  tone?: string;
  description?: string;
  glossary?: GlossaryEntry[];
}

function buildInstructionPriorityBlock(stageHeading: string, priority3Line: string): string {
  return (
    `[THỨ TỰ ƯU TIÊN TUYỆT ĐỐI ${stageHeading}]:\n` +
    "- ƯU TIÊN #1 (BẤT KHẢ XÂM PHẠM): TRUNG THÀNH TUYỆT ĐỐI 100% VỚI NGUYÊN TÁC TIẾNG TRUNG, BẢNG TỪ ĐIỂN & BẢO TOÀN CẤU TRÚC 1-1 (XUỐNG DÒNG, CÁCH NGẮT CÂU, DẤU CÂU, NGOẶC THOẠI). KHÔNG bịa đặt thêm tên riêng nhân vật/địa danh/chiêu thức ngoài nguyên tác, KHÔNG thêm thắt tình tiết mới, KHÔNG bỏ sót câu đoạn hay lời thoại.\n" +
    "- ƯU TIÊN #2: Quy tắc dịch riêng của dự án — Cẩm nang & quy tắc xưng hô của truyện > Hồ sơ nhân vật (giới tính, tự xưng, quan hệ xưng hô) > Yêu cầu biên tập bổ sung.\n" +
    `- ƯU TIÊN #3 (thấp hơn #1 và #2): Quy chuẩn Tông giọng biên tập > Chỉ dẫn Thể loại chính — ${priority3Line}\n`
  );
}

function sanitizeGlossaryEntries(glossary: GlossaryEntry[] | undefined): GlossaryEntry[] {
  if (!Array.isArray(glossary)) return [];
  return glossary
    .filter((g) => g && typeof g.chinese === 'string' && g.chinese.trim().length > 0)
    .map((g) => ({
      ...g,
      chinese: sanitizePromptInput(g.chinese.trim()),
      vietnamese: sanitizePromptInput((g.vietnamese || '').trim()),
      pinyin: sanitizePromptInput((g.pinyin || '').trim()),
      type: sanitizePromptInput((g.type || 'other').trim()),
      note: sanitizePromptInput((g.note || '').trim()),
      variants: Array.isArray(g.variants)
        ? g.variants.map((v) => sanitizePromptInput(String(v || '').trim())).filter(Boolean)
        : undefined,
      characterProfile: normalizeCharacterProfile(g.characterProfile),
    }));
}

const GENDER_LABEL_VI: Record<string, string> = {
  male: 'Nam',
  female: 'Nữ',
  neutral: 'Trung lập',
  unknown: 'Chưa rõ',
};

function formatCharacterProfileSuffix(entry: GlossaryEntry): string {
  if (entry.type !== 'character' && !entry.characterProfile) return '';
  const profile = normalizeCharacterProfile(entry.characterProfile);
  if (!profile) return '';

  const parts: string[] = [];
  if (profile.gender && profile.gender !== 'unknown') {
    parts.push(`Giới tính: ${GENDER_LABEL_VI[profile.gender] || profile.gender}`);
  }
  if (profile.defaultNarrativePronoun) {
    parts.push(`Đại từ tự sự (ngôi thứ 3): "${profile.defaultNarrativePronoun}"`);
  }
  if (profile.defaultSelfPronoun) {
    parts.push(`Tự xưng: "${profile.defaultSelfPronoun}"`);
  }
  if (profile.relations && profile.relations.length > 0) {
    const relStr = profile.relations
      .map(
        (r) =>
          `với ${r.targetName} (xưng "${r.selfPronoun}" - gọi "${r.targetPronoun}"${r.note ? `; ${r.note}` : ''})`
      )
      .join(', ');
    parts.push(`Quan hệ xưng hô: ${relStr}`);
  }
  return parts.length > 0 ? ` | Hồ sơ nhân vật: [${parts.join(' | ')}]` : '';
}

function formatContinuityContextBlock(continuity?: ContinuityContext): string {
  if (!continuity) return '';
  const rawSourceTail = sanitizePromptInput((continuity.previousSourceTail || '').trim());
  const rawTranslationTail = sanitizePromptInput((continuity.previousTranslationTail || '').trim());
  const sourceTail = rawSourceTail.length > 350 ? rawSourceTail.slice(-350) : rawSourceTail;
  const translationTail =
    rawTranslationTail.length > 500 ? rawTranslationTail.slice(-500) : rawTranslationTail;

  if (!sourceTail && !translationTail) return '';

  const lines = [
    '[NGỮ CẢNH LIỀN TRƯỚC — CHỈ ĐỌC ĐỂ GIỮ MẠCH XƯNG HÔ, TUYỆT ĐỐI KHÔNG DỊCH LẠI ĐOẠN NÀY]',
  ];
  if (sourceTail) {
    lines.push(`Đoạn tiếng Trung liền trước:\n${sourceTail}`);
  }
  if (translationTail) {
    lines.push(`Bản dịch liền trước:\n${translationTail}`);
  }
  lines.push('[HẾT NGỮ CẢNH LIỀN TRƯỚC]');
  return lines.join('\n') + '\n\n';
}

function formatFullGlossaryEntryLine(entry: GlossaryEntry, options?: { mandateSuffix?: string }): string {
  const cn = entry.chinese;
  const variants = Array.isArray(entry.variants) ? entry.variants : [];
  const py = entry.pinyin || '';
  const vi = entry.vietnamese || '';
  const tp = entry.type || 'other';
  const nt = entry.note || '';
  const profileSuffix = formatCharacterProfileSuffix(entry);
  const mandate = options?.mandateSuffix ? `${options.mandateSuffix}; ` : '';
  return `- Trung: [${cn}${variants.length ? ' / ' + variants.join(' / ') : ''}] -> Hán Việt: [${py}] -> Việt: [${vi}] (${mandate}Loại: ${tp}${nt ? `, Ghi chú: ${nt}` : ', Ghi chú: '}${profileSuffix})`;
}

function formatRoleGroupedGlossarySections(
  sections: GroupedGlossarySections<GlossaryEntry>,
  formatter: (entry: GlossaryEntry) => string,
  includePinnedReference: boolean
): string {
  const blocks: Array<{ heading: string; items: GlossaryEntry[] }> = [
    { heading: '### Nhân vật & Hồ sơ xưng hô', items: sections.characterProfiled },
    { heading: '### Nhân vật khác', items: sections.characterPlain },
    { heading: '### Địa danh', items: sections.location },
    { heading: '### Thuật ngữ / Kỹ năng / Vật phẩm', items: sections.term },
    { heading: '### Thành ngữ / Cụm từ / Khác', items: sections.phraseOther },
  ];

  if (includePinnedReference) {
    blocks.push({ heading: '### Từ điển ghim tham chiếu', items: sections.pinnedReference });
  }

  return blocks
    .filter((b) => b.items.length > 0)
    .map((b) => `${b.heading}\n${b.items.map(formatter).join('\n')}`)
    .join('\n');
}

/**
 * Xây dựng payload prompt và schema cho Giai đoạn 1: Dịch thô + Trích xuất thực thể
 */
export function buildRawTranslationPayload(params: BuildRawTranslationPromptParams) {
  const { text, genre, tone, description, glossary = [], isRetry, continuity } = params;

  const cleanGenre = sanitizePromptInput(genre || "Tiên Hiệp");
  const cleanTone = sanitizePromptInput(tone || "Trang nghiêm cổ phong");
  const cleanDescription = sanitizePromptInput(description || "");
  const cleanText = sanitizePromptInput(text || "");

  const sanitizedGlossary = sanitizeGlossaryEntries(glossary);

  const { entries: relevantGlossary, matchedInSource } = selectRelevantGlossary(cleanText, sanitizedGlossary);

  let glossaryStr = "";
  if (sanitizedGlossary.length === 0) {
    glossaryStr = "(Không có từ điển tùy chọn, dịch tự động dựa trên âm Hán-Việt phổ thông và ngữ cảnh)";
  } else if (relevantGlossary.length === 0) {
    glossaryStr = "(Không có thuật ngữ trong từ điển xuất hiện trực tiếp ở phân đoạn này)";
  } else {
    glossaryStr = formatRoleGroupedGlossarySections(
      groupGlossaryByRole(relevantGlossary, matchedInSource),
      (g) => formatFullGlossaryEntryLine(g),
      true
    );
  }

  // Đánh dấu nội tuyến an toàn Chữ_Hán[Tên_Việt] cho cụm >= 2 ký tự Hán (giữ nguyên chữ Hán gốc)
  const { substitutedText } = substituteGlossaryTermsSafely(cleanText, relevantGlossary, {
    minHanLength: 2,
    annotationStyle: 'inline-pair',
  });

  let systemInstruction =
    LITERARY_TRANSLATION_FRAMING +
    "Bạn là hệ thống dịch thuật AI cao cấp chuyên dịch truyện chữ Trung Quốc sang tiếng Việt.\n" +
    "Nhiệm vụ của bạn là thực hiện dịch thô Giai đoạn 1 (Translation Draft 1) từ đoạn văn bản tiếng Trung được cung cấp.\n" +
    buildInstructionPriorityBlock(
      "KHI DỊCH THÔ",
      "DỊCH SÁT NGHĨA MẠCH LẠC sang tiếng Việt tự nhiên, bảo tồn đủ 100% phân đoạn và trích xuất thực thể mới."
    ) +
    "YÊU CẦU QUAN TRỌNG NHẤT:\n" +
    "1. BẮT BUỘC BẢO TỒN NGUYÊN VẸN 100% CẤU TRÚC 1-1 SO VỚI BẢN GỐC (XUỐNG DÒNG, NGẮT CÂU, DẤU CÂU):\n" +
    "   - Xuống dòng & Phân đoạn 1-1: Bản gốc có bao nhiêu đoạn văn/dòng thoại/câu thơ/dòng phân cảnh (***, ---) thì bản dịch PHẢI có bấy nhiêu đoạn/dòng tương ứng 1-1 theo đúng thứ tự, ngăn cách bởi đúng 2 dấu xuống dòng (\\n\\n). TUYỆT ĐỐI KHÔNG gộp đoạn ngắn hoặc lời thoại vào tự sự; tiêu đề chương đứng riêng trên dòng đầu.\n" +
    "   - Cách ngắt câu 1-1: Giữ nguyên số lượng, ranh giới và trật tự các câu trong từng đoạn. KHÔNG tự ý gộp nhiều câu ngắn thành 1 câu dài hoặc cắt 1 câu gốc thành nhiều câu rời.\n" +
    "   - Dấu câu & Thoại 1-1: Chuyển sạch 100% dấu câu tiếng Trung sang tiếng Việt chuẩn (。→., ，/、→,, ；→;, ：→:, ？→?, ！→!, ……→..., ——→—, “...”/「...」→\"...\", 『...』/‘...’→'...', （...）→(...), 《...》→«...»). Giữ nguyên lời thoại trực tiếp trong ngoặc \"...\" và bảo toàn dấu ngữ khí (?, !, ..., —), tuyệt đối không để sót dấu câu tiếng Trung.\n" +
    "2. Tôn trọng Tuyệt đối các từ khóa, thực thể và đại từ trong bảng Từ điển (Glossary) được cung cấp. Nếu một từ Trung Quốc xuất hiện trong Glossary, bạn PHẢI dịch chính xác bằng từ tiếng Việt tương ứng.\n" +
    "3. Dịch chính xác nghĩa đơn và bối cảnh câu chữ. Phân biệt rõ ràng người nam là 'hắn/y/chàng', người nữ là 'nàng/cô/y', người già là 'lão', v.v. dựa trên giới tính quy định.\n" +
    "4. Bản dịch thô này cần đủ sát nghĩa gốc chữ Trung, cấu trúc dễ hiểu, không bỏ sót bất kỳ chi tiết hay câu văn nào.\n" +
    "5. TRÍCH XUẤT THỰC THỂ MỚI: Trong quá trình đọc hiểu tiếng Trung gốc, hãy tinh mắt phát hiện NGAY các tên nhân vật mới, địa danh mới, chiêu thức võ công/ma thuật/bí kĩ mới xuất hiện mà CHƯA có trong Từ điển (Glossary) được đối chiếu và điền vào `discoveredEntities`.\n" +
    "6. KHÔI PHỤC TÊN GỐC TIẾNG ANH/PHƯƠNG TÂY: Khi điền trường 'vietnamese' của `discoveredEntities`, NẾU là phiên âm từ tên tiếng Anh/phương Tây (ví dụ: 阿诗娜 = Athena, 盖伊 = Guy), hãy khôi phục TÊN GỐC TIẾNG ANH. Nếu kèm danh từ chỉ loại hoặc đồ vật đi liền phía sau (như 茶, 镇, 城, 国), bắt buộc dịch danh từ sang tiếng Việt đặt trước tên tiếng Anh (ví dụ: 阿帕茶 -> 'Trà Abbacchio', 伦敦城 -> 'Thành London'). Nếu là tên thuần Trung, dùng phiên âm Hán-Việt hoặc nghĩa tiếng Việt mượt mà.\n" +
    "7. BẢO TOÀN DẠNG CHỮ HÁN GỐC: Về trường 'chinese' trong `discoveredEntities`, bạn PHẢI copy CHÍNH XÁC ký tự Hán như xuất hiện trong VĂN BẢN TIẾNG TRUNG GỐC. TUYỆT ĐỐI KHÔNG tự ý chuyển đổi giữa phồn thể và giản thể (văn bản gốc phồn thể thì trả về phồn thể, giản thể thì trả về giản thể).\n" +
    "8. LOẠI BỎ NGOẶC CHÚ THÍCH NHÁP: Khi gặp thuật ngữ được chú thích dạng Chữ_Hán[Tên_Việt] hoặc [Tên_Việt] trong văn bản, chỉ viết 'Tên_Việt' KHÔNG có ngoặc vuông và KHÔNG giữ lại chữ Hán trong bản dịch cuối cùng. Ví dụ: 罗峰[La Phong] hoặc [Philomena] → viết 'La Phong', 'Philomena'.\n" +
    `9. PHONG CÁCH THỂ LOẠI & TÔNG GIỌNG: ${getGenreStyleGuide(cleanGenre)} | ${getToneStyleGuide(cleanTone)}\n` +
    (cleanDescription && cleanDescription.trim()
      ? `10. BẮT BUỘC TUÂN THỦ nguyên tắc xưng hô và phong cách dịch đặc biệt của truyện: ${cleanDescription.trim()}\n`
      : "");

  if (isRetry) {
    systemInstruction +=
      "\n\n⚠️ CẢNH BÁO QUAN TRỌNG: Lượt dịch trước bị lỗi do để sót chữ Hán chưa dịch. Trong lượt dịch này, bạn BẮT BUỘC PHẢI DỊCH 100% SANG TIẾNG VIỆT HOẶC PHIÊN ÂM HÁN-VIỆT. TUYỆT ĐỐI KHÔNG COPY NGUYÊN VĂN BẤT KỲ CÂU TỪ CHỮ HÁN NÀO.";
  }

  const hasBrackets = /\[[^\]]+\]/.test(cleanText);
  const textPromptBlock = hasBrackets
    ? `--- VĂN BẢN TIẾNG TRUNG (ĐÃ ĐÁNH DẤU TỪ ĐIỂN) ---
(Các tên đã được thay sẵn trong ngoặc vuông [Tên_Việt]. Bắt buộc dùng đúng tên này khi dịch)
${substitutedText}`
    : `--- VĂN BẢN TIẾNG TRUNG GỐC ---
${substitutedText}`;

  const expectedParagraphCount = countParagraphs(cleanText);
  const continuityBlock = formatContinuityContextBlock(continuity);
  const prompt = `--- THÔNG TIN TRUYỆN ---
Thể loại: ${cleanGenre}
Tông giọng: ${cleanTone}
${cleanDescription && cleanDescription.trim() ? `Nguyên tắc dịch thuật & Quy tắc xưng hô từ cẩm nang:\n${cleanDescription.trim()}` : ""}

--- TỪ ĐIỂN TÊN NHÂN VẬT & THUẬT NGỮ (ĐÃ CÓ - BẮT BUỘC TUÂN THỦ) ---
${glossaryStr}

[BẢN ĐỒ CẤU TRÚC ĐOẠN BẮT BUỘC: Xuất đúng ${expectedParagraphCount} đoạn văn/dòng ngăn cách bằng \\n\\n, giữ nguyên ngắt câu và dấu câu 1-1]

${continuityBlock}${textPromptBlock}`;

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
    roundIndex = 1,
    totalRounds = 1,
    continuity,
  } = params;

  const cleanGenre = sanitizePromptInput(genre || "Tiên Hiệp");
  const cleanTone = sanitizePromptInput(tone || "Trang nghiêm cổ phong");
  const cleanDescription = sanitizePromptInput(description || "");
  const cleanAdditionalInstructions = sanitizePromptInput(additionalInstructions || "");

  const strategy = getPolishStrategyForRound(roundIndex, totalRounds);

  const cleanSourceText = sanitizePromptInput(sourceText || "");
  const cleanRawTranslation = sanitizePromptInput(rawTranslation);

  const sanitizedGlossary = sanitizeGlossaryEntries(glossary);
  const { entries: relevantGlossary, matchedInSource } = selectRelevantGlossary(
    cleanSourceText,
    sanitizedGlossary
  );

  const {
    substitutedText: substitutedSourceText,
    totalReplacements: totalMatchOccurrences,
  } = substituteGlossaryTermsSafely(cleanSourceText, relevantGlossary, {
    minHanLength: 2,
    annotationStyle: 'inline-pair',
  });

  const groupedGlossary = groupGlossaryByRole(relevantGlossary, matchedInSource);
  const pinnedOnlyEntries = groupedGlossary.pinnedReference;

  const systemInstruction =
    LITERARY_TRANSLATION_FRAMING +
    "BẠN LÀ MỘT BIÊN TẬP VIÊN VĂN HỌC VÀ DỊCH GIẢ TRUNG - VIỆT ĐẠI TÀI.\n" +
    buildInstructionPriorityBlock(
      "KHI CHUỐT VĂN PHONG",
      "TRAU CHUỐT VĂN PHONG thuần Việt mượt mà, chỉ cải thiện diễn đạt trong phạm vi ý nghĩa nguyên gốc."
    ) +
    (roundIndex > 1
      ? `ĐÂY LÀ LƯỢT CHUỐT VĂN THỨ ${strategy.round}/${Math.max(strategy.round, totalRounds)} (${strategy.stageName.toUpperCase()}).\n` +
        `CHỈ ĐẠO TRỌNG TÂM LƯỢT NÀY: ${strategy.directive}\n`
      : "Nhiệm vụ của bạn là thực hiện chuốt mịn văn phong (Translation Polishing Phase 2) cho bản dịch thô tiếng Việt dựa trên văn bản tiếng Trung đối chiếu.\n") +
    "QUY ĐỊNH BẮT BUỘC:\n" +
    "1. BẮT BUỘC BẢO TỒN NGUYÊN VẸN 100% CẤU TRÚC 1-1 (XUỐNG DÒNG, NGẮT CÂU, DẤU CÂU):\n" +
    "   - Xuống dòng & Phân đoạn 1-1: Bản gốc và bản dịch thô có bao nhiêu đoạn văn/dòng thoại/dòng phân cảnh thì bản dịch biên tập PHẢI có đúng bấy nhiêu đoạn/dòng tương ứng 1-1, ngăn cách bởi đúng 2 dấu xuống dòng (\\n\\n). TUYỆT ĐỐI KHÔNG gộp thoại vào tự sự; tiêu đề chương đứng riêng dòng đầu.\n" +
    "   - Cách ngắt câu 1-1: Giữ nguyên ranh giới, số lượng và trật tự các câu trong từng đoạn so với nguyên tác. KHÔNG gộp nhiều câu ngắn thành câu dài, KHÔNG tách 1 câu thành nhiều câu.\n" +
    "   - Dấu câu & Thoại 1-1: Giữ nguyên lời thoại trực tiếp trong ngoặc \"...\" (không đổi thành câu kể gián tiếp), bảo toàn dấu ngữ khí (?, !, ..., —), chuẩn hóa sạch 100% dấu câu tiếng Trung sang chuẩn tiếng Việt.\n" +
    "2. TUYỆT ĐỐI KHÔNG CẮT CỤT HOẶC TÓM TẮT: Không được lược bỏ bất kỳ câu văn, đoạn văn, chi tiết hay lời thoại nào ở giữa hoặc cuối chương so với bản dịch thô. Độ dài và nội dung bản chuốt văn PHẢI truyền tải trọn vẹn 100% bản dịch thô.\n" +
    "3. Diễn đạt mượt mà thuần Việt, loại bỏ hoàn toàn cấu trúc câu 'sượng', ngữ pháp dịch máy thô cứng (convert/quick translator vibe).\n" +
    "4. Giữ đúng sắc thái, đại từ nhân xưng phù hợp thể loại và tông giọng được yêu cầu.\n" +
    "5. Tôn trọng triệt để các thuật ngữ trong Từ điển riêng đã được định nghĩa.\n" +
    "6. Khi sử dụng thuật ngữ từ ngoặc vuông Chữ_Hán[Tên_Việt] hoặc [Tên_Việt], hãy chỉ viết 'Tên_Việt' KHÔNG có ngoặc vuông và KHÔNG giữ lại chữ Hán trong bản dịch cuối cùng (ví dụ: [Philomena] → viết 'Philomena').\n" +
    `7. Phong cách phù hợp thể loại & tông giọng: ${getGenreStyleGuide(cleanGenre)} | ${getToneStyleGuide(cleanTone)}` +
    (cleanDescription && cleanDescription.trim() ? `\n8. BẮT BUỘC TUÂN THỦ NGUYÊN TẮC DỊCH THUẬT & QUY TẮC XƯNG HÔ ĐẶC THÙ CỦA TRUYỆN:\n${cleanDescription.trim()}` : "") +
    (isExtractionEnabled ? "\n9. Trong quá trình rà soát đối chiếu, nếu phát hiện thêm thực thể/tên riêng nào chưa có trong từ điển, hãy trích xuất vào discoveredEntities. ĐẶC BIỆT LƯU Ý: Khôi phục tên gốc tiếng Anh nếu là phiên âm phương Tây; dịch danh từ chỉ loại tiếng Trung lên trước tên tiếng Anh (ví dụ: 阿帕茶 -> 'Trà Abbacchio'); và giữ nguyên dạng chữ Hán phồn/giản thể như trong bản gốc." : "");

  const formatPolishGlossaryLine = (g: GlossaryEntry): string =>
    formatFullGlossaryEntryLine(g, { mandateSuffix: 'Bắt buộc dùng bản dịch này' });

  const matchedGlossaryBody = formatRoleGroupedGlossarySections(groupedGlossary, formatPolishGlossaryLine, false);
  const matchedGlossaryBlock = matchedInSource.length > 0 && matchedGlossaryBody
    ? `\n[TỪ ĐIỂN RIÊNG ĐÃ XUẤT HIỆN TRONG ĐOẠN NÀY (${matchedInSource.length} thuật ngữ, ${totalMatchOccurrences} lần xuất hiện)]:\n${matchedGlossaryBody}`
    : '';

  const pinnedGlossaryBlock = pinnedOnlyEntries.length > 0
    ? `\n[TỪ ĐIỂN GHIM BẮT BUỘC (${pinnedOnlyEntries.length} thuật ngữ)]:\n${pinnedOnlyEntries.map(formatPolishGlossaryLine).join('\n')}`
    : '';

  const expectedPolishParagraphCount = countParagraphs(cleanSourceText || cleanRawTranslation);
  const continuityBlock = formatContinuityContextBlock(continuity);
  const prompt = `[THÔNG TIN BẢN THẢO]
Thể loại: ${cleanGenre}
Tông giọng: ${cleanTone}
${cleanDescription && cleanDescription.trim() ? `[NGUYÊN TẮC DỊCH THUẬT & QUY TẮC XƯNG HÔ ĐẶC THÙ TỪ CẨM NANG]\n${cleanDescription.trim()}\n` : ''}
[YÊU CẦU BIÊN TẬP BỔ SUNG TỪ NGƯỜI DÙNG]
${cleanAdditionalInstructions && cleanAdditionalInstructions.trim() ? cleanAdditionalInstructions.trim() : 'Hãy trau chuốt câu chữ tự nhiên, thuần Việt nhưng vẫn trung thành nguyên tác và giữ nguyên tuyệt đối cấu trúc 1-1 (xuống dòng, ngắt câu, dấu câu, ngoặc thoại).'}

[BẢN ĐỒ CẤU TRÚC ĐOẠN BẮT BUỘC: Xuất đúng ${expectedPolishParagraphCount} đoạn văn/dòng ngăn cách bằng \\n\\n, giữ nguyên ngắt câu và dấu câu 1-1]

${continuityBlock}${strategy.inputLabel}
${cleanRawTranslation}

[BẢN GỐC TIẾNG TRUNG ĐỐI CHIẾU]
${substitutedSourceText}
${matchedGlossaryBlock}${pinnedGlossaryBlock}

[HƯỚNG DẪN BIÊN TẬP VĂN HỌC]
${getGenreStyleGuide(cleanGenre)}
${getToneStyleGuide(cleanTone)}
${roundIndex > 1 ? `- Trọng tâm biên tập Lượt ${strategy.round}: ${strategy.directive}\n` : ''}- Hãy chuốt lại câu chữ tiếng Việt cho tự nhiên, thuần Việt, loại bỏ cảm giác "dịch máy", giữ đúng tông giọng ${cleanTone} trong khi vẫn khóa chặt 1-1 ranh giới câu và dấu câu nguyên tác.
- Đảm bảo mạch văn trôi chảy, danh từ riêng chuẩn xác theo từ điển và âm Hán Việt.
- Giữ nguyên 100% cấu trúc phân đoạn, cách ngắt câu, dấu câu ngữ khí và tiêu đề chương.`;

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
  const { genre, tone, description, glossary = [] } = params;

  const cleanGenre = sanitizePromptInput(genre || "");
  const cleanTone = sanitizePromptInput(tone || "");
  const cleanDescription = sanitizePromptInput(description || "");

  let glossarySection = "";
  const sanitizedGlossary = sanitizeGlossaryEntries(glossary);
  if (sanitizedGlossary.length > 0) {
    const { entries: relevantGlossary, matchedInSource } = selectRelevantGlossary(sourceText, sanitizedGlossary);
    const checkableRelevant = relevantGlossary.filter((g) => g.chinese && g.vietnamese);
    const checkableMatched = matchedInSource.filter((g) => g.chinese && g.vietnamese);
    const glossaryLines = formatRoleGroupedGlossarySections(
      groupGlossaryByRole(checkableRelevant, checkableMatched),
      (g) => formatFullGlossaryEntryLine(g),
      true
    );
    if (glossaryLines) {
      glossarySection = `\n\n--- BẢNG TỪ ĐIỂN QUY ƯỚC CỦA DỰ ÁN ---\n${glossaryLines}`;
    }
  }

  const contextDirectives =
    (cleanGenre ? `\n- Thể loại truyện: ${cleanGenre} (${getGenreStyleGuide(cleanGenre)})` : "") +
    (cleanTone ? `\n- Tông giọng biên dịch: ${cleanTone} (${getToneStyleGuide(cleanTone)})` : "") +
    (cleanDescription && cleanDescription.trim()
      ? `\n- Quy tắc xưng hô & phong cách đặc thù: ${cleanDescription.trim()}\nLƯU Ý QUAN TRỌNG: Các cách xưng hô hoặc văn phong tuân thủ đúng quy tắc đặc thù trên và tông giọng đã chọn là CHỦ Ý CỦA DỊCH GIẢ, TUYỆT ĐỐI KHÔNG coi là lỗi sai.`
      : "");

  const systemInstruction =
    LITERARY_TRANSLATION_FRAMING +
    "Bạn là một chuyên gia kiểm định chất lượng (QA) dịch thuật Trung - Việt chuyên nghiệp.\n" +
    "Nhiệm vụ của bạn là kiểm tra xem bản dịch tiếng Việt có đầy đủ, trung thực và chính xác so với văn bản gốc tiếng Trung hay không.\n" +
    buildInstructionPriorityBlock(
      "KHI KIỂM DUYỆT QA",
      "TÔN TRỌNG VĂN PHONG BIÊN TẬP thuần Việt khi nghĩa gốc, từ điển và xưng hô đều đã chính xác."
    ) +
    (contextDirectives ? `BỐI CẢNH DỰ ÁN:${contextDirectives}\n\n` : "") +
    "Hãy đối chiếu kỹ văn bản gốc tiếng Trung và bản dịch tiếng Việt để phát hiện đủ 8 nhóm lỗi sau:\n" +
    "1. Bỏ sót / cắt xén (omission / Omissions): Câu, đoạn hoặc chi tiết quan trọng trong bản gốc tiếng Trung bị thiếu trong bản dịch.\n" +
    "2. Thêm thắt / ảo giác (addition / Additions): Tình tiết, nhân vật hoặc tên riêng tự vẽ ra, không hề có trong bản gốc tiếng Trung.\n" +
    "3. Lặp lại nội dung (repetition / Repetitions): Câu chữ bị lặp đi lặp lại nhiều lần vô nghĩa trong bản dịch.\n" +
    "4. Sai thuật ngữ / từ điển (terminology / Terminology): Dịch sai hoặc bỏ quên tên riêng, thuật ngữ đã quy ước trong bảng từ điển.\n" +
    "5. Dịch sai nghĩa (mistranslation): Hiểu nhầm ngữ pháp/thành ngữ tiếng Trung dẫn tới sai lệch hoàn toàn ý nghĩa câu gốc.\n" +
    "6. Sai đại từ / xưng hô (pronoun): Dùng nhầm giới tính đại từ (hắn/nàng), ngôi tự xưng hoặc quan hệ xưng hô so với hồ sơ nhân vật và cẩm nang.\n" +
    "7. Sót chữ Hán / rác dịch thô (raw_leak): Còn sót ký tự chữ Hán chưa dịch, sót dấu câu toàn giác tiếng Trung (。, ，, 、, 「」, 『』, （）, 《》...) hoặc ngoặc chú thích thô như [Tên] trong bản dịch cuối.\n" +
    "8. Lỗi khác (other): Lỗi nghiêm trọng khác làm hỏng trải nghiệm đọc hoặc phá vỡ cấu trúc 1-1 so với bản raw (gộp/tách đoạn, bỏ dấu ngoặc thoại trực tiếp, đổi sai dấu ngữ khí ? / ! / ..., gộp câu bất thường).\n\n" +
    "Yêu cầu về trích dẫn lỗi (targetText):\n" +
    "- Với mỗi lỗi phát hiện, bạn BẮT BUỘC phải trích dẫn NGUYÊN VĂN (copy chính xác từng ký tự, không diễn giải, không sửa từ, không thêm dấu ngoặc kép) câu hoặc đoạn văn bản tiếng Việt trong bản dịch trực tiếp liên quan đến lỗi vào trường 'targetText'.\n" +
    "- Trường hợp ĐẶC BIỆT: Nếu lỗi là BỎ SÓT (omission) mà câu/đoạn hoàn toàn không xuất hiện trong bản dịch tiếng Việt để trích dẫn, bạn ĐƯỢC PHÉP để 'targetText' là chuỗi rỗng (\"\").\n\n" +
    "Bạn PHẢI trả về kết quả dưới định dạng JSON theo schema được yêu cầu, chứa danh sách các lỗi phát hiện được (hoặc mảng trống nếu không có lỗi). Hãy phản hồi cực kỳ nghiêm ngặt và chính xác.";

  const cleanSourceText = sanitizePromptInput(sourceText);
  const cleanTranslatedText = sanitizePromptInput(translatedText);
  const prompt = `--- VĂN BẢN TRUNG GỐC ---
${cleanSourceText}

--- BẢN DỊCH TIẾNG VIỆT ---
${cleanTranslatedText}${glossarySection}

Hãy thực hiện thẩm định kỹ lưỡng từ đầu đến cuối bản dịch đối chiếu với bối cảnh và từ điển trên.`;

  const schema = {
    type: "OBJECT",
    properties: {
      isValid: {
        type: "BOOLEAN",
        description: "true nếu không phát hiện bất kỳ lỗi nghiêm trọng nào. false nếu phát hiện lỗi."
      },
      issues: {
        type: "ARRAY",
        description: "Danh sách các vấn đề phát hiện được.",
        items: {
          type: "OBJECT",
          properties: {
            type: {
              type: "STRING",
              enum: [
                "omission",
                "addition",
                "repetition",
                "terminology",
                "mistranslation",
                "pronoun",
                "raw_leak",
                "other"
              ],
              description:
                "Loại lỗi: omission (bỏ sót), addition (thêm thắt), repetition (lặp lại), terminology (sai từ điển), mistranslation (dịch sai nghĩa), pronoun (sai xưng hô/giới tính), raw_leak (sót chữ Hán/ngoặc thô), other (khác)."
            },
            severity: {
              type: "STRING",
              enum: ["critical", "warning", "info"],
              description: "Mức độ nghiêm trọng của lỗi."
            },
            targetText: {
              type: "STRING",
              description: "Đoạn trích NGUYÊN VĂN câu/đoạn tiếng Việt bị lỗi trong bản dịch để định vị. Nếu là lỗi bỏ sót (omission) hoàn toàn không có trong bản dịch thì để chuỗi rỗng (\"\")."
            },
            description: {
              type: "STRING",
              description: "Mô tả chi tiết lỗi phát hiện được, ghi rõ nội dung tiếng Trung bị ảnh hưởng và lỗi tiếng Việt tương ứng."
            }
          },
          required: ["type", "severity", "targetText", "description"]
        }
      }
    },
    required: ["isValid", "issues"]
  };

  return { systemInstruction, prompt, schema };
}

export interface BuildAnalyzeGlossaryPromptParams {
  text: string;
  knownChineseTerms?: string[];
  knownGlossaryEntries?: Array<{ chinese: string; vietnamese: string; isPinned?: boolean }>;
  genre?: string;
  tone?: string;
  description?: string;
  loopIndex?: number;
  totalLoops?: number;
}

/**
 * Xây dựng payload cho tác vụ: Phân tích trích xuất gợi ý thuật ngữ từ văn bản thô (analyze-glossary)
 */
export function buildAnalyzeGlossaryPayload(params: BuildAnalyzeGlossaryPromptParams) {
  const text = sanitizePromptInput(params.text);
  const {
    knownChineseTerms = [],
    knownGlossaryEntries = [],
    genre = '',
    tone = '',
    description = '',
    loopIndex = 1,
    totalLoops = 1,
  } = params;

  const cleanGenre = sanitizePromptInput(genre || '');
  const cleanTone = sanitizePromptInput(tone || '');
  const cleanDescription = sanitizePromptInput(description || '');

  let projectContextHeader = '';
  if (cleanGenre || cleanTone || cleanDescription) {
    const parts: string[] = [];
    if (cleanGenre) parts.push(`Thể loại: ${cleanGenre}`);
    if (cleanTone) parts.push(`Tông giọng: ${cleanTone}`);
    if (cleanDescription) {
      const compactDesc = cleanDescription.length > 400 ? `${cleanDescription.slice(0, 400)}...` : cleanDescription;
      parts.push(`Quy ước đặt tên & xưng hô của truyện: ${compactDesc}`);
    }
    projectContextHeader = `--- BỐI CẢNH DỰ ÁN (NEO PHONG CÁCH ĐẶT TÊN) ---\n${parts.join('\n')}\n\n`;
  }

  let exclusionText = '';
  if (knownGlossaryEntries.length > 0) {
    const anchorLines = knownGlossaryEntries
      .slice(0, 150)
      .map((entry) => {
        const cn = sanitizePromptInput((entry.chinese || '').trim());
        const vi = sanitizePromptInput((entry.vietnamese || '').trim());
        return vi ? `- [${cn}] => [${vi}]` : `- [${cn}]`;
      })
      .filter((line) => line.length > 4);

    if (anchorLines.length > 0) {
      exclusionText =
        `\n\n--- THUẬT NGỮ ĐÃ BIẾT TRONG TRUYỆN (GIỮ NHẤT QUÁN TÊN GỌI & KHÔNG TRÍCH LẠI KỂ CẢ MẢNH CẮT) ---\n` +
        `${anchorLines.join('\n')}\n` +
        (loopIndex > 1
          ? `ĐÂY LÀ LƯỢT RÀ SOÁT THỨ ${loopIndex}/${totalLoops}. Tuyệt đối BỎ QUA các thuật ngữ đã có trên; tập trung tìm nhân vật phụ, địa danh phụ, chiêu thức/đạo cụ còn sót và giữ chuẩn Hán-Việt đồng bộ.`
          : `Tuyệt đối KHÔNG trích xuất lại các thuật ngữ đã có trên hoặc mảnh tên cắt ngắn của chúng; hãy dùng đúng quy chuẩn đặt tên và âm Hán-Việt tương ứng cho thực thể mới.`);
    }
  } else if (knownChineseTerms.length > 0 && loopIndex > 1) {
    const prioritizedTerms = prioritizeKnownTermsForChapter(text, knownChineseTerms, 150);
    const termList = prioritizedTerms.join(', ');
    exclusionText =
      `\n\n--- DANH SÁCH THUẬT NGỮ ĐÃ CÓ / ĐÃ QUÉT ĐƯỢC (BỎ QUA KHÔNG TRÍCH XUẤT LẠI) ---\n` +
      `${termList}\n` +
      `ĐÂY LÀ LƯỢT RÀ SOÁT THỨ ${loopIndex}/${totalLoops}. Tuyệt đối BỎ QUA các thuật ngữ đã có trong danh sách trên. Hãy tập trung rà soát sâu để tìm ra các tên riêng nhân vật phụ, địa danh phụ, chiêu thức võ công/pháp thuật bị bỏ sót trong văn bản gốc.`;
  }

  const systemInstruction =
    LITERARY_TRANSLATION_FRAMING +
    "Bạn là trợ lý phân tích ngôn lý học tiếng Trung chuyên về truyện văn học, kiếm hiệp, thế giới giả tưởng. " +
    "Nhiệm vụ của bạn là đọc kỹ đoạn văn bản tiếng Trung, trích xuất tất cả các tên nhân vật (characters), địa danh quan trọng (locations), bí kíp/vũ khí/thuật ngữ chuyên môn (terms) xuất hiện. " +
    buildEntityExtractionInstruction('analyze', {
      loopIndex,
      totalLoops,
      hasExclusions: knownChineseTerms.length > 0 || knownGlossaryEntries.length > 0,
    });

  const schema = {
    type: "OBJECT",
    properties: {
      suggestions: {
        type: "ARRAY",
        description: "Danh sách thuật ngữ trích xuất được",
        items: buildEntitySchema('analyze'),
      },
    },
    required: ["suggestions"],
  };

  return { systemInstruction, prompt: projectContextHeader + text + exclusionText, schema };
}

export interface BuildAnalyzeGuidelinesPromptParams {
  guidelinesSection: string;
}

/**
 * Xây dựng payload cho tác vụ: Phân tích cẩm nang hướng dẫn dịch thuật (analyze-guidelines).
 * Chỉ suy đoán genre/tone/description — bảng thuật ngữ được trích xuất riêng bằng regex parser (xem parseGlossaryFromMd).
 */
export function buildAnalyzeGuidelinesPayload(params: BuildAnalyzeGuidelinesPromptParams) {
  const cleanGuidelines = sanitizePromptInput(params.guidelinesSection || '');
  const genreHints = GENRE_PROFILES.map((g) => g.id).join(', ');
  const toneHints = TONE_PROFILES.map((t) => t.id).join(', ');

  const systemInstruction =
    LITERARY_TRANSLATION_FRAMING +
    "Bạn là trợ lý dịch thuật AI lão luyện chuyên phân tích cẩm nang dịch thuật.\n" +
    "Nhiệm vụ: Đọc phần hướng dẫn phong cách dịch (kể cả phần quy tắc ở cuối tài liệu) và xác định:\n" +
    `1. Thể loại truyện (genre) — ưu tiên chọn đúng từ danh mục chuẩn [${genreHints}], hoặc ghi tên thể loại tùy chỉnh ngắn gọn nếu không nằm trong danh sách.\n` +
    `2. Tông giọng biên dịch (tone) — ưu tiên chọn đúng từ danh mục chuẩn [${toneHints}], hoặc ghi tên tông giọng tùy chỉnh phù hợp.\n` +
    "3. Tóm tắt đầy đủ, có cấu trúc rõ ràng các quy tắc xưng hô, mức độ Hán-Việt/thuần Việt, danh xưng/cấp bậc/tên ngoại lai và điều cần tránh (description).\n" +
    "KHÔNG cần trích xuất bảng thuật ngữ — đã được xử lý riêng bằng parser.";
  const prompt = `Phân tích phần hướng dẫn phong cách dịch thuật sau:\n\n${cleanGuidelines}`;
  const schema = {
    type: "OBJECT",
    properties: {
      genre: {
        type: "STRING",
        description: `Thể loại truyện phù hợp nhất (ưu tiên: ${genreHints}; cho phép thể loại tùy chỉnh nếu cẩm nang nêu rõ)`,
      },
      tone: {
        type: "STRING",
        description: `Tông giọng biên tập phù hợp nhất (ưu tiên: ${toneHints}; cho phép tông giọng tùy chỉnh nếu cẩm nang nêu rõ)`,
      },
      description: {
        type: "STRING",
        description: "Bản tổng hợp đầy đủ nguyên tắc xưng hô, chính sách Hán-Việt, quy ước danh xưng và điều cần tránh từ toàn bộ cẩm nang.",
      },
    },
    required: ["genre", "tone", "description"],
  };

  return { systemInstruction, prompt, schema };
}

export interface BuildExtractGlossaryPromptParams {
  text: string;
}

/**
 * Xây dựng payload cho tác vụ: Trích xuất nhanh thuật ngữ (extract-glossary)
 */
export function buildExtractGlossaryPayload(params: BuildExtractGlossaryPromptParams) {
  const text = sanitizePromptInput(params.text);

  const systemInstruction =
    LITERARY_TRANSLATION_FRAMING +
    "Bạn là trợ lý phân tích ngôn lý học tiếng Trung chuyên về truyện văn học, kiếm hiệp, thế giới giả tưởng. " +
    "Nhiệm vụ của bạn là đọc kỹ đoạn văn bản tiếng Trung và trích xuất tất cả tên nhân vật, địa danh, bí kíp/vũ khí/thuật ngữ chuyên môn. " +
    buildEntityExtractionInstruction('extract');

  const schema = {
    type: "ARRAY",
    items: buildEntitySchema('extract'),
  };

  const prompt = `Phân tích đoạn truyện chữ sau và trích xuất thuật ngữ:\n\n${text}`;

  return { systemInstruction, prompt, schema };
}

export interface BuildAlignChapterPromptParams {
  sourceText: string;
  translatedText: string;
}

/**
 * Xây dựng payload cho tác vụ: Gióng hàng song ngữ xuất bản học liệu JSONL (align-chapter)
 */
export function buildAlignChapterPayload(params: BuildAlignChapterPromptParams) {
  const sourceText = sanitizePromptInput(params.sourceText);
  const translatedText = sanitizePromptInput(params.translatedText);

  const systemInstruction =
    LITERARY_TRANSLATION_FRAMING +
    "Bạn là một chuyên gia đối dịch Trung - Việt nâng cao, chuyên gióng hàng (align) văn bản gốc tiếng Trung and bản dịch tiếng Việt của truyện/tiểu thuyết mạng sao cho ý nghĩa các cặp câu/đoạn khớp nhau hoàn toàn 100%.\n" +
    "Nhiệm vụ:\n" +
    "1. Phân tích văn bản gốc tiếng Trung và bản dịch tiếng Việt của chương truyện.\n" +
    "2. Tiến hành gióng hàng (align) từng câu hoặc nhóm câu/đoạn văn sao cho phần tiếng Trung (input) and phần tiếng Việt dịch tương ứng (output) khớp nhau hoàn hảo về nghĩa.\n" +
    "3. Nếu một câu tiếng Trung được dịch thoát ý thành nhiều câu tiếng Việt (hoặc ngược lại), hãy tự động gộp phần tiếng Trung và tiếng Việt tương ứng lại làm một để các cặp câu khớp nghĩa hoàn toàn.\n" +
    "4. Hãy phủ kín, không được bỏ sót bất kì dòng hay nội dung nào của chương truyện trong quá trình gióng hàng.\n" +
    "5. Chỉ trả về dữ liệu cấu trúc Array theo schema được yêu cầu, không kèm bất kỳ lời giải thích hay markdown code blocks hứa hẹn nào.";

  const prompt = `--- VĂN BẢN TRUNG GỐC ---
${sourceText}

--- VĂN BẢN VIỆT DỊCH THAM KHẢO ---
${translatedText}

Hãy thực hiện gióng hàng tỷ mỷ từ đầu đến cuối chương truyện.`;

  const schema = {
    type: "OBJECT",
    properties: {
      alignments: {
        type: "ARRAY",
        description: "Mảng danh sách các câu/đoạn đã gióng hàng hoàn chỉnh khớp nhau.",
        items: {
          type: "OBJECT",
          properties: {
            chinese: { type: "STRING", description: "Câu/đoạn văn tiếng Trung đã gióng hàng" },
            vietnamese: { type: "STRING", description: "Câu/đoạn văn tiếng Việt tương ứng đã gióng hàng" },
          },
          required: ["chinese", "vietnamese"],
        },
      },
    },
    required: ["alignments"],
  };

  return { systemInstruction, prompt, schema };
}

/**
 * Chuyển danh sách cặp câu đã gióng hàng thành các dòng JSONL để xuất bản học liệu fine-tuning.
 */
export function buildAlignmentJsonlLines(alignments: Array<{ chinese?: string; vietnamese?: string }>): string[] {
  const instructionText = "你是一位专业的中文转越南文翻译专家，专注于网络小说翻译。规则：1. 完整翻译所有内容，不得遗漏。2. 保持段落结构，不要合并段落。3. 直接输出翻译结果，放在 <result>...</result> 标签内。";
  return alignments.map((item) =>
    JSON.stringify({
      instruction: instructionText,
      input: (item.chinese || "").trim(),
      output: (item.vietnamese || "").trim(),
    })
  );
}

