import React from 'react';
import { Seal } from './Seal';

/**
 * Mỗi thể loại truyện được gán một chữ Hán duy nhất, lấy nghĩa gốc của
 * chính thể loại đó (Tiên Hiệp -> 仙, Linh Dị -> 鬼...), thay vì emoji nền
 * tảng. Lý do: emoji đổi hình theo hệ điều hành (Windows/macOS/Android vẽ
 * khác nhau) và không cùng ngôn ngữ hình ảnh với bộ icon lucide-react +
 * con dấu chu sa đang dùng trong toàn app. Một chữ Hán trong khung triện
 * vừa nhất quán thị giác, vừa đúng tinh thần "bản thảo chữ Hán" của sản phẩm.
 */
const GENRE_MARKS: Record<string, string> = {
  'Tiên Hiệp': '仙',
  'Võ Hiệp': '侠',
  'Ngôn Tình': '情',
  'Đô Thị': '都',
  'Huyền Huyễn': '玄',
  'Huyền Huyễn Phương Tây': '堡',
  'Vô Hạn Lưu': '无',
  'Lịch Sử / Quân Sự': '史',
  'Khoa Huyễn / Võng Du': '机',
  'Linh Dị / Thần Quái': '鬼',
  'Hệ Thống / Điền Văn': '田',
};

const DEFAULT_MARK = '卷';

export function getGenreMark(genre: string): string {
  return GENRE_MARKS[genre] || DEFAULT_MARK;
}

export function GenreMark({ genre, size = 'sm' }: { genre: string; size?: 'sm' | 'md' }) {
  return <Seal character={getGenreMark(genre)} tone="ink" size={size} title={genre} />;
}

export default GenreMark;
