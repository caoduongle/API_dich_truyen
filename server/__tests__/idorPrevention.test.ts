import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import { Server } from "http";
import apiRouter from "../routes/api";
import { projectAuthService } from "../services/projectAuthService";
import * as relayService from "../services/websocketRelayService";
import { verifyWsTicket } from "../services/wsTicketService";

describe("IDOR / BOLA Prevention Integration Tests (T007)", () => {
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

  beforeEach(() => {
    vi.restoreAllMocks();
    projectAuthService.clearMemoryStore();
  });

  it("should return 401 when Authorization Bearer token is missing", async () => {
    const res = await fetch(`${baseUrl}/api/ws-ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: "proj_123", chapterId: "chap_456" }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("should return 401 when token verification fails with provider", async () => {
    vi.spyOn(relayService, "verifyGoogleAccessToken").mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/ws-ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer fake_or_expired_token",
      },
      body: JSON.stringify({ projectId: "proj_123", chapterId: "chap_456" }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("INVALID_OR_EXPIRED_TOKEN");
  });

  it("should return 400 when projectId or chapterId contains dangerous characters / injection", async () => {
    vi.spyOn(relayService, "verifyGoogleAccessToken").mockResolvedValue({
      email: "attacker@example.com",
      name: "Attacker",
    });

    const maliciousPayloads = [
      { projectId: "../../../etc/passwd", chapterId: "chap_1" },
      { projectId: "proj' OR '1'='1", chapterId: "chap_1" },
      { projectId: "proj_123", chapterId: "chap\r\nSET key val" },
      { projectId: "", chapterId: "chap_1" },
    ];

    for (const payload of maliciousPayloads) {
      const res = await fetch(`${baseUrl}/api/ws-ticket`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid_token",
        },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(400);
    }
  });

  it("should return 403 when authenticated user has no permission for target project (IDOR/BOLA)", async () => {
    // Project belongs to victim
    await projectAuthService.setProjectAcl("proj_secret_victim", "victim@example.com");

    // Attacker authenticates with their own valid token
    vi.spyOn(relayService, "verifyGoogleAccessToken").mockResolvedValue({
      email: "attacker@evil.com",
      name: "Attacker User",
    });

    const res = await fetch(`${baseUrl}/api/ws-ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer attacker_valid_token",
      },
      body: JSON.stringify({
        projectId: "proj_secret_victim",
        chapterId: "chap_001",
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("FORBIDDEN_PROJECT_ACCESS");
  });

  it("should ignore spoofed userEmail in body and strictly bind ticket to verified token identity", async () => {
    // Project belongs to victim
    await projectAuthService.setProjectAcl("proj_secret_victim", "victim@example.com");

    // Attacker is authenticated as attacker@evil.com but tries to impersonate victim@example.com in body
    vi.spyOn(relayService, "verifyGoogleAccessToken").mockResolvedValue({
      email: "attacker@evil.com",
      name: "Attacker User",
    });

    const res = await fetch(`${baseUrl}/api/ws-ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer attacker_valid_token",
      },
      body: JSON.stringify({
        projectId: "proj_secret_victim",
        chapterId: "chap_001",
        userEmail: "victim@example.com", // Spoofed parameter!
      }),
    });

    // Must be rejected because server uses req.verifiedUser, not req.body.userEmail
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("FORBIDDEN_PROJECT_ACCESS");
  });

  it("should issue valid ticket when verified user is the project owner", async () => {
    await projectAuthService.setProjectAcl("proj_legit_100", "translator@example.com");

    vi.spyOn(relayService, "verifyGoogleAccessToken").mockResolvedValue({
      email: "translator@example.com",
      name: "Legit Translator",
    });

    const res = await fetch(`${baseUrl}/api/ws-ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer translator_valid_token",
      },
      body: JSON.stringify({
        projectId: "proj_legit_100",
        chapterId: "chap_001",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.ticket).toBe("string");

    // Verify generated ticket payload
    const verification = verifyWsTicket(body.ticket);
    expect(verification.valid).toBe(true);
    expect(verification.payload?.userEmail).toBe("translator@example.com");
    expect(verification.payload?.projectId).toBe("proj_legit_100");
    expect(verification.payload?.chapterId).toBe("chap_001");
  });

  it("should issue valid ticket when verified user is an authorized collaborator", async () => {
    await projectAuthService.setProjectAcl(
      "proj_collab_200",
      "owner@example.com",
      [{ email: "assistant@example.com", role: "editor" }]
    );

    vi.spyOn(relayService, "verifyGoogleAccessToken").mockResolvedValue({
      email: "assistant@example.com",
      name: "Assistant Editor",
    });

    const res = await fetch(`${baseUrl}/api/ws-ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer assistant_valid_token",
      },
      body: JSON.stringify({
        projectId: "proj_collab_200",
        chapterId: "chap_005",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const verification = verifyWsTicket(body.ticket);
    expect(verification.valid).toBe(true);
    expect(verification.payload?.userEmail).toBe("assistant@example.com");
  });
});
