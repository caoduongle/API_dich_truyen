import { describe, it, expect } from "vitest";
import express from "express";
import helmet from "helmet";
import { Server } from "http";

function createTestApp(isProduction: boolean) {
  const app = express();
  app.use(
    helmet({
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com", "https://accounts.google.com"],
              styleSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://fonts.googleapis.com"],
              fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
              imgSrc: ["'self'", "data:", "blob:", "https:", "*.googleusercontent.com"],
              connectSrc: [
                "'self'",
                "ws:",
                "wss:",
                "https://www.googleapis.com",
                "https://accounts.google.com",
                "https://content.googleapis.com",
                "https://oauth2.googleapis.com",
                "https://apis.google.com",
              ],
              frameSrc: [
                "https://drive.google.com",
                "https://docs.google.com",
                "https://accounts.google.com",
                "https://content.googleapis.com",
              ],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
    })
  );

  app.get("/test", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}

describe("Security Headers & CSP Configuration", () => {
  it("should set hardened CSP directives and COOP in production mode", async () => {
    const app = createTestApp(true);
    let server: Server;
    let baseUrl = "";

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });

    try {
      const res = await fetch(`${baseUrl}/test`);
      const csp = res.headers.get("content-security-policy");

      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com");
      expect(csp).toContain("style-src 'self' 'unsafe-inline' https://accounts.google.com https://fonts.googleapis.com");
      expect(csp).toContain("font-src 'self' https://fonts.gstatic.com data:");
      expect(csp).toContain("img-src 'self' data: blob: https: *.googleusercontent.com");
      expect(csp).toContain("connect-src 'self' ws: wss: https://www.googleapis.com https://accounts.google.com https://content.googleapis.com https://oauth2.googleapis.com https://apis.google.com");
      expect(csp).toContain("frame-src https://drive.google.com https://docs.google.com https://accounts.google.com https://content.googleapis.com");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
      expect(csp).toContain("frame-ancestors 'none'");

      // Cross-Origin-Opener-Policy for GIS popup and Google Picker support
      expect(res.headers.get("cross-origin-opener-policy")).toBe("same-origin-allow-popups");

      // Standard helmet headers
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("should disable CSP in development mode for Vite HMR while maintaining COOP", async () => {
    const app = createTestApp(false);
    let server: Server;
    let baseUrl = "";

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });

    try {
      const res = await fetch(`${baseUrl}/test`);
      const csp = res.headers.get("content-security-policy");

      expect(csp).toBeNull();
      // COOP still active in development
      expect(res.headers.get("cross-origin-opener-policy")).toBe("same-origin-allow-popups");
      // Other security headers still active
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
