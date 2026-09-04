import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import { Server } from "http";
import apiRouter from "../routes/api";
import { sessionStore } from "../services/sessionStore";
import { formatRedisChannel, isValidRoomId } from "../services/crdtRedisPubSub";
import { validateParameterizedQuery } from "../utils/dbSecurity";

describe("Input Sanitization & Injection Defense Suite (T012)", () => {
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
  });

  describe("Redis Session Token Sanitization & Regex Allowlist", () => {
    const maliciousTokens = [
      "session_123\r\nSET malicious_key pwned",
      "session_*\r\nKEYS *",
      "session_../../../etc/passwd",
      "session_' OR '1'='1",
      "session_not-a-valid-uuid",
      "session_12345678-1234-1234-1234-1234567890ab; FLUSHALL",
      "session_12345678-1234-1234-1234-1234567890ab\0extra",
    ];

    it("should reject malicious session tokens in getSessionKeyHashes", async () => {
      for (const token of maliciousTokens) {
        const result = await sessionStore.getSessionKeyHashes(token);
        expect(result).toBeNull();
      }
    });

    it("should reject malicious session tokens in deleteSession", async () => {
      for (const token of maliciousTokens) {
        const result = await sessionStore.deleteSession(token);
        expect(result).toBe(false);
      }
    });

    it("should reject malicious session tokens in getSessionInfo", async () => {
      for (const token of maliciousTokens) {
        const result = await sessionStore.getSessionInfo(token);
        expect(result.valid).toBe(false);
        expect(result.keyCount).toBe(0);
      }
    });

    it("GET /api/session-keys/status should return 400 when X-Session-Token is malformed or contains injection", async () => {
      const res = await fetch(`${baseUrl}/api/session-keys/status`, {
        headers: {
          "X-Session-Token": "session_*_KEYS_*",
        },
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("INVALID_SESSION_TOKEN");
    });

    it("DELETE /api/session-keys should return 400 when X-Session-Token is malformed or contains injection", async () => {
      const res = await fetch(`${baseUrl}/api/session-keys`, {
        method: "DELETE",
        headers: {
          "X-Session-Token": "session_' OR '1'='1",
        },
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe("INVALID_SESSION_TOKEN");
    });
  });

  describe("Redis Pub/Sub Channel & Room ID Allowlist", () => {
    const maliciousRoomIds = [
      "room\r\nPUBLISH admin_channel pwned",
      "room*wildcard",
      "room?glob",
      "room/../../path",
      "room' OR '1'='1",
      "room\0nullbyte",
    ];

    it("should detect invalid room IDs", () => {
      for (const roomId of maliciousRoomIds) {
        expect(isValidRoomId(roomId)).toBe(false);
      }
    });

    it("should throw error on formatRedisChannel when room ID is invalid", () => {
      for (const roomId of maliciousRoomIds) {
        expect(() => formatRedisChannel(roomId)).toThrow();
      }
    });

    it("should allow safe room IDs conforming to pattern", () => {
      const safeRoomIds = [
        "project_123_chapter_456",
        "proj_abc-xyz_chap_001",
        "room-test:123",
      ];
      for (const roomId of safeRoomIds) {
        expect(isValidRoomId(roomId)).toBe(true);
        expect(formatRedisChannel(roomId)).toBe(`crdt:room:${roomId}`);
      }
    });
  });

  describe("Database Parameterization & Prepared Statement Defense", () => {
    it("should validate that queries use parameter placeholders ($1, $2) rather than string interpolation", () => {
      const validQuery = {
        text: "SELECT * FROM chapters WHERE project_id = $1 AND id = $2",
        values: ["proj_123", "chap_456"],
      };

      const result = validateParameterizedQuery(validQuery.text, validQuery.values);
      expect(result.valid).toBe(true);
    });

    it("should reject raw queries with literal string quotes indicating unparameterized user input", () => {
      const dangerousQueries = [
        "SELECT * FROM users WHERE email = 'admin@example.com'",
        "SELECT * FROM projects WHERE id = 'proj_123' OR '1'='1'",
        "DELETE FROM sessions WHERE token = 'session_xyz'; DROP TABLE users;",
      ];

      for (const query of dangerousQueries) {
        const result = validateParameterizedQuery(query, []);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("unparameterized");
      }
    });
  });
});
