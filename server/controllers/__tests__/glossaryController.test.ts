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

describe("analyzeGlossary Controller", () => {
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

  it("should process multiple chunks successfully and return aggregated suggestions", async () => {
    // MAX_CHARS_FOR_GLOSSARY_ANALYSIS = 8000.
    // Line 1 (4000 chars) + Line 2 (5000 chars) -> split into exactly 2 chunks.
    const longText = "A".repeat(4000) + "\n" + "B".repeat(5000);

    req.body.text = longText;

    vi.mocked(geminiService.generateWithRotation)
      .mockResolvedValueOnce({ text: '{"suggestions": [{"chinese": "A", "vietnamese": "A_VN", "type": "character", "note": "Character A"}]}', successKeyIndex: 1 })
      .mockResolvedValueOnce({ text: '{"suggestions": [{"chinese": "B", "vietnamese": "B_VN", "type": "character", "note": "Character B"}]}', successKeyIndex: 0 });

    await analyzeGlossary(req as Request, res as Response);

    expect(geminiService.generateWithRotation).toHaveBeenCalledTimes(2);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestions: [
          expect.objectContaining({ chinese: "A", vietnamese: "A_VN" }),
          expect.objectContaining({ chinese: "B", vietnamese: "B_VN" }),
        ],
        successKeyIndex: 0,
        partialFailure: false,
        failedChunks: [],
        totalChunks: 2,
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

  it("should retry on overload error and succeed on second try", async () => {
    const longText = "A".repeat(4000) + "\n" + "B".repeat(5000);
    req.body.text = longText;

    // First call for chunk 1 fails with 503 (overload), retry succeeds.
    // Second call for chunk 2 succeeds immediately.
    vi.mocked(geminiService.generateWithRotation)
      // Chunk 1, try 1 (fail with 503)
      .mockRejectedValueOnce(new Error("503 overload"))
      // Chunk 1, try 2 (retry - succeeds)
      .mockResolvedValueOnce({ text: '{"suggestions": [{"chinese": "A", "vietnamese": "A_VN", "type": "character", "note": "A"}]}', successKeyIndex: 1 })
      // Chunk 2 (succeeds)
      .mockResolvedValueOnce({ text: '{"suggestions": [{"chinese": "B", "vietnamese": "B_VN", "type": "character", "note": "B"}]}', successKeyIndex: 0 });

    await analyzeGlossary(req as Request, res as Response);

    expect(geminiService.generateWithRotation).toHaveBeenCalledTimes(3);
    expect(geminiService.sleep).toHaveBeenCalledWith(750);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestions: [
          expect.objectContaining({ chinese: "A" }),
          expect.objectContaining({ chinese: "B" }),
        ],
        successKeyIndex: 0,
        partialFailure: false,
        failedChunks: [],
        totalChunks: 2,
      })
    );
  });

  it("should mark partial failure if chunk retry fails", async () => {
    const longText = "A".repeat(4000) + "\n" + "B".repeat(5000);
    req.body.text = longText;

    vi.mocked(geminiService.generateWithRotation)
      // Chunk 1 fails and its retry also fails (overload)
      .mockRejectedValueOnce(new Error("503 overload"))
      .mockRejectedValueOnce(new Error("503 overload"))
      // Chunk 2 succeeds
      .mockResolvedValueOnce({ text: '{"suggestions": [{"chinese": "B", "vietnamese": "B_VN", "type": "character", "note": "B"}]}', successKeyIndex: 0 });

    await analyzeGlossary(req as Request, res as Response);

    expect(geminiService.generateWithRotation).toHaveBeenCalledTimes(3);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestions: [
          expect.objectContaining({ chinese: "B" }),
        ],
        successKeyIndex: 0,
        partialFailure: true,
        failedChunks: [1], // 1-based index of failed chunk
        totalChunks: 2,
      })
    );
  });

  it("should mark partial failure on non-retryable error without retrying", async () => {
    const longText = "A".repeat(4000) + "\n" + "B".repeat(5000);
    req.body.text = longText;

    vi.mocked(geminiService.generateWithRotation)
      // Chunk 1 fails with non-retryable error (e.g. invalid config)
      .mockRejectedValueOnce(new Error("Some non-retryable error"))
      // Chunk 2 succeeds
      .mockResolvedValueOnce({ text: '{"suggestions": [{"chinese": "B", "vietnamese": "B_VN", "type": "character", "note": "B"}]}', successKeyIndex: 0 });

    await analyzeGlossary(req as Request, res as Response);

    // No retry for chunk 1, so only 2 calls total
    expect(geminiService.generateWithRotation).toHaveBeenCalledTimes(2);
    expect(geminiService.sleep).not.toHaveBeenCalled();
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestions: [
          expect.objectContaining({ chinese: "B" }),
        ],
        successKeyIndex: 0,
        partialFailure: true,
        failedChunks: [1],
        totalChunks: 2,
      })
    );
  });
});
