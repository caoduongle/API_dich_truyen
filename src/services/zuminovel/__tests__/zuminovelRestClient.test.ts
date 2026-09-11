import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZuminovelRestClient, ZuminovelApiError, ZuminovelNetworkError } from '../zuminovelRestClient';

describe('ZuminovelRestClient', () => {
  const client = new ZuminovelRestClient();
  const apiKey = 'zn_test_key';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists owned novels via GET /external/novels with the X-API-Key header', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: [{ id: '65f2...', title: 'Hào Môn Kinh Mộng', slug: 'hao-mon-kinh-mong' }],
      }),
    } as any);

    const novels = await client.listNovels(apiKey);

    expect(novels).toHaveLength(1);
    expect(novels[0].slug).toBe('hao-mon-kinh-mong');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://zuminovel.com/api/external/novels',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'X-API-Key': apiKey }),
      })
    );
  });

  it('lists chapters of a novel via GET /external/novels/{id_or_slug}/chapters', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        count: 1,
        data: [{ id: '67...', title: 'Chương 1: Khởi đầu mới', order: 1, status: 'published', isVIP: false, createdAt: '2026-04-10T00:00:00Z' }],
      }),
    } as any);

    const chapters = await client.listChapters(apiKey, 'hao-mon-kinh-mong');

    expect(chapters).toHaveLength(1);
    expect(chapters[0].order).toBe(1);
  });

  it('creates a chapter via POST /external/chapters with JSON body and correct headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'Chapter posted successfully',
        data: { id: '67b845c12...', slug: 'chuong-1', order: 1 },
      }),
    } as any);

    const result = await client.createChapter(apiKey, {
      novelSlug: 'hao-mon-kinh-mong',
      title: 'Chương 1',
      content: '<p>Nội dung</p>',
    });

    expect(result.id).toBe('67b845c12...');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://zuminovel.com/api/external/chapters',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-API-Key': apiKey, 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          novelSlug: 'hao-mon-kinh-mong',
          title: 'Chương 1',
          content: '<p>Nội dung</p>',
        }),
      })
    );
  });

  it('updates a chapter via PUT /external/chapters/{chapter_id} sending only changed fields', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, message: 'Chapter updated successfully', data: { id: '67...', title: 'New Title' } }),
    } as any);

    const result = await client.updateChapter(apiKey, '67...', { title: 'New Title' });

    expect(result.title).toBe('New Title');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://zuminovel.com/api/external/chapters/67...',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ title: 'New Title' }) })
    );
  });

  it('deletes a chapter via DELETE /external/chapters/{chapter_id}', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as any);

    await client.deleteChapter(apiKey, '67...');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://zuminovel.com/api/external/chapters/67...',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('uploads an image via POST /external/upload as multipart/form-data without a manual Content-Type', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { url: 'https://pub-abc.r2.dev/chapters/17150123.jpg', key: 'chapters/17150123.jpg' } }),
    } as any);

    const file = new File(['fake-bytes'], 'cover.jpg', { type: 'image/jpeg' });
    const result = await client.uploadImage(apiKey, file, 'chapters');

    expect(result.url).toContain('r2.dev');
    const callArgs = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(callArgs.method).toBe('POST');
    expect(callArgs.body).toBeInstanceOf(FormData);
    expect((callArgs.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('maps a documented error code (401 INVALID_API_KEY) to a friendly ZuminovelApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false, code: 'INVALID_API_KEY' }),
    } as any);

    await expect(client.listNovels('bad_key')).rejects.toMatchObject({
      name: 'ZuminovelApiError',
      status: 401,
      code: 'INVALID_API_KEY',
    });
    await expect(client.listNovels('bad_key')).rejects.toBeInstanceOf(ZuminovelApiError);
  });

  it('maps 429 TOO_MANY_REQUESTS with the documented rate-limit message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ success: false, code: 'TOO_MANY_REQUESTS' }),
    } as any);

    await expect(client.listNovels(apiKey)).rejects.toMatchObject({
      status: 429,
      message: expect.stringContaining('50 request/phút'),
    });
  });

  it('wraps a fetch-level failure (e.g. CORS block) as ZuminovelNetworkError, not ZuminovelApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(client.listNovels(apiKey)).rejects.toBeInstanceOf(ZuminovelNetworkError);
  });
});
