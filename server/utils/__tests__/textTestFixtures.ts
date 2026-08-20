/**
 * Test fixtures for Title Preservation and Chinese Character Detection Tests
 */

export const SAMPLE_RAW_WITH_TITLE = `Chương 1: Đài Phát Thanh Kinh Hoàng

Đêm khuya thanh vắng, tiếng còi xe cảnh sát vang lên từ xa.
Lâm Phong đứng trước cửa sổ, ánh mắt trầm ngâm nhìn xuống đường phố vắng tanh.
Đây là đêm thứ ba liên tiếp hắn nghe thấy âm thanh kỳ lạ đó.`;

export const SAMPLE_POLISHED_DROPPED_TITLE = `Đêm khuya tĩnh mịch, từ nơi xa vọng lại tiếng còi xe cảnh sát xé toạc màn đêm.
Lâm Phong lặng lẽ đứng bên khung cửa sổ, ánh mắt thâm trầm dõi theo con đường vắng lặng không một bóng người.
Đã là đêm thứ ba liên tiếp hắn nghe thấy những thanh âm kỳ quái quẩn quanh.`;

export const SAMPLE_POLISHED_WITH_TITLE = `Chương 1: Đài Phát Thanh Kinh Hoàng

Đêm khuya tĩnh mịch, từ nơi xa vọng lại tiếng còi xe cảnh sát xé toạc màn đêm.
Lâm Phong lặng lẽ đứng bên khung cửa sổ, ánh mắt thâm trầm dõi theo con đường vắng lặng không một bóng người.
Đã là đêm thứ ba liên tiếp hắn nghe thấy những thanh âm kỳ quái quẩn quanh.`;

export const SAMPLE_RAW_WITHOUT_TITLE = `Đêm khuya thanh vắng, tiếng còi xe cảnh sát vang lên từ xa.
Lâm Phong đứng trước cửa sổ, ánh mắt trầm ngâm nhìn xuống đường phố vắng tanh.`;

export const SAMPLE_POLISHED_WITHOUT_TITLE = `Đêm khuya tĩnh mịch, tiếng còi xe cảnh sát từ xa xăm vọng lại.
Lâm Phong đứng trước khung cửa sổ, ánh mắt thâm trầm nhìn con phố vắng lặng.`;

export const SAMPLE_UNTRANSLATED_CHINESE = `深夜时分，远处的警笛声隐约传来。
[Lâm Phong]站在窗前，神色凝重地注视着空无一人的街道。
这已经是第三个夜晚，他听到这种奇怪的声音了。
[Sở Phong]的眼中闪过一丝凌厉的寒芒，手中的长剑微微嗡鸣。`;

export const SAMPLE_CLEAN_VIETNAMESE = `Đêm khuya tĩnh mịch, từ nơi xa vọng lại tiếng còi xe cảnh sát xé toạc màn đêm.
Lâm Phong lặng lẽ đứng bên khung cửa sổ, ánh mắt thâm trầm dõi theo con phố vắng tanh.
Đây đã là đêm thứ ba liên tiếp hắn nghe thấy những âm thanh kỳ lạ này.`;

export const SAMPLE_VIETNAMESE_WITH_SMALL_CHINESE_QUOTE = `Đạo gia có câu "Đạo khả đạo phi thường đạo" (道可道非常道), hàm ý đạo trời huyền diệu khôn lường.
Lâm Phong thở dài một hơi, thu lại kiếm thế.`;
