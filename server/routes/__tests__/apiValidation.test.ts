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

describe("API Request Body Validation Integration Tests", () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;
  const validApiKeys = ["AIzaSyValidMockKey1234567890123456789"];

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

  describe("POST /api/auth/login", () => {
    it("should return 400 if password is missing when auth is required", async () => {
      const { authStore } = await import("../../services/authStore");
      const spy = vi.spyOn(authStore, "isAuthRequired").mockReturnValue(true);

      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toContain("mật khẩu");

      spy.mockRestore();
    });
  });

  describe("POST /api/session-keys", () => {
    it("should return 400 if apiKeys is not an array", async () => {
      const res = await fetch(`${baseUrl}/api/session-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKeys: "invalid-string" }),
      });

      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toContain("phải là một mảng");
    });

    it("should return 400 if apiKeys array is empty", async () => {
      const res = await fetch(`${baseUrl}/api/session-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKeys: [] }),
      });

      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toContain("không được để trống");
    });

    it("should return 400 if apiKeys contains invalid blank string entries", async () => {
      const res = await fetch(`${baseUrl}/api/session-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKeys: ["   ", ""] }),
      });

      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toContain("không hợp lệ");
    });

    it("should return 400 if apiKeys exceeds limit of 20", async () => {
      const res = await fetch(`${baseUrl}/api/session-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKeys: Array(25).fill("AIzaSyTestKey") }),
      });

      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toContain("Quá nhiều API key");
    });
  });

  describe("POST /api/translate-raw", () => {
    it("should return 400 if text is missing or whitespace only", async () => {
      const res = await fetch(`${baseUrl}/api/translate-raw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "   ", apiKeys: validApiKeys }),
      });

      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toContain("Văn bản gốc");
    });
  });

  describe("POST /api/polish-translation", () => {
    it("should return 400 if rawTranslation is missing or whitespace only", async () => {
      const res = await fetch(`${baseUrl}/api/polish-translation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawTranslation: "   ", apiKeys: validApiKeys }),
      });

      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toContain("Bản dịch thô");
    });
  });

  describe("POST /api/qa-critique", () => {
    it("should return 400 if sourceText is missing", async () => {
      const res = await fetch(`${baseUrl}/api/qa-critique`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ translatedText: "Bản dịch tiếng Việt", apiKeys: validApiKeys }),
      });

      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toContain("Văn bản gốc");
    });

    it("should return 400 if translatedText is missing", async () => {
      const res = await fetch(`${baseUrl}/api/qa-critique`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: "Tiêu Viêm", apiKeys: validApiKeys }),
      });

      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toContain("Bản dịch");
    });
  });

  describe("POST /api/analyze-glossary", () => {
    it("should return 400 if text is empty", async () => {
      const res = await fetch(`${baseUrl}/api/analyze-glossary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "", apiKeys: validApiKeys }),
      });

      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toContain("Văn bản");
    });
  });

  describe("POST /api/analyze-guidelines", () => {
    it("should return 400 if content/text is empty", async () => {
      const res = await fetch(`${baseUrl}/api/analyze-guidelines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "", apiKeys: validApiKeys }),
      });

      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toContain("Nội dung cẩm nang");
    });
  });

  describe("POST /api/extract-glossary", () => {
    it("should return 400 if text is empty", async () => {
      const res = await fetch(`${baseUrl}/api/extract-glossary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "  ", apiKeys: validApiKeys }),
      });

      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toContain("Văn bản");
    });
  });

  describe("POST /api/quick-translate-term", () => {
    it("should return 400 if term is missing or empty", async () => {
      const res = await fetch(`${baseUrl}/api/quick-translate-term`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: "  ", apiKeys: validApiKeys }),
      });

      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toContain("Thuật ngữ");
    });
  });

  describe("POST /api/align-chapter", () => {
    it("should return 400 if sourceText or translatedText is missing", async () => {
      const res = await fetch(`${baseUrl}/api/align-chapter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: "萧炎", apiKeys: validApiKeys }),
      });

      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error).toContain("Văn bản dịch");
    });
  });
});
