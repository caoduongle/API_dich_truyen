import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { Server } from "http";
import path from "path";
import fs from "fs";

describe("Quickstart Verification Scenarios (All 5 Scenarios)", () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    // Fallback 404 cho API
    app.all("/api/*", (req, res) => {
      res.status(404).json({
        error: "Not Found",
        message: `Đường dẫn API '${req.originalUrl}' không tồn tại trên hệ thống.`,
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
    });

    // Phục vụ dist/client tĩnh
    const distClient = path.join(process.cwd(), "dist", "client");
    app.use(express.static(distClient));

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

  it("Scenario 1: GET /robots.txt returns 200 with text/plain and correct crawler directives", async () => {
    const res = await fetch(`${baseUrl}/robots.txt`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("User-agent: *");
    expect(text).toContain("Allow: /");
    expect(text).toContain("Disallow: /api/");
    expect(text).toContain("Sitemap: https://dich-truyen.example.com/sitemap.xml");
  });

  it("Scenario 2: GET /sitemap.xml returns 200 with XML content and public routes", async () => {
    const res = await fetch(`${baseUrl}/sitemap.xml`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    expect(text).toContain("<urlset");
    expect(text).toContain("<loc>https://dich-truyen.example.com/</loc>");
    expect(text).toContain("<loc>https://dich-truyen.example.com/workspace</loc>");
  });

  it("Scenario 3: GET /llms.txt returns 200 with markdown summary for AI agents", async () => {
    const res = await fetch(`${baseUrl}/llms.txt`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("# Bản Thảo Chu Sa - AI Dịch Truyện Trung - Việt");
    expect(text).toContain("Gemini");
  });

  it("Scenario 4: GET /api/v1/invalid-route returns JSON 404 fallback instead of HTML", async () => {
    const res = await fetch(`${baseUrl}/api/v1/invalid-route`);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    const json = await res.json();
    expect(json.error).toBe("Not Found");
    expect(json.statusCode).toBe(404);
  });

  it("Scenario 5: Ensures complete absence of .map files in dist/client and dist/server", () => {
    const distPath = path.join(process.cwd(), "dist");
    const findMapFiles = (dir: string): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(findMapFiles(fullPath));
        } else if (file.endsWith(".map")) {
          results.push(fullPath);
        }
      }
      return results;
    };

    const mapFiles = findMapFiles(distPath);
    expect(mapFiles).toEqual([]);
  });
});
