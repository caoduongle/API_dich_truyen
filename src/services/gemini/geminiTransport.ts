/**
 * Gemini Network Transport
 * Thực hiện lệnh gọi HTTP fetch qua mạng tới Gemini API kèm kiểm soát timeout và xử lý lỗi mạng/CSP
 */

export function formatGeminiNetworkError(err: any): Error {
  const msg = err?.message || String(err);
  if (
    err?.name === 'TypeError' ||
    err?.name === 'SecurityError' ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('SecurityError')
  ) {
    return new Error('Không thể kết nối đến Gemini API (Vui lòng kiểm tra kết nối mạng hoặc chính sách CSP).');
  }
  return err instanceof Error ? err : new Error(String(err));
}

export async function executeGeminiFetch(
  url: string,
  apiKey: string,
  payload: Record<string, any>,
  signal?: AbortSignal
): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(payload),
    signal,
  });
}
