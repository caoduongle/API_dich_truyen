import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireVerifiedUser, AuthenticatedRequest } from "../authMiddleware";
import { projectAuthService } from "../../services/projectAuthService";
import * as relayService from "../../services/websocketRelayService";
import { Response } from "express";

describe("requireVerifiedUser Middleware & Project Access Suite (Feature 088)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    projectAuthService.clearMemoryStore();
  });

  describe("requireVerifiedUser middleware", () => {
    it("should return 401 if Authorization header is completely missing", async () => {
      const req = { headers: {} } as AuthenticatedRequest;
      const jsonMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
      const res = { status: statusMock } as unknown as Response;
      const next = vi.fn();

      await requireVerifiedUser(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ code: "UNAUTHORIZED" }));
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 if token verification fails", async () => {
      vi.spyOn(relayService, "verifyGoogleAccessToken").mockResolvedValue(null);

      const req = { headers: { authorization: "Bearer invalid_token" } } as AuthenticatedRequest;
      const jsonMock = vi.fn();
      const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
      const res = { status: statusMock } as unknown as Response;
      const next = vi.fn();

      await requireVerifiedUser(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ code: "INVALID_OR_EXPIRED_TOKEN" }));
      expect(next).not.toHaveBeenCalled();
    });

    it("should populate req.verifiedUser and call next() on valid token", async () => {
      vi.spyOn(relayService, "verifyGoogleAccessToken").mockResolvedValue({
        email: "editor@example.com",
        name: "Editor User",
        picture: "https://photo.jpg",
      });

      const req = { headers: { authorization: "Bearer valid_google_token" } } as AuthenticatedRequest;
      const res = {} as Response;
      const next = vi.fn();

      await requireVerifiedUser(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.verifiedUser).toBeDefined();
      expect(req.verifiedUser?.email).toBe("editor@example.com");
      expect(req.verifiedUser?.name).toBe("Editor User");
    });
  });

  describe("projectAuthService.verifyProjectAccess", () => {
    it("should grant owner access to the registered owner", async () => {
      await projectAuthService.setProjectAcl("proj_100", "author@domain.com", [
        { email: "editor@domain.com", role: "editor" },
      ]);

      const result = await projectAuthService.verifyProjectAccess("proj_100", "author@domain.com");
      expect(result.hasAccess).toBe(true);
      expect(result.isOwner).toBe(true);
      expect(result.role).toBe("owner");
    });

    it("should grant collaborator access to registered collaborator with correct role", async () => {
      await projectAuthService.setProjectAcl("proj_100", "author@domain.com", [
        { email: "editor@domain.com", role: "editor" },
        { email: "viewer@domain.com", role: "viewer" },
      ]);

      const editorResult = await projectAuthService.verifyProjectAccess("proj_100", "editor@domain.com");
      expect(editorResult.hasAccess).toBe(true);
      expect(editorResult.isOwner).toBe(false);
      expect(editorResult.role).toBe("editor");

      const viewerResult = await projectAuthService.verifyProjectAccess("proj_100", "viewer@domain.com");
      expect(viewerResult.hasAccess).toBe(true);
      expect(viewerResult.isOwner).toBe(false);
      expect(viewerResult.role).toBe("viewer");
    });

    it("should reject unauthorized user attempting IDOR access to registered project", async () => {
      await projectAuthService.setProjectAcl("proj_100", "author@domain.com", [
        { email: "editor@domain.com", role: "editor" },
      ]);

      const attackerResult = await projectAuthService.verifyProjectAccess("proj_100", "attacker@evil.com");
      expect(attackerResult.hasAccess).toBe(false);
      expect(attackerResult.role).toBeNull();
      expect(attackerResult.isOwner).toBe(false);
    });
  });
});
