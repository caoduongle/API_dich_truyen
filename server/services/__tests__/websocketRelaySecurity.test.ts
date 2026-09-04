import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer, Server as HttpServer } from "http";
import WebSocket from "ws";
import { setupWebSocketRelay } from "../websocketRelayService";
import { generateWsTicket } from "../wsTicketService";

describe("WebSocket Relay Security Tests (T008)", () => {
  let server: HttpServer;
  let port: number;

  beforeAll(async () => {
    server = createServer();
    setupWebSocketRelay(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          port = addr.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function connectWs(queryString: string): Promise<{ ws?: WebSocket; statusCode?: number; error?: Error }> {
    return new Promise((resolve) => {
      const url = `ws://127.0.0.1:${port}/ws/sync${queryString}`;
      const client = new WebSocket(url);

      client.on("open", () => {
        resolve({ ws: client });
      });

      client.on("unexpected-response", (_req, res) => {
        resolve({ statusCode: res.statusCode });
      });

      client.on("error", (error) => {
        resolve({ error });
      });
    });
  }

  it("should reject connection when ticket is missing (HTTP 401 or 403)", async () => {
    const result = await connectWs("?projectId=proj_1&chapterId=chap_1");
    expect([401, 403]).toContain(result.statusCode);
  });

  it("should reject connection attempting bypass with ?collaborators= parameter without ticket", async () => {
    const collabs = encodeURIComponent(JSON.stringify([{ email: "attacker@evil.com" }]));
    const result = await connectWs(`?projectId=proj_1&chapterId=chap_1&collaborators=${collabs}`);
    expect([401, 403]).toContain(result.statusCode);
  });

  it("should reject connection with forged or tampered HMAC ticket (HTTP 403)", async () => {
    const fakeTicket = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmb28iOiJiYXIifQ.tampered_signature";
    const result = await connectWs(`?projectId=proj_1&chapterId=chap_1&ticket=${fakeTicket}`);
    expect(result.statusCode).toBe(403);
  });

  it("should reject connection when ticket projectId does not match query projectId", async () => {
    const ticket = generateWsTicket({
      projectId: "proj_authorized",
      chapterId: "chap_001",
      userEmail: "user@example.com",
    });

    const result = await connectWs(`?projectId=proj_ATTACKER&chapterId=chap_001&ticket=${ticket}`);
    expect(result.statusCode).toBe(403);
  });

  it("should reject connection when ticket chapterId does not match query chapterId", async () => {
    const ticket = generateWsTicket({
      projectId: "proj_authorized",
      chapterId: "chap_001",
      userEmail: "user@example.com",
    });

    const result = await connectWs(`?projectId=proj_authorized&chapterId=chap_DIFFERENT&ticket=${ticket}`);
    expect(result.statusCode).toBe(403);
  });

  it("should reject connection when projectId contains injection characters", async () => {
    const ticket = generateWsTicket({
      projectId: "proj_1",
      chapterId: "chap_1",
      userEmail: "user@example.com",
    });

    const result = await connectWs(`?projectId=${encodeURIComponent("proj' OR '1'='1")}&chapterId=chap_1&ticket=${ticket}`);
    expect(result.statusCode).toBe(400);
  });

  it("should accept connection with valid server-signed ticket and matching parameters", async () => {
    const ticket = generateWsTicket({
      projectId: "proj_valid_123",
      chapterId: "chap_valid_456",
      userEmail: "editor@example.com",
    });

    const result = await connectWs(`?projectId=proj_valid_123&chapterId=chap_valid_456&ticket=${ticket}`);
    expect(result.ws).toBeDefined();
    expect(result.ws?.readyState).toBe(WebSocket.OPEN);
    result.ws?.close();
  });
});
