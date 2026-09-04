import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { Server } from "http";

describe("API 404 Fallback Handler", () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    // Route có sẵn
    app.get("/api/ping", (_req, res) => {
      res.json({ pong: true });
    });

    // 404 handler cho mọi route /api/* không khớp
    app.all("/api/*", (req, res) => {
      res.status(404).json({
        error: "Not Found",
        message: `Đường dẫn API '${req.originalUrl}' không tồn tại trên hệ thống.`,
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
    });

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

  it("should respond normally to defined API routes", async () => {
    const res = await fetch(`${baseUrl}/api/ping`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pong).toBe(true);
  });

  it("should return JSON 404 for unmatched GET /api/* routes", async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent-endpoint`);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body.error).toBe("Not Found");
    expect(body.statusCode).toBe(404);
    expect(body.message).toContain("/api/nonexistent-endpoint");
  });

  it("should return JSON 404 for unmatched POST /api/* routes", async () => {
    const res = await fetch(`${baseUrl}/api/invalid-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unknown" }),
    });
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body.error).toBe("Not Found");
    expect(body.statusCode).toBe(404);
  });
});

