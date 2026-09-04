import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { assertNoLeakedSecretsInViteEnv } from "../config/env";

describe("Frontend Secret Leak Audit & Scanner (T016)", () => {
  const projectRoot = path.resolve(__dirname, "../..");
  const srcDir = path.join(projectRoot, "src");
  const envExamplePath = path.join(projectRoot, ".env.example");

  it("should enforce assertNoLeakedSecretsInViteEnv throws when sensitive keys use VITE_ prefix", () => {
    expect(() => {
      assertNoLeakedSecretsInViteEnv({
        VITE_SUPABASE_SERVICE_ROLE_KEY: "secret_12345",
      });
    }).toThrow(/CRITICAL SECURITY ALERT/);

    expect(() => {
      assertNoLeakedSecretsInViteEnv({
        VITE_ACCESS_PASSWORD: "admin_password",
      });
    }).toThrow(/CRITICAL SECURITY ALERT/);

    expect(() => {
      assertNoLeakedSecretsInViteEnv({
        VITE_WS_TICKET_SECRET: "my_secret_token",
      });
    }).toThrow(/CRITICAL SECURITY ALERT/);

    // Should not throw for normal client-safe env vars
    expect(() => {
      assertNoLeakedSecretsInViteEnv({
        VITE_GOOGLE_CLIENT_ID: "client_id.apps.googleusercontent.com",
      });
    }).not.toThrow();
  });

  it(".env.example must not expose any service role or private server keys with VITE_ prefix", () => {
    if (fs.existsSync(envExamplePath)) {
      const content = fs.readFileSync(envExamplePath, "utf-8");
      const lines = content.split("\n");

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;

        const [key] = trimmed.split("=");
        const upperKey = key.trim().toUpperCase();

        if (upperKey.startsWith("VITE_")) {
          // Verify that it is NOT a secret/admin/service-role key
          expect(upperKey).not.toContain("SERVICE_ROLE");
          expect(upperKey).not.toContain("SECRET");
          expect(upperKey).not.toContain("PASSWORD");
          expect(upperKey).not.toContain("PRIVATE");
        }
      }
    }
  });

  it("src directory files must not contain hardcoded service role or master keys", () => {
    function scanDir(dir: string): string[] {
      const files: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && entry.name !== ".git") {
            files.push(...scanDir(fullPath));
          }
        } else if (/\.(tsx?|jsx?|json|html|css)$/.test(entry.name) && !entry.name.includes(".test.")) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const clientFiles = scanDir(srcDir);
    const forbiddenPatterns = [
      /supabase_service_role/i,
      /service_role_key/i,
      /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/, // hardcoded JWT
      /AIzaSy[A-Za-z0-9_-]{33}/, // Real Google API Key format
    ];

    for (const filePath of clientFiles) {
      const content = fs.readFileSync(filePath, "utf-8");
      for (const pattern of forbiddenPatterns) {
        const match = content.match(pattern);
        if (match) {
          // Allow comments or mock test keys if any
          const relative = path.relative(projectRoot, filePath);
          throw new Error(`Potential secret leak found in ${relative}: ${match[0]}`);
        }
      }
    }
  });
});
