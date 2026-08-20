import { vi } from 'vitest';
import { Request, Response } from 'express';

export interface MockResponseOptions {
  onJson?: (body: any) => void;
  onStatus?: (statusCode: number) => void;
}

export function createMockRequest(options: {
  headers?: Record<string, string>;
  body?: any;
  method?: string;
  path?: string;
  baseUrl?: string;
  ip?: string;
} = {}): Request {
  const req = {
    headers: options.headers || {},
    body: options.body || {},
    method: options.method || 'POST',
    path: options.path || '/api/translate-raw',
    baseUrl: options.baseUrl || '',
    ip: options.ip || '127.0.0.1',
    socket: { remoteAddress: options.ip || '127.0.0.1' },
  } as unknown as Request;

  return req;
}

export function createMockResponse(options: MockResponseOptions = {}): {
  res: Response;
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  jsonMock: any;
  statusMock: any;
  setHeaderMock: any;
} {
  let capturedStatusCode = 200;
  let capturedBody: any = null;
  const capturedHeaders: Record<string, string> = {};

  const jsonMock = vi.fn().mockImplementation((b: any) => {
    capturedBody = b;
    if (options.onJson) options.onJson(b);
    return res;
  });

  const statusMock = vi.fn().mockImplementation((code: number) => {
    capturedStatusCode = code;
    if (options.onStatus) options.onStatus(code);
    return res;
  });

  const setHeaderMock = vi.fn().mockImplementation((name: string, value: string) => {
    capturedHeaders[name.toLowerCase()] = String(value);
    return res;
  });

  const res = {
    status: statusMock,
    json: jsonMock,
    setHeader: setHeaderMock,
    getHeader: (name: string) => capturedHeaders[name.toLowerCase()],
    get statusCode() {
      return capturedStatusCode;
    },
    set statusCode(code: number) {
      capturedStatusCode = code;
    },
  } as unknown as Response;

  return {
    res,
    get statusCode() {
      return capturedStatusCode;
    },
    headers: capturedHeaders,
    get body() {
      return capturedBody;
    },
    jsonMock,
    statusMock,
    setHeaderMock,
  };
}
