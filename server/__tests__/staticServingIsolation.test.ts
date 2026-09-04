import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";

describe("Static Serving Isolation (User Story 1 - Pentest Hardening)", () => {
  it("should output client build into dist/client and server build into dist/server", () => {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    expect(pkg.scripts.build).toContain("--outfile=dist/server/server.cjs");
    expect(pkg.scripts.build).not.toContain("--sourcemap");
    expect(pkg.scripts.start).toBe("node dist/server/server.cjs");
  });

  it("should configure vite.config.ts to output client assets strictly to dist/client", () => {
    const viteConfigPath = path.join(process.cwd(), "vite.config.ts");
    const content = fs.readFileSync(viteConfigPath, "utf-8");

    expect(content).toContain("outDir: 'dist/client'");
    expect(content).toContain("emptyOutDir: true");
  });

  it("should ensure dist/client does not contain server.cjs binary", () => {
    const clientServerCjs = path.join(process.cwd(), "dist", "client", "server.cjs");
    expect(fs.existsSync(clientServerCjs)).toBe(false);

    const clientServerMap = path.join(process.cwd(), "dist", "client", "server.cjs.map");
    expect(fs.existsSync(clientServerMap)).toBe(false);
  });
});
