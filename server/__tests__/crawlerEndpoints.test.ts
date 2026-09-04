import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { Server } from "http";
import path from "path";
import fs from "fs";

describe("Crawler & AI Agent Endpoints (User Story 4)", () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    app = express();
    const publicDir = path.join(process.cwd(), "public");
    app.use(express.static(publicDir));

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

  it("should serve public/robots.txt with correct crawler rules and sitemap reference", async () => {
    const res = await fetch(`${baseUrl}/robots.txt`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("User-agent: *");
    expect(text).toContain("Allow: /");
    expect(text).toContain("Disallow: /api/");
    expect(text).toContain("Disallow: /ws/");
    expect(text).toContain("Sitemap:");
  });

  it("should serve public/sitemap.xml with valid XML structure and public routes", async () => {
    const res = await fetch(`${baseUrl}/sitemap.xml`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    expect(text).toContain("<urlset");
    expect(text).toContain("<loc>");
    expect(text).toContain("<lastmod>");
    expect(text).toContain("<changefreq>");
    expect(text).toContain("<priority>");
  });

  it("should serve public/llms.txt with AI context summary in Markdown", async () => {
    const res = await fetch(`${baseUrl}/llms.txt`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("# Bản Thảo Chu Sa - AI Dịch Truyện Trung - Việt");
    expect(text).toContain("Gemini");
    expect(text).toContain("/workspace");
    expect(text).toContain("/glossary");
  });

  it("should verify static files exist on disk in public/", () => {
    expect(fs.existsSync(path.join(process.cwd(), "public", "robots.txt"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "public", "sitemap.xml"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "public", "llms.txt"))).toBe(true);
  });
});
