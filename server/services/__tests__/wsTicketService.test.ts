import { describe, it, expect, beforeEach } from "vitest";
import { generateWsTicket, verifyWsTicket } from "../wsTicketService";

describe("WebSocket Ticket Service (User Story 2 - IDOR Prevention)", () => {
  beforeEach(() => {
    process.env.WS_TICKET_SECRET = "super-secret-key-for-unit-tests-123456";
  });

  it("should generate a valid signed ticket and verify it successfully", () => {
    const ticket = generateWsTicket({
      projectId: "proj-123",
      chapterId: "chap-456",
      userEmail: "user@example.com",
    });

    expect(typeof ticket).toBe("string");
    expect(ticket).toContain(".");

    const result = verifyWsTicket(ticket);
    expect(result.valid).toBe(true);
    expect(result.payload).toBeDefined();
    expect(result.payload?.projectId).toBe("proj-123");
    expect(result.payload?.chapterId).toBe("chap-456");
    expect(result.payload?.userEmail).toBe("user@example.com");
  });

  it("should reject tampered tickets", () => {
    const ticket = generateWsTicket({
      projectId: "proj-123",
      chapterId: "chap-456",
      userEmail: "user@example.com",
    });

    const [dataStr, sig] = ticket.split(".");
    // Kẻ tấn công sửa dataStr để đổi projectId thành proj-999
    const fakePayload = JSON.parse(Buffer.from(dataStr, "base64url").toString("utf-8"));
    fakePayload.projectId = "proj-999";
    const forgedDataStr = Buffer.from(JSON.stringify(fakePayload)).toString("base64url");
    const tamperedTicket = `${forgedDataStr}.${sig}`;

    const result = verifyWsTicket(tamperedTicket);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Chữ ký ticket không hợp lệ");
  });

  it("should reject expired tickets", () => {
    // Cấp ticket với TTL -1 giây (đã hết hạn)
    const expiredTicket = generateWsTicket(
      {
        projectId: "proj-123",
        chapterId: "chap-456",
        userEmail: "user@example.com",
      },
      -1
    );

    const result = verifyWsTicket(expiredTicket);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Ticket đã hết hạn");
  });

  it("should reject malformed ticket strings", () => {
    expect(verifyWsTicket("").valid).toBe(false);
    expect(verifyWsTicket("invalid-string-without-dot").valid).toBe(false);
    expect(verifyWsTicket("part1.part2.part3").valid).toBe(false);
  });
});
