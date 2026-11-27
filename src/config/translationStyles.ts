/**
 * Nguồn chân lý tập trung cho Thể loại chính, Tông giọng biên tập,
 * Cẩm nang dịch thuật có cấu trúc, Trích xuất/Xuất Markdown và Phát hiện mâu thuẫn văn phong.
 * Module thuần TypeScript thuộc tầng Config/Model — tuyệt đối không import UI hay hook.
 */

export type GenreRegisterClass =
  | 'classical_eastern'
  | 'modern_contemporary'
  | 'western_fantasy'
  | 'speculative_action'
  | 'suspense_dark'
  | 'light_slice_of_life'
  | 'neutral';

export type GenreGroup =
  | 'Cổ phong & Tu luyện'
  | 'Hiện đại & Đời sống'
  | 'Kỳ ảo & Phiêu lưu'
  | 'Trinh thám & Kinh dị'
  | 'Khác';

export type HanVietLevel = 'low' | 'balanced' | 'high' | 'domain_specific';

export interface StructuredGuidelineSections {
  contextSummary: string;
  pronounRules: string;
  hanVietPolicy: string;
  titlesAndForeignNames: string;
  avoidRules: string;
  extraNotes?: string;
}

export interface GenreProfile {
  id: string;
  label: string;
  group: GenreGroup;
  sealChar: string;
  registerClass: GenreRegisterClass;
  shortDescription: string;
  styleGuide: string;
  recommendedTones: string[];
  starterTemplate: StructuredGuidelineSections;
}

export interface ToneProfile {
  id: string;
  label: string;
  registerClass: GenreRegisterClass;
  hanVietLevel: HanVietLevel;
  shortDescription: string;
  styleGuide: string;
}

export interface StyleConflictWarning {
  id: string;
  severity: 'warning' | 'info';
  category: 'genre_tone_mismatch' | 'rule_tone_conflict' | 'rule_genre_conflict';
  message: string;
  suggestedTone?: string;
  suggestedActionLabel?: string;
}

export const CUSTOM_GENRE_OPTION_VALUE = '__CUSTOM_GENRE__';
export const CUSTOM_TONE_OPTION_VALUE = '__CUSTOM_TONE__';
export const LEGACY_OTHER_GENRE_VALUE = 'Khác';
export const MAX_CUSTOM_STYLE_LENGTH = 80;

export const GENRE_GROUPS: readonly GenreGroup[] = [
  'Cổ phong & Tu luyện',
  'Hiện đại & Đời sống',
  'Kỳ ảo & Phiêu lưu',
  'Trinh thám & Kinh dị',
  'Khác',
];

export const GUIDELINE_SECTION_HEADINGS = {
  contextSummary: '### Bối cảnh & Tóm tắt',
  pronounRules: '### Quy tắc xưng hô mặc định',
  hanVietPolicy: '### Mức độ Hán-Việt / Thuần Việt',
  titlesAndForeignNames: '### Danh xưng, Cấp bậc & Tên ngoại lai',
  avoidRules: '### Điều cần tránh',
} as const;

export const GENRE_PROFILES: readonly GenreProfile[] = [
  {
    id: 'Tiên Hiệp',
    label: 'Tiên Hiệp (Tu tiên, tông môn, cảnh giới trường sinh)',
    group: 'Cổ phong & Tu luyện',
    sealChar: '仙',
    registerClass: 'classical_eastern',
    shortDescription: 'Tu luyện cảnh giới, pháp bảo, tông môn và nhân quả đại đạo.',
    styleGuide:
      'Thể loại Tiên Hiệp: văn phong cổ phong thanh thoát, khí thế khoáng đạt; ưu tiên từ Hán-Việt cho cảnh giới, công pháp, linh khí, đan dược nhưng tự sự vẫn mượt mà. Xưng hô rõ tôn ti (ta-ngươi, đạo hữu, tiền bối-vãn bối, sư tôn-đệ tử). Tránh lẫn tiếng lóng hiện đại hoặc khẩu ngữ Tây hóa.',
    recommendedTones: ['Trang nghiêm cổ phong', 'Hùng tráng dồn dập', 'Dịch thuần Việt mượt mà'],
    starterTemplate: {
      contextSummary: 'Truyện tu tiên theo hệ thống cảnh giới cổ điển, coi trọng đạo tâm và nhân quả.',
      pronounRules: 'Đồng đạo gọi nhau "đạo hữu" (ta - các hạ/huynh đài); trên dưới rõ ràng (sư tôn/tiền bối - đệ tử/vãn bối); đối thủ dùng ta - ngươi.',
      hanVietPolicy: 'Giữ Hán-Việt cho cảnh giới tu luyện, công pháp, pháp bảo, đan dược; phần tự sự và miêu tả tâm lý dùng tiếng Việt gãy gọn, thanh thoát.',
      titlesAndForeignNames: 'Giữ nguyên âm Hán-Việt cho tên tông môn, trưởng lão, phong hào; thống nhất tên cảnh giới từ đầu đến cuối.',
      avoidRules: 'Tránh từ lóng đô thị hiện đại (OK, boss, fan, level up) trong bối cảnh tu chân.',
    },
  },
  {
    id: 'Võ Hiệp',
    label: 'Võ Hiệp (Giang hồ, kiếm khách, ân oán môn phái)',
    group: 'Cổ phong & Tu luyện',
    sealChar: '侠',
    registerClass: 'classical_eastern',
    shortDescription: 'Hành hiệp trượng nghĩa, chiêu thức nội công và ân oán võ lâm.',
    styleGuide:
      'Thể loại Võ Hiệp: câu văn rắn rỏi, giàu tiết tấu võ đấu và khí khái giang hồ; chiêu thức giữ Hán-Việt súc tích, động tác giao đấu dịch giàu động từ thuần Việt. Xưng hô chuẩn mực võ lâm (tại hạ-các hạ, huynh đài-huynh đệ, tiền bối, bang chủ). Tránh văn phong quá ẻo lả hoặc sặc mùi game hệ thống.',
    recommendedTones: ['Hùng tráng dồn dập', 'Trang nghiêm cổ phong', 'Trầm hùng dã sử'],
    starterTemplate: {
      contextSummary: 'Bối cảnh giang hồ võ lâm truyền thống, xoay quanh ân oán môn phái và nghĩa khí hiệp khách.',
      pronounRules: 'Khách sáo dùng tại hạ - các hạ; đồng môn gọi sư huynh - sư đệ/sư muội; kẻ địch gọi ta - ngươi hoặc tên thẳng.',
      hanVietPolicy: 'Tên chiêu thức, bí kíp, huyệt đạo, môn phái giữ Hán-Việt; mô tả chiêu giao phong dùng động từ mạnh thuần Việt.',
      titlesAndForeignNames: 'Giữ danh hiệu giang hồ (Kiếm Thánh, Chưởng Môn, Bang Chủ) nhất quán theo bảng thuật ngữ.',
      avoidRules: 'Tránh dùng thuật ngữ khoa huyễn, chỉ số RPG hay lối nói chuyện hiện đại.',
    },
  },
  {
    id: 'Huyền Huyễn',
    label: 'Huyền Huyễn (Dị giới kỳ ảo phương Đông, huyết mạch, thần thú)',
    group: 'Cổ phong & Tu luyện',
    sealChar: '玄',
    registerClass: 'classical_eastern',
    shortDescription: 'Thế giới giả tưởng đồ sộ, huyết mạch thần thông và chiến trận kỳ ảo.',
    styleGuide:
      'Thể loại Huyền Huyễn: kết hợp hào khí sử thi và sắc thái kỳ bí; câu văn giàu hình ảnh, tiết tấu linh hoạt giữa tự sự huyền bí và giao chiến bùng nổ. Xưng hô đa tầng theo thân phận (ta-ngươi, bản tọa, bổn hoàng, huynh-đệ). Tránh dịch thô cứng danh hiệu thần ma.',
    recommendedTones: ['Hùng tráng dồn dập', 'Trang nghiêm cổ phong', 'Dịch thuần Việt mượt mà'],
    starterTemplate: {
      contextSummary: 'Thế giới dị giới rộng lớn với nhiều chủng tộc, huyết mạch và thế lực cổ xưa.',
      pronounRules: 'Cường giả tự xưng ta/bản tọa; người cùng bối gọi ta - ngươi hoặc huynh - đệ; thuộc hạ thưa chủ nhân/bệ hạ.',
      hanVietPolicy: 'Cân bằng Hán-Việt sang trọng cho tên huyết mạch, thần thông, cổ tộc và thuần Việt tự nhiên cho dẫn truyện.',
      titlesAndForeignNames: 'Phân biệt rõ tên gốc phương Đông (Hán-Việt) và tên phiên âm ngoại tộc nếu xuất hiện.',
      avoidRules: 'Tránh giữ nguyên âm convert thô cứng như "hắn có chút ngưu bức", "một mặt mộng bức".',
    },
  },
  {
    id: 'Lịch Sử / Quân Sự',
    label: 'Lịch Sử / Quân Sự (Triều chính, binh pháp, tranh bá thiên hạ)',
    group: 'Cổ phong & Tu luyện',
    sealChar: '史',
    registerClass: 'classical_eastern',
    shortDescription: 'Dã sử triều đình, mưu lược chính trị và đại chiến quân đoàn.',
    styleGuide:
      'Thể loại Lịch Sử / Quân Sự: văn phong trầm hùng, chuẩn mực dã sử chương hồi; xưng hô quân thần và phẩm hàm triều đình chuẩn xác (bệ hạ, trẫm, vi thần, khanh, bản soái, mạt tướng). Thuật ngữ binh pháp, địa danh cổ dùng Hán-Việt nghiêm cẩn. Tuyệt đối tránh khẩu ngữ hiện đại làm gãy không khí lịch sử.',
    recommendedTones: ['Trầm hùng dã sử', 'Trang nghiêm cổ phong', 'Sắc sảo cung đấu'],
    starterTemplate: {
      contextSummary: 'Bối cảnh lịch sử / dã sử xoay quanh triều chính, quân vụ và mưu lược tranh hùng.',
      pronounRules: 'Vua xưng trẫm/quả nhân; quần thần xưng thần/vi thần - gọi bệ hạ; tướng sĩ xưng mạt tướng - gọi đại nhân/tướng quân.',
      hanVietPolicy: 'Ưu tiên từ Hán-Việt trang trọng cho quan chế, binh chủng, chiến thuật, tấu chương.',
      titlesAndForeignNames: 'Giữ nguyên tước vị, niên hiệu, chức quan (Thượng thư, Đô đốc, Hầu gia) và thống nhất địa danh cổ.',
      avoidRules: 'Tuyệt đối tránh ngôn từ hiện đại (sếp, nhân sự, chiến dịch marketing, OK).',
    },
  },
  {
    id: 'Cổ Đại / Xuyên Không',
    label: 'Cổ Đại / Xuyên Không (Xuyên về cổ đại, trạch viện, khoa cử)',
    group: 'Cổ phong & Tu luyện',
    sealChar: '古',
    registerClass: 'classical_eastern',
    shortDescription: 'Đời sống cổ đại, xuyên không đổi mệnh, khoa cử hoặc gia đình xưa.',
    styleGuide:
      'Thể loại Cổ Đại / Xuyên Không: cổ phong vừa phải, giữ phong vị phong tục xưa mà vẫn gần gũi dễ đọc. Xưng hô đúng vai vế gia tộc và xã hội cổ đại (phụ thân-mẫu thân, công tử-tiểu thư, chàng-nàng, ta-ngươi). Nếu nhân vật xuyên không có độc thoại nội tâm hiện đại thì giữ nét tinh nghịch riêng mà không phá bối cảnh hội thoại.',
    recommendedTones: ['Dịch thuần Việt mượt mà', 'Trang nghiêm cổ phong', 'Nhẹ nhàng điền văn'],
    starterTemplate: {
      contextSummary: 'Bối cảnh xã hội cổ đại kết hợp góc nhìn hiện đại của nhân vật xuyên không.',
      pronounRules: 'Trong nhà gọi phụ thân/mẫu thân/tổ mẫu; ngoài xã hội dùng công tử, cô nương, đại nhân; độc thoại nội tâm của người xuyên không có thể tự xưng tôi/mình.',
      hanVietPolicy: 'Dùng Hán-Việt vừa phải cho lễ nghi, khoa cử, xưng hô; đời sống thường nhật dịch thuần Việt uyển chuyển.',
      titlesAndForeignNames: 'Thống nhất cách gọi chức quan địa phương, đơn vị tiền tệ (lượng bạc, văn tiền) và gia quy.',
      avoidRules: 'Tránh để nhân vật cổ đại bản địa dùng từ hiện đại; tách bạch giữa lời thoại ra miệng và suy nghĩ nội tâm của người xuyên không.',
    },
  },
  {
    id: 'Cung Đấu / Gia Đấu',
    label: 'Cung Đấu / Gia Đấu (Hậu cung, phủ đệ, đấu trí thâm sâu)',
    group: 'Cổ phong & Tu luyện',
    sealChar: '宫',
    registerClass: 'classical_eastern',
    shortDescription: 'Âm mưu hậu cung, trạch đấu quyền quý, lời nói hai tầng nghĩa.',
    styleGuide:
      'Thể loại Cung Đấu / Gia Đấu: lời thoại sắc sảo, hàm ý ẩn dụ, giữ lễ tiết bề ngoài mà ngầm đối đầu. Xưng hô phân bậc cực kỳ chặt chẽ (hoàng thượng-nô tỳ-thần thiếp, bản cung, muội muội-tỷ tỷ, phu nhân-di nương). Chú trọng sắc thái kính ngữ và chuyển biến thái độ tinh tế giữa các nhân vật.',
    recommendedTones: ['Sắc sảo cung đấu', 'Trang nghiêm cổ phong', 'Trầm lắng tinh tế'],
    starterTemplate: {
      contextSummary: 'Đấu trí chốn hậu cung hoặc đại gia tộc, đề cao lễ nghi, tôn ti và ẩn ý ngôn từ.',
      pronounRules: 'Phi tần tự xưng thần thiếp/bản cung; cung nữ/thái giám xưng nô tỳ/nô tài; tỷ muội trong phủ dùng tỷ tỷ - muội muội đúng thứ bậc.',
      hanVietPolicy: 'Hán-Việt tinh tế ở cấp bậc hậu cung, lễ chế, lời nói mỉa mai bóng gió.',
      titlesAndForeignNames: 'Giữ chuẩn phong hiệu phi tần (Hoàng hậu, Quý phi, Tài nhân) và thứ bậc đích - thứ trong gia tộc.',
      avoidRules: 'Tránh dịch thô lỗ, suồng sã làm mất sự thâm sâu và lễ giáo bề ngoài của nhân vật.',
    },
  },
  {
    id: 'Đô Thị',
    label: 'Đô Thị (Hiện đại, thương trường, đời sống thành thị)',
    group: 'Hiện đại & Đời sống',
    sealChar: '都',
    registerClass: 'modern_contemporary',
    shortDescription: 'Bối cảnh thành thị hiện đại, công sở, gia đình và thương trường.',
    styleGuide:
      'Thể loại Đô Thị: ngôn ngữ hiện đại tinh gọn, tự nhiên như giao tiếp đời thực Việt Nam; nhịp câu linh hoạt. Xưng hô đúng tuổi tác và quan hệ hiện đại (tôi-anh/cô/ông/bà, cậu-tớ, anh-em, sếp-nhân viên). Tuyệt đối không dùng đại từ cổ phong (ta-ngươi, tại hạ, nương tử) hay văn phong chương hồi.',
    recommendedTones: ['Dịch thuần Việt mượt mà', 'Bình dị dân dã', 'Hài hước dí dỏm'],
    starterTemplate: {
      contextSummary: 'Truyện bối cảnh thành phố hiện đại, xoay quanh đời sống, tình cảm hoặc thương trường.',
      pronounRules: 'Dùng tôi - anh/chị/ông/cô ở nơi công cộng; cậu - tớ/mày - tao giữa bạn bè thân; anh - em trong tình cảm.',
      hanVietPolicy: 'Ưu tiên thuần Việt 85–90%; chỉ giữ từ Hán-Việt thông dụng trong kinh tế/pháp lý hiện đại.',
      titlesAndForeignNames: 'Dùng chức danh hiện đại (Giám đốc, Chủ tịch, Bác sĩ, Thanh tra); giữ nguyên tên thương hiệu hoặc tên tiếng Anh thông dụng.',
      avoidRules: 'Tuyệt đối tránh xưng hô cổ trang (ta - ngươi, huynh - đệ, tiểu thư - công tử trừ khi nói đùa).',
    },
  },
  {
    id: 'Ngôn Tình',
    label: 'Ngôn Tình (Tình cảm lãng mạn, tâm lý nhân vật sâu sắc)',
    group: 'Hiện đại & Đời sống',
    sealChar: '情',
    registerClass: 'neutral',
    shortDescription: 'Tình yêu đôi lứa, rung động nội tâm và giằng xé cảm xúc.',
    styleGuide:
      'Thể loại Ngôn Tình: câu chữ uyển chuyển, giàu nhịp cảm xúc và chiều sâu nội tâm; hội thoại lãng mạn tự nhiên không sến gượng. Linh hoạt xưng hô theo bối cảnh cổ đại (chàng-nàng, thiếp) hoặc hiện đại (anh-em, tôi-cô ấy), chú ý biến chuyển thân mật qua từng giai đoạn tình cảm.',
    recommendedTones: ['Trầm lắng tinh tế', 'Dịch thuần Việt mượt mà', 'Trang nghiêm cổ phong'],
    starterTemplate: {
      contextSummary: 'Truyện thiên về tuyến tình cảm và chuyển biến tâm lý giữa hai nhân vật chính.',
      pronounRules: 'Chuyển biến xưng hô theo độ thân mật: xa lạ (tôi - anh/cô hoặc công tử - cô nương) → thân mật (anh - em hoặc chàng - nàng).',
      hanVietPolicy: 'Câu văn giàu chất thơ và cảm xúc thuần Việt; nếu bối cảnh cổ đại thì pha nhẹ Hán-Việt êm ái.',
      titlesAndForeignNames: 'Giữ nhất quán biệt danh thân mật giữa cặp đôi chính qua các chương.',
      avoidRules: 'Tránh lời thoại khô khan như văn bản hành chính hoặc lặp từ vô cảm.',
    },
  },
  {
    id: 'Hệ Thống / Điền Văn',
    label: 'Hệ Thống / Điền Văn (Làm ruộng, ẩm thực, sinh hoạt nhẹ nhàng)',
    group: 'Hiện đại & Đời sống',
    sealChar: '田',
    registerClass: 'light_slice_of_life',
    shortDescription: 'Nhịp sống êm ả, làm giàu, nấu ăn, xây dựng thôn quê hoặc nhiệm vụ hệ thống.',
    styleGuide:
      'Thể loại Hệ Thống / Điền Văn: giọng kể ấm áp, mộc mạc, gần gũi đời thường; tên nông sản, món ăn, vật dụng dân dã dịch thuần Việt sinh động. Phân biệt rõ văn phong thông báo máy móc/hài hước của Hệ Thống với lời nói mộc mạc của dân làng hoặc gia đình.',
    recommendedTones: ['Nhẹ nhàng điền văn', 'Bình dị dân dã', 'Dịch thuần Việt mượt mà'],
    starterTemplate: {
      contextSummary: 'Cuộc sống điền viên, làm ăn buôn bán nhẹ nhàng kết hợp trợ giúp từ hệ thống.',
      pronounRules: 'Dân làng xưng hô thân tình (bác, chú, thím, con - u/bầm/cha); thông báo hệ thống giữ giọng trung tính/dí dỏm.',
      hanVietPolicy: 'Ưu tiên thuần Việt bình dị cho sinh hoạt, đồng áng, món ăn; giữ gọn khung chữ của bảng nhiệm vụ hệ thống.',
      titlesAndForeignNames: 'Thống nhất tên bảng thuộc tính hệ thống, đơn vị đo lường dân gian và tên món ăn.',
      avoidRules: 'Tránh dùng từ quá bác học, đao to búa lớn cho cảnh sinh hoạt làng quê thường ngày.',
    },
  },
  {
    id: 'Hài Hước / Sảng Văn',
    label: 'Hài Hước / Sảng Văn (Giải trí, phản sáo lộ, dí dỏm)',
    group: 'Hiện đại & Đời sống',
    sealChar: '乐',
    registerClass: 'light_slice_of_life',
    shortDescription: 'Tình huống tréo ngoe, thoại tung hứng duyên dáng và cao trào hả hê.',
    styleGuide:
      'Thể loại Hài Hước / Sảng Văn: nhịp văn nhanh, tung hứng duyên dáng, giữ đúng nhịp gây cười (punchline) cuối câu; bản địa hóa thành ngữ chơi chữ sang tiếng Việt tự nhiên mà không bịa thêm ý ngoài nguyên tác. Thoại khẩu ngữ sinh động, phản ánh đúng tính cách lầy lội hoặc ngầu của nhân vật.',
    recommendedTones: ['Hài hước dí dỏm', 'Dịch thuần Việt mượt mà', 'Hùng tráng dồn dập'],
    starterTemplate: {
      contextSummary: 'Truyện thiên về giải trí, tình huống hài hước, lật kèo hả hê.',
      pronounRules: 'Linh hoạt theo ngữ cảnh gây cười (mình, tớ, ông anh, đại ca, tiểu đệ), giữ đúng sắc thái châm biếm của nguyên tác.',
      hanVietPolicy: 'Ưu tiên thuần Việt lém lỉnh, tự nhiên; giữ nguyên Hán-Việt nếu nguyên tác cố tình dùng kiểu trang nghiêm để tạo tương phản hài.',
      titlesAndForeignNames: 'Giữ nhất quán biệt danh hài hước và khẩu hiệu đặc trưng của nhân vật.',
      avoidRules: 'Tránh dịch cứng nhắc từng chữ làm mất nhịp hài, nhưng không tự bịa thêm câu đùa không có trong bản Trung.',
    },
  },
  {
    id: 'Huyền Huyễn Phương Tây',
    label: 'Huyền Huyễn Phương Tây (Hiệp sĩ, ma pháp, rồng, ma giới Âu Mỹ)',
    group: 'Kỳ ảo & Phiêu lưu',
    sealChar: '堡',
    registerClass: 'western_fantasy',
    shortDescription: 'Fantasy phương Tây, ma thuật nguyên tố, giáo hội và vương quốc.',
    styleGuide:
      'Thể loại Huyền Huyễn Phương Tây: phong vị fantasy Âu Mỹ thanh thoát nhưng trang nhã; tên nhân vật và địa danh phiên âm ngoại lai khôi phục về tiếng Anh/Latin gốc khi có cơ sở. Xưng hô tôi-anh/ngài/bệ hạ tự nhiên. Tuyệt đối tránh dùng từ Hán-Việt đặc thù cổ trang Trung Quốc.',
    recommendedTones: ['Dịch thuần Việt mượt mà', 'Hùng tráng dồn dập', 'Trầm lắng tinh tế'],
    starterTemplate: {
      contextSummary: 'Bối cảnh fantasy châu Âu với hiệp sĩ, pháp sư, giáo hội và các chủng tộc kỳ ảo.',
      pronounRules: 'Dùng tôi - anh/cô/ngài; quý tộc gọi điện hạ/bệ hạ/lãnh chúa; pháp sư xưng tôi - các hạ/ngài.',
      hanVietPolicy: 'Hạn chế Hán-Việt cổ trang; dùng thuật ngữ fantasy chuẩn (ma pháp, kỵ sĩ, mana, ma đạo cụ, công tước).',
      titlesAndForeignNames: 'Khôi phục tên gốc tiếng Anh/phương Tây (Arthur, Merlin...); danh từ chỉ loại đảo lên trước (Thành Silvermoon).',
      avoidRules: 'Tránh gọi hiệp sĩ là "kiếm khách", không dùng ta - ngươi hay "tại hạ" kiểu kiếm hiệp Trung Quốc.',
    },
  },
  {
    id: 'Vô Hạn Lưu',
    label: 'Vô Hạn Lưu (Phó bản sinh tồn, chủ thần không gian, đấu trí)',
    group: 'Kỳ ảo & Phiêu lưu',
    sealChar: '无',
    registerClass: 'speculative_action',
    shortDescription: 'Chuỗi phó bản sinh tử đa thế giới, giải đố và hợp tác/phản bội.',
    styleGuide:
      'Thể loại Vô Hạn Lưu: nhịp văn nhanh, dồn dập, sắc bén trong mô tả chiến đấu, quy tắc sinh tồn và suy luận chiến thuật. Thống nhất thuật ngữ luân hồi (chủ thần, phó bản, điểm tích lũy, đạo cụ, nhiệm vụ chi tuyến). Xưng hô linh hoạt theo từng thế giới phó bản.',
    recommendedTones: ['Kịch tính ly kỳ', 'Hùng tráng dồn dập', 'Hiện đại công nghệ'],
    starterTemplate: {
      contextSummary: 'Nhân vật bị cuốn vào các phó bản sinh tồn nhiều thế giới với quy tắc khắc nghiệt.',
      pronounRules: 'Người chơi mặc định dùng tôi - anh/cô/cậu; điều chỉnh tạm thời nếu nhập vai trong phó bản cổ đại/kinh dị.',
      hanVietPolicy: 'Gọn gàng, sắc nét; giữ chuẩn thuật ngữ hệ thống (Chủ Thần, Phó bản, Thưởng điểm, Đánh giá cấp S).',
      titlesAndForeignNames: 'Giữ nhất quán tên đội ngũ, tên kỹ năng, vật phẩm đặc hữu và tên nhân vật ở từng phó bản.',
      avoidRules: 'Tránh câu văn dài dòng lê thê làm giảm nhịp căng thẳng khi đếm ngược sinh tử.',
    },
  },
  {
    id: 'Khoa Huyễn / Võng Du',
    label: 'Khoa Huyễn / Võng Du (Viễn tưởng, tinh tế, cơ giáp, thực tế ảo)',
    group: 'Kỳ ảo & Phiêu lưu',
    sealChar: '机',
    registerClass: 'modern_contemporary',
    shortDescription: 'Tàu vũ trụ, cơ giáp, AI, công nghệ tương lai hoặc game thực tế ảo.',
    styleGuide:
      'Thể loại Khoa Huyễn / Võng Du: văn phong chính xác, giàu chất kỹ thuật hiện đại/vị lai; chỉ số, giao diện, cơ giáp, hệ thống tinh tế dịch chuẩn xác và ngắn gọn. Xưng hô tôi-anh/chỉ huy/đồng đội; trong thế giới game võng du phân biệt ID người chơi và NPC rõ ràng.',
    recommendedTones: ['Hiện đại công nghệ', 'Hùng tráng dồn dập', 'Dịch thuần Việt mượt mà'],
    starterTemplate: {
      contextSummary: 'Bối cảnh khoa học viễn tưởng / tinh tế hoặc trò chơi thực tế ảo đa người chơi.',
      pronounRules: 'Dùng tôi - anh/cậu/đội trưởng/hạm trưởng; giữ phong thái chuyên nghiệp trong chiến hạm hoặc tự nhiên giữa game thủ.',
      hanVietPolicy: 'Kết hợp thuật ngữ khoa học - tin học chuẩn tiếng Việt; không cổ phong hóa công nghệ.',
      titlesAndForeignNames: 'Giữ nguyên ký hiệu model cơ giáp, đơn vị ánh sáng, cấp độ (SSR, A+), tên ID nhân vật game.',
      avoidRules: 'Tránh nhầm lẫn thuật ngữ kỹ thuật thành phép thuật cổ đại trừ khi nguyên tác chủ ý dùng.',
    },
  },
  {
    id: 'Mạt Thế / Sinh Tồn',
    label: 'Mạt Thế / Sinh Tồn (Tang thi, dị năng, khan hiếm tài nguyên)',
    group: 'Kỳ ảo & Phiêu lưu',
    sealChar: '末',
    registerClass: 'speculative_action',
    shortDescription: 'Thế giới hậu tận thế, xác sống, dị biến, căn cứ sinh tồn khắc nghiệt.',
    styleGuide:
      'Thể loại Mạt Thế / Sinh Tồn: giọng văn rắn rỏi, lạnh lùng, thực tế và giàu cảm giác cấp bách sinh tồn. Mô tả rõ dị năng, cấp độ tang thi/quái biến, nhu yếu phẩm và tổ chức căn cứ. Xưng hô tôi-anh/cô/mày-tao thực tế theo tình thế sống còn.',
    recommendedTones: ['Kịch tính ly kỳ', 'Hùng tráng dồn dập', 'Bình dị dân dã'],
    starterTemplate: {
      contextSummary: 'Hậu tận thế khắc nghiệt với tang thi, quái dị biến, dị năng giả và các căn cứ người sống sót.',
      pronounRules: 'Dùng tôi - anh/cô/hắn; đồng đội thân thiết gọi thẳng tên hoặc anh - em; kẻ địch giữ giọng lạnh lùng.',
      hanVietPolicy: 'Thực tế, súc tích; chuẩn hóa tên gọi hệ dị năng (Hệ Hỏa, Hệ Lôi, Hệ Không Gian) và tang thi/zombie nhất quán.',
      titlesAndForeignNames: 'Thống nhất tên căn cứ, tinh hạch, cấp bậc tiến hóa và tên vũ khí.',
      avoidRules: 'Tránh lời văn hoa mỹ thừa thãi làm giảm tính khốc liệt và thực dụng của bối cảnh sinh tồn.',
    },
  },
  {
    id: 'Đồng Nhân / Light Novel',
    label: 'Đồng Nhân / Light Novel (Nhịp nhẹ, anime/manga, thế giới giả tưởng trẻ)',
    group: 'Kỳ ảo & Phiêu lưu',
    sealChar: '漫',
    registerClass: 'light_slice_of_life',
    shortDescription: 'Tác phẩm phóng tác anime/manga/game hoặc lối viết Light Novel hiện đại.',
    styleGuide:
      'Thể loại Đồng Nhân / Light Novel: câu văn trẻ trung, nhịp thoại nhanh gọn giàu biểu cảm; ưu tiên khôi phục tên nhân vật, kỹ năng, tổ chức theo bản chuẩn tiếng Nhật/Anh/gốc của tác phẩm nguyên bản. Xưng hô tự nhiên theo lứa tuổi học đường/thiếu niên (tôi-cậu, anh-em, senpai/tiền bối tùy chọn).',
    recommendedTones: ['Dịch thuần Việt mượt mà', 'Hài hước dí dỏm', 'Nhẹ nhàng điền văn'],
    starterTemplate: {
      contextSummary: 'Truyện đồng nhân hoặc phong cách Light Novel, nhiều hội thoại nhanh và thuật ngữ từ nguyên tác.',
      pronounRules: 'Bạn đồng trang dùng tôi - cậu/mình - cậu; người nhỏ gọi anh/chị hoặc tiền bối theo đúng quan hệ.',
      hanVietPolicy: 'Thuần Việt trẻ trung là chủ đạo; giữ nguyên tên chiêu thức/danh hiệu quen thuộc của nguyên tác nếu có quy ước.',
      titlesAndForeignNames: 'Khôi phục tên nhân vật Nhật/Anh chính xác (không biến tên Nhật sang Hán-Việt nếu tên nguyên tác phổ biến dạng Romaji).',
      avoidRules: 'Tránh dịch cứng sang âm Hán-Việt các tên anime/manga nổi tiếng (như dùng âm Hán thay tên Nhật chuẩn).',
    },
  },
  {
    id: 'Linh Dị / Thần Quái',
    label: 'Linh Dị / Thần Quái (Tâm linh, ma quỷ, phong thủy, rùng rợn)',
    group: 'Trinh thám & Kinh dị',
    sealChar: '鬼',
    registerClass: 'suspense_dark',
    shortDescription: 'Chuyện kỳ bí, quỷ dị, đạo sĩ trừ tà và nỗi sợ âm ỉ.',
    styleGuide:
      'Thể loại Linh Dị / Thần Quái: câu văn tạo bầu không khí âm trầm, lạnh gáy và huyền bí; tiết tấu ngắt nghỉ đúng chỗ để giữ căng thẳng tâm lý. Tên bùa chú, trận pháp, lệ quỷ, phong thủy dùng Hán-Việt chuẩn dân gian/tâm linh Việt Nam; hội thoại đời thường tự nhiên để làm bật sự rùng rợn.',
    recommendedTones: ['Kịch tính ly kỳ', 'Trầm lắng tinh tế', 'Dịch thuần Việt mượt mà'],
    starterTemplate: {
      contextSummary: 'Bối cảnh linh dị, hiện tượng siêu nhiên, phong thủy âm trạch hoặc quy tắc quỷ dị.',
      pronounRules: 'Nhân vật hiện đại dùng tôi - anh/ông/cô; cao nhân đạo sĩ/thầy phong thủy có thể dùng bần đạo/tại hạ tùy bối cảnh.',
      hanVietPolicy: 'Dùng từ tâm linh, âm dương, lệ quỷ, quỷ vực rõ ràng; tả cảm giác rùng rợn bằng tiếng Việt giàu gợi hình.',
      titlesAndForeignNames: 'Thống nhất cấp bậc quỷ dị, tên pháp khí, bùa chú và các quy tắc cấm kỵ.',
      avoidRules: 'Tránh giải thích dài dòng phá vỡ sự bí ẩn và nhịp ngắt bất ngờ của cảnh kinh dị.',
    },
  },
  {
    id: 'Huyền Nghi / Trinh Thám',
    label: 'Huyền Nghi / Trinh Thám (Phá án, suy luận logic, tội phạm học)',
    group: 'Trinh thám & Kinh dị',
    sealChar: '探',
    registerClass: 'suspense_dark',
    shortDescription: 'Điều tra hiện trường, pháp y, suy luận chặt chẽ và lật mở nút thắt.',
    styleGuide:
      'Thể loại Huyền Nghi / Trinh Thám: ngôn từ chính xác, logic chặt chẽ, bảo toàn mọi manh mối thời gian, vị trí và chi tiết vật chứng trong nguyên tác. Giọng văn lạnh tĩnh, khách quan ở phần khám nghiệm/suy luận và sắc sảo trong thẩm vấn. Tuyệt đối tránh thêm bớt hoặc làm mơ hồ chi tiết phá án.',
    recommendedTones: ['Kịch tính ly kỳ', 'Trầm lắng tinh tế', 'Hiện đại công nghệ'],
    starterTemplate: {
      contextSummary: 'Điều tra hình sự / phá án tâm lý, đòi hỏi độ chính xác tuyệt đối về manh mối và mốc thời gian.',
      pronounRules: 'Cảnh sát, pháp y, nghi phạm dùng tôi - anh/cô/ông/bà, đồng chí/đội trưởng đúng tác phong điều tra.',
      hanVietPolicy: 'Ưu tiên thuật ngữ pháp y, hình sự, tâm lý tội phạm chuẩn tiếng Việt hiện đại.',
      titlesAndForeignNames: 'Giữ nguyên cấp bậc công an/thanh tra, tên đơn vị điều tra, mã hồ sơ vụ án.',
      avoidRules: 'Tuyệt đối không làm mờ thời gian, số liệu, vị trí dấu vết hoặc tự suy diễn ngoài nguyên tác.',
    },
  },
  {
    id: LEGACY_OTHER_GENRE_VALUE,
    label: 'Thể loại khác (Đa thể loại / Trung tính)',
    group: 'Khác',
    sealChar: '卷',
    registerClass: 'neutral',
    shortDescription: 'Phù hợp tác phẩm giao thoa nhiều dòng hoặc không thuộc các nhóm trên.',
    styleGuide:
      'Thể loại linh hoạt: bám sát bối cảnh nguyên tác và quy tắc riêng trong Cẩm nang dịch thuật; dùng tiếng Việt tự nhiên, mạch lạc, giữ nhất quán xưng hô và thuật ngữ xuyên suốt các chương.',
    recommendedTones: ['Dịch thuần Việt mượt mà', 'Trầm lắng tinh tế'],
    starterTemplate: {
      contextSummary: 'Mô tả ngắn gọn bối cảnh chính, thời đại và thiết lập thế giới của bộ truyện.',
      pronounRules: 'Nêu rõ cách xưng hô của nhân vật chính với từng nhóm đối tượng (người thân, bạn bè, cấp trên, đối thủ).',
      hanVietPolicy: 'Xác định tỷ lệ ưu tiên tiếng Việt thuần túy hay giữ Hán-Việt cho thuật ngữ đặc thù.',
      titlesAndForeignNames: 'Liệt kê quy ước chức danh, đơn vị đo lường hoặc cách xử lý tên nước ngoài (nếu có).',
      avoidRules: 'Ghi rõ những từ lóng, đại từ hoặc kiểu câu cần tránh cho tác phẩm này.',
    },
  },
];

export const TONE_PROFILES: readonly ToneProfile[] = [
  {
    id: 'Dịch thuần Việt mượt mà',
    label: 'Thuần Việt mượt mà (Tự nhiên, trôi chảy, hạn chế từ convert)',
    registerClass: 'neutral',
    hanVietLevel: 'balanced',
    shortDescription: 'Ưu tiên câu văn tự nhiên theo ngữ pháp tiếng Việt, giảm thiểu từ convert thô.',
    styleGuide:
      'Tông giọng Thuần Việt mượt mà: ưu tiên diễn đạt tự nhiên như văn viết tiếng Việt bản địa, chuyển hóa mượt các cấu trúc "bị/khiến/vô cùng/có chút" đặc trưng dịch máy nhưng vẫn giữ 100% ý nghĩa và ranh giới câu gốc. Chỉ dùng Hán-Việt cho tên riêng, thuật ngữ chuyên ngành hoặc điểm nhấn trang trọng cần thiết.',
  },
  {
    id: 'Trang nghiêm cổ phong',
    label: 'Cổ phong trang nghiêm (Đậm chất Hán-Việt, tao nhã sang quý)',
    registerClass: 'classical_eastern',
    hanVietLevel: 'high',
    shortDescription: 'Tăng cường từ vựng Hán-Việt trang nhã, nhịp văn cổ kính, giữ lễ nghi.',
    styleGuide:
      'Tông giọng Trang nghiêm cổ phong: sử dụng vốn từ Hán-Việt chọn lọc, tao nhã và cổ kính cho lời dẫn lẫn thoại; giữ nhịp câu đĩnh đạc, lễ tiết rõ ràng (bỉ nhân, tại hạ, các hạ, phu nhân, bản tọa...). Tránh tối đa khẩu ngữ hiện đại hoặc rút gọn suồng sã.',
  },
  {
    id: 'Bình dị dân dã',
    label: 'Bình dị dân dã (Mộc mạc, gần gũi, phong vị đời thường)',
    registerClass: 'light_slice_of_life',
    hanVietLevel: 'low',
    shortDescription: 'Từ ngữ đời thường giản dị, thoại chân thực, gần gũi người đọc Việt.',
    styleGuide:
      'Tông giọng Bình dị dân dã: chọn từ vựng mộc mạc, dễ hiểu, giàu chất đời sống hằng ngày; lời thoại tự nhiên như lời ăn tiếng nói ngoài đời thật, tránh dùng từ Hán-Việt cầu kỳ hoặc câu văn quá hoa mỹ khi ngữ cảnh đang bình dị.',
  },
  {
    id: 'Hùng tráng dồn dập',
    label: 'Hùng tráng dồn dập (Khí thế nhiệt huyết, giàu nhịp hành động)',
    registerClass: 'speculative_action',
    hanVietLevel: 'balanced',
    shortDescription: 'Động từ mạnh, tiết tấu gọn gàng dứt khoát, phù hợp combat & cao trào.',
    styleGuide:
      'Tông giọng Hùng tráng dồn dập: ưu tiên động từ mạnh, hình ảnh giàu uy lực và nhịp văn dứt khoát trong các phân đoạn giao chiến, đột phá hoặc đối đầu; tránh lạm dụng trạng từ thừa làm loãng khí thế cao trào.',
  },
  {
    id: 'Trầm hùng dã sử',
    label: 'Trầm hùng dã sử (Trang trọng sử thi, hợp quân sự lịch sử)',
    registerClass: 'classical_eastern',
    hanVietLevel: 'high',
    shortDescription: 'Văn phong sử thi trầm lắng, nặng sức nặng lịch sử và triều chính.',
    styleGuide:
      'Tông giọng Trầm hùng dã sử: giữ âm hưởng sử thi trang nghiêm, cổ kính và điềm tĩnh; dùng thuật ngữ triều chính, quân sự, tước hiệu Hán-Việt chuẩn mực, lời thoại dè dặt sâu xa đúng phong thái mưu sĩ và danh tướng.',
  },
  {
    id: 'Hiện đại công nghệ',
    label: 'Hiện đại công nghệ (Chính xác, sắc gọn, thuật ngữ số/khoa học)',
    registerClass: 'modern_contemporary',
    hanVietLevel: 'domain_specific',
    shortDescription: 'Ngôn ngữ sắc bén, hiện đại, chuẩn xác thuật ngữ số hóa và viễn tưởng.',
    styleGuide:
      'Tông giọng Hiện đại công nghệ: câu văn mạch lạc, chính xác, tốc độ thông tin cao; ưu tiên thuật ngữ khoa học, kỹ thuật, hệ thống và giao tiếp hiện đại gọn ghẽ, không pha tạp âm hưởng cổ trang.',
  },
  {
    id: 'Kịch tính ly kỳ',
    label: 'Kịch tính ly kỳ (U ám, hồi hộp, nhấn mạnh tâm lý căng thẳng)',
    registerClass: 'suspense_dark',
    hanVietLevel: 'balanced',
    shortDescription: 'Nhấn mạnh bất an, nhịp cắt căng thẳng, phù hợp kinh dị & trinh thám.',
    styleGuide:
      'Tông giọng Kịch tính ly kỳ: kiểm soát chặt không khí căng thẳng, bí ẩn hoặc rùng rợn; chọn từ gợi cảm giác cảnh giác, lạnh lẽo và bất ngờ mà vẫn bảo toàn nguyên vẹn dấu câu, ranh giới câu gốc.',
  },
  {
    id: 'Nhẹ nhàng điền văn',
    label: 'Nhẹ nhàng điền văn (Ấm áp, chậm rãi, chữa lành thư thái)',
    registerClass: 'light_slice_of_life',
    hanVietLevel: 'low',
    shortDescription: 'Nhịp kể ôn hòa, từ ngữ dịu dàng, phù hợp sinh hoạt & chữa lành.',
    styleGuide:
      'Tông giọng Nhẹ nhàng điền văn: lối kể ôn hòa, ấm áp và thư thái; chú trọng cảm giác sinh hoạt đời thường, cảnh sắc thiên nhiên và sự gắn kết tình cảm êm đềm, tránh ngôn từ gay gắt không cần thiết.',
  },
  {
    id: 'Trầm lắng tinh tế',
    label: 'Trầm lắng tinh tế (Sâu lắng, giàu nội tâm và dư vị văn học)',
    registerClass: 'neutral',
    hanVietLevel: 'balanced',
    shortDescription: 'Tinh tế trong từng chuyển biến cảm xúc, không phô trương, giàu dư âm.',
    styleGuide:
      'Tông giọng Trầm lắng tinh tế: chú trọng chiều sâu tâm lý, khoảng lặng cảm xúc và sự chừng mực trong chọn từ; tránh cảm thán ồn ào hay lạm dụng tính từ cường điệu khi nguyên tác đang tiết chế.',
  },
  {
    id: 'Hài hước dí dỏm',
    label: 'Hài hước dí dỏm (Linh hoạt, lém lỉnh, bắt đúng nhịp gây cười)',
    registerClass: 'light_slice_of_life',
    hanVietLevel: 'low',
    shortDescription: 'Thoại sinh động, chơi chữ tự nhiên, giữ nguyên nhịp tung hứng.',
    styleGuide:
      'Tông giọng Hài hước dí dỏm: thể hiện trọn vẹn nét trào phúng, mỉa mai hoặc tung hứng vui nhộn của nguyên tác bằng tiếng Việt tự nhiên, hoạt ngôn; giữ đúng điểm rơi gây cười mà không tự thêm nội dung ngoài bản gốc.',
  },
  {
    id: 'Sắc sảo cung đấu',
    label: 'Sắc sảo cung đấu (Thâm trầm, lễ độ ngoài mặt, gai góc ngầm ý)',
    registerClass: 'classical_eastern',
    hanVietLevel: 'high',
    shortDescription: 'Lời nói có ẩn ý, giữ chuẩn lễ tiết quý tộc mà sắc bén từng câu.',
    styleGuide:
      'Tông giọng Sắc sảo cung đấu: bảo toàn tầng nghĩa bóng, lối nói đưa đẩy mềm mỏng nhưng đầy hàm ý áp đảo; giữ kính ngữ và thứ bậc xưng hô chuẩn mực chốn khuê phòng/triều đình.',
  },
];

const TONE_LEGACY_ALIASES: Record<string, string> = {
  'trang nghiêm cổ kính': 'Trang nghiêm cổ phong',
  'thuần việt mượt mà': 'Dịch thuần Việt mượt mà',
  'bình dị đời thường': 'Bình dị dân dã',
  'hùng tráng dập dồn': 'Hùng tráng dồn dập',
};

const GENRE_BY_LOWER_ID = new Map<string, GenreProfile>(
  GENRE_PROFILES.map((profile) => [profile.id.toLowerCase(), profile])
);

const TONE_BY_LOWER_ID = new Map<string, ToneProfile>(
  TONE_PROFILES.map((profile) => [profile.id.toLowerCase(), profile])
);

export function getGenreProfile(genre: string): GenreProfile | undefined {
  const normalized = (genre || '').trim().toLowerCase();
  if (!normalized) return undefined;
  return GENRE_BY_LOWER_ID.get(normalized);
}

export function isBuiltInGenre(genre: string): boolean {
  return getGenreProfile(genre) !== undefined;
}

export function getToneProfile(tone: string): ToneProfile | undefined {
  const normalized = (tone || '').trim().toLowerCase();
  if (!normalized) return undefined;
  const canonical = TONE_LEGACY_ALIASES[normalized]?.toLowerCase() ?? normalized;
  return TONE_BY_LOWER_ID.get(canonical);
}

export function isBuiltInTone(tone: string): boolean {
  return getToneProfile(tone) !== undefined;
}

export function getGenreStyleGuide(genre: string): string {
  const cleanGenre = (genre || '').trim();
  const profile = getGenreProfile(cleanGenre);
  if (profile) {
    return profile.styleGuide;
  }
  if (!cleanGenre) {
    return getGenreProfile('Tiên Hiệp')!.styleGuide;
  }
  return `Thể loại tùy chỉnh "${cleanGenre}": dịch tự nhiên bám sát đặc trưng thế giới, hệ thống thuật ngữ và cách xưng hô phù hợp với dòng "${cleanGenre}", ưu tiên tiếng Việt mạch lạc dễ hiểu.`;
}

export function getToneStyleGuide(tone: string): string {
  const cleanTone = (tone || '').trim();
  const profile = getToneProfile(cleanTone);
  if (profile) {
    return profile.styleGuide;
  }
  if (!cleanTone) {
    return getToneProfile('Dịch thuần Việt mượt mà')!.styleGuide;
  }
  return `Tông giọng tùy chỉnh "${cleanTone}": duy trì nhất quán sắc thái diễn đạt, nhịp điệu câu văn và mức độ từ vựng phù hợp định hướng "${cleanTone}" xuyên suốt lời dẫn và hội thoại.`;
}

export function getRecommendedTonesForGenre(genre: string): string[] {
  const profile = getGenreProfile(genre);
  if (profile) {
    return [...profile.recommendedTones];
  }
  return ['Dịch thuần Việt mượt mà', 'Trầm lắng tinh tế'];
}

export function getGenreStarterTemplate(genre: string): StructuredGuidelineSections {
  const profile = getGenreProfile(genre);
  if (profile) {
    return { ...profile.starterTemplate };
  }
  const cleanGenre = (genre || '').trim();
  const base = { ...getGenreProfile(LEGACY_OTHER_GENRE_VALUE)!.starterTemplate };
  if (cleanGenre && cleanGenre !== LEGACY_OTHER_GENRE_VALUE) {
    base.contextSummary = `Tác phẩm thuộc dòng "${cleanGenre}". Bổ sung bối cảnh, thiết lập thế giới và mạch truyện chính tại đây.`;
  }
  return base;
}

export function getGenreStarterTemplateText(genre: string): string {
  return serializeStructuredGuidelines(getGenreStarterTemplate(genre));
}

type SectionKey = Exclude<keyof StructuredGuidelineSections, 'extraNotes'>;

const HEADING_PATTERNS: Array<{ key: SectionKey; pattern: RegExp }> = [
  {
    key: 'contextSummary',
    pattern: /^#{2,4}\s*(?:bối\s*cảnh\s*(?:&|và)?\s*tóm\s*tắt|tóm\s*tắt\s*(?:bối\s*cảnh|cốt\s*truyện)|giới\s*thiệu(?:\s*tóm\s*tắt)?)\s*$/i,
  },
  {
    key: 'pronounRules',
    pattern: /^#{2,4}\s*(?:quy\s*(?:tắc|ước)\s*xưng\s*hô(?:\s*mặc\s*định)?|xưng\s*hô)\s*$/i,
  },
  {
    key: 'hanVietPolicy',
    pattern: /^#{2,4}\s*(?:mức\s*độ\s*hán[\s-]?việt(?:\s*\/\s*thuần\s*việt)?|chính\s*sách\s*hán[\s-]?việt|tỷ\s*lệ\s*hán[\s-]?việt)\s*$/i,
  },
  {
    key: 'titlesAndForeignNames',
    pattern: /^#{2,4}\s*(?:danh\s*xưng[\s,]*(?:cấp\s*bậc)?(?:\s*(?:&|và)\s*tên\s*ngoại\s*lai)?|quy\s*ước\s*danh\s*xưng|tên\s*phiên\s*âm\s*ngoại\s*lai)\s*$/i,
  },
  {
    key: 'avoidRules',
    pattern: /^#{2,4}\s*(?:điều\s*cần\s*tránh|cấm\s*kỵ|lỗi\s*cần\s*tránh|lưu\s*ý\s*tránh)\s*$/i,
  },
];

export function hasStructuredGuidelineHeadings(markdownText: string): boolean {
  if (!markdownText || !markdownText.trim()) return false;
  return markdownText
    .split(/\r?\n/)
    .some((line) => HEADING_PATTERNS.some(({ pattern }) => pattern.test(line.trim())));
}

export function parseStructuredGuidelines(markdownText: string): StructuredGuidelineSections {
  const empty: StructuredGuidelineSections = {
    contextSummary: '',
    pronounRules: '',
    hanVietPolicy: '',
    titlesAndForeignNames: '',
    avoidRules: '',
    extraNotes: '',
  };

  if (!markdownText || !markdownText.trim()) {
    return empty;
  }

  const normalized = markdownText.replace(/\r\n/g, '\n');
  if (!hasStructuredGuidelineHeadings(normalized)) {
    return {
      ...empty,
      contextSummary: normalized.trim(),
    };
  }

  const buckets: Record<SectionKey | 'extraNotes', string[]> = {
    contextSummary: [],
    pronounRules: [],
    hanVietPolicy: [],
    titlesAndForeignNames: [],
    avoidRules: [],
    extraNotes: [],
  };

  let currentBucket: SectionKey | 'extraNotes' = 'extraNotes';

  for (const line of normalized.split('\n')) {
    const trimmed = line.trim();
    const matchedHeading = HEADING_PATTERNS.find(({ pattern }) => pattern.test(trimmed));
    if (matchedHeading) {
      currentBucket = matchedHeading.key;
      continue;
    }

    // Nếu đang nằm ở một heading khác không thuộc 5 mục chuẩn (ví dụ "## Ghi chú khác"),
    // chuyển về extraNotes và giữ nguyên dòng heading đó để round-trip không mất dữ liệu.
    if (/^#{1,4}\s+\S/.test(trimmed)) {
      currentBucket = 'extraNotes';
    }
    buckets[currentBucket].push(line);
  }

  return {
    contextSummary: buckets.contextSummary.join('\n').trim(),
    pronounRules: buckets.pronounRules.join('\n').trim(),
    hanVietPolicy: buckets.hanVietPolicy.join('\n').trim(),
    titlesAndForeignNames: buckets.titlesAndForeignNames.join('\n').trim(),
    avoidRules: buckets.avoidRules.join('\n').trim(),
    extraNotes: buckets.extraNotes.join('\n').trim(),
  };
}

export function serializeStructuredGuidelines(sections: StructuredGuidelineSections): string {
  const orderedKeys: SectionKey[] = [
    'contextSummary',
    'pronounRules',
    'hanVietPolicy',
    'titlesAndForeignNames',
    'avoidRules',
  ];

  const blocks: string[] = [];
  for (const key of orderedKeys) {
    const value = (sections[key] || '').trim();
    if (value) {
      blocks.push(`${GUIDELINE_SECTION_HEADINGS[key]}\n${value}`);
    }
  }

  const extra = (sections.extraNotes || '').trim();
  if (extra) {
    blocks.push(extra);
  }

  return blocks.join('\n\n');
}

export function formatGuidelinesMarkdownExport(input: {
  title?: string;
  genre: string;
  tone: string;
  description: string;
}): string {
  const titleLine = (input.title || '').trim() || 'Dự án dịch thuật';
  const cleanGenre = (input.genre || '').trim() || 'Tiên Hiệp';
  const cleanTone = (input.tone || '').trim() || 'Dịch thuần Việt mượt mà';
  const rawDesc = (input.description || '').trim();

  const body = hasStructuredGuidelineHeadings(rawDesc)
    ? serializeStructuredGuidelines(parseStructuredGuidelines(rawDesc))
    : rawDesc || getGenreStarterTemplateText(cleanGenre);

  return [
    `# Cẩm nang dịch thuật: ${titleLine}`,
    '',
    `- Thể loại chính: ${cleanGenre}`,
    `- Tông giọng biên tập: ${cleanTone}`,
    '',
    '## Quy tắc dịch thuật',
    '',
    body,
    '',
  ].join('\n');
}

const HAN_CHAR_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
const GLOSSARY_SECTION_HEADING_REGEX =
  /^#{1,4}\s*(?:bảng\s*)?(?:từ\s*điển|thuật\s*ngữ|glossary|tên\s*(?:riêng|nhân\s*vật)|địa\s*danh|bí\s*kíp)\b/i;

/**
 * Lọc bỏ các bảng từ điển Markdown (| ... |) và mục danh sách thuật ngữ chữ Hán
 * để giữ trọn phần văn xuôi/quy tắc cẩm nang ở cả đầu và cuối tệp dài.
 * Giữ nguyên 100% các dòng quy tắc thuần tiếng Việt (kể cả có ký hiệu "->").
 */
export function extractGuidelinesProseSection(markdownText: string): string {
  if (!markdownText || !markdownText.trim()) return '';

  const lines = markdownText.replace(/\r\n/g, '\n').split('\n');
  const kept: string[] = [];
  let inGlossarySection = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    // Nhận diện heading Markdown
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      if (GLOSSARY_SECTION_HEADING_REGEX.test(trimmed)) {
        inGlossarySection = true;
        continue;
      }
      // Gặp một heading mới không phải từ điển → thoát chế độ lọc mục từ điển
      inGlossarySection = false;
      kept.push(rawLine);
      continue;
    }

    // Luôn lọc bỏ dòng bảng Markdown (| col1 | col2 |) và dòng phân cách (|---|---|)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      continue;
    }

    // Bỏ dòng danh sách gạch đầu dòng kiểu cặp từ điển có chứa chữ Hán hoặc nằm trong mục từ điển
    if (trimmed.includes('->')) {
      if (inGlossarySection || HAN_CHAR_REGEX.test(trimmed)) {
        continue;
      }
    }

    if (inGlossarySection && (!trimmed || HAN_CHAR_REGEX.test(trimmed))) {
      continue;
    }

    kept.push(rawLine);
  }

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeStyleValue(rawValue: string): string {
  return rawValue.trim().slice(0, MAX_CUSTOM_STYLE_LENGTH);
}

/**
 * Trích xuất tất định Thể loại, Tông giọng và Quy tắc dịch từ văn bản Markdown
 * để làm nền kiểm chứng và dự phòng cục bộ khi ngoại tuyến / chưa có API key.
 */
export function parseGuidelinesMarkdownLocal(markdownText: string): {
  genre: string;
  tone: string;
  description: string;
} {
  const prose = extractGuidelinesProseSection(markdownText);
  if (!prose) {
    return { genre: '', tone: '', description: '' };
  }

  let detectedGenre = '';
  let detectedTone = '';
  const keptBodyLines: string[] = [];

  for (const rawLine of prose.split('\n')) {
    const trimmed = rawLine.trim();

    if (/^#\s+Cẩm nang dịch thuật(?:\s*:|\s*$)/i.test(trimmed)) {
      continue;
    }
    if (/^##\s+Quy tắc dịch thuật\s*$/i.test(trimmed)) {
      continue;
    }

    const genreMatch = trimmed.match(
      /^(?:[-*]\s*)?(?:\*\*)?Thể loại(?:\s*chính)?(?:\*\*)?\s*:\s*(.+)$/i
    );
    if (genreMatch && !detectedGenre) {
      const candidate = normalizeStyleValue(genreMatch[1].replace(/\*\*/g, ''));
      const matchedProfile = getGenreProfile(candidate);
      detectedGenre = matchedProfile ? matchedProfile.id : candidate;
      continue;
    }

    const toneMatch = trimmed.match(
      /^(?:[-*]\s*)?(?:\*\*)?Tông giọng(?:\s*biên\s*(?:dịch|tập)(?:\s*&\s*biên\s*tập)?)?(?:\*\*)?\s*:\s*(.+)$/i
    );
    if (toneMatch && !detectedTone) {
      const candidate = normalizeStyleValue(toneMatch[1].replace(/\*\*/g, ''));
      const matchedTone = getToneProfile(candidate);
      detectedTone = matchedTone ? matchedTone.id : candidate;
      continue;
    }

    keptBodyLines.push(rawLine);
  }

  const description = keptBodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return {
    genre: detectedGenre,
    tone: detectedTone,
    description,
  };
}

const PROHIBIT_HAN_VIET_REGEX =
  /(?:cấm(?:\s*(?:dùng|sử\s*dụng))?|không\s*(?:dùng|sử\s*dụng)|hạn\s*chế(?:\s*tối\s*đa|\s*dùng)?|tránh(?:\s*dùng)?|tuyệt\s*đối\s*tránh)\s+(?:(?:các\s+)?từ(?:\s*ngữ)?\s+)?hán[\s-]?việt/iu;

const KEEP_ENGLISH_NAMES_REGEX =
  /(?:giữ\s*nguyên\s*tên\s*(?:gốc\s*)?tiếng\s*anh|tên\s*(?:nhân\s*vật|phương\s*tây)\s*giữ\s*tiếng\s*anh)/iu;

/**
 * Kiểm tra mâu thuẫn rõ rệt giữa Thể loại chính, Tông giọng biên tập và Quy tắc dịch.
 * Luôn trả về cảnh báo mang tính tham khảo (non-blocking).
 */
export function detectStyleConflicts(params: {
  genre: string;
  tone: string;
  description: string;
}): StyleConflictWarning[] {
  const warnings: StyleConflictWarning[] = [];
  const genreProfile = getGenreProfile(params.genre);
  const toneProfile = getToneProfile(params.tone);
  const desc = (params.description || '').trim();
  const recommended = getRecommendedTonesForGenre(params.genre);
  const primarySuggestion = recommended[0] || 'Dịch thuần Việt mượt mà';

  if (genreProfile && toneProfile) {
    if (
      (genreProfile.registerClass === 'modern_contemporary' ||
        genreProfile.registerClass === 'western_fantasy') &&
      toneProfile.registerClass === 'classical_eastern'
    ) {
      warnings.push({
        id: 'genre-modern-tone-classical',
        severity: 'warning',
        category: 'genre_tone_mismatch',
        message: `Thể loại "${genreProfile.id}" mang bối cảnh hiện đại/phương Tây, có thể bị gượng khi ghép với tông "${toneProfile.id}".`,
        suggestedTone: primarySuggestion,
        suggestedActionLabel: `Đổi sang "${primarySuggestion}"`,
      });
    } else if (
      genreProfile.registerClass === 'classical_eastern' &&
      toneProfile.id === 'Hiện đại công nghệ'
    ) {
      warnings.push({
        id: 'genre-classical-tone-tech',
        severity: 'warning',
        category: 'genre_tone_mismatch',
        message: `Thể loại cổ phong "${genreProfile.id}" thường không hợp với tông "${toneProfile.id}".`,
        suggestedTone: primarySuggestion,
        suggestedActionLabel: `Đổi sang "${primarySuggestion}"`,
      });
    }
  }

  if (desc && toneProfile && toneProfile.hanVietLevel === 'high' && PROHIBIT_HAN_VIET_REGEX.test(desc)) {
    warnings.push({
      id: 'rule-no-hanviet-vs-classical-tone',
      severity: 'warning',
      category: 'rule_tone_conflict',
      message: `Quy tắc dịch đang yêu cầu hạn chế/cấm từ Hán-Việt nhưng bạn lại chọn tông "${toneProfile.id}". Hệ thống sẽ ưu tiên Quy tắc dịch riêng hơn Tông giọng.`,
      suggestedTone: 'Dịch thuần Việt mượt mà',
      suggestedActionLabel: 'Đổi sang "Dịch thuần Việt mượt mà"',
    });
  }

  if (
    toneProfile?.id === 'Trang nghiêm cổ phong' &&
    (genreProfile?.id === 'Huyền Huyễn Phương Tây' || (desc && KEEP_ENGLISH_NAMES_REGEX.test(desc)))
  ) {
    const alreadyWarned = warnings.some((w) => w.id === 'genre-modern-tone-classical');
    if (!alreadyWarned) {
      warnings.push({
        id: 'western-names-vs-classical-tone',
        severity: 'info',
        category: 'rule_tone_conflict',
        message:
          'Dự án có quy ước giữ tên tiếng Anh/phương Tây; khi dùng tông "Trang nghiêm cổ phong" cần tránh Hán-Việt hóa tên riêng ngoại lai.',
        suggestedTone: 'Dịch thuần Việt mượt mà',
        suggestedActionLabel: 'Đổi sang "Dịch thuần Việt mượt mà"',
      });
    }
  }

  return warnings;
}

export function sanitizeExportFileNameBase(title: string): string {
  const cleaned = (title || '')
    .trim()
    .replace(/[\s/\\:*?"<>|]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'cam_nang_dich_thuat';
}
