import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import { analyzeGlossary } from "../glossaryController";
import * as geminiService from "../../services/geminiService.ts";
import { translationChunkCache } from "../../utils/chunkCache.ts";

vi.mock("../../services/geminiService.ts", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    generateWithRotation: vi.fn(),
    sleep: vi.fn(() => Promise.resolve()),
    isOverloadError: vi.fn((err: any) => err?.message?.includes("503") || false),
    isSafetyOrEmptyError: vi.fn((err: any) => actual.isSafetyOrEmptyError(err)),
  };
});

describe("analyzeGlossary Controller with Divide & Conquer", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: any;
  let statusMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(geminiService.generateWithRotation).mockReset();
    vi.mocked(geminiService.sleep).mockImplementation(() => Promise.resolve());
    vi.mocked(geminiService.isOverloadError).mockImplementation((err: any) => err?.message?.includes("503") || false);
    vi.mocked(geminiService.isSafetyOrEmptyError).mockImplementation((err: any) => err?.message?.includes("safety") || err?.name === "SafetyFilterError" || false);
    translationChunkCache.clear();
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    req = {
      body: {
        text: "This is a long text chunk 1.\nThis is chunk 2.\nThis is chunk 3.",
        apiKeys: ["key1", "key2"],
        model: "gemini-2.5-flash",
        startKeyIndex: 0,
      },
    };
    res = {
      status: statusMock,
      json: jsonMock,
    };
  });

  it("should process the entire text successfully when no error occurs", async () => {
    req.body.text = "Short text under 300 chars.";

    vi.mocked(geminiService.generateWithRotation)
      .mockResolvedValueOnce({ text: '{"suggestions": [{"chinese": "A", "vietnamese": "A_VN", "type": "character", "note": "Character A"}]}', successKeyIndex: 1 });

    await analyzeGlossary(req as Request, res as Response);

    expect(geminiService.generateWithRotation).toHaveBeenCalledTimes(1);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestions: [
          expect.objectContaining({ chinese: "A", vietnamese: "A_VN" }),
        ],
        successKeyIndex: 1,
      })
    );
  });

  it("should throw ALL_KEYS_EXHAUSTED error immediately", async () => {
    vi.mocked(geminiService.generateWithRotation).mockRejectedValueOnce(new Error("ALL_KEYS_EXHAUSTED: all keys failed"));

    await analyzeGlossary(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "ALL_KEYS_EXHAUSTED: all keys failed",
      })
    );
  });

  it("should trigger Divide & Conquer split when safety block error occurs on long text", async () => {
    const p1 = "萧炎看着面前的古老卷轴，心中掀起惊涛骇浪。".repeat(10);
    const p2 = "药老的身影从戒指中缓缓浮现，抚须微笑道。".repeat(10);
    const longText = p1 + "\n\n" + p2;

    req.body.text = longText;

    vi.mocked(geminiService.generateWithRotation)
      // First call fails with safety block
      .mockRejectedValueOnce(new Error("safety block error"))
      // Recursive call for part 1 succeeds
      .mockResolvedValueOnce({ text: '{"suggestions": [{"chinese": "萧炎", "vietnamese": "Tiêu Viêm", "type": "character", "note": "Nhân vật chính"}]}', successKeyIndex: 0 })
      // Recursive call for part 2 succeeds
      .mockResolvedValueOnce({ text: '{"suggestions": [{"chinese": "药老", "vietnamese": "Dược Lão", "type": "character", "note": "Sư phụ"}]}', successKeyIndex: 1 });

    await analyzeGlossary(req as Request, res as Response);

    // Should call once for full text, then once for part 1, once for part 2
    expect(geminiService.generateWithRotation).toHaveBeenCalledTimes(3);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestions: [
          expect.objectContaining({ chinese: "萧炎", vietnamese: "Tiêu Viêm" }),
          expect.objectContaining({ chinese: "药老", vietnamese: "Dược Lão" }),
        ],
        successKeyIndex: 1, // returns the successKeyIndex of the last recursive call
      })
    );
  });

  it("should bubble up non-safety general errors immediately without splitting", async () => {
    const p1 = "萧炎看着面前的古老卷轴，心中掀起惊涛骇浪。".repeat(10);
    const p2 = "药老的身影从戒指中缓缓浮现，抚须微笑道。".repeat(10);
    const longText = p1 + "\n\n" + p2;
    req.body.text = longText;

    vi.mocked(geminiService.generateWithRotation)
      .mockRejectedValueOnce(new Error("Some general API network failure"));

    await analyzeGlossary(req as Request, res as Response);

    expect(geminiService.generateWithRotation).toHaveBeenCalledTimes(1);
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Some general API network failure",
      })
    );
  });

  it("should gracefully recover if one leaf part fails and return suggestions from successful parts", async () => {
    const p1 = "萧炎看着面前的古老卷轴，心中掀起惊涛骇浪。".repeat(10);
    const p2 = "药老的身影从戒指中缓缓浮现，抚须微笑道。".repeat(10);
    const longText = p1 + "\n\n" + p2;

    req.body.text = longText;

    vi.mocked(geminiService.generateWithRotation)
      // First call fails with safety block
      .mockRejectedValueOnce(new Error("safety block error"))
      // Part 1 succeeds
      .mockResolvedValueOnce({ text: '{"suggestions": [{"chinese": "萧炎", "vietnamese": "Tiêu Viêm", "type": "character", "note": "Nhân vật chính"}]}', successKeyIndex: 0 })
      // Part 2 fails with safety block at leaf
      .mockRejectedValueOnce(new Error("safety block error at leaf"));

    await analyzeGlossary(req as Request, res as Response);

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestions: [
          expect.objectContaining({ chinese: "萧炎", vietnamese: "Tiêu Viêm" }),
        ],
      })
    );
  });

  it("should gracefully return empty suggestions if the entire text is blocked by safety filter", async () => {
    req.body.text = "Văn bản nhạy cảm bị chặn hoàn toàn bởi bộ lọc an toàn.";

    vi.mocked(geminiService.generateWithRotation)
      .mockRejectedValue(new geminiService.SafetyFilterError("safety block error"));

    await analyzeGlossary(req as Request, res as Response);

    expect(statusMock).not.toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestions: [],
      })
    );
  });
});
