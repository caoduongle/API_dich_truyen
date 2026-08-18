import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Kết hợp className có điều kiện (clsx) và loại bỏ xung đột Tailwind (twMerge).
 * Dùng trong mọi component ở src/components/ui để các variant có thể ghi đè
 * style mặc định một cách an toàn, thay vì nối chuỗi className thủ công.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
