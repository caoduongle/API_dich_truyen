import { Seal } from './Seal';
import { getGenreProfile } from '../../config/translationStyles';

/**
 * Mỗi thể loại truyện được gán một chữ Hán duy nhất lấy từ cấu hình tập trung
 * (Tiên Hiệp -> 仙, Linh Dị -> 鬼...), giữ nhất quán thị giác với con dấu chu sa.
 */
const DEFAULT_MARK = '卷';

export function getGenreMark(genre: string): string {
  return getGenreProfile(genre)?.sealChar || DEFAULT_MARK;
}

export function GenreMark({ genre, size = 'sm' }: { genre: string; size?: 'sm' | 'md' }) {
  return <Seal character={getGenreMark(genre)} tone="ink" size={size} title={genre} />;
}

export default GenreMark;
