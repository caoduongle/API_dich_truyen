import { GlossaryItem } from '../../../../types';
import { QualityEvaluationSample } from '../../qualityEvaluator';

function makeGlossaryItem(
  id: string,
  chinese: string,
  vietnamese: string,
  type: GlossaryItem['type'] = 'term',
  extra?: Partial<GlossaryItem>
): GlossaryItem {
  return {
    id,
    chinese,
    pinyin: vietnamese,
    vietnamese,
    type,
    note: '',
    origin: 'manual',
    createdAt: '2026-01-01T00:00:00Z',
    ...extra,
  };
}

/**
 * Tạo danh sách từ điển 250 mục để kiểm thử hiệu năng lọc từ điển theo ngữ cảnh (SC-005).
 */
export function buildLargeScaleGlossary250(): GlossaryItem[] {
  const realEntries: GlossaryItem[] = [
    makeGlossaryItem('scale-0', '林动', 'Lâm Động', 'character', {
      isPinned: true,
      characterProfile: {
        gender: 'male',
        defaultNarrativePronoun: 'hắn',
        defaultSelfPronoun: 'ta',
        relations: [{ targetName: 'Lâm Thanh Đàn', selfPronoun: 'ca', targetPronoun: 'muội' }],
      },
    }),
    makeGlossaryItem('scale-1', '林青檀', 'Lâm Thanh Đàn', 'character', {
      isPinned: true,
      characterProfile: {
        gender: 'female',
        defaultNarrativePronoun: 'nàng',
        defaultSelfPronoun: 'muội',
        relations: [{ targetName: 'Lâm Động', selfPronoun: 'muội', targetPronoun: 'ca ca' }],
      },
    }),
    makeGlossaryItem('scale-2', '青阳镇', 'Thanh Dương Trấn', 'location', { isPinned: true }),
    makeGlossaryItem('scale-3', '通背拳', 'Thông Bối Quyền', 'term'),
    makeGlossaryItem('scale-4', '石符', 'Thạch Phù', 'term'),
    makeGlossaryItem('scale-5', '淬体境', 'Thối Thể Cảnh', 'term'),
  ];

  const fillerEntries: GlossaryItem[] = [];
  for (let i = 6; i < 250; i++) {
    fillerEntries.push(
      makeGlossaryItem(
        `scale-${i}`,
        `秘境_${i}_禁地`,
        `Bí Cảnh Cấm Địa Thứ ${i}`,
        i % 3 === 0 ? 'location' : i % 3 === 1 ? 'character' : 'term',
        { note: `Thuật ngữ mở rộng quy mô số ${i} không xuất hiện trong chương mẫu` }
      )
    );
  }

  return [...realEntries, ...fillerEntries];
}

const sample1Glossary: GlossaryItem[] = [
  makeGlossaryItem('s1-1', '林', 'Lâm', 'character'),
  makeGlossaryItem('s1-2', '林动', 'Lâm Động', 'character'),
  makeGlossaryItem('s1-3', '大炎王朝', 'Đại Viêm Vương Triều', 'location'),
];

const sample1Source = [
  '第一章 森林试炼',
  '林动独自走入幽暗森林，四周古木林立。',
  '远方林海翻涌，他誓言成为大炎王朝强者。',
].join('\n\n');

const sample2Glossary = buildLargeScaleGlossary250();
const sample2Source = [
  '第二章 石符微光',
  '在青阳镇后山，林动盘膝修炼通背拳。',
  '掌心石符微微发热，助力他稳步迈入淬体境。',
].join('\n\n');

const sample3Glossary: GlossaryItem[] = [
  makeGlossaryItem('s3-1', '云韵', 'Vân Vận', 'character', {
    characterProfile: {
      gender: 'female',
      defaultNarrativePronoun: 'nàng',
      defaultSelfPronoun: 'bổn tông',
      relations: [{ targetName: 'Tiêu Viêm', selfPronoun: 'ta', targetPronoun: 'ngươi' }],
    },
  }),
  makeGlossaryItem('s3-2', '萧炎', 'Tiêu Viêm', 'character', {
    characterProfile: {
      gender: 'male',
      defaultNarrativePronoun: 'hắn',
      defaultSelfPronoun: 'ta',
      relations: [{ targetName: 'Vân Vận', selfPronoun: 'vãn bối', targetPronoun: 'tiền bối' }],
    },
  }),
  makeGlossaryItem('s3-3', '魔兽山脉', 'Ma Thú Sơn Mạch', 'location'),
];

const sample3Source = [
  '第三章 幽谷重逢',
  '云韵立于魔兽山脉悬崖之巅，她轻拂长袖，目光冷静。',
  '萧炎缓步上前，他微微拱手行礼，神情颇为恭敬。',
  '云韵淡淡开口，她转身望向远方云海。',
].join('\n\n');

const sample4Glossary: GlossaryItem[] = [
  makeGlossaryItem('s4-1', '韩立', 'Hàn Lập', 'character', {
    characterProfile: { gender: 'male', defaultNarrativePronoun: 'hắn' },
  }),
  makeGlossaryItem('s4-2', '掌天瓶', 'Chưởng Thiên Bình', 'term'),
  makeGlossaryItem('s4-3', '黄枫谷', 'Hoàng Phong Cốc', 'location'),
];

const sample4Source = [
  '第四章 灵草初成',
  '韩立取出掌天瓶，小心滴落一滴翠绿灵液。',
  '黄枫谷夜色沉沉，他收好玉盒静待天明。',
].join('\n\n');

const sample4Round1Faithful = [
  'Chương 4: Linh Thảo Sơ Thành',
  'Hàn Lập lấy ra Chưởng Thiên Bình, cẩn thận nhỏ xuống một giọt linh dịch xanh biếc.',
  'Đêm ở Hoàng Phong Cốc trầm lắng, hắn cất kỹ hộp ngọc lặng lẽ chờ trời sáng.',
].join('\n\n');

const sample5Glossary: GlossaryItem[] = [
  makeGlossaryItem('s5-1', '唐三', 'Đường Tam', 'character', {
    characterProfile: { gender: 'male', defaultNarrativePronoun: 'hắn' },
  }),
  makeGlossaryItem('s5-2', '小舞', 'Tiểu Vũ', 'character', {
    characterProfile: { gender: 'female', defaultNarrativePronoun: 'nàng' },
  }),
  makeGlossaryItem('s5-3', '蓝银草', 'Lam Ngân Thảo', 'term'),
];

const sample5Source = [
  '第五章 魂环觉醒',
  '唐三催动体内蓝银草，静静感应四周魂力波动。',
  '小舞在一旁护法，她微笑着点了点头。',
  '片刻后，林间恢复宁静。',
].join('\n\n');

export const UPLIFTED_EVAL_SAMPLES: QualityEvaluationSample[] = [
  {
    id: 'sample-1-single-char-compound',
    description: 'Mục 1 ký tự (林 -> Lâm) không được phép làm hỏng từ ghép 森林, 林海, 林立',
    sourceText: sample1Source,
    glossary: sample1Glossary,
    candidateTranslation: [
      'Chương 1: Thí Luyện Rừng Rậm',
      'Lâm Động một mình bước vào khu rừng u tối, bốn phía cổ thụ san sát.',
      'Phương xa biển rừng cuồn cuộn, hắn thề trở thành cường giả của Đại Viêm Vương Triều.',
    ].join('\n\n'),
    compoundWords: ['森林', '林海', '林立'],
    forbiddenMistranslations: ['Sâm Lâm', '森Lâm', 'Lâm[', ']Lâm'],
  },
  {
    id: 'sample-2-scale-250-glossary',
    description: 'Từ điển lớn 250 mục được lọc theo ngữ cảnh chỉ đưa mục liên quan + mục ghim vào prompt',
    sourceText: sample2Source,
    glossary: sample2Glossary,
    candidateTranslation: [
      'Chương 2: Ánh Sáng Thạch Phù',
      'Tại hậu sơn Thanh Dương Trấn, Lâm Động khoanh chân tu luyện Thông Bối Quyền.',
      'Thạch Phù trong lòng bàn tay khẽ nóng lên, trợ giúp hắn vững vàng bước vào Thối Thể Cảnh.',
    ].join('\n\n'),
  },
  {
    id: 'sample-3-chunk-pronoun-continuity',
    description: 'Duy trì nhất quán đại từ nhân vật theo hồ sơ qua ranh giới đoạn/phân đoạn',
    sourceText: sample3Source,
    glossary: sample3Glossary,
    candidateTranslation: [
      'Chương 3: U Cốc Trùng Phùng',
      'Vân Vận đứng trên đỉnh vách núi Ma Thú Sơn Mạch, nàng khẽ phất tay áo dài, ánh mắt bình tĩnh.',
      'Tiêu Viêm chậm rãi bước lên, hắn khẽ chắp tay hành lễ, thần sắc vô cùng cung kính.',
      'Vân Vận nhạt giọng lên tiếng, nàng quay người nhìn về biển mây phương xa.',
    ].join('\n\n'),
  },
  {
    id: 'sample-4-multi-round-polish',
    description: 'Bảo toàn trung thành qua nhiều lượt chuốt văn (không bịa đặt tên riêng ngoài nguồn)',
    sourceText: sample4Source,
    glossary: sample4Glossary,
    previousDraft: sample4Round1Faithful,
    candidateTranslation: sample4Round1Faithful,
  },
  {
    id: 'sample-5-planted-qa-issues',
    description: 'Chương sau kiểm duyệt & sửa có mục tiêu giữ vững thuật ngữ, xưng hô và parity đoạn văn',
    sourceText: sample5Source,
    glossary: sample5Glossary,
    candidateTranslation: [
      'Chương 5: Hồn Hoàn Giác Tỉnh',
      'Đường Tam thúc giục Lam Ngân Thảo trong cơ thể, lặng lẽ cảm ứng dao động hồn lực bốn phía.',
      'Tiểu Vũ đứng bên cạnh hộ pháp, nàng mỉm cười gật đầu.',
      'Một lát sau, trong rừng khôi phục yên tĩnh.',
    ].join('\n\n'),
  },
];

/**
 * Bộ mẫu baseline mô phỏng hành vi cũ trước nâng cấp (để đo mức cải thiện định lượng SC-001–SC-011).
 */
export const BASELINE_EVAL_SAMPLES: QualityEvaluationSample[] = [
  {
    id: 'sample-1-single-char-compound',
    description: 'Baseline: thay thế mù quáng từ 1 ký tự làm hỏng từ ghép 森林 / 林海 và bỏ sót tên đầy đủ',
    sourceText: sample1Source,
    glossary: sample1Glossary,
    substitutedSourceOverride:
      '第一章 森Lâm[Lâm]试炼\n\nLâm动独自走入幽暗森Lâm[Lâm]，四周古木Lâm[Lâm]立。\n\n远方Lâm[Lâm]海翻涌。',
    candidateTranslation: [
      'Chương 1: Thí Luyện Sâm Lâm',
      'Lâm Động một mình bước vào khu rừng u tối, bốn phía cổ thụ đứng san sát.',
      'Phương xa Lâm Hải cuồn cuộn, hắn thề trở thành cường giả của Đại Viêm Vương Triều.',
    ].join('\n\n'),
    compoundWords: ['森林', '林海', '林立'],
    forbiddenMistranslations: ['Sâm Lâm'],
  },
  {
    id: 'sample-2-scale-250-glossary',
    description: 'Baseline: nhồi nhét toàn bộ từ điển không lọc ngữ cảnh làm phình prompt',
    sourceText: sample2Source,
    glossary: sample2Glossary,
    useUnfilteredGlossaryForPromptCount: true,
    candidateTranslation: [
      'Chương 2: Ánh Sáng Thạch Phù',
      'Tại hậu sơn Thanh Dương Trấn, Lâm Động khoanh chân tu luyện quyen phap.',
      'Vật đá trong tay khẽ nóng lên.',
    ].join('\n\n'),
  },
  {
    id: 'sample-3-chunk-pronoun-continuity',
    description: 'Baseline: mất ngữ cảnh hồ sơ nhân vật làm trôi đại từ nữ sang "hắn"',
    sourceText: sample3Source,
    glossary: sample3Glossary,
    candidateTranslation: [
      'Chương 3: U Cốc Trùng Phùng',
      'Vân Vận đứng trên đỉnh vách núi Ma Thú Sơn Mạch, hắn khẽ phất tay áo dài, ánh mắt bình tĩnh.',
      'Tiêu Viêm chậm rãi bước lên, hắn khẽ chắp tay hành lễ, thần sắc vô cùng cung kính.',
      'Vân Vận nhạt giọng lên tiếng, anh quay người nhìn về biển mây phương xa.',
    ].join('\n\n'),
  },
  {
    id: 'sample-4-multi-round-polish',
    description: 'Baseline: chuốt văn lượt 2 tự bịa đặt tên riêng ngoài nguyên tác và đổi sai thuật ngữ',
    sourceText: sample4Source,
    glossary: sample4Glossary,
    previousDraft: sample4Round1Faithful,
    candidateTranslation: [
      'Chương 4: Linh Thảo Sơ Thành',
      'Hàn Lập lấy ra chiếc bình xanh của Huyết Ma Lão Tổ, cẩn thận nhỏ xuống một giọt linh dịch.',
      'Đêm ở Hoàng Phong Cốc trầm lắng, hắn cất kỹ hộp ngọc tại Vạn Cổ Thần Điện.',
    ].join('\n\n'),
  },
  {
    id: 'sample-5-planted-qa-issues',
    description: 'Baseline: bản dịch cài sẵn lỗi thiếu thuật ngữ, lệch xưng hô và sót chữ Hán',
    sourceText: sample5Source,
    glossary: sample5Glossary,
    candidateTranslation: [
      'Chương 5: Hồn Hoàn Giác Tỉnh',
      'Đường Tam thúc giục cỏ xanh trong cơ thể, lặng lẽ cảm ứng 魂力 bốn phía.',
      'Tiểu Vũ đứng bên cạnh hộ pháp, hắn khẽ gật đầu.',
    ].join('\n\n'),
  },
];
