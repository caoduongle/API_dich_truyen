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
  signal?: AbortSignal,
  timeoutMs: number = 60_000
): Promise<Response> {
  const controller = new AbortController();
  let isTimedOut = false;

  const timerId = setTimeout(() => {
    isTimedOut = true;
    controller.abort(
      new Error(`Yêu cầu tới Gemini API đã quá thời gian chờ (${Math.round(timeoutMs / 1000)}s).`)
    );
  }, timeoutMs);

  const onCallerAbort = () => {
    controller.abort(signal?.reason);
  };

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timerId);
      controller.abort(signal.reason);
    } else {
      signal.addEventListener('abort', onCallerAbort, { once: true });
    }
  }

  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (isTimedOut) {
      const timeoutError = new Error(
        `Yêu cầu tới Gemini API đã quá thời gian chờ (${Math.round(timeoutMs / 1000)}s).`
      );
      (timeoutError as any).name = 'TimeoutError';
      (timeoutError as any).code = 'ETIMEDOUT';
      throw timeoutError;
    }
    if (signal?.aborted) {
      throw err;
    }
    throw formatGeminiNetworkError(err);
  } finally {
    clearTimeout(timerId);
    if (signal) {
      signal.removeEventListener('abort', onCallerAbort);
    }
  }
}
