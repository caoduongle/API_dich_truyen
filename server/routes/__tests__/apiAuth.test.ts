import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import express from "express";
import { Server } from "http";
import apiRouter from "../api";

vi.mock("../../services/geminiService", () => ({
  generateWithRotation: vi.fn().mockResolvedValue({
    text: JSON.stringify({ rawTranslation: "Bản dịch", polishedTranslation: "Bản dịch chuốt", suggestions: [], alignments: [] }),
    successKeyIndex: 0,
  }),
  sleep: vi.fn(),
  isOverloadError: vi.fn().mockReturnValue(false),
  isSafetyOrEmptyError: vi.fn().mockReturnValue(false),
}));

describe("API Key Requirement & Zero Fallback Tests", () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api", apiRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      if (server) server.close(() => resolve());
      else resolve();
    });
  });

  it("rejects /api/translate-raw with 400 and NO_PERSONAL_API_KEY_CONFIGURED when no apiKeys provided", async () => {
    const res = await fetch(`${baseUrl}/api/translate-raw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "第一章 测试内容",
        genre: "Tiên Hiệp",
        tone: "Trang nghiêm",
      }),
    });

    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("NO_PERSONAL_API_KEY_CONFIGURED");
    expect(body.error).toContain("Vui lòng cấu hình API key cá nhân");
  });

  it("rejects /api/polish-translation with 400 when apiKeys array is empty", async () => {
    const res = await fetch(`${baseUrl}/api/polish-translation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceText: "第一章",
        rawTranslation: "Chương 1",
        genre: "Tiên Hiệp",
        tone: "Trang nghiêm",
        apiKeys: [],
      }),
    });

    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("NO_PERSONAL_API_KEY_CONFIGURED");
  });

  it("rejects /api/analyze-glossary with 400 when no apiKeys provided", async () => {
    const res = await fetch(`${baseUrl}/api/analyze-glossary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "第一章 楚风",
      }),
    });

    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe("NO_PERSONAL_API_KEY_CONFIGURED");
  });

  it("allows request to pass middleware when valid apiKeys are provided", async () => {
    const res = await fetch(`${baseUrl}/api/translate-raw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "第一章 测试",
        genre: "Tiên Hiệp",
        tone: "Trang nghiêm",
        apiKeys: ["AIzaSyValidKey1234567890"],
        model: "gemini-2.5-flash",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rawTranslation).toBe("Bản dịch");
  });
});
