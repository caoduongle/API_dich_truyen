import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import { analyzeGlossary } from "../glossaryController";
import * as geminiService from "../../services/geminiService";

vi.mock("../../services/geminiService", () => {
  return {
    generateWithRotation: vi.fn(),
    sleep: vi.fn(() => Promise.resolve()),
    isOverloadError: vi.fn((err: any) => err.message && err.message.includes("503")),
  };
});

describe("analyzeGlossary Controller with Divide & Conquer", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: any;
  let statusMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.mocked(geminiService.generateWithRotation).mockRejectedValue(new Error("ALL_KEYS_EXHAUSTED: all keys failed"));

    await analyzeGlossary(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "ALL_KEYS_EXHAUSTED: all keys failed",
      })
    );
  });

  it("should trigger Divide & Conquer split when safety block error occurs on long text", async () => {
    // text length must be >= 300 chars to allow splitting
    const longText = "A".repeat(200) + "\n" + "B".repeat(200); // 401 chars

    req.body.text = longText;

    vi.mocked(geminiService.generateWithRotation)
      // First call fails with safety block
      .mockRejectedValueOnce(new Error("safety block error"))
      // Recursive call for part 1 succeeds
      .mockResolvedValueOnce({ text: '{"suggestions": [{"chinese": "A", "vietnamese": "A_VN", "type": "character", "note": "Character A"}]}', successKeyIndex: 0 })
      // Recursive call for part 2 succeeds
      .mockResolvedValueOnce({ text: '{"suggestions": [{"chinese": "B", "vietnamese": "B_VN", "type": "character", "note": "Character B"}]}', successKeyIndex: 1 });

    await analyzeGlossary(req as Request, res as Response);

    // Should call once for full text, then once for part 1, once for part 2
    expect(geminiService.generateWithRotation).toHaveBeenCalledTimes(3);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestions: [
          expect.objectContaining({ chinese: "A", vietnamese: "A_VN" }),
          expect.objectContaining({ chinese: "B", vietnamese: "B_VN" }),
        ],
        successKeyIndex: 1, // returns the successKeyIndex of the last recursive call
      })
    );
  });

  it("should bubble up non-safety general errors immediately without splitting", async () => {
    const longText = "A".repeat(200) + "\n" + "B".repeat(200); // 401 chars
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
});
