import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Kết hợp className có điều kiện (clsx) và loại bỏ xung đột Tailwind (twMerge).
 * Dùng trong mọi component ở src/components/ui để các variant có thể ghi đè
 * style mặc định một cách an toàn (vd: className="px-2" truyền vào Button phải
 * thắng px-4 mặc định, không phải cả hai cùng tồn tại trong chuỗi class).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
