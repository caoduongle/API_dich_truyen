/**
 * Pure Utility functions for Find and Replace text processing
 * Feature: 136-find-and-replace
 */

import { MatchLocation, ReplaceAllResult } from '../types/textSearch';

/**
 * Thoát các ký tự đặc biệt trong chuỗi để sử dụng an toàn với RegExp
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tìm tất cả các vị trí trùng khớp của từ khóa trong chuỗi văn bản
 */
export function findMatchesInText(
  fullText: string,
  searchTerm: string,
  matchCase: boolean = false
): MatchLocation[] {
  if (!fullText || !searchTerm || searchTerm === '') {
    return [];
  }

  const escaped = escapeRegex(searchTerm);
  const flags = matchCase ? 'g' : 'gi';
  const regex = new RegExp(escaped, flags);
  const matches: MatchLocation[] = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(fullText)) !== null) {
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
    });
    // Tránh vòng lặp vô hạn nếu regex match ký tự 0-length
    if (match.index === regex.lastIndex) {
      regex.lastIndex++;
    }
  }

  return matches;
}

/**
 * Thay thế một vị trí trùng khớp đơn lẻ trong văn bản
 */
export function replaceSingleMatch(
  fullText: string,
  match: MatchLocation,
  replaceTerm: string
): string {
  if (
    match.start < 0 ||
    match.end > fullText.length ||
    match.start > match.end
  ) {
    return fullText;
  }
  return fullText.slice(0, match.start) + replaceTerm + fullText.slice(match.end);
}

/**
 * Thay thế toàn bộ các vị trí trùng khớp trong văn bản trong một lượt duy nhất
 */
export function replaceAllMatches(
  fullText: string,
  searchTerm: string,
  replaceTerm: string,
  matchCase: boolean = false
): ReplaceAllResult {
  if (!fullText || !searchTerm) {
    return { newText: fullText, count: 0 };
  }

  const matches = findMatchesInText(fullText, searchTerm, matchCase);
  if (matches.length === 0) {
    return { newText: fullText, count: 0 };
  }

  const escaped = escapeRegex(searchTerm);
  const flags = matchCase ? 'g' : 'gi';
  const regex = new RegExp(escaped, flags);
  const newText = fullText.replace(regex, replaceTerm);

  return {
    newText,
    count: matches.length,
  };
}

/**
 * Tính toán chỉ số kế tiếp theo cơ chế xoay vòng (wrap-around)
 */
export function getNextMatchIndex(currentIndex: number, totalMatches: number): number {
  if (totalMatches <= 0) return -1;
  if (currentIndex < 0) return 0;
  return (currentIndex + 1) % totalMatches;
}

/**
 * Tính toán chỉ số trước đó theo cơ chế xoay vòng (wrap-around)
 */
export function getPrevMatchIndex(currentIndex: number, totalMatches: number): number {
  if (totalMatches <= 0) return -1;
  if (currentIndex < 0) return totalMatches - 1;
  return (currentIndex - 1 + totalMatches) % totalMatches;
}
